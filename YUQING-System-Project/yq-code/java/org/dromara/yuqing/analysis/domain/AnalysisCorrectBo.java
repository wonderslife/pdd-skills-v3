package org.dromara.yuqing.analysis.domain;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 人工修正研判结论入参（F-007 验收标准 8）
 *
 * <p><b>只允许改三样：情感倾向、风险等级、标签。</b>
 * 这是验收标准明确列举的范围，也是模型最容易判错、人工最容易纠正的三项。
 * 主题 / 摘要 / 建议属模型生成的自然语言，人工改它们会让「模型效果比对」
 * 失去基线，因此本期不开放。</p>
 *
 * <p><b>为什么必须传 opinionId 而不是 analysisId：</b>
 * 研判结论是「按舆情」的，一条舆情可能经历多次研判（重试 / 换模型版本）。
 * 用 opinionId 作为入口可以保证改的永远是「当前生效的那一份」，
 * 前端不需要知道 analysisId 是哪个版本，也就不会出现
 * 「改完了但改的是历史版本」这种隐蔽错误。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisCorrectBo implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID（必填，入口键） */
    @NotNull(message = "舆情ID不能为空")
    private Long opinionId;

    /** 修正后的情感倾向（positive / neutral / negative）；为 null 表示不改这项 */
    private String sentiAttr;

    /** 修正后的风险等级（general / moderate / severe）；为 null 表示不改这项 */
    private String riskLevel;

    /** 修正后的舆情分级（normal / attention / warning / urgent）；为 null 表示不改这项 */
    private String opinionLevel;

    /**
     * 修正后的标签名集合。
     *
     * <p>语义是「覆盖」，不是「追加」：为 null 表示不动标签；
     * 传空数组表示「把人工标签全删掉」。这个区分很关键 ——
     * 如果空数组被当成「不改」，研判员就永远删不掉模型打错的标签。</p>
     */
    private List<String> tags;

    /** 修正说明（为什么改）。留痕用，建议必填 */
    private String remark;

    /** 是否同步登记训练样本（null 时取配置 sampleOnCorrect） */
    private Boolean createSample;
}
