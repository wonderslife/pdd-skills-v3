package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 看板聚合响应（F-009 验收标准 1 / 2 / 3 / 4 / 9）
 *
 * <p>七类指标各占一个字段，筛选条件原样回显（{@link #scope}）——
 * 回显是为了让前端在导出、带入报告、分享链接时能复现同一份视图，
 * 而不是让使用者对着图回忆「我刚才选的是哪几天」。</p>
 *
 * @author ruoyi
 */
@Data
public class DashboardView {

    /** 生效的范围（归一化后回显） */
    private AggregateScope scope;

    /** 生效的时间粒度 */
    private String grain;

    /** 生效的排序口径 */
    private String rankBy;

    /** 趋势归属口径说明（publish_time / collect_time） */
    private String trendBase;

    /** 总量卡 */
    private TotalsView totals;

    /** 平台（渠道）分布 */
    private List<DimItem> platform = new ArrayList<>();

    /** 地域分布 */
    private List<DimItem> region = new ArrayList<>();

    /** 话题分布 */
    private List<DimItem> topic = new ArrayList<>();

    /** 舆情属性分布 */
    private List<DimItem> senti = new ArrayList<>();

    /** 风险等级分布 */
    private List<DimItem> risk = new ArrayList<>();

    /** 舆情分级分布 */
    private List<DimItem> level = new ArrayList<>();

    /** 传播量级分布 */
    private List<DimItem> spread = new ArrayList<>();

    /** 传播趋势（按 grain 切换） */
    private List<DimItem> trend = new ArrayList<>();

    /** 热点排行 */
    private List<HotItem> hot = new ArrayList<>();

    /** 结构化分析结论 */
    private AnalysisConclusion conclusion;

    /**
     * 结论来源
     *
     * <ul>
     *   <li>{@code batch}：来自聚合批次落库的结论（含核心事件与传播路径，最完整）</li>
     *   <li>{@code derived}：当前筛选条件与批次不一致，由预聚合数据即时推导
     *       （只有舆论焦点与风险点，没有核心事件与传播路径）</li>
     *   <li>{@code none}：无数据</li>
     * </ul>
     * 显式告知来源，是为了避免使用者把「派生结论」当成全量结论 ——
     * 两者差着「核心事件」和「传播路径」两块，不标出来就是误导。
     */
    private String conclusionMode;

    /** 数据来源批次元信息 */
    private BatchMeta batch;

    /** 非致命提示 */
    private List<String> notices = new ArrayList<>();

    /** 生效的起始统计日（冗余出来方便前端拼接导出文件名） */
    private LocalDate dateFrom;

    /** 生效的截止统计日 */
    private LocalDate dateTo;

    /** 是否为空数据（前端显示空态而不是空白图） */
    public boolean isEmpty() {
        return totals == null || totals.getTotalCount() == null || totals.getTotalCount() == 0;
    }
}
