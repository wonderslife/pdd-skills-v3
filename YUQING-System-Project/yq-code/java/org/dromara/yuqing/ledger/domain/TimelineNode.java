package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 事件传播时间轴节点（F-016 验收标准 4）
 *
 * <p>验收标准 4 要求「按聚合事件查看关联的全部舆情，并在时间轴上展示传播脉络」。
 * 一个节点 = 一条关联舆情在该事件中的一次发声。</p>
 *
 * <p><b>{@code stage} 由后端判定而不是前端：</b>首发/扩散/峰值/回落的划分
 * 依赖整条时间轴的统计特征（首条、末条、热量最高点），
 * 后端算一次比让每个前端各算一遍更一致。</p>
 *
 * @author ruoyi
 */
@Data
public class TimelineNode implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID */
    private Long opinionId;

    /** 发言时间（无发布时间时回落到采集时间） */
    private LocalDateTime time;

    /** 该时间是发布时间还是采集时间（PUBLISH / COLLECT），前端标注口径用 */
    private String timeBasis;

    /** 标题 */
    private String title;

    /** 来源渠道 */
    private String channelName;

    /** 发布作者 */
    private String author;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 热度分值 */
    private Integer heatScore;

    /** 原文链接 */
    private String opinionUrl;

    /** 传播阶段：first（首发）/ spread（扩散）/ peak（峰值）/ fall（回落） */
    private String stage;

    /** 相对首发的时间偏移（分钟），便于前端画等距轴 */
    private Long offsetMinutes;
}
