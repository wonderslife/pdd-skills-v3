/**
 * F-009 多维分析 · 第 5 片：服务 + 控制器 + 定时任务 + 配置
 */
export const ANALYTICS_TPL5 = [

  /* ======================================================= 边界 DTO */
  {
    rel: 'analytics/AggregateRequest.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 聚合请求（F-009 验收标准 8 / 9 的手动触发入口）
 *
 * @author ruoyi
 */
@Data
public class AggregateRequest {

    /** 起始统计日 */
    private LocalDate dateFrom;

    /** 截止统计日 */
    private LocalDate dateTo;

    /** 任务ID（可选） */
    private Long taskId;

    /** 渠道ID（可选） */
    private Long channelId;

    /** 触发方式 auto / manual / replay */
    private String triggerType = "manual";

    /**
     * 是否先清理该范围的旧聚合行
     *
     * <p>默认 false。Doris 的 Unique Key 覆盖写已保证「写过的行不重复」，
     * 只有「某天明细被删后重算、残留旧聚合行」这种场景才需要先删。
     * 打开它会有一个短暂的看板空窗，所以要求显式指定。</p>
     */
    private boolean purge = false;
}
`,
  },
  {
    rel: 'analytics/AggregateSummary.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 聚合执行摘要（返回给触发方，也是定时任务日志的内容）
 *
 * @author ruoyi
 */
@Data
public class AggregateSummary {

    /** 批次号 */
    private String batchNo;

    /** 执行状态 running / success / failed */
    private String status;

    /** 统计范围 */
    private String scopeText;

    /** 读取明细条数 */
    private int sourceCount;

    /** 写入行数 */
    private int dailyRows;

    /** 写入维度行数 */
    private int dimRows;

    /** 写入热点行数 */
    private int hotRows;

    /** 耗时（毫秒） */
    private long costMs;

    /** 数据截止时间 */
    private String dataUntil;

    /** 结论来源 */
    private String conclusionMode;

    /** 非致命提示 */
    private List<String> notices = new ArrayList<>();

    /** 失败原因（失败时才有值） */
    private String failReason;

    /** 一句话总结（写日志用） */
    public String message() {
        if ("failed".equals(status)) {
            return "聚合失败：" + failReason;
        }
        return "范围 " + scopeText + "，明细 " + sourceCount + " 条，写入 daily " + dailyRows
            + " / dim " + dimRows + " / hot " + hotRows + " 行，耗时 " + costMs + "ms"
            + (notices.isEmpty() ? "" : "，提示：" + String.join("；", notices));
    }
}
`,
  },

  /* ======================================== 派生结论（无批次结论时兜底） */
  {
    rel: 'analytics/DerivedConclusionBuilder.java',
    content: `package org.dromara.yuqing.analytics;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 派生结论构建器
 *
 * <p><b>为什么需要它：</b>核心事件与传播路径必须从明细提炼，所以只有聚合任务
 * （明细在内存里的那一刻）才算得出来。可看板允许使用者自由改筛选条件，
 * 改完之后的组合几乎不可能正好等于某个历史批次。这时如果什么都不给，
 * 验收标准 5 的四类结论在看板上就有两块永远空着。</p>
 *
 * <p>于是分两条路：范围命中批次 → 用批次结论（{@code batch}）；
 * 否则用本类从预聚合数据推导（{@code derived}），给得出「舆论焦点」与「潜在风险点」，
 * 并在文字里说明核心事件与传播路径需要「按批次范围查看」。
 * <b>不硬凑</b>——宁可少两块，也不拿总量去编事件。</p>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
public class DerivedConclusionBuilder {

    private final YqAnalyticsProperties props;

    /**
     * 由预聚合结果推导结论
     *
     * @param view 已装配的看板视图（需要其中已填好的各维度卡片）
     * @return 结论（永远非空）
     */
    public AnalysisConclusion build(DashboardView view) {
        AnalysisConclusion c = new AnalysisConclusion();
        c.setGeneratedAt(LocalDateTime.now());
        TotalsView t = view == null ? null : view.getTotals();
        if (t == null || t.getTotalCount() == null || t.getTotalCount() == 0) {
            c.getNarrative().add("统计范围内无有效舆情数据。");
            c.setDurationHours(0L);
            c.setSpeedPerHour(0D);
            return c;
        }
        c.setClusterBased(false);
        c.setFocusPoints(focus(view));
        c.setRiskPoints(risks(view, t));
        peak(c, view);
        c.getNarrative().addAll(narrative(view, t, c));
        return c;
    }

    private List<FocusPoint> focus(DashboardView view) {
        List<FocusPoint> out = new ArrayList<>();
        out.addAll(convert(view.getTopic(), "topic"));
        out.addAll(convert(view.getRegion(), "region"));
        int cap = 10;
        return out.size() <= cap ? out : new ArrayList<>(out.subList(0, cap));
    }

    private List<FocusPoint> convert(List<DimItem> items, String kind) {
        List<FocusPoint> rows = new ArrayList<>();
        if (items == null) {
            return rows;
        }
        for (DimItem it : items) {
            FocusPoint p = new FocusPoint();
            p.setKind(kind);
            p.setKey(it.getDimKey());
            p.setLabel(it.getDimLabel());
            p.setOpinionCount(it.getOpinionCount());
            p.setShare(it.getShare());
            p.setNegativeRate(it.getNegativeRate());
            p.setHeatSum(it.getHeatSum());
            rows.add(p);
        }
        rows.sort(Comparator
            .comparingInt((FocusPoint p) -> p.getOpinionCount() == null ? 0 : p.getOpinionCount()).reversed()
            .thenComparing(p -> String.valueOf(p.getKey())));
        return rows.size() <= 5 ? rows : new ArrayList<>(rows.subList(0, 5));
    }

    private List<RiskPoint> risks(DashboardView view, TotalsView t) {
        List<RiskPoint> out = new ArrayList<>();
        int total = t.getTotalCount() == null ? 0 : t.getTotalCount();
        double negRate = t.getNegativeRate() == null ? 0D : t.getNegativeRate();
        if (negRate >= props.getRiskNegativeRate()) {
            double threshold = props.getRiskNegativeRate();
            RiskPoint r = new RiskPoint();
            r.setLevel(negRate >= threshold * 2D ? "high" : "medium");
            r.setType("负面占比偏高");
            r.setDetail("负面 " + t.getNegativeCount() + " 条，占总量 " + negRate + "%");
            r.setValue(negRate);
            r.setThreshold(threshold);
            out.add(r);
        }
        int severe = t.getHighRiskCount() == null ? 0 : t.getHighRiskCount();
        double severeRate = total == 0 ? 0D : DailyRow.round2(severe * 100D / total);
        if (severeRate >= props.getRiskSevereRate()) {
            RiskPoint r = new RiskPoint();
            r.setLevel(severeRate >= props.getRiskSevereRate() * 2D ? "high" : "medium");
            r.setType("高风险占比偏高");
            r.setDetail("严重级 " + severe + " 条，占总量 " + severeRate + "%");
            r.setValue(severeRate);
            r.setThreshold(props.getRiskSevereRate());
            out.add(r);
        }
        if (view.getTopic() != null) {
            for (DimItem it : view.getTopic()) {
                if (it.getNegativeRate() == null || it.getOpinionCount() == null) {
                    continue;
                }
                if (it.getNegativeRate() >= props.getRiskNegativeRate() + 20D && it.getOpinionCount() >= 3) {
                    RiskPoint r = new RiskPoint();
                    r.setLevel(it.getNegativeRate() >= 80D ? "high" : "medium");
                    r.setType("负面聚集话题");
                    r.setDetail("话题「" + it.getDimLabel() + "」共 " + it.getOpinionCount() + " 条，负面占 "
                        + it.getNegativeRate() + "%");
                    r.setValue(it.getNegativeRate());
                    r.setThreshold(props.getRiskNegativeRate() + 20D);
                    r.setTarget(it.getDimKey());
                    out.add(r);
                    break;
                }
            }
        }
        if (view.getTrend() != null && view.getTrend().size() >= 2) {
            int peak = 0;
            int sum = 0;
            String peakKey = null;
            for (DimItem it : view.getTrend()) {
                int n = it.getOpinionCount() == null ? 0 : it.getOpinionCount();
                sum += n;
                if (n > peak) {
                    peak = n;
                    peakKey = it.getDimKey();
                }
            }
            double avg = sum / (double) view.getTrend().size();
            double ratio = avg <= 0 ? 0D : DailyRow.round2(peak / avg);
            if (ratio >= 3D) {
                RiskPoint r = new RiskPoint();
                r.setLevel(ratio >= 5D ? "high" : "medium");
                r.setType("时段量突增");
                r.setDetail("峰值时段 " + peakKey + " 共 " + peak + " 条，为均值的 " + ratio + " 倍");
                r.setValue(ratio);
                r.setThreshold(3D);
                r.setTarget(peakKey);
                out.add(r);
            }
        }
        out.sort((a, b) -> {
            int c1 = Integer.compare(rank(b.getLevel()), rank(a.getLevel()));
            if (c1 != 0) {
                return c1;
            }
            return Double.compare(dbl(b.getValue()), dbl(a.getValue()));
        });
        return out.size() <= 5 ? out : new ArrayList<>(out.subList(0, 5));
    }

    private void peak(AnalysisConclusion c, DashboardView view) {
        String grain = view.getGrain();
        if (!StatsGrain.HOUR.getCode().equals(grain) || view.getTrend() == null) {
            return;
        }
        DimItem best = null;
        for (DimItem it : view.getTrend()) {
            if (best == null || nz(it.getOpinionCount()) > nz(best.getOpinionCount())) {
                best = it;
            }
        }
        if (best != null) {
            c.setPeakBucket(best.getDimKey());
            c.setPeakCount(best.getOpinionCount());
        }
    }

    private List<String> narrative(DashboardView view, TotalsView t, AnalysisConclusion c) {
        List<String> lines = new ArrayList<>();
        lines.add("统计范围内共采集舆情 " + t.getTotalCount() + " 条，其中正面 " + t.getPositiveCount()
            + " 条、中性 " + t.getNeutralCount() + " 条、负面 " + t.getNegativeCount()
            + " 条（负面占比 " + t.getNegativeRate() + "%）。");
        if (view.getPlatform() != null && !view.getPlatform().isEmpty()) {
            DimItem top = view.getPlatform().get(0);
            lines.add("主要来源平台为 " + top.getDimLabel() + "，共 " + top.getOpinionCount()
                + " 条，占本范围的 " + top.getShare() + "%。");
        }
        if (view.getRegion() != null && !view.getRegion().isEmpty()) {
            DimItem top = view.getRegion().get(0);
            lines.add("地域分布上 " + top.getDimLabel() + " 最集中，共 " + top.getOpinionCount()
                + " 条，占 " + top.getShare() + "%。");
        }
        if (cover(view.getTopic())) {
            DimItem top = view.getTopic().get(0);
            lines.add("舆论焦点集中在话题「" + top.getDimLabel() + "」，共 " + top.getOpinionCount()
                + " 条，负面占比 " + top.getNegativeRate() + "%。");
        }
        lines.add("互动数据：阅读 " + t.getReadSum() + "、评论 " + t.getCommentSum()
            + "、转发 " + t.getShareSum() + "、点赞 " + t.getLikeSum()
            + "，互动合计 " + t.getInteractionSum() + "。");
        if (c.getRiskPoints().isEmpty()) {
            lines.add("未触发潜在风险阈值。");
        } else {
            for (RiskPoint r : c.getRiskPoints()) {
                lines.add("风险[" + levelCn(r.getLevel()) + "] " + r.getType() + "：" + r.getDetail());
            }
        }
        lines.add("说明：当前筛选条件与最近一次聚合批次的范围不一致，因此本结论由预聚合数据推导，"
            + "不含「核心舆情事件」与「传播路径」——这两项需要按批次范围（通常是定时的整日范围）查看。");
        return lines;
    }

    private static boolean cover(List<DimItem> list) {
        return list != null && !list.isEmpty();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static double dbl(Double v) {
        return v == null ? 0D : v;
    }

    private static int rank(String level) {
        if ("high".equals(level)) {
            return 3;
        }
        if ("medium".equals(level)) {
            return 2;
        }
        return 1;
    }

    private static String levelCn(String level) {
        if ("high".equals(level)) {
            return "高";
        }
        if ("medium".equals(level)) {
            return "中";
        }
        return "低";
    }
}
`,
  },

  /* ============================================================== 配置 */
  {
    rel: 'analytics/config/YqAnalyticsConfig.java',
    content: `package org.dromara.yuqing.analytics.config;

import org.dromara.yuqing.analytics.ConclusionExtractor;
import org.dromara.yuqing.analytics.DerivedConclusionBuilder;
import org.dromara.yuqing.analytics.StatsAggregator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 多维分析引擎装配
 *
 * <p>聚合器与结论提炼器刻意做成普通对象而不是 {@code @Component}：
 * 它们不依赖容器（没有数据库、没有事务、没有请求上下文），
 * 这样离线自测可以直接 {@code new}，不用起 Spring。</p>
 *
 * @author ruoyi
 */
@Configuration
public class YqAnalyticsConfig {

    /**
     * 聚合器
     */
    @Bean
    public StatsAggregator statsAggregator(YqAnalyticsProperties properties) {
        return new StatsAggregator(properties);
    }

    /**
     * 明细口径结论提炼器
     */
    @Bean
    public ConclusionExtractor conclusionExtractor(YqAnalyticsProperties properties) {
        return new ConclusionExtractor(properties);
    }

    /**
     * 预聚合口径派生结论构建器
     */
    @Bean
    public DerivedConclusionBuilder derivedConclusionBuilder(YqAnalyticsProperties properties) {
        return new DerivedConclusionBuilder(properties);
    }
}
`,
  },

  /* ============================================================== 服务 */
  {
    rel: 'service/IYqAnalyticsService.java',
    content: `package org.dromara.yuqing.service;

import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.DashboardView;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.analytics.StatsExportRow;
import org.dromara.yuqing.domain.YqStatsBatch;

import java.util.List;

/**
 * 多维分析服务（F-009）
 *
 * @author ruoyi
 */
public interface IYqAnalyticsService {

    /**
     * 执行预聚合
     *
     * @param request 聚合请求
     * @return 执行摘要
     */
    AggregateSummary aggregate(AggregateRequest request);

    /**
     * 看板查询（读预聚合表）
     *
     * @param scope  范围
     * @param grain  时间粒度
     * @param rankBy 热点排序口径
     * @return 看板视图
     */
    DashboardView dashboard(AggregateScope scope, String grain, String rankBy);

    /**
     * 下钻明细
     */
    DrilldownResult drilldown(DrilldownQuery query);

    /**
     * 构建报告章节交接包
     */
    ReportSection handoff(AggregateScope scope, String grain, String rankBy);

    /**
     * 构建导出数据
     */
    List<StatsExportRow> exportRows(AggregateScope scope, String grain, String rankBy);

    /**
     * 最近聚合批次台账
     */
    List<YqStatsBatch> recentBatches(int limit);
}
`,
  },
  {
    rel: 'service/impl/YqAnalyticsServiceImpl.java',
    content: `package org.dromara.yuqing.service.impl;

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
`,
  },

  /* ============================================================ 控制器 */
  {
    rel: 'controller/YqAnalyticsController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.DashboardView;
import org.dromara.yuqing.analytics.DimType;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.analytics.RankBy;
import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.analytics.StatsExportRow;
import org.dromara.yuqing.analytics.StatsGrain;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.service.IYqAnalyticsService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 多维分析看板控制器（F-009）
 *
 * <p><b>权限：</b>读接口统一 {@code yuqing:dashboard:list}（菜单已配该权限）；
 * 重算接口 {@code yuqing:dashboard:aggregate}；导出接口 {@code yuqing:dashboard:export}。</p>
 *
 * <p><b>安全：</b>身份与数据范围一律来自 Sa-Token 上下文，请求参数只参与查询条件构造；
 * 不存在「前端传 taskId 就绕过权限」的路径 —— 本模块不做数据行级鉴权（按需求，舆情台账
 * 对所有有权限的角色可见），因此这里不引入越权面。</p>
 *
 * @author ruoyi
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/analytics")
public class YqAnalyticsController extends BaseController {

    private final IYqAnalyticsService analyticsService;

    /**
     * 看板数据
     *
     * @param dateFrom 起始统计日 yyyy-MM-dd
     * @param dateTo   截止统计日 yyyy-MM-dd
     * @param taskId   任务ID
     * @param channelId 渠道ID
     * @param sentiAttr 舆情属性
     * @param riskLevel 风险等级
     * @param opinionLevel 舆情分级
     * @param spreadLevel 传播量级
     * @param grain    时间粒度 hour / day / week
     * @param rankBy   热点排序口径 read / share / comment / heat
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/dashboard")
    public R<DashboardView> dashboard(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        return R.ok(analyticsService.dashboard(scope, grain, rankBy));
    }

    /**
     * 下钻明细（F-009 验收标准 6）
     *
     * @param dimType  维度类型，见 {@link DimType}
     * @param dimKey   维度取值
     * @param dimLabel 展示名
     * @param grain    当前粒度（趋势行下钻用）
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/drilldown")
    public R<DrilldownResult> drilldown(
        @RequestParam String dimType,
        @RequestParam(required = false) String dimKey,
        @RequestParam(required = false) String dimLabel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) Long opinionId,
        @RequestParam(required = false, defaultValue = "1") Integer pageNum,
        @RequestParam(required = false, defaultValue = "20") Integer pageSize,
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel) {
        DimType type = DimType.of(dimType);
        if (type == null) {
            return R.fail("不支持的维度类型：" + dimType);
        }
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        DrilldownQuery q = DrilldownQuery.of(scope, type, dimKey, dimLabel, StatsGrain.of(grain));
        if (q == null) {
            return R.fail("维度取值无法解析，请刷新看板后重试");
        }
        if (opinionId != null) {
            q.setOpinionId(opinionId);
        }
        q.setPageNum(pageNum == null ? 1 : pageNum);
        q.setPageSize(pageSize == null ? 20 : pageSize);
        return R.ok(analyticsService.drilldown(q));
    }

    /**
     * 报告章节交接包（F-009 验收标准 7）
     *
     * <p>返回的是「自描述数据包」，F-014 报告生成直接消费，不用反向调用本模块。</p>
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/handoff")
    public R<ReportSection> handoff(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        return R.ok(analyticsService.handoff(scope, grain, rankBy));
    }

    /**
     * 手动重算 / 补算历史（F-009 验收标准 8 / 9）
     */
    @SaCheckPermission("yuqing:dashboard:aggregate")
    @PostMapping("/aggregate")
    public R<AggregateSummary> aggregate(@RequestBody(required = false) AggregateRequest request) {
        return R.ok(analyticsService.aggregate(request));
    }

    /**
     * 聚合批次台账
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/batches")
    public R<List<YqStatsBatch>> batches(@RequestParam(required = false, defaultValue = "20") Integer limit) {
        return R.ok(analyticsService.recentBatches(limit == null ? 20 : limit));
    }

    /**
     * 导出 Excel（F-009 验收标准 10）
     *
     * <p>长表结构（指标区块 / 维度 / 取值 / 数值 / 占比 / 说明），
     * 七类指标齐在一张 sheet 里，下游做透视比多 sheet 更顺手。</p>
     */
    @SaCheckPermission("yuqing:dashboard:export")
    @PostMapping("/export")
    public void export(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy,
        HttpServletResponse response) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        List<StatsExportRow> rows = analyticsService.exportRows(scope, grain, rankBy);
        ExcelBuilder.of(rows, StatsExportRow.class)
            .sheetName("多维分析")
            .toResponse(response);
    }

    /**
     * 组装范围条件
     *
     * <p>日期解析失败一律忽略该条件（回落默认范围），不抛 500：
     * 看板裸 URL 打开也要能用。</p>
     */
    private AggregateScope buildScope(String dateFrom, String dateTo, Long taskId, Long channelId,
                                     String sentiAttr, String riskLevel,
                                     String opinionLevel, String spreadLevel) {
        AggregateScope scope = new AggregateScope();
        scope.setDateFrom(parseDate(dateFrom));
        scope.setDateTo(parseDate(dateTo));
        scope.setTaskId(taskId);
        scope.setChannelId(channelId);
        scope.setSentiAttr(sentiAttr);
        scope.setRiskLevel(riskLevel);
        scope.setOpinionLevel(opinionLevel);
        scope.setSpreadLevel(spreadLevel);
        return scope;
    }

    private java.time.LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(v.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
`,
  },

  /* ========================================================== 定时任务 */
  {
    rel: 'job/YqStatsAggregateJobExecutor.java',
    content: `package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;
import org.dromara.yuqing.service.IYqAnalyticsService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 多维分析预聚合定时任务（SnailJob，F-009 验收标准 8 / 9）
 *
 * <p>在 SnailJob 控制台创建执行器名 {@code yuqingStatsAggregate}，建议每日 02:10 执行。</p>
 *
 * <p><b>回看窗口：</b>默认重算最近 {@code yuqing.analytics.job-lookback-days} 天（默认 2 天），
 * 而不是只算昨天。原因是舆情数据存在迟到（采集慢、补采、跨天发布），只算昨天会让今天的看板缺一块；
 * 而 Doris Unique Key 覆盖写让「多算一天」的成本仅为一点点 CPU，收益是不出现空洞。
 * 需要补算任意历史区间时走 PC 看板的「重算」按钮（{@code POST /yuqing/analytics/aggregate}），
 * 那才是 ad-hoc 范围的正确入口 —— 定时任务保持无参，避免有人往任务参数里塞乱七八糟的东西。</p>
 *
 * <p><b>失败隔离（验收标准 9）：</b>本任务与采集、研判、预警完全解耦 ——
 * 它失败只体现为看板上的一个降级提示与数据截止时间，主流程照常。
 * 因此异常在这里被捕获成失败的 {@code ExecuteResult}，不往外抛。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingStatsAggregate")
public class YqStatsAggregateJobExecutor {

    private final IYqAnalyticsService analyticsService;

    private final YqAnalyticsProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("多维分析引擎已关闭，跳过");
        }
        try {
            LocalDate today = LocalDate.now();
            int lookback = Math.max(1, Math.min(props.getJobLookbackDays(), 31));
            AggregateRequest req = new AggregateRequest();
            req.setDateFrom(today.minusDays(lookback - 1L));
            req.setDateTo(today);
            req.setTriggerType("auto");
            AggregateSummary summary = analyticsService.aggregate(req);
            SnailJobLog.LOCAL.info("[多维分析] {}", summary.message());
            if ("failed".equals(summary.getStatus())) {
                return ExecuteResult.failure("聚合失败：" + summary.getFailReason());
            }
            return ExecuteResult.success(summary.message());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[多维分析] 执行异常", e);
            return ExecuteResult.failure("聚合异常: " + e.getMessage());
        }
    }
}
`,
  },

  /* ============================================================== 配置样例 */
  {
    rel: 'config/yq_analytics.yml',
    content: `# ============================================================================
# 舆情监测平台 · 多维分析配置（F-009）
#
# 落位：application-<profile>.yml 的 spring.config.import，或直接追加到 application.yml
# 前缀：yuqing.analytics
#
# 这份配置决定了「看板查询多快」——预聚合的产出规模由下面三个参数直接决定：
#   dim-top-n / hot-top-n / hour-trend-days
# 调大任何一个，看板能看到的细节更多，但预聚合表会线性变大，查询反而变慢。
# ============================================================================
yuqing:
  analytics:
    # 引擎总开关；关闭时定时任务与重算接口都直接返回，不产生任何查询
    enabled: true

    # 单次聚合允许的最大统计跨度（天）。超过则从结束日往前截断
    max-scope-days: 366

    # 单次聚合最多读入内存的明细条数。命中即截断，并在看板标注「不完全统计」
    # 估算方法：单日明细量 × 回看天数 × 1.5 倍余量
    max-source-records: 200000

    # 定时任务的回看天数（含当天）。设为 2 表示每天连算「昨天 + 今天」
    # 需要补算任意历史区间时用 PC 看板的「重算」按钮，不要改这个值
    job-lookback-days: 2

    # 分布类维度（平台 / 地域 / 话题 / 属性 / 风险 / 分级 / 传播量级）每类保留的取值个数
    dim-top-n: 50

    # 热点排行 TopN（按「天 × 4 个口径」写快照，所以实际行数 = 回看天数 × 4 × 该值）
    hot-top-n: 20

    # 小时级趋势只回算最近多少天。小时桶行数增长最快（24 倍于日桶），必须封顶
    hour-trend-days: 30

    # 结论里保留的核心事件条数
    conclusion-top-events: 5

    # 「负面占比偏高」风险阈值（%）
    risk-negative-rate: 30

    # 「高风险占比偏高」风险阈值（%）
    risk-severe-rate: 10

    # 趋势曲线归属口径：
    #   true  -> 按发布时间（业务语义上的「传播趋势」）
    #   false -> 按采集时间（更贴近「采集节奏」，适合排查采集链路）
    # 注意：总量按采集日归属，趋势按发布时间归属，两者累计值允许存在差异
    trend-by-publish-time: true

    # 下钻明细单页最大条数
    max-drilldown-page-size: 200

    # 导出 Excel 最大行数
    export-max-rows: 20000
`,
  },
];
