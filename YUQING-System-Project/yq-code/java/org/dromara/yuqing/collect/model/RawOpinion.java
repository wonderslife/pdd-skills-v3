package org.dromara.yuqing.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 原始采集数据（未净化、未研判）。
 *
 * <p>字段覆盖 F-004 验收标准 3 要求的 12 项：标题、原文内容、发布链接、发布时间、发布作者、
 * 点赞量、评论量、转发量、阅读量、发布地域、设备信息、话题标签。</p>
 *
 * @author ruoyi
 */
@Data
public class RawOpinion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 舆情ID（落库时由雪花算法分配） */
    private Long opinionId;

    /** 分区列 = 采集日期 */
    private LocalDate collectDate;

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 舆情标题 */
    private String title;

    /** 原文内容（不做有损截断，验收标准 4） */
    private String content;

    /** 原文链接 */
    private String opinionUrl;

    /** 链接 SHA-256（归一化后计算，唯一去重主键载体） */
    private String urlHash;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 发布作者 / 主体 */
    private String author;

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 发布地域 */
    private String region;

    /** 设备信息 */
    private String deviceInfo;

    /** 话题标签（逗号分隔） */
    private String topicTags;

    /** 采集来源：auto / manual_link / file_import */
    private String collectSource;

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 采集批次号（溯源依据） */
    private String batchNo;

    /** 命中关键词（多词用逗号分隔，便于核查为什么抓到这条） */
    private String hitKeywords;

    /** 原始 HTML 快照（可选，落 MinIO 后清空，不写入 Doris） */
    private String rawHtml;

    /** 快照对象键（落 MinIO 成功时回填） */
    private String snapshotKey;

    /** 管道处理结果：inserted / duplicated / rejected，仅内存流转 */
    private String pipelineStatus;

    /** 清洗状态：raw / cleaned / rejected（F-006 验收标准 5） */
    private String cleanStatus = "raw";

    /** 降噪剔除原因（取 yq_noise_category 取值，F-006 验收标准 3） */
    private String noiseReason;

    /** 跨渠道重复时的其余渠道ID（逗号分隔，验收标准 8） */
    private String dupChannelIds;

    /** 净化时间 */
    private java.time.LocalDateTime cleanTime;
}
