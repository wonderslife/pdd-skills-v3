package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 看板装配入参
 *
 * <p>把「已从预聚合表查出来的行」交给 {@link DashboardAssembler}，
 * 装配逻辑因此不碰数据库，可以被离线自测完整覆盖。</p>
 *
 * @author ruoyi
 */
@Data
public class DashboardInput {

    /** 生效范围 */
    private AggregateScope scope;

    /** 时间粒度 */
    private StatsGrain grain = StatsGrain.DAY;

    /** 排序口径 */
    private RankBy rankBy = RankBy.HEAT;

    /** 趋势归属口径说明 */
    private String trendBase;

    /** 范围汇总后的日聚合行 */
    private List<DailyRow> daily = new ArrayList<>();

    /** 七个分布类维度行（已按 dim_type 汇总） */
    private List<DimRow> distributions = new ArrayList<>();

    /** 趋势行（已按 grain 汇总） */
    private List<DimRow> trend = new ArrayList<>();

    /** 热点行 */
    private List<HotRow> hot = new ArrayList<>();

    /** 结论 */
    private AnalysisConclusion conclusion;

    /** 批次元信息 */
    private BatchMeta batch;

    /** 提示 */
    private List<String> notices = new ArrayList<>();

    /** 每个分布类维度最多保留的取值个数 */
    private int dimTopN = 50;
}
