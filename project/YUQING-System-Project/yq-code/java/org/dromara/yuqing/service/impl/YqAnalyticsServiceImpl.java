package org.dromara.yuqing.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.analytics.AggregateOutcome;
import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.AnalysisConclusion;
import org.dromara.yuqing.analytics.BatchMeta;
import org.dromara.yuqing.analytics.ConclusionExtractor;
import org.dromara.yuqing.analytics.DashboardAssembler;
import org.dromara.yuqing.analytics.DashboardInput;
import org.dromara.yuqing.analytics.DashboardView;
import org.dromara.yuqing.analytics.DerivedConclusionBuilder;
import org.dromara.yuqing.analytics.DimRow;
import org.dromara.yuqing.analytics.DimType;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.analytics.RankBy;
import org.dromara.yuqing.analytics.ReportHandoffBuilder;
import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.analytics.StatsAggregator;
import org.dromara.yuqing.analytics.StatsExportBuilder;
import org.dromara.yuqing.analytics.StatsExportRow;
import org.dromara.yuqing.analytics.StatsGrain;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;
import org.dromara.yuqing.analytics.jdbc.JdbcDrilldownReader;
import org.dromara.yuqing.analytics.jdbc.JdbcOpinionStatsReader;
import org.dromara.yuqing.analytics.jdbc.JdbcProcessMetricsReader;
import org.dromara.yuqing.analytics.jdbc.JdbcStatsQuery;
import org.dromara.yuqing.analytics.jdbc.JdbcStatsWriter;
import org.dromara.yuqing.analytics.jdbc.SliceLoad;
import org.dromara.yuqing.analytics.jdbc.StatsBatchLedger;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.service.IYqAnalyticsService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 多维分析服务实现（F-009）
 *
 * <p><b>跨库编排点（读这段就能理解整个 F-009 的数据流）：</b></p>
 * <ol>
 *   <li>明细与预聚合在 Doris；预警/推送台账、聚合批次在主库。两类库没有共享事务，
 *       所以本类只做「顺序调用 + 内存合并」，绝不试图在一个事务里跨库写；</li>
 *   <li>聚合路径：读 Doris 明细 → 纯函数聚合 → 读主库流程量 → 合并 → 写 Doris 预聚合 → 写主库批次台账。
 *       其中「写 Doris 成功、写台账失败」是允许的良性偏差：看板仍能读到数据，只是新鲜度标注会滞后；
 *       反之「台账标成功、Doris 写入失败」是不允许的，因此写 Doris 在前、标成功在后；</li>
 *   <li>查询路径：只读预聚合表；结论优先取批次落库的 JSON，取不到则用派生结论。</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqAnalyticsServiceImpl implements IYqAnalyticsService {

    private final YqAnalyticsProperties props;

    private final StatsAggregator aggregator;

    private final ConclusionExtractor conclusionExtractor;

    private final DerivedConclusionBuilder derivedConclusionBuilder;

    private final JdbcOpinionStatsReader opinionReader;

    private final JdbcProcessMetricsReader processReader;

    private final JdbcStatsWriter statsWriter;

    private final JdbcStatsQuery statsQuery;

    private final JdbcDrilldownReader drilldownReader;

    private final StatsBatchLedger ledger;

    /* ============================================================ 聚合 */

    @Override
    public AggregateSummary aggregate(AggregateRequest request) {
        AggregateSummary summary = new AggregateSummary();
        AggregateRequest req = request == null ? new AggregateRequest() : request;
        AggregateScope scope = new AggregateScope();
        scope.setDateFrom(req.getDateFrom());
        scope.setDateTo(req.getDateTo());
        scope.setTaskId(req.getTaskId());
        scope.setChannelId(req.getChannelId());
        scope.normalized(props.getMaxScopeDays());
        summary.setScopeText(scope.getDateFrom() + " ~ " + scope.getDateTo());

        if (!props.isEnabled()) {
            summary.setStatus("failed");
            summary.setFailReason("多维分析引擎已关闭（yuqing.analytics.enabled=false）");
            return summary;
        }

        String trigger = req.getTriggerType() == null || req.getTriggerType().isBlank()
            ? "manual" : req.getTriggerType();
        YqStatsBatch batch = ledger.begin(scope, trigger);
        summary.setBatchNo(batch.getBatchNo());
        long start = System.currentTimeMillis();
        try {
            // 1) 读 Doris 明细
            SliceLoad load = opinionReader.loadSlices(scope, props.getMaxSourceRecords());
            // 2) 纯函数聚合
            AggregateOutcome outcome = aggregator.aggregate(load.getSlices(), scope, load.isTruncated());
            // 3) 主库流程量（预警 / 推送）按日合并进 daily 行
            mergeProcessMetrics(scope, outcome);
            // 4) 结论（明细还在手里，此刻提炼才拿得到核心事件与传播路径）
            AnalysisConclusion conclusion = conclusionExtractor.extract(load.getSlices(), outcome.getDim());
            // 5) 数据截止时间
            LocalDateTime dataUntil = null;
            for (var s : load.getSlices()) {
                if (s.getPublishTime() != null && (dataUntil == null || s.getPublishTime().isAfter(dataUntil))) {
                    dataUntil = s.getPublishTime();
                }
            }
            // 6) 可选清理
            if (req.isPurge()) {
                int purged = statsWriter.purgeRange(scope.getDateFrom(), scope.getDateTo());
                outcome.notice("已先清理该范围旧聚合行 " + purged + " 行");
            }
            // 7) 写 Doris 预聚合（先写数据）
            statsWriter.write(outcome);
            // 8) 再标台账成功（含结论 JSON）
            ledger.success(batch, outcome, dataUntil, System.currentTimeMillis() - start,
                JsonUtils.toJsonString(conclusion));

            fill(summary, outcome, dataUntil, System.currentTimeMillis() - start);
            summary.setStatus("success");
            summary.setConclusionMode("batch");
            return summary;
        } catch (Exception e) {
            long cost = System.currentTimeMillis() - start;
            log.error("[F-009 聚合] 批次 {} 执行失败", batch.getBatchNo(), e);
            ledger.fail(batch, e, cost);
            summary.setStatus("failed");
            summary.setCostMs(cost);
            summary.setFailReason(String.valueOf(e.getMessage()));
            return summary;
        }
    }

    /**
     * 把主库的预警数 / 推送数按日合并进日聚合行
     *
     * <p>合并策略是「按日全量覆盖」而不是累加：Doris 的 daily 行由明细重算得出，
     * 流程量若累加，重跑一次就翻倍。</p>
     */
    private void mergeProcessMetrics(AggregateScope scope, AggregateOutcome outcome) {
        Map<LocalDate, int[]> metrics;
        try {
            metrics = processReader.load(scope.getDateFrom(), scope.getDateTo());
        } catch (Exception e) {
            // 流程量读不到不能拖垮整次聚合：主指标（舆情总量与分布）仍然有用
            log.warn("[F-009 聚合] 主库流程量读取失败，预警/推送列按 0 处理", e);
            outcome.notice("预警数与推送数读取失败，相关列已置零");
            return;
        }
        if (metrics.isEmpty()) {
            return;
        }
        for (var row : outcome.getDaily()) {
            int[] cell = metrics.get(row.getStatsDate());
            if (cell == null) {
                continue;
            }
            row.setAlertCount(cell[0]);
            row.setPushCount(cell[1]);
        }
    }

    private void fill(AggregateSummary summary, AggregateOutcome outcome, LocalDateTime dataUntil, long costMs) {
        summary.setSourceCount(outcome.getSourceCount());
        summary.setDailyRows(outcome.getDaily().size());
        summary.setDimRows(outcome.getDim().size());
        summary.setHotRows(outcome.getHot().size());
        summary.setCostMs(costMs);
        summary.setDataUntil(String.valueOf(dataUntil));
        summary.setNotices(new ArrayList<>(outcome.getNotices()));
    }

    /* ============================================================ 看板 */

    @Override
    public DashboardView dashboard(AggregateScope scope, String grain, String rankBy) {
        AggregateScope s = (scope == null ? new AggregateScope() : scope).normalized(props.getMaxScopeDays());
        StatsGrain g = StatsGrain.of(grain);
        RankBy r = RankBy.of(rankBy);

        BatchMeta meta = ledger.latestMeta();
        DashboardInput in = new DashboardInput();
        in.setScope(s);
        in.setGrain(g);
        in.setRankBy(r);
        in.setTrendBase(props.isTrendByPublishTime() ? "publish_time" : "collect_time");
        in.setBatch(meta);
        in.setDimTopN(props.getDimTopN());

        boolean aggregated = statsQuery.hasAggregated(s);
        if (!aggregated) {
            in.getNotices().add("该范围尚未生成预聚合数据，请先执行「看板重算」");
            DashboardView empty = DashboardAssembler.assemble(in);
            empty.setConclusionMode("none");
            return empty;
        }

        in.setDaily(statsQuery.queryTotals(s));
        List<DimRow> distributions = new ArrayList<>();
        for (DimType t : DimType.distributions()) {
            distributions.addAll(statsQuery.queryDistribution(s, t, StatsGrain.DAY));
        }
        in.setDistributions(distributions);
        in.setTrend(statsQuery.queryTrend(s, g));
        in.setHot(statsQuery.queryHot(s, r, hotLimit(s)));

        DashboardView view = DashboardAssembler.assemble(in);

        // 结论：优先用批次落库的结论；范围不一致时退化为派生结论
        AnalysisConclusion fromBatch = parseConclusion(meta);
        if (fromBatch != null && sameScope(meta, s)) {
            view.setConclusion(fromBatch);
            view.setConclusionMode("batch");
        } else {
            view.setConclusion(derivedConclusionBuilder.build(view));
            view.setConclusionMode("derived");
            if (fromBatch == null) {
                view.getNotices().add("最近一次成功聚合未产出结论，当前结论由预聚合数据推导");
            }
        }
        if (meta.isDegraded()) {
            view.getNotices().add("最近一次聚合执行失败：" + meta.getFailReason()
                + "，当前展示的是上一次成功聚合的结果");
        }
        return view;
    }

    /**
     * 热点行的读取上限
     *
     * <p>表里存的是「每天的 TopN」，跨日查询需要把范围内的天数都取回来再重排。
     * 上限用一个足够大的常数封顶，避免「范围选一年」时把几万行读回来。</p>
     */
    private int hotLimit(AggregateScope s) {
        int days = Math.max(1, s.spanDays());
        long need = (long) days * Math.max(1, props.getHotTopN());
        return (int) Math.min(Math.max(need, props.getHotTopN()), 20000L);
    }

    /**
     * 判断当前查询范围是否与批次范围一致
     *
     * <p>只有完全一致才能直接用批次结论：批次结论是按那一段明细提炼的，
     * 换一段范围还沿用就是张冠李戴。</p>
     */
    private boolean sameScope(BatchMeta meta, AggregateScope s) {
        if (meta == null || !meta.isAvailable()) {
            return false;
        }
        return String.valueOf(s.getDateFrom()).equals(meta.getBeginDate())
            && String.valueOf(s.getDateTo()).equals(meta.getEndDate());
    }

    private AnalysisConclusion parseConclusion(BatchMeta meta) {
        if (meta == null || meta.getConclusionJson() == null || meta.getConclusionJson().isBlank()) {
            return null;
        }
        try {
            return JsonUtils.parseObject(meta.getConclusionJson(), AnalysisConclusion.class);
        } catch (Exception e) {
            log.warn("[F-009 看板] 批次结论反序列化失败，回落派生结论", e);
            return null;
        }
    }

    /* ============================================================ 下钻 */

    @Override
    public DrilldownResult drilldown(DrilldownQuery query) {
        if (query == null || query.getDimType() == null) {
            throw new IllegalArgumentException("下钻条件不完整");
        }
        if (query.getScope() == null) {
            throw new IllegalArgumentException("下钻必须带时间范围");
        }
        query.getScope().normalized(props.getMaxScopeDays());
        query.paged(props.getMaxDrilldownPageSize());
        return drilldownReader.query(query);
    }

    /* ======================================================= 报告 / 导出 */

    @Override
    public ReportSection handoff(AggregateScope scope, String grain, String rankBy) {
        DashboardView view = dashboard(scope, grain, rankBy);
        String batchNo = view.getBatch() == null ? null : view.getBatch().getBatchNo();
        ReportSection section = ReportHandoffBuilder.build(view, batchNo);
        if (!"batch".equals(view.getConclusionMode())) {
            section.setMetrics(append(section.getMetrics(), "conclusionMode", view.getConclusionMode()));
        }
        return section;
    }

    private Map<String, Object> append(Map<String, Object> src, String key, Object value) {
        Map<String, Object> m = src == null ? new HashMap<>() : new HashMap<>(src);
        m.put(key, value);
        return m;
    }

    @Override
    public List<StatsExportRow> exportRows(AggregateScope scope, String grain, String rankBy) {
        DashboardView view = dashboard(scope, grain, rankBy);
        return StatsExportBuilder.build(view, props.getExportMaxRows());
    }

    @Override
    public List<YqStatsBatch> recentBatches(int limit) {
        return ledger.recent(limit);
    }
}
