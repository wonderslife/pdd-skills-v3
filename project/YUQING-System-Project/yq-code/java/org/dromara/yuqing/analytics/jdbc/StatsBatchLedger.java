package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.AggregateOutcome;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.BatchMeta;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.mapper.YqStatsBatchMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 聚合批次台账（主库 MySQL，F-009 验收标准 9）
 *
 * <p>台账承担两件事：
 * <ol>
 *   <li>留痕 —— 谁在什么时候补算了哪一段、耗时多少、有没有被截断；</li>
 *   <li>回退依据 —— 看板不直接读明细，而是读「最近一次成功批次」，</li>
 * </ol>
 * 因此聚合失败时看板依然可用，只是会显示上一批数据的截止时间。
 * <b>这条路径是本模块唯一允许「降级」的地方</b>：失败可见，但不影响主流程。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StatsBatchLedger {

    private final YqStatsBatchMapper statsBatchMapper;

    /**
     * 开启一个批次（状态 running）
     *
     * @param scope      范围
     * @param triggerType 触发方式 auto / manual / replay
     * @return 批次实体（已落库）
     */
    public YqStatsBatch begin(AggregateScope scope, String triggerType) {
        YqStatsBatch b = new YqStatsBatch();
        b.setBatchId(IdWorker.getId());
        b.setBatchNo("YQSTAT" + b.getBatchId());
        b.setBeginDate(scope.getDateFrom());
        b.setEndDate(scope.getDateTo());
        b.setTriggerType(triggerType == null || triggerType.isBlank() ? "auto" : triggerType);
        b.setStatus("running");
        b.setSourceCount(0);
        b.setDailyRows(0);
        b.setDimRows(0);
        b.setHotRows(0);
        b.setCostMs(0L);
        statsBatchMapper.insert(b);
        return b;
    }

    /**
     * 标记成功
     *
     * @param batch          批次
     * @param out            聚合产出
     * @param dataUntil      数据截止时间
     * @param costMs         耗时
     * @param conclusionJson 结构化结论 JSON（可为空）
     */
    public void success(YqStatsBatch batch, AggregateOutcome out, LocalDateTime dataUntil,
                        long costMs, String conclusionJson) {
        if (batch == null) {
            return;
        }
        batch.setStatus("success");
        batch.setSourceCount(out == null ? 0 : out.getSourceCount());
        batch.setDailyRows(out == null ? 0 : out.getDaily().size());
        batch.setDimRows(out == null ? 0 : out.getDim().size());
        batch.setHotRows(out == null ? 0 : out.getHot().size());
        batch.setCostMs(costMs);
        batch.setDataUntil(dataUntil);
        batch.setNotice(out == null ? null : out.noticeText());
        batch.setConclusionJson(conclusionJson);
        batch.setFailReason(null);
        statsBatchMapper.updateById(batch);
    }

    /**
     * 标记失败
     *
     * <p>失败原因截断到列宽以内：宁可丢尾部的堆栈，也不能让 update 因为超长而再抛一次异常，
     * 那会把真实的失败原因彻底盖掉。</p>
     */
    public void fail(YqStatsBatch batch, Throwable e, long costMs) {
        if (batch == null) {
            return;
        }
        batch.setStatus("failed");
        batch.setCostMs(costMs);
        batch.setFailReason(cut(e == null ? "未知错误" : String.valueOf(e.getMessage()), 900));
        statsBatchMapper.updateById(batch);
    }

    /**
     * 最近一次成功的批次 + 最近一次失败信息（用于看板降级提示）
     *
     * <p>降级判定用 batchId 比大小，而不是比时间字段：batchId 是雪花 ID 单调递增，
     * 而 createTime 依赖自动填充，手写数据或补算历史时可能出现时间倒挂。</p>
     */
    public BatchMeta latestMeta() {
        BatchMeta meta = new BatchMeta();
        Long successId = null;
        LambdaQueryWrapper<YqStatsBatch> ok = new LambdaQueryWrapper<>();
        ok.eq(YqStatsBatch::getStatus, "success");
        ok.orderByDesc(YqStatsBatch::getBatchId);
        ok.last("limit 1");
        List<YqStatsBatch> success = statsBatchMapper.selectList(ok);
        if (success != null && !success.isEmpty()) {
            YqStatsBatch b = success.get(0);
            successId = b.getBatchId();
            meta.setAvailable(true);
            meta.setBatchNo(b.getBatchNo());
            meta.setBeginDate(String.valueOf(b.getBeginDate()));
            meta.setEndDate(String.valueOf(b.getEndDate()));
            meta.setDataUntil(b.getDataUntil());
            meta.setAggregatedAt(b.getCreateTime());
            meta.setConclusionJson(b.getConclusionJson());
        }
        LambdaQueryWrapper<YqStatsBatch> bad = new LambdaQueryWrapper<>();
        bad.eq(YqStatsBatch::getStatus, "failed");
        bad.orderByDesc(YqStatsBatch::getBatchId);
        bad.last("limit 1");
        List<YqStatsBatch> failed = statsBatchMapper.selectList(bad);
        if (failed != null && !failed.isEmpty()) {
            YqStatsBatch b = failed.get(0);
            boolean newerThanSuccess = successId == null
                || (b.getBatchId() != null && b.getBatchId() > successId);
            if (newerThanSuccess) {
                meta.setDegraded(true);
                meta.setFailReason(b.getFailReason());
            }
        }
        return meta;
    }

    /**
     * 分页查批次台账（看板「聚合记录」抽屉用）
     */
    public List<YqStatsBatch> recent(int limit) {
        LambdaQueryWrapper<YqStatsBatch> lqw = new LambdaQueryWrapper<>();
        lqw.orderByDesc(YqStatsBatch::getBatchId);
        lqw.last("limit " + Math.max(1, Math.min(limit, 200)));
        return statsBatchMapper.selectList(lqw);
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
