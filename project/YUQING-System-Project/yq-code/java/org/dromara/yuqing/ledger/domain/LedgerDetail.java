package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 舆情详情（F-016 验收标准 3）
 *
 * <p>验收标准 3 要求详情展示：原文内容、互动数据、完整溯源字段（含原始链接）、
 * 研判结论、预警记录与推送记录。本类是这六块的聚合根。</p>
 *
 * <p><b>跨库来源说明（PRD §6.3）：</b></p>
 * <ul>
 *   <li>Doris / 镜像库：opinion 主体、analysis 研判结论、tags 标签、metric 互动快照</li>
 *   <li>MySQL（master）：task / channel / tag 的名称回填，以及 alert 预警记录、
 *       pushRecord 推送记录</li>
 * </ul>
 * <p>由 {@code YqLedgerDetailAssembler} 先取 Doris 明细，再批量回查 MySQL 补配置字段；
 * 全链路禁止跨库 JOIN、禁止分布式事务。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerDetail implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 原文块 ---------------- */

    /** 舆情ID */
    private Long opinionId;

    /** 标题 */
    private String title;

    /** 原文内容 */
    private String content;

    /** 原文链接（溯源用，前端必须 target=_blank rel=noopener） */
    private String opinionUrl;

    /** 链接 SHA-256（去重指纹，溯源佐证） */
    private String urlHash;

    /** 发布作者/主体 */
    private String author;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 发布地域 */
    private String region;

    /** 设备信息 */
    private String deviceInfo;

    /** 话题标签（原文里的 #话题#，非系统标签） */
    private String topicTags;

    /* ---------------- 互动数据块 ---------------- */

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 综合热度分值 */
    private Integer heatScore;

    /** 互动数据快照（按日期，最多返回最近 N 条，用于看趋势） */
    private List<MetricPoint> metricTrend;

    /* ---------------- 溯源与归属块 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 所属任务名称 */
    private String taskName;

    /** 来源渠道ID */
    private Long channelId;

    /** 来源渠道名称 */
    private String channelName;

    /** 采集来源（auto / manual_import） */
    private String collectSource;

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 采集批次号 */
    private String batchNo;

    /** 重复渠道ID（F-006 跨渠道去重时回填） */
    private String dupChannelIds;

    /** 清洗状态 */
    private String cleanStatus;

    /** 降噪剔除原因 */
    private String noiseReason;

    /** 净化时间 */
    private LocalDateTime cleanTime;

    /* ---------------- 研判块 ---------------- */

    /** 研判状态 */
    private String analyzeStatus;

    /** 是否已预警 */
    private String alertFlag;

    /** 是否已推送 */
    private String pushFlag;

    /** 舆情属性（列表口径，来自 yq_opinion） */
    private String sentiAttr;

    /** 风险等级（列表口径） */
    private String riskLevel;

    /** 舆情分级（列表口径） */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /** 系统标签名集合 */
    private List<String> tagNames;

    /** 最新一次研判结论（可能为空：pending / failed） */
    private LedgerAnalysisView analysis;

    /** 研判历史（多版本，时间倒序） */
    private List<LedgerAnalysisView> analysisHistory;

    /* ---------------- 预警 / 推送块 ---------------- */

    /** 关联预警记录（按触发时间倒序） */
    private List<LedgerAlertView> alerts;

    /** 关联推送记录（按发送时间倒序） */
    private List<LedgerPushView> pushes;

    /* ---------------- 事件聚合块 ---------------- */

    /** 事件聚合ID */
    private Long clusterId;

    /** 事件聚合标题 */
    private String clusterTitle;

    /**
     * 互动数据点（详情页的互动趋势）。
     *
     * <p>独立小对象而不是复用 YqOpinionMetric，是为了只暴露详情页需要的四个量，
     * 避免把 metric 表的主键与采集时间一起推到前端。</p>
     */
    @Data
    public static class MetricPoint implements Serializable {

        private static final long serialVersionUID = 1L;

        /** 快照日期 */
        private java.time.LocalDate snapshotDate;

        /** 点赞量 */
        private Long likeCount;

        /** 评论量 */
        private Long commentCount;

        /** 转发量 */
        private Long shareCount;

        /** 阅读量 */
        private Long readCount;

        /** 热度分值 */
        private Integer heatScore;
    }
}
