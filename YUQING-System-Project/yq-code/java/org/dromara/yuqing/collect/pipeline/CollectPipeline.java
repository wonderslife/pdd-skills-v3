package org.dromara.yuqing.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.adapter.AdapterContext;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.adapter.AdapterSpec;
import org.dromara.yuqing.collect.adapter.SiteAdapter;
import org.dromara.yuqing.collect.anti.BlockDetector;
import org.dromara.yuqing.collect.clean.CleanVerdict;
import org.dromara.yuqing.collect.clean.CrossChannelMerger;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.guard.CollectHealthGuard;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCollectLog;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 采集管道：抓取 → 解析 → 去重 → 快照 → 攒批落库 → 记录日志。
 *
 * <p>对齐《技术架构说明》§5.2 的 {@code Pipeline（清洗 → 去重 → 快照落 MinIO → 攒批 Stream Load 入 Doris）}；
 * 深度降噪与状态流转属 F-006 净化去重，本模块只做「无效内容剔除 + 链接去重 + 批次日志」。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CollectPipeline {

    private final YqCollectProperties props;

    private final AdapterRegistry adapterRegistry;

    private final UrlHashDeduplicator deduplicator;

    private final SnapshotStore snapshotStore;

    private final DorisStreamLoader sink;

    private final CollectMetrics metrics;

    private final BlockDetector blockDetector;

    private final CollectHealthGuard guard;

    /** 净化降噪引擎（F-006）；开关关闭时管线跳过净化，只做去重 */
    private final NoiseEngine noiseEngine;

    /**
     * 执行一个采集单元（一个任务 × 一个渠道）。
     *
     * @param unit 采集单元
     * @return 批次结果（同时写入采集日志）
     */
    public CollectResult run(CollectUnit unit) {
        CollectResult result = new CollectResult();
        result.setBatchNo(unit.getBatchNo());
        result.setTaskId(unit.getTaskId());
        result.setTaskName(unit.getTaskName());
        result.setChannelId(unit.getChannelId());
        result.setChannelName(unit.getChannelName());
        result.setStrategy(unit.getCollectStrategy());
        result.setCollectTime(LocalDateTime.now());
        long start = System.currentTimeMillis();
        try {
            if (!unit.dispatchable()) {
                result.addFailure(unit.getSkipReason());
            } else {
                doRun(unit, result);
            }
        } catch (Exception e) {
            result.addFailure(rootMessage(e));
            log.warn("[采集] 批次执行异常 batchNo={} task={} channel={}: {}",
                unit.getBatchNo(), unit.getTaskId(), unit.getChannelId(), rootMessage(e));
        } finally {
            result.setCostMs(System.currentTimeMillis() - start);
            result.settle();
            sink.appendLog(toLog(result));
            metrics.record(result);
            guard.evaluate(result);
        }
        return result;
    }

    private void doRun(CollectUnit unit, CollectResult result) throws Exception {
        AdapterSpec spec = adapterRegistry.spec(unit.getAdapterCode());
        SiteAdapter adapter = adapterRegistry.adapterFor(spec);
        AdapterContext context = new AdapterContext(unit.getBatchNo(),
            Math.max(1, props.getMaxRecordsPerBatch()),
            Math.max(1, Math.min(spec.maxPage(), props.getMaxPagesPerBatch())),
            unit.getWatermark());
        List<RawOpinion> fetched = adapter.fetch(unit, spec, context);
        result.setFetchedCount(fetched.size());
        List<RawOpinion> accepted = dedupeAndFilter(fetched, result, unit);
        result.setInsertedCount(accepted.size());
        // 攒批交由 sink 定时 / 定量触发，避免每批都刷写而失去攒批收益
        sink.appendOpinions(accepted);
    }

    /**
     * 原始数据落库 + 链接去重（PRD §6.2 的 {@code YqCollectService.saveRaw}）。
     *
     * <p>供「链接导入 F-005」「文件导入」等非爬虫入口复用同一条去重与落库链路。</p>
     *
     * @param unit    采集单元（提供任务/渠道/批次溯源信息）
     * @param rawList 原始舆情
     * @return 批次结果
     */
    public CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList) {
        CollectResult result = new CollectResult();
        result.setBatchNo(unit.getBatchNo());
        result.setTaskId(unit.getTaskId());
        result.setChannelId(unit.getChannelId());
        result.setStrategy(unit.getCollectStrategy());
        result.setCollectTime(LocalDateTime.now());
        long start = System.currentTimeMillis();
        try {
            List<RawOpinion> list = rawList == null ? List.of() : rawList;
            result.setFetchedCount(list.size());
            List<RawOpinion> accepted = dedupeAndFilter(list, result, unit);
            result.setInsertedCount(accepted.size());
            sink.appendOpinions(accepted);
        } catch (Exception e) {
            result.addFailure(rootMessage(e));
        } finally {
            result.setCostMs(System.currentTimeMillis() - start);
            result.settle();
            sink.appendLog(toLog(result));
            metrics.record(result);
            guard.evaluate(result);
        }
        return result;
    }

    /**
     * 归一化链接 → 关键词组合条件过滤 → 净化降噪（F-006）→ 跨批次去重 → 按天跨渠道合并 → 快照留存。
     *
     * <p><b>顺序有讲究：</b>关键词过滤最先（不匹配的条目不占用去重配额），
     * 净化降噪次之（脏数据不该消耗快照存储与写入配额），去重放最后——
     * 先去重再净化会让「首次进来被判垃圾、下次就不再进来」的错误永久化。</p>
     *
     * @param unit 采集单元（提供关键词匹配器）；为空或未配置关键词时不启用过滤
     */
    private List<RawOpinion> dedupeAndFilter(List<RawOpinion> fetched, CollectResult result, CollectUnit unit) {
        KeywordMatcher matcher = unit == null ? null : unit.getMatcher();
        boolean filtering = matcher != null && matcher.filterEnabled();
        boolean cleaning = props.getClean().isEnabled();
        LocalDate today = LocalDate.now();
        List<RawOpinion> candidates = new ArrayList<>(fetched.size());
        for (RawOpinion raw : fetched) {
            if (StringUtils.isBlank(raw.getOpinionUrl())) {
                continue;
            }
            String normalized = UrlNormalizer.normalize(raw.getOpinionUrl());
            raw.setOpinionUrl(normalized);
            String hash = UrlNormalizer.sha256(normalized);
            raw.setUrlHash(hash);
            /* 按天去重的分区键：采集日缺省时补今天，保证 (collect_date, url_hash) 永不为空 */
            if (raw.getCollectDate() == null) {
                raw.setCollectDate(today);
            }
            /* 关键词组合条件过滤（P0-1）：检索词只是「召回」，命中全部组且不含排除词才允许进 Doris。
               不通过的条目不占用去重配额，直接丢弃并计入降噪剔除（yq_collect_log.rejected_count）。 */
            if (filtering) {
                String keywordText = keywordText(raw);
                if (!matcher.accept(keywordText)) {
                    result.setRejectedCount(result.getRejectedCount() + 1);
                    result.setFilteredCount(result.getFilteredCount() + 1);
                    continue;
                }
                String hits = matcher.hitOf(keywordText);
                if (StringUtils.isNotBlank(hits)) {
                    raw.setHitKeywords(hits);
                }
            }
            if (cleaning) {
                /* F-006 净化降噪：正文标准化 + 七类规则判定，并回填三态清洗状态 */
                CleanVerdict verdict = noiseEngine.evaluate(raw);
                raw.setTitle(verdict.getPurifiedTitle());
                raw.setContent(verdict.getPurifiedContent());
                raw.setCleanStatus(verdict.getCleanStatus());
                raw.setNoiseReason(verdict.getNoiseReason());
                raw.setCleanTime(LocalDateTime.now());
                if (verdict.isRejected()) {
                    result.setRejectedCount(result.getRejectedCount() + 1);
                    continue;
                }
            } else if (blockDetector.looksLikeTrap(raw.getTitle(), 4) && blockDetector.looksLikeTrap(raw.getContent(), 10)) {
                // 净化开关关闭时的兜底：只挡空壳记录
                result.setRejectedCount(result.getRejectedCount() + 1);
                continue;
            }
            candidates.add(raw);
        }
        /* 按天跨渠道合并（验收标准 8）：同一 (采集日, 链接) 只保留首条，
           其余渠道ID补进首条的 dup_channel_ids 后再做跨批次去重。 */
        CrossChannelMerger.MergeOutcome merged = CrossChannelMerger.merge(candidates);
        result.setDupCount(result.getDupCount() + merged.getDupCount());
        result.setDupChannelCount(result.getDupChannelCount() + merged.getDupChannelCount());
        List<RawOpinion> accepted = new ArrayList<>(merged.getKeepers().size());
        for (RawOpinion keeper : merged.getKeepers()) {
            if (!deduplicator.firstSeen(keeper.getUrlHash())) {
                result.setDupCount(result.getDupCount() + 1);
                continue;
            }
            keeper.setSnapshotKey(snapshotStore.store(keeper));
            accepted.add(keeper);
        }
        return accepted;
    }

    /**
     * 关键词匹配用的文本：标题 + 正文 + 话题标签 + 发布地域。
     *
     * <p>把地域纳入匹配范围，组合表达式里的「地区组」才能对政务站内搜索结果生效
     * （这类站点常把地域放在独立字段而不是正文里）。</p>
     */
    private static String keywordText(RawOpinion raw) {
        StringBuilder sb = new StringBuilder();
        appendPart(sb, raw.getTitle());
        appendPart(sb, raw.getContent());
        appendPart(sb, raw.getTopicTags());
        appendPart(sb, raw.getRegion());
        return sb.toString();
    }

    private static void appendPart(StringBuilder sb, String part) {
        if (part != null && !part.isEmpty()) {
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(part);
        }
    }

    private void snapshotFlush() {
        try {
            sink.flushAll();
        } catch (Exception e) {
            log.debug("[采集] 收尾刷写失败: {}", e.getMessage());
        }
    }

    /**
     * 立即刷写攒批缓冲（供手动触发 / 关停前调用）。
     */
    public void flush() {
        snapshotFlush();
    }

    /**
     * 批次结果转采集日志（验收标准 10：任务、渠道、批次、结果、耗时、失败原因逐条记录）。
     *
     * @param result 批次结果
     * @return 日志实体
     */
    public YqCollectLog toLog(CollectResult result) {
        YqCollectLog row = new YqCollectLog();
        row.setTaskId(result.getTaskId());
        row.setChannelId(result.getChannelId());
        row.setBatchNo(result.getBatchNo());
        row.setCollectSource("auto");
        row.setStrategy(result.getStrategy());
        row.setFetchedCount(result.getFetchedCount());
        row.setInsertedCount(result.getInsertedCount());
        row.setDupCount(result.getDupCount());
        row.setRejectedCount(result.getRejectedCount());
        row.setFailedCount(result.getFailedCount());
        row.setCostMs((int) Math.min(Integer.MAX_VALUE, result.getCostMs()));
        row.setResultStatus(result.getResultStatus());
        row.setFailReason(result.getFailReason());
        row.setCreateTime(result.getCollectTime() == null ? LocalDateTime.now() : result.getCollectTime());
        return row;
    }

    /**
     * 提取异常根因信息。
     *
     * @param e 异常
     * @return 可读原因
     */
    public static String rootMessage(Throwable e) {
        Throwable cur = e;
        String message = e.getMessage();
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
            if (!StringUtils.isBlank(cur.getMessage())) {
                message = cur.getMessage();
            }
        }
        String type = e.getClass().getSimpleName();
        return StringUtils.isBlank(message) ? type : type + ": " + message;
    }
}
