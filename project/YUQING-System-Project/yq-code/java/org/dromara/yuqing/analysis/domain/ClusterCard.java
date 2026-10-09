package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 事件聚合卡片（F-007 验收标准 4、10）
 *
 * <p>批量研判汇总台账要「支持按事件聚合维度查看」，本类即该维度的一行。
 * 与 F-016 的 {@code ClusterView} 是**读侧与写侧的分工**：
 * ClusterView 是单事件的详情视图（含完整时间轴与分页舆情清单），
 * ClusterCard 是事件列表里的摘要卡片（只带少量代表性节点），
 * 两者不互相替代、也不合并成一个类 —— 合并会让详情页被迫接受
 * 「列表用的截断参数」，时间轴长度就再也改不回去了。</p>
 *
 * <p><b>为什么带 {@code visibleCount}：</b>事件本身是跨任务共享实体
 * （同一热点可能由多个任务采集到），但卡片是给具体用户看的。
 * 用户有权知道「事件存在」，却只能看到自己范围内的条目数。
 * 把两个数字都给出，用户才不会被「卡片显示 50 条、点进去只有 3 条」搞糊涂。</p>
 *
 * @author ruoyi
 */
@Data
public class ClusterCard implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 聚合ID（验收标准 4 的「聚合编号」） */
    private Long clusterId;

    /** 事件标题 */
    private String clusterTitle;

    /** 事件主题 */
    private String clusterTopic;

    /** 事件下舆情总条数（全量口径） */
    private Integer opinionCount;

    /** 当前用户可见条数（不会超过 opinionCount） */
    private Long visibleCount;

    /** 首次出现时间 */
    private LocalDateTime firstTime;

    /** 最近出现时间 */
    private LocalDateTime lastTime;

    /** 峰值热度 */
    private Integer peakHeat;

    /** 事件风险等级 */
    private String riskLevel;

    /** 各阶段条数统计：FIRST / SPREAD / PEAK / FALL */
    private Map<String, Integer> stageCount;

    /** 传播脉络摘要（由 spread_path 归类而来，形如「首发 1 -> 扩散 3 -> 峰值 1」） */
    private String spreadSummary;

    /** 代表性节点（最多 3 条，按热度倒序，用于卡片下面的缩略列表） */
    private List<AnalysisRow> topOpinions;
}
