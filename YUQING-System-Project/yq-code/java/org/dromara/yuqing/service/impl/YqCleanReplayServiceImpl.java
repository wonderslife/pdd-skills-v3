package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;
import org.dromara.yuqing.collect.clean.CleanVerdict;
import org.dromara.yuqing.collect.clean.CrossChannelMerger;
import org.dromara.yuqing.collect.clean.NoiseCategory;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCleanBatch;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqCleanBatchMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.service.IYqCleanReplayService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 历史数据净化重跑实现（F-006 验收标准 3 / 6 / 7 / 8 / 9）。
 *
 * <p><b>为什么重跑要单独走一遍而不是改采集：</b>采集侧是「攒批写入 + 只增不改」，
 * 规则变更不可能回头改写历史分区；重跑必须是一等公民能力，而不是运维补丁。</p>
 *
 * <p><b>为什么不加 {@code @Transactional}：</b>{@code yq_opinion} 落在 Doris（另一数据源），
 * 批次台账落在 MySQL，两者无法共享本地事务；改成 XA 收益极低。这里用「逐条更新 + 失败即停」
 * 的显式补偿：中断时批次记录已落库并标记为 failed，重跑一次即可继续，不会出现半截脏数据被当成成功。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqCleanReplayServiceImpl implements IYqCleanReplayService {

    /** 单批最多处理条数兜底（配置缺失时的硬上限） */
    private static final int HARD_MAX_RECORDS = 500000;

    /** 每处理这么多条打一次进度日志 */
    private static final int PROGRESS_STEP = 2000;

    private final YqOpinionMapper opinionMapper;

    private final YqCleanBatchMapper cleanBatchMapper;

    private final NoiseEngine noiseEngine;

    private final YqCollectProperties props;

    @Override
    public CleanBatchStats preview(CleanBatchScope scope) {
        scope.assertValid();
        scope.setPreviewOnly(true);
        return run(scope);
    }

    @Override
    public CleanBatchStats execute(CleanBatchScope scope) {
        scope.assertValid();
        scope.setPreviewOnly(false);
        return run(scope);
    }

    private CleanBatchStats run(CleanBatchScope scope) {
        boolean preview = scope.isPreviewOnly();
        CleanBatchStats stats = new CleanBatchStats();
        stats.setPreviewOnly(preview);
        stats.setBatchName(resolveName(scope));
        long start = System.currentTimeMillis();
        try {
            List<YqOpinion> rows = load(scope);
            stats.setTotalCount(rows.size());
            if (!props.getClean().isEnabled()) {
                stats.setFailReason("净化开关已关闭（yuqing.collect.clean.enabled=false）");
                stats.setCleanedCount(rows.size());
                return finish(stats, scope, start);
            }
            // 按 (采集日, 链接) 分组：同组内保留首条，其余判为重复并合并渠道
            Map<String, List<YqOpinion>> groups = new LinkedHashMap<>();
            for (YqOpinion row : rows) {
                String key = CrossChannelMerger.dayKey(row.getCollectDate(), row.getUrlHash());
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
            }
            List<YqOpinion> dirty = new ArrayList<>();
            int index = 0;
            for (Map.Entry<String, List<YqOpinion>> entry : groups.entrySet()) {
                if (entry.getValue().size() > 1) {
                    int dup = entry.getValue().size() - 1;
                    stats.setDupCount(stats.getDupCount() + dup);
                }
                for (YqOpinion row : entry.getValue()) {
                    index++;
                    if (index % PROGRESS_STEP == 0) {
                        log.info("[净化重跑] 进度 {}/{}，{}", index, rows.size(), stats.summary());
                    }
                    CleanVerdict verdict = noiseEngine.evaluate(toRaw(row));
                    if (verdict.isRejected()) {
                        stats.incRejected(verdict.getCategory());
                    } else {
                        stats.setCleanedCount(stats.getCleanedCount() + 1);
                    }
                    if (apply(row, verdict)) {
                        dirty.add(row);
                    }
                }
            }
            if (!preview) {
                for (YqOpinion row : dirty) {
                    opinionMapper.updateById(row);
                }
                stats.setBatchId(persistBatch(scope, stats));
            }
            log.info("[净化重跑] {} {}", preview ? "预览" : "执行", stats.summary());
        } catch (Exception e) {
            stats.setFailReason(StringUtils.isBlank(e.getMessage()) ? e.getClass().getSimpleName() : e.getMessage());
            log.warn("[净化重跑] 批次异常: {}", e.getMessage());
            if (!preview) {
                stats.setBatchId(persistBatch(scope, stats));
            }
        }
        return finish(stats, scope, start);
    }

    /**
     * 把判定结论写回实体；只有真正发生变化才返回 true（避免无意义的 UPDATE）。
     */
    private boolean apply(YqOpinion row, CleanVerdict verdict) {
        boolean changed = false;
        if (!verdict.getCleanStatus().equals(row.getCleanStatus())) {
            row.setCleanStatus(verdict.getCleanStatus());
            changed = true;
        }
        String reason = verdict.getNoiseReason();
        if (!sameText(reason, row.getNoiseReason())) {
            row.setNoiseReason(reason);
            changed = true;
        }
        if (verdict.getPurifiedTitle() != null && !verdict.getPurifiedTitle().equals(row.getTitle())) {
            row.setTitle(verdict.getPurifiedTitle());
            changed = true;
        }
        if (verdict.getPurifiedContent() != null && !verdict.getPurifiedContent().equals(row.getContent())) {
            row.setContent(verdict.getPurifiedContent());
            changed = true;
        }
        row.setCleanTime(LocalDateTime.now());
        return changed;
    }

    /**
     * 载入范围内的舆情。
     *
     * <p>一律走 LambdaQueryWrapper，禁止拼接 SQL：范围参数全部来自前端请求体。</p>
     */
    private List<YqOpinion> load(CleanBatchScope scope) {
        LambdaQueryWrapper<YqOpinion> qw = new LambdaQueryWrapper<>();
        if (scope.getScopeTaskId() != null) {
            qw.eq(YqOpinion::getTaskId, scope.getScopeTaskId());
        }
        if (scope.getScopeChannelId() != null) {
            qw.eq(YqOpinion::getChannelId, scope.getScopeChannelId());
        }
        if (scope.getScopeStartDate() != null) {
            qw.ge(YqOpinion::getCollectDate, scope.getScopeStartDate());
        }
        if (scope.getScopeEndDate() != null) {
            qw.le(YqOpinion::getCollectDate, scope.getScopeEndDate());
        }
        if (!props.getClean().isReplayIncludeRejected()) {
            qw.ne(YqOpinion::getCleanStatus, CleanVerdict.REJECTED);
        }
        int limit = props.getClean().getMaxReplayRecords() > 0
            ? Math.min(props.getClean().getMaxReplayRecords(), HARD_MAX_RECORDS)
            : HARD_MAX_RECORDS;
        qw.last("limit " + limit);
        return opinionMapper.selectList(qw);
    }

    /**
     * 落一条批次记录（成功或失败都写，验收标准 9 的「执行结果记录」）。
     *
     * @return 批次ID
     */
    private Long persistBatch(CleanBatchScope scope, CleanBatchStats stats) {
        try {
            YqCleanBatch batch = new YqCleanBatch();
            batch.setBatchName(stats.getBatchName());
            batch.setBatchType(scope.getBatchType());
            batch.setScopeTaskId(scope.getScopeTaskId());
            batch.setScopeChannelId(scope.getScopeChannelId());
            batch.setScopeStartDate(scope.getScopeStartDate());
            batch.setScopeEndDate(scope.getScopeEndDate());
            batch.setTotalCount(stats.getTotalCount());
            batch.setCleanedCount(stats.getCleanedCount());
            batch.setRejectedCount(stats.getRejectedCount());
            batch.setDupCount(stats.getDupCount());
            batch.setDupChannelCount(stats.getDupChannelCount());
            batch.setNoiseSpam(stats.countOf(NoiseCategory.SPAM));
            batch.setNoiseAdvertisement(stats.countOf(NoiseCategory.ADVERTISEMENT));
            batch.setNoiseFlooding(stats.countOf(NoiseCategory.FLOODING));
            batch.setNoiseMeaningless(stats.countOf(NoiseCategory.MEANINGLESS));
            batch.setNoiseBot(stats.countOf(NoiseCategory.BOT));
            batch.setNoiseBlank(stats.countOf(NoiseCategory.BLANK));
            batch.setNoiseViolation(stats.countOf(NoiseCategory.VIOLATION));
            batch.setPreviewOnly(stats.isPreviewOnly() ? "1" : "0");
            batch.setStatus(StringUtils.isBlank(stats.getFailReason()) ? "success" : "failed");
            batch.setFailReason(stats.getFailReason());
            batch.setCostMs((int) Math.min(Integer.MAX_VALUE, stats.getCostMs()));
            cleanBatchMapper.insert(batch);
            return batch.getBatchId();
        } catch (Exception e) {
            log.warn("[净化重跑] 批次记录落库失败: {}", e.getMessage());
            return null;
        }
    }

    private CleanBatchStats finish(CleanBatchStats stats, CleanBatchScope scope, long start) {
        stats.setCostMs(System.currentTimeMillis() - start);
        return stats;
    }

    private static String resolveName(CleanBatchScope scope) {
        if (StringUtils.isNotBlank(scope.getBatchName())) {
            return scope.getBatchName();
        }
        LocalDate d = scope.getScopeStartDate();
        return "净化重跑-" + (d == null ? LocalDate.now() : d) + "-" + System.currentTimeMillis() % 100000L;
    }

    private static boolean sameText(String a, String b) {
        if (a == null && b == null) {
            return true;
        }
        return a != null && a.equals(b);
    }

    /**
     * 把已入库实体转成引擎入参。
     *
     * <p>只映射判定需要的字段：净化引擎不关心热度、研判状态等下游结果，
     * 少拷一个字段就少一处「改了但没同步」的隐患。</p>
     */
    private static RawOpinion toRaw(YqOpinion row) {
        RawOpinion raw = new RawOpinion();
        raw.setOpinionId(row.getOpinionId());
        raw.setCollectDate(row.getCollectDate());
        raw.setTaskId(row.getTaskId());
        raw.setChannelId(row.getChannelId());
        raw.setTitle(row.getTitle());
        raw.setContent(row.getContent());
        raw.setOpinionUrl(row.getOpinionUrl());
        raw.setUrlHash(row.getUrlHash());
        raw.setAuthor(row.getAuthor());
        raw.setDeviceInfo(row.getDeviceInfo());
        raw.setCollectTime(row.getCollectTime());
        return raw;
    }
}
