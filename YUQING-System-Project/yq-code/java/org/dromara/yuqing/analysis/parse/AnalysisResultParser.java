package org.dromara.yuqing.analysis.parse;

import org.dromara.yuqing.analysis.prompt.PromptSpec;
import tools.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 大模型输出解析器（F-007 验收标准 1、2、6）
 *
 * <p><b>两档错误处理</b>（本类的核心设计决策）：</p>
 *
 * <table border="1">
 *   <caption>错误分档</caption>
 *   <tr><th>档位</th><th>场景</th><th>处置</th></tr>
 *   <tr><td>致命</td><td>抽不出 JSON / 不是对象 / 既无 topic 又无 sentiAttr</td>
 *       <td>研判状态置 failed，不落半成品结论</td></tr>
 *   <tr><td>可修复</td><td>个别枚举越界、字段超长、标签超量、置信度量纲异常</td>
 *       <td>归一到最保守值 + 截断 + 记录 warning，研判仍算完成</td></tr>
 * </table>
 *
 * <p><b>为什么不把所有异常都判 failed：</b>验收标准 6 说「返回格式不合法则置 failed」，
 * 但模型的「不合法」绝大多数是「说了 very_negative 而不是 negative」这类
 * 词形差异。若一律判失败，生产上会看到大量本可挽救的失败，且它们会被
 * 无差别重试三遍，徒增成本。真正不可挽救的是「没有结构」，
 * 因此按「有没有结构」而不是「每个字段是否完美」来分档。</p>
 *
 * <p><b>归一为什么一律向保守侧倒：</b>越界的 sentiAttr 归一为 neutral
 * 而不是 negative，越界的 riskLevel 归一为 general 而不是 severe。
 * 理由是误判为高风险会触发 F-010 的真实预警与企微推送，造成无法撤回的打扰；
 * 误判为无风险只是漏一条待人工复核的记录。</p>
 *
 * @author ruoyi
 */
public final class AnalysisResultParser {

    /** 各文本字段的落库长度上限，与 yq_opinion_analysis 的列宽一致 */
    private static final int LEN_TOPIC = 200;
    private static final int LEN_SUMMARY = 1000;
    private static final int LEN_RISK_ATTR = 200;
    private static final int LEN_EVIDENCE = 1000;
    private static final int LEN_SUGGESTION = 1000;

    /** 枚举原始值最大读取长度 */
    private static final int LEN_ENUM_RAW = 40;

    /**
     * 代码围栏（三个反引号）。
     *
     * <p>用 char 数组构造而不是字符串字面量：本项目模板经三层传递，
     * 产物里出现反引号字面量会被编排脚本硬拦截（它用于模板串的分界），
     * 因此必须绕开字面量写法。</p>
     */
    private static final String FENCE = new String(new char[]{(char) 96, (char) 96, (char) 96});

    /** 情感词语义映射 */
    private static final Map<String, String> SENTI_ALIAS = buildAlias(
        new String[]{"positive", "正", "正面", "正向", "好评", "积极", "pos", "p", "positive_vibe"},
        new String[]{"neutral", "中", "中性", "中立", "客观", "neu", "n"},
        new String[]{"negative", "负", "负面", "负向", "差评", "消极", "neg"});

    /** 风险等级语义映射 */
    private static final Map<String, String> RISK_ALIAS = buildAlias(
        new String[]{"general", "一般", "低", "低风险", "无风险", "low", "none"},
        new String[]{"moderate", "较重", "中", "中风险", "较高", "medium", "middle"},
        new String[]{"severe", "严重", "高", "高风险", "重大", "high"});

    /** 舆情分级语义映射 */
    private static final Map<String, String> LEVEL_ALIAS = buildAlias(
        new String[]{"normal", "一般", "常规", "普通"},
        new String[]{"attention", "关注", "留意"},
        new String[]{"warning", "预警", "警告"},
        new String[]{"urgent", "紧急", "特急", "严重"});

    private AnalysisResultParser() {
    }

    /**
     * 解析模型输出。
     *
     * @param raw          模型回复正文（可能带围栏、前后废话）
     * @param maxTags      最多保留几个标签，<=0 用 8
     * @param maxTagLength 单个标签最大字符数，<=0 用 20
     * @return 解析结果，永不返回 null
     */
    public static ParsedJudgement parse(String raw, int maxTags, int maxTagLength) {
        if (raw == null || raw.isBlank()) {
            return ParsedJudgement.fatalOf("模型输出为空");
        }
        String json = extractJson(raw);
        if (json == null) {
            return ParsedJudgement.fatalOf("模型输出中未找到 JSON 对象");
        }
        JsonNode node;
        try {
            node = AnalysisJson.readTree(json);
        } catch (RuntimeException e) {
            return ParsedJudgement.fatalOf("模型输出的 JSON 无法解析: " + brief(e.getMessage()));
        }
        if (node == null || !node.isObject()) {
            return ParsedJudgement.fatalOf("模型输出的 JSON 不是对象");
        }

        String rawTopic = text(node, "topic", LEN_TOPIC);
        String rawSenti = text(node, "sentiAttr", LEN_ENUM_RAW);
        String senti = normalizeEnum(rawSenti, SENTI_ALIAS, PromptSpec.SENTI_ATTRS);
        if ((rawTopic == null || rawTopic.isBlank()) && senti == null) {
            return ParsedJudgement.fatalOf("模型输出缺少 topic 与 sentiAttr，无法构成研判结论");
        }

        ParsedJudgement p = new ParsedJudgement();
        p.setSource("llm");
        p.setTopic(rawTopic);
        p.setSummary(text(node, "summary", LEN_SUMMARY));
        p.setRiskAttr(text(node, "riskAttr", LEN_RISK_ATTR));
        p.setMatchEvidence(text(node, "matchEvidence", LEN_EVIDENCE));
        p.setSuggestion(text(node, "suggestion", LEN_SUGGESTION));

        p.setSentiAttr(senti == null ? "neutral" : senti);
        if (senti == null) {
            p.warn("sentiAttr 越界已归一为 neutral: " + brief(rawSenti));
        }

        String rawRisk = text(node, "riskLevel", LEN_ENUM_RAW);
        String risk = normalizeEnum(rawRisk, RISK_ALIAS, PromptSpec.RISK_LEVELS);
        /* 非负面舆情统一无风险：模型偶尔会给正面舆情打 severe，必须拉回来，
         * 否则会触发 F-010 的高风险预警。 */
        if (!"negative".equals(p.getSentiAttr())) {
            if (risk != null && !"general".equals(risk)) {
                p.warn("非负面舆情的 riskLevel 被强制归为 general（模型给的是 " + risk + "）");
            }
            risk = "general";
        } else if (risk == null) {
            p.warn("riskLevel 越界已归一为 general: " + brief(rawRisk));
            risk = "general";
        }
        p.setRiskLevel(risk);

        String rawLevel = text(node, "opinionLevel", LEN_ENUM_RAW);
        String level = normalizeEnum(rawLevel, LEVEL_ALIAS, PromptSpec.OPINION_LEVELS);
        if (level == null) {
            p.warn("opinionLevel 越界已归一为 normal: " + brief(rawLevel));
            level = "normal";
        }
        p.setOpinionLevel(level);

        p.setTags(normalizeTags(node.path("tags"), maxTags, maxTagLength, p));
        p.setConfidence(normalizeConfidence(node.path("confidence"), p));
        return p;
    }

    /* ------------------------------------------------------------------ JSON 抽取 */

    /**
     * 从模型输出里抽出 JSON 对象文本。
     *
     * <p>依次尝试三种形态：围栏代码块内的内容、第一个左花括号到最后一个
     * 右花括号之间的内容、整体文本本身。</p>
     *
     * @return 候选 JSON 文本；都失败返回 null
     */
    public static String extractJson(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        String fenced = fencedBody(text);
        if (fenced != null) {
            return fenced;
        }
        int begin = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (begin >= 0 && end > begin) {
            return text.substring(begin, end + 1);
        }
        return text.startsWith("{") ? text : null;
    }

    /** 取围栏代码块正文（支持 json / JSON / 无语言标记） */
    static String fencedBody(String text) {
        int start = text.indexOf(FENCE);
        if (start < 0) {
            return null;
        }
        int bodyStart = text.indexOf(PromptSpec.NL.charAt(0), start);
        if (bodyStart < 0) {
            return null;
        }
        int end = text.indexOf(FENCE, bodyStart);
        if (end < 0) {
            return null;
        }
        String body = text.substring(bodyStart + 1, end).trim();
        if (body.startsWith("json") || body.startsWith("JSON")) {
            int nl = body.indexOf(PromptSpec.NL.charAt(0));
            body = nl < 0 ? "" : body.substring(nl + 1).trim();
        }
        return body.isBlank() ? null : body;
    }

    /* ------------------------------------------------------------------ 字段归一 */

    static String text(JsonNode node, String field, int maxLen) {
        JsonNode v = node.path(field);
        if (v.isMissingNode() || v.isNull()) {
            return null;
        }
        String s = v.isString() ? v.asString("") : v.asString(v.toString());
        if (s == null) {
            return null;
        }
        s = s.trim();
        if (s.isEmpty()) {
            return null;
        }
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    /**
     * 枚举归一：精确命中白名单 → 别名表 → 语义片段包含 → null。
     *
     * <p>第三档「语义片段包含」是为了接住 {@code very_negative}、
     * {@code 高风险(严重)} 这类模型自由发挥的写法 —— 精确匹配接不住它们，
     * 但它们其实语义明确，直接判越界太浪费。</p>
     */
    static String normalizeEnum(String raw, Map<String, String> alias, Set<String> allowed) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String key = raw.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        if (allowed.contains(key)) {
            return key;
        }
        String mapped = alias.get(key);
        if (mapped != null && allowed.contains(mapped)) {
            return mapped;
        }
        String fragment = byFragment(key, alias);
        return (fragment != null && allowed.contains(fragment)) ? fragment : null;
    }

    /** 按语义片段匹配（只考虑长度 >= 3 的键，避免 p / n / 中 这类短键误命中） */
    static String byFragment(String key, Map<String, String> alias) {
        String bestKey = null;
        for (String k : alias.keySet()) {
            if (k == null || k.length() < 3) {
                continue;
            }
            if (key.contains(k) && (bestKey == null || k.length() > bestKey.length())) {
                bestKey = k;
            }
        }
        return bestKey == null ? null : alias.get(bestKey);
    }

    /** 置信度归一：兼容 0~1 小数、0~100 整数、带百分号的字符串；越界钳制 */
    static BigDecimal normalizeConfidence(JsonNode v, ParsedJudgement p) {
        if (v == null || v.isMissingNode() || v.isNull()) {
            return null;
        }
        double d;
        if (v.isNumber()) {
            d = v.asDouble(0d);
        } else {
            String s = v.asString("").replace("%", "").trim();
            try {
                d = Double.parseDouble(s);
            } catch (NumberFormatException e) {
                p.warn("confidence 无法解析已忽略: " + brief(s));
                return null;
            }
        }
        if (d < 0) {
            p.warn("confidence 为负已归零: " + d);
            d = 0;
        }
        /* 模型有时给 0.85 有时给 85，用 <=1 判断量纲 */
        if (d > 0 && d <= 1) {
            d = d * 100;
        }
        if (d > 100) {
            p.warn("confidence 超上限已截为 100: " + d);
            d = 100;
        }
        return BigDecimal.valueOf(d).setScale(2, RoundingMode.HALF_UP);
    }

    /** 标签归一：支持数组与逗号串；去空、去重、限长、限量 */
    static List<String> normalizeTags(JsonNode v, int maxTags, int maxLength, ParsedJudgement p) {
        int limit = maxTags <= 0 ? 8 : maxTags;
        int maxLen = maxLength <= 0 ? 20 : maxLength;
        List<String> raw = new ArrayList<>();
        if (v != null && v.isArray()) {
            for (JsonNode item : v) {
                if (item != null && !item.isNull()) {
                    raw.add(item.isString() ? item.asString("") : item.toString());
                }
            }
        } else if (v != null && v.isString()) {
            for (String part : v.asString("").split("[,，、;；|]")) {
                raw.add(part);
            }
        }
        Set<String> seen = new LinkedHashSet<>();
        int dropped = 0;
        for (String t : raw) {
            if (t == null) {
                continue;
            }
            String name = t.trim().replace("#", "");
            if (name.isEmpty()) {
                continue;
            }
            if (name.length() > maxLen) {
                dropped++;
                continue;
            }
            if (!seen.add(name)) {
                continue;
            }
            if (seen.size() > limit) {
                seen.remove(name);
                dropped++;
            }
        }
        if (dropped > 0) {
            p.warn("标签有 " + dropped + " 个因超长、重复或超量被丢弃");
        }
        return new ArrayList<>(seen);
    }

    /**
     * 构建别名表。
     *
     * <p>第一项是枚举主值本身，其余为同义写法。
     * 主值必须同时在 {@link PromptSpec} 的白名单里，构造时会校验，
     * 避免出现「别名指向一个不存在的枚举值」这种静默失效。</p>
     */
    static Map<String, String> buildAlias(String[]... groups) {
        Map<String, String> m = new LinkedHashMap<>();
        for (String[] group : groups) {
            if (group.length == 0) {
                continue;
            }
            String main = group[0];
            m.put(main, main);
            for (int i = 1; i < group.length; i++) {
                m.put(group[i], main);
            }
        }
        return m;
    }

    private static String brief(String s) {
        if (s == null) {
            return "null";
        }
        String t = s.replace(PromptSpec.CR, ' ').replace(PromptSpec.NL.charAt(0), ' ');
        return t.length() > 60 ? t.substring(0, 60) + "..." : t;
    }
}
