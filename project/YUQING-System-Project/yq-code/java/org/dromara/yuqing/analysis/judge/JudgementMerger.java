package org.dromara.yuqing.analysis.judge;

import org.dromara.yuqing.analysis.parse.ParsedJudgement;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 模型结论与规则结论的融合（F-007）
 *
 * <p><b>为什么不「模型失败就整体用规则」而是逐字段融合：</b>
 * 模型经常能给出很好的主题与摘要，却把 riskLevel 判高或判低。
 * 直接整份丢弃会浪费最有价值的那部分输出。</p>
 *
 * <p><b>融合规则（保守优先）：</b></p>
 * <ul>
 *   <li>主题 / 摘要 / 风险属性 / 建议 / 命中依据：以模型为准（规则产物较粗糙）；</li>
 *   <li>置信度：取两者较小值 —— 交叉验证不一致时应当降低把握，而不是取高；</li>
 *   <li>标签：并集去重（规则标签带有「规则研判」标记，便于事后统计）；</li>
 *   <li>情感与风险：不一致时取风险更高的一方，但强制「非负面无风险」不变式。</li>
 * </ul>
 *
 * <p>「不一致时取更高风险」是有意偏保守的选择：漏报一条高风险的代价
 * 远大于多报一条待人工复核的记录，且后者可以被处置流程消化。</p>
 *
 * @author ruoyi
 */
public final class JudgementMerger {

    private JudgementMerger() {
    }

    /**
     * 融合。
     *
     * @param llm  模型结论（可为 null 或致命失败态）
     * @param rule 规则结论（可为 null）
     * @return 融合后的结论；两者都不可用时返回致命失败结论
     */
    public static ParsedJudgement merge(ParsedJudgement llm, ParsedJudgement rule) {
        boolean llmUsable = llm != null && !llm.isFatal();
        boolean ruleUsable = rule != null && !rule.isFatal();
        if (!llmUsable && !ruleUsable) {
            String reason = llm != null && llm.getFailReason() != null
                ? llm.getFailReason() : "无可用的研判结论";
            return ParsedJudgement.fatalOf(reason);
        }
        if (!llmUsable) {
            return rule;
        }
        if (!ruleUsable) {
            return llm;
        }

        ParsedJudgement out = new ParsedJudgement();
        out.setSource(llm.getSource() == null ? "llm" : llm.getSource());
        out.setTopic(prefer(llm.getTopic(), rule.getTopic()));
        out.setSummary(prefer(llm.getSummary(), rule.getSummary()));
        out.setRiskAttr(prefer(llm.getRiskAttr(), rule.getRiskAttr()));
        out.setSuggestion(prefer(llm.getSuggestion(), rule.getSuggestion()));
        out.setMatchEvidence(prefer(llm.getMatchEvidence(), rule.getMatchEvidence()));

        String senti = higherRiskSenti(llm.getSentiAttr(), rule.getSentiAttr());
        out.setSentiAttr(senti);

        String risk = higherRiskLevel(llm.getRiskLevel(), rule.getRiskLevel());
        if (!"negative".equals(senti)) {
            /* 不变式：非负面舆情永远无风险。模型与规则都有可能给出矛盾组合，
             * 这里统一收口，下游（F-010 预警）就只需要信任这一个不变式。 */
            risk = "general";
        }
        out.setRiskLevel(risk);
        out.setOpinionLevel(higherOpinionLevel(llm.getOpinionLevel(), rule.getOpinionLevel()));
        out.setConfidence(lower(llm.getConfidence(), rule.getConfidence()));
        out.setTags(union(llm.getTags(), rule.getTags()));

        /* 两侧的 warning 都带上：它们记录了模型跑偏与规则兜底的痕迹 */
        out.getWarnings().addAll(rule.getWarnings());
        out.getWarnings().addAll(llm.getWarnings());
        if (!Objects.equals(llm.getSentiAttr(), rule.getSentiAttr())
            || !Objects.equals(llm.getRiskLevel(), rule.getRiskLevel())) {
            out.warn("模型与规则判定不一致，已按较保守的一方取值（模型: "
                + llm.getSentiAttr() + '/' + llm.getRiskLevel()
                + "，规则: " + rule.getSentiAttr() + '/' + rule.getRiskLevel() + "）");
        }
        return out;
    }

    /** 情感取「更负面」的一方：negative > neutral > positive */
    static String higherRiskSenti(String a, String b) {
        if ("negative".equals(a) || "negative".equals(b)) {
            return "negative";
        }
        if ("neutral".equals(a) || "neutral".equals(b)) {
            return "neutral";
        }
        return a == null ? b : a;
    }

    static String higherRiskLevel(String a, String b) {
        return RuleJudger.riskRank(a) >= RuleJudger.riskRank(b) ? a : b;
    }

    static String higherOpinionLevel(String a, String b) {
        return levelRank(a) >= levelRank(b) ? a : b;
    }

    static int levelRank(String level) {
        if ("urgent".equals(level)) {
            return 4;
        }
        if ("warning".equals(level)) {
            return 3;
        }
        if ("attention".equals(level)) {
            return 2;
        }
        return 1;
    }

    static BigDecimal lower(BigDecimal a, BigDecimal b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.compareTo(b) <= 0 ? a : b;
    }

    static List<String> union(List<String> a, List<String> b) {
        Set<String> s = new LinkedHashSet<>();
        if (a != null) {
            s.addAll(a);
        }
        if (b != null) {
            s.addAll(b);
        }
        return new ArrayList<>(s);
    }

    static String prefer(String primary, String fallback) {
        return (primary == null || primary.isBlank()) ? fallback : primary;
    }
}
