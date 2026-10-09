package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 研判中心列表行（F-007）
 *
 * <p>一行 = 一条舆情 + 它的研判结论（可能尚无结论，此时 analyzeStatus=pending）。
 * 刻意把「舆情侧字段」与「结论侧字段」都摊平在一行，因为研判员的工作方式是
 * 「扫一屏、挑几条改」——如果不把原文摘要和结论放一起，就要不停点开详情。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisRow implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 舆情侧 ---------------- */

    private Long opinionId;
    private Long taskId;
    private String taskName;
    private Long channelId;
    private String channelName;
    private String title;
    /** 原文截断预览（列表不返回全文，避免大字段拖慢分页） */
    private String contentBrief;
    private String opinionUrl;
    private LocalDateTime publishTime;
    private String author;
    private Integer heatScore;
    private Long clusterId;
    private String clusterTitle;
    private String alertFlag;

    /* ---------------- 结论侧 ---------------- */

    /** 研判状态（pending / processing / completed / failed） */
    private String analyzeStatus;
    private LocalDateTime analyzeTime;

    /** 主题识别结果 */
    private String topic;

    /** 情感倾向 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /** 置信度（%） */
    private BigDecimal confidence;

    /** 模型版本 */
    private String modelVersion;

    /** 提示词版本 */
    private String promptVersion;

    /** 研判版本号（每次研判/修正递增） */
    private Integer analyzeVersion;

    /** 是否人工修正过（0否 1是） */
    private String correctedFlag;

    /** 失败原因（analyzeStatus=failed 时有值） */
    private String failReason;

    /** 标签名列表（已按来源展开，供列表直接展示） */
    private List<String> tags = new ArrayList<>();
}
