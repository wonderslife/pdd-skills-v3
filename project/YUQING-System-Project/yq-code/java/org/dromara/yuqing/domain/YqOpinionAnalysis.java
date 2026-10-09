package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 研判结果对象 yq_opinion_analysis *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_opinion_analysis")
@ExcelIgnoreUnannotated
public class YqOpinionAnalysis implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "analysis_id")
    private Long analysisId;

    /** 舆情ID */
    private Long opinionId;

    /** 主题识别结果 */
    @ExcelProperty(value = "主题识别结果")
    private String topic;

    /** 核心内容提炼 */
    private String summary;

    /** 情感倾向判定 */
    @ExcelProperty(value = "情感倾向判定")
    private String sentiAttr;

    /** 风险属性判定 */
    private String riskAttr;

    /** 风险等级 */
    @ExcelProperty(value = "风险等级")
    private String riskLevel;

    /** 舆情分级 */
    @ExcelProperty(value = "舆情分级")
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
    @ExcelProperty(value = "模型版本")
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
    @ExcelProperty(value = "修正时间")
    private LocalDateTime correctedTime;

    /** 研判时间 */
    @ExcelProperty(value = "研判时间")
    private LocalDateTime analyzeTime;

    /** 失败原因 */
    private String failReason;
}
