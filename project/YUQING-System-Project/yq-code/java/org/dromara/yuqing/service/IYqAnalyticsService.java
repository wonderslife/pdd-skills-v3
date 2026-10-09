package org.dromara.yuqing.service;

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
