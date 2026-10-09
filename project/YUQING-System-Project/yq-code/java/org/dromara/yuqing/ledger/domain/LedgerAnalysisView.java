package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 研判结论视图（F-016 验收标准 3 的「研判结论」块）
 *
 * <p>对应 yq_opinion_analysis 一行。刻意与实体分离：实体含 opinion_id 等
 * 内部关联键，前端不需要；且修正研判（F-007 的 correct 端点）只改其中几列，
 * 用视图对象可以明确「哪些列可被人工修改」。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerAnalysisView implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 研判结果ID */
    private Long analysisId;

    /** 主题识别结果 */
    private String topic;

    /** 核心内容提炼 */
    private String summary;

    /** 情感倾向判定 */
    private String sentiAttr;

    /** 风险属性判定 */
    private String riskAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 模型输出标签（逗号分隔） */
    private String tags;

    /** 隐性/变体命中依据 */
    private String matchEvidence;

    /** 处置建议 */
    private String suggestion;

    /** 置信度（%） */
    private BigDecimal confidence;

    /** 模型版本 */
    private String modelVersion;

    /** 提示词版本 */
    private String promptVersion;

    /** 研判版本号 */
    private Integer analyzeVersion;

    /** 是否人工修正（0否 1是） */
    private String correctedFlag;

    /** 修正人用户ID */
    private Long correctedBy;

    /** 修正时间 */
    private LocalDateTime correctedTime;

    /** 研判时间 */
    private LocalDateTime analyzeTime;

    /** 失败原因 */
    private String failReason;
}
