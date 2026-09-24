package org.dromara.yuqing.analysis.judge;

import org.dromara.yuqing.analysis.parse.ParsedJudgement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 规则兜底判定器（F-007 验收标准 1、6）
 *
 * <p><b>为什么必须存在：</b>大模型不可用（未配置、额度耗尽、网络不通、
 * 供应商故障）时，研判链路不能整体停摆 —— F-010 的判级、F-013/F-014 的
 * 报告取数、F-018 的监控统计都依赖 {@code yq_opinion_analysis} 有数据。
 * 本类用可解释的本地规则产出四类结构化结果，使「研判状态能推进」这件事
 * 不依赖外部服务。</p>
 *
 * <p><b>口径与 F-010 的关系：</b>风险等级与舆情分级的判定口径与
 * {@code alert.LevelResolver} 保持一致（热度 + 传播量级映射），
 * 但本类是独立实现 —— 它服务的是「落库结构化结论」，而 LevelResolver
 * 服务的是「预警候选就地补空」。F-007 落地后，舆情的 risk/level 由本类或
 * 大模型写入，LevelResolver 的补空逻辑自然不再触发（它只填空白）。</p>
 *
 * <p><b>能力边界：</b>情感判定基于内置的最小正负词典，只覆盖通用倾向词，
 * 不含行业与领域词。它是「让链路能跑」的兜底，不是「替代模型」的方案 ——
 * 因此结论的 source 会标记为 rule，台账上可一眼区分。</p>
 *
 * @author ruoyi
 */
public final class RuleJudger {

    /** 内置最小负面词典（可解释、可单测；生产应结合业务词库迭代） */
    private static final List<String> NEGATIVE = Arrays.asList(
        "投诉", "举报", "曝光", "违规", "违法", "事故", "伤亡", "腐", "贪",
        "骗", "欺诈", "造假", "虚假", "污染", "泄漏", "中毒", "召回", "停业",
        "罚款", "处罚", "处分", "问责", "质疑", "不满", "反对", "抵制", "抗议",
        "维权", "纠纷", "诉讼", "起诉", "败诉", "崩", "烂", "差", "坑", "怒",
        "骂", "黑幕", "内幕", "塌", "爆雷", "失信", "拖欠", "欠薪", "裁员");

    /** 内置最小正面词典 */
    private static final List<String> POSITIVE = Arrays.asList(
        "表彰", "获奖", "荣誉", "先进", "优秀", "突破", "创新", "领先", "第一",
        "好评", "点赞", "满意", "提升", "增长", "增收", "盈利", "中标", "签约",
        "落成", "通车", "投产", "助力", "惠民", "公益", "捐赠", "救助");

    /** 传播量级阈值（与 LevelResolver 同口径：千 / 万 / 十万） */
    private static final long THOUSAND = 1_000L;
    private static final long TEN_THOUSAND = 10_000L;
    private static final long HUNDRED_THOUSAND = 100_000L;

    /* 换行与回车用十进制构造：本项目模板经三层传递，源码里写转义序列
     * 极易在某一层被提前解析成真实控制字符，导致字符字面量跨行而编译失败。 */
    private static final char LF = (char) 10;
    private static final char CR = (char) 13;

    private RuleJudger() {
    }

    /**
     * 规则判定。
     *
     * @param title        标题（参与情感加权）
     * @param content      正文
     * @param heatScore    热度分值（可为 null）
     * @param readCount    阅读量（可为 null）
     * @param likeCount    点赞量（可为 null）
     * @param commentCount 评论量（可为 null）
     * @param shareCount   转发量（可为 null）
     * @return 结构化结论，source = rule
     */
    public static ParsedJudgement judge(String title, String content, Integer heatScore,
                                        Long readCount, Long likeCount,
                                        Long commentCount, Long shareCount) {
        String text = join(title, content);
        int neg = countHits(text, NEGATIVE);
        int pos = countHits(text, POSITIVE);
        /* 标题命中权重加倍：标题里的倾向词比正文里的更代表主旨 */
        int titleNeg = countHits(title, NEGATIVE);
        int titlePos = countHits(title, POSITIVE);
        int negScore = neg + titleNeg * 2;
        int posScore = pos + titlePos * 2;

        String senti;
        if (negScore > posScore) {
            senti = "negative";
        } else if (posScore > negScore) {
            senti = "positive";
        } else {
            senti = "neutral";
        }

        String spread = spreadLevel(readCount, likeCount, commentCount, shareCount);
        int heat = heatScore == null ? 0 : heatScore;
        String risk = riskLevel(senti, heat, spread);
        String level = opinionLevel(risk, spread);

        ParsedJudgement p = new ParsedJudgement();
        p.setSource("rule");
        p.setSentiAttr(senti);
        p.setRiskLevel(risk);
        p.setOpinionLevel(level);
        p.setTopic(topicOf(title, text));
        p.setSummary(summaryOf(content, title));
        p.setRiskAttr("规则判定：命中负面特征词 " + negScore + " 处、正面特征词 " + posScore + " 处");
        p.setSuggestion(suggest(risk, level));
        p.setTags(ruleTags(senti, risk, spread));
        p.setConfidence(confidenceOf(neg + pos + titleNeg + titlePos));
        p.setMatchEvidence("");
        p.warn("结论由规则兜底产出（大模型不可用），来源标记为 rule");
        return p;
    }

    /* ------------------------------------------------------------------ 子判定 */

    /** 传播量级：优先阅读量，缺失时用互动量之和 */
    public static String spreadLevel(Long read, Long like, Long comment, Long share) {
        long metric = (read != null && read > 0)
            ? read
            : nz(like) + nz(comment) + nz(share);
        if (metric >= HUNDRED_THOUSAND) {
            return "viral";
        }
        if (metric >= TEN_THOUSAND) {
            return "high";
        }
        if (metric >= THOUSAND) {
            return "medium";
        }
        return "low";
    }

    /** 风险等级：非负面一律 general（与 LevelResolver 同口径） */
    public static String riskLevel(String senti, int heat, String spread) {
        if (!"negative".equals(senti)) {
            return "general";
        }
        int sr = spreadRank(spread);
        if (heat >= 80 || sr >= spreadRank("high")) {
            return "severe";
        }
        if (heat >= 50 || sr >= spreadRank("medium")) {
            return "moderate";
        }
        return "general";
    }

    /** 舆情分级：与 LevelResolver 同口径 */
    public static String opinionLevel(String risk, String spread) {
        int rr = riskRank(risk);
        int sr = spreadRank(spread);
        if (rr >= 3 && sr >= spreadRank("high")) {
            return "urgent";
        }
        if (rr >= 3 || (rr >= 2 && sr >= spreadRank("medium"))) {
            return "warning";
        }
        if (rr >= 2 || sr >= spreadRank("medium")) {
            return "attention";
        }
        return "normal";
    }

    /** 风险等级序（general=1 / moderate=2 / severe=3；未知按 1） */
    public static int riskRank(String risk) {
        if ("severe".equals(risk)) {
            return 3;
        }
        if ("moderate".equals(risk)) {
            return 2;
        }
        return 1;
    }

    /** 传播量级序（low=1 / medium=2 / high=3 / viral=4；未知按 1） */
    public static int spreadRank(String spread) {
        if ("viral".equals(spread)) {
            return 4;
        }
        if ("high".equals(spread)) {
            return 3;
        }
        if ("medium".equals(spread)) {
            return 2;
        }
        return 1;
    }

    /* ------------------------------------------------------------------ 文本 */

    /** 主题：优先取标题；标题空则取正文首句 */
    public static String topicOf(String title, String text) {
        String t = title == null ? "" : title.trim();
        if (!t.isEmpty()) {
            return t.length() > 60 ? t.substring(0, 60) : t;
        }
        String s = firstSentence(text);
        return s.length() > 60 ? s.substring(0, 60) : s;
    }

    /** 摘要：取正文前 120 字（正文空则退回标题） */
    static String summaryOf(String content, String title) {
        String s = content == null ? "" : content.trim();
        if (s.isEmpty()) {
            s = title == null ? "" : title.trim();
        }
        s = s.replace(CR, ' ').replace(LF, ' ');
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    /** 处置建议：按分级给出模板化建议（不含具体内容，避免编造事实） */
    static String suggest(String risk, String level) {
        if ("urgent".equals(level)) {
            return "紧急：建议立即核实事实，评估是否需要官方回应，并同步舆情主管介入。";
        }
        if ("warning".equals(level) || "severe".equals(risk)) {
            return "预警：建议尽快核实并向责任部门通报，持续跟踪传播量变化。";
        }
        if ("attention".equals(level) || "moderate".equals(risk)) {
            return "关注：建议纳入日常跟踪，出现量级上升时升级处理。";
        }
        return "常规记录留存，无需特别处置。";
    }

    /** 规则标签：来源 + 倾向 + 风险 */
    static List<String> ruleTags(String senti, String risk, String spread) {
        Set<String> tags = new LinkedHashSet<>();
        tags.add("规则研判");
        if ("negative".equals(senti)) {
            tags.add("负面");
        } else if ("positive".equals(senti)) {
            tags.add("正面");
        } else {
            tags.add("中性");
        }
        if ("severe".equals(risk)) {
            tags.add("高风险");
        } else if ("moderate".equals(risk)) {
            tags.add("中风险");
        }
        if ("viral".equals(spread)) {
            tags.add("高传播");
        }
        return new ArrayList<>(tags);
    }

    /** 置信度：命中特征词越多越有把握，但封顶 60（规则结论不该显得比模型可信） */
    static BigDecimal confidenceOf(int hits) {
        int c = Math.min(20 + hits * 8, 60);
        return BigDecimal.valueOf(c).setScale(2, RoundingMode.HALF_UP);
    }

    static String firstSentence(String text) {
        if (text == null) {
            return "";
        }
        String s = text.trim();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '。' || c == '！' || c == '？' || c == '.' || c == '!' || c == '?') {
                return s.substring(0, i + 1);
            }
            if (i > 80) {
                break;
            }
        }
        return s.length() > 80 ? s.substring(0, 80) : s;
    }

    static int countHits(String text, List<String> dict) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (String w : dict) {
            int from = 0;
            while (true) {
                int i = text.indexOf(w, from);
                if (i < 0) {
                    break;
                }
                n++;
                from = i + w.length();
            }
        }
        return n;
    }

    private static String join(String a, String b) {
        String x = a == null ? "" : a;
        String y = b == null ? "" : b;
        if (x.isEmpty()) {
            return y;
        }
        if (y.isEmpty()) {
            return x;
        }
        return x + ' ' + y;
    }

    private static long nz(Long v) {
        return v == null ? 0L : Math.max(0L, v);
    }
}
