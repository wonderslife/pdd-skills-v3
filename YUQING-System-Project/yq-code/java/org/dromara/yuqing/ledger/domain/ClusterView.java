package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 事件聚合视图（F-016 验收标准 4）
 *
 * <p>含事件概要 + 传播时间轴 + 关联舆情清单。时间轴是验收标准 4 的核心交付，
 * 关联清单是它的下钻明细（前端点击节点跳到对应舆情详情）。</p>
 *
 * @author ruoyi
 */
@Data
public class ClusterView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 聚合ID */
    private Long clusterId;

    /** 事件标题 */
    private String clusterTitle;

    /** 事件主题 */
    private String clusterTopic;

    /** 关联舆情条数 */
    private Integer opinionCount;

    /** 首次出现时间 */
    private LocalDateTime firstTime;

    /** 最近出现时间 */
    private LocalDateTime lastTime;

    /** 峰值热度 */
    private Integer peakHeat;

    /** 事件风险等级 */
    private String riskLevel;

    /** 各阶段条数统计：first / spread / peak / fall */
    private java.util.Map<String, Integer> stageCount;

    /** 传播时间轴（按时间升序，受 timelineNodeLimit 限制） */
    private List<TimelineNode> timeline;

    /** 关联舆情清单（按时间倒序，分页） */
    private List<LedgerRow> opinions;

    /** 时间轴是否被截断（true 时前端提示「仅展示前 N 个节点」） */
    private Boolean timelineTruncated;
}
