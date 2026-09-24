package org.dromara.yuqing.collect.clean;

import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.domain.YqNoiseRule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 一条 {@code yq_noise_rule} 的运行时形态（预编译，避免每条正文重复编译正则）。
 *
 * <p><b>正则降级约定：</b>业务在后台填的正则经常写错（未转义的括号、Java 不支持的语法）。
 * 编译失败时【不抛异常、不停链路】，降级为「按字面量包含匹配」并保留错误信息，
 * 保证一条坏规则不会让整批采集静默失败。</p>
 *
 * @author ruoyi
 */
public final class CompiledNoiseRule {

    /** 关键词模式下 match_value 的分隔符（中英文逗号、顿号、分号、竖线） */
    private static final String KEYWORD_DELIMS = ",，、;；|";

    private final Long ruleId;

    private final String ruleName;

    private final NoiseCategory category;

    private final String matchType;

    private final String matchValue;

    private final int priority;

    private final List<String> keywords;

    private final Pattern pattern;

    private final String compileError;

    private CompiledNoiseRule(Long ruleId, String ruleName, NoiseCategory category, String matchType,
                              String matchValue, int priority, List<String> keywords, Pattern pattern, String compileError) {
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.category = category;
        this.matchType = matchType;
        this.matchValue = matchValue;
        this.priority = priority;
        this.keywords = keywords;
        this.pattern = pattern;
        this.compileError = compileError;
    }

    /**
     * 由数据库实体编译。
     *
     * @param rule 降噪规则
     * @return 编译后规则；入参为空或类别无法识别时返回 null（调用方直接跳过）
     */
    public static CompiledNoiseRule from(YqNoiseRule rule) {
        if (rule == null || StringUtils.isBlank(rule.getMatchValue())) {
            return null;
        }
        NoiseCategory category = NoiseCategory.of(rule.getNoiseCategory());
        if (category == null) {
            return null;
        }
        String type = rule.getMatchType() == null ? "keyword" : rule.getMatchType().trim().toLowerCase(Locale.ROOT);
        String value = rule.getMatchValue().trim();
        int priority = rule.getPriority() == null ? 10 : rule.getPriority();
        List<String> keywords = Collections.emptyList();
        Pattern pattern = null;
        String error = null;
        if ("regex".equals(type)) {
            try {
                pattern = Pattern.compile(value, Pattern.CASE_INSENSITIVE);
            } catch (Exception e) {
                // 降级为字面量匹配，并留下证据便于后台定位是哪条规则写错了
                error = "正则编译失败，已降级为字面量匹配: " + e.getMessage();
                keywords = splitKeywords(value);
            }
        } else {
            keywords = splitKeywords(value);
        }
        return new CompiledNoiseRule(rule.getRuleId(), rule.getRuleName(), category, type, value,
            priority, keywords, pattern, error);
    }

    /**
     * 是否命中。
     *
     * @param text 待判定文本（已净化）；为空时恒为 false
     * @return true 表示命中该规则
     */
    public boolean hits(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        if (pattern != null) {
            return pattern.matcher(text).find();
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String kw : keywords) {
            if (!kw.isEmpty() && lower.contains(kw)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 命中证据：关键词模式回关键词，正则模式回实际匹配到的片段（截断到 50 字）。
     *
     * @param text 待判定文本
     * @return 证据串；未命中返回空串
     */
    public String evidence(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        if (pattern != null) {
            java.util.regex.Matcher m = pattern.matcher(text);
            if (m.find()) {
                String s = m.group();
                return s.length() > 50 ? s.substring(0, 50) : s;
            }
            return "";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String kw : keywords) {
            if (!kw.isEmpty() && lower.contains(kw)) {
                return kw;
            }
        }
        return "";
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public String getMatchType() {
        return matchType;
    }

    public String getMatchValue() {
        return matchValue;
    }

    public int getPriority() {
        return priority;
    }

    public String getCompileError() {
        return compileError;
    }

    /**
     * 该规则是否降级过（正则写错）。
     *
     * @return true 表示正则编译失败、当前按字面量匹配
     */
    public boolean isDegraded() {
        return compileError != null;
    }

    /**
     * 按中英文分隔符拆分关键词，空片段丢弃、统一小写。
     */
    private static List<String> splitKeywords(String value) {
        List<String> out = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (KEYWORD_DELIMS.indexOf(c) >= 0) {
                addKeyword(out, sb);
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        addKeyword(out, sb);
        return out;
    }

    private static void addKeyword(List<String> out, StringBuilder sb) {
        String s = sb.toString().trim().toLowerCase(Locale.ROOT);
        if (!s.isEmpty()) {
            out.add(s);
        }
    }
}
