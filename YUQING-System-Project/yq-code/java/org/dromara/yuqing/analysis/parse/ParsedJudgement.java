package org.dromara.yuqing.analysis.parse;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 解析后的结构化研判结论（F-007 验收标准 1、2）
 *
 * <p>模型输出 → 本对象 → 落库。中间这一层的意义是：<b>把「不可信文本」
 * 变成「字段值域受控的对象」</b>。落库代码只认本对象，永远不直接碰模型原文。</p>
 *
 * @author ruoyi
 */
@Data
public class ParsedJudgement implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 主题识别结果 */
    private String topic;

    /** 核心内容提炼 */
    private String summary;

    /** 情感倾向（已在白名单内） */
    private String sentiAttr;

    /** 风险属性描述 */
    private String riskAttr;

    /** 风险等级（已在白名单内） */
    private String riskLevel;

    /** 舆情分级（已在白名单内） */
    private String opinionLevel;

    /** 标签（已去重、限长、限数量） */
    private List<String> tags = new ArrayList<>();

    /** 隐性/变体命中依据 */
    private String matchEvidence;

    /** 处置建议 */
    private String suggestion;

    /** 置信度（0~100） */
    private BigDecimal confidence;

    /** 结论来源：llm / rule */
    private String source;

    /**
     * 解析过程中的可修复问题（枚举越界已归一、字段超长已截断等）。
     *
     * <p>不当作失败处理，但必须留痕 —— 这些是「模型开始跑偏」的早期信号，
     * 也是提示词迭代的依据。</p>
     */
    private List<String> warnings = new ArrayList<>();

    /** 是否为致命失败（true 时除 failReason 外其余字段都不可信） */
    private boolean fatal;

    /** 致命失败原因（落 yq_opinion_analysis.fail_reason） */
    private String failReason;

    /** 构造一个致命失败结论 */
    public static ParsedJudgement fatalOf(String reason) {
        ParsedJudgement p = new ParsedJudgement();
        p.fatal = true;
        p.failReason = reason;
        return p;
    }

    /** 追加一条可修复问题并返回自身，便于链式调用 */
    public ParsedJudgement warn(String message) {
        this.warnings.add(message);
        return this;
    }

    /** 警告汇总成一行（落库到 matchEvidence 前缀或日志） */
    public String warningText() {
        return warnings.isEmpty() ? "" : String.join("; ", warnings);
    }
}
