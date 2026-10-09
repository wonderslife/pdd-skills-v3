package org.dromara.yuqing.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 采集用关键词规格：一个「检索意图」的完整表达。
 *
 * <p>它是关键词库（F-002）与采集引擎（F-004）之间的契约：</p>
 * <ul>
 *   <li>{@link #searchTerms} —— 真正拼进 {@code {kw}} 占位符的词（组合表达式取「检索组」）</li>
 *   <li>{@link #mustGroups} —— 本地匹配组，AND 关系；组内 OR</li>
 *   <li>{@link #excludeTerms} —— 该词自带的排除词</li>
 *   <li>{@link #filterMode} —— 过滤强度</li>
 * </ul>
 *
 * @author ruoyi
 */
@Data
public class KeywordSpec implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 命中词回写上限（对齐 hit_keywords 字段容量的保守值） */
    private static final int MAX_HIT_TEXT = 200;

    /**
     * 本地过滤强度。
     */
    public enum FilterMode {
        /** 不做过滤：检索到什么就采什么（普通单词默认，避免搜索引擎分词扩召回被误杀） */
        OFF,
        /** 至少命中一个组即通过 */
        LOOSE,
        /** 每个组都要命中，且不含排除词（组合表达式默认） */
        STRICT
    }

    /** 关键词ID（yq_keyword.keyword_id） */
    private Long keywordId;

    /** 原始文本 / 表达式 */
    private String raw;

    /** 关键词类型：precise / fuzzy / combo / negative */
    private String keywordType;

    /** 关键词分类 */
    private String keywordCategory;

    /** 生效的匹配策略（任务级覆盖 > 关键词类型） */
    private String matchStrategy;

    /** 检索词（用于 {kw} 填充） */
    private List<String> searchTerms = new ArrayList<>();

    /** 必须命中的词组（AND）；组内 OR */
    private List<List<String>> mustGroups = new ArrayList<>();

    /** 排除词 */
    private List<String> excludeTerms = new ArrayList<>();

    /** 本地过滤强度 */
    private FilterMode filterMode = FilterMode.OFF;

    /** 解析错误；非空表示该关键词不可用（会在调度日志中暴露，避免静默采不到） */
    private String parseError;

    /**
     * 是否可用于发起检索。
     *
     * @return true 表示检索词齐备且无解析错误
     */
    public boolean isUsable() {
        return parseError == null && !searchTerms.isEmpty();
    }

    /**
     * 是否启用本地过滤。
     *
     * @return true 表示需要做组合条件匹配
     */
    public boolean isFilterEnabled() {
        return filterMode != FilterMode.OFF && !mustGroups.isEmpty();
    }

    /**
     * 组合条件匹配：所有组都要命中（STRICT）或至少一组命中（LOOSE），且不含任何排除词。
     *
     * @param text 待检文本（标题 + 正文 + 标签等拼接）
     * @return true 表示通过
     */
    public boolean matches(String text) {
        if (filterMode == FilterMode.OFF || mustGroups.isEmpty()) {
            return true;
        }
        if (text == null || text.isEmpty()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String exclude : excludeTerms) {
            if (!exclude.isEmpty() && lower.contains(exclude.toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        int hitGroups = 0;
        for (List<String> group : mustGroups) {
            boolean any = false;
            for (String word : group) {
                if (!word.isEmpty() && lower.contains(word.toLowerCase(Locale.ROOT))) {
                    any = true;
                    break;
                }
            }
            if (any) {
                hitGroups++;
            } else if (filterMode == FilterMode.STRICT) {
                return false;
            }
        }
        return hitGroups > 0;
    }

    /**
     * 命中的词，逗号分隔，用于回写 hit_keywords（说明「为什么抓到这条」）。
     *
     * @param text 待检文本
     * @return 命中词串；无命中返回空串
     */
    public String hits(String text) {
        if (text == null || text.isEmpty() || mustGroups.isEmpty()) {
            return "";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        Set<String> found = new LinkedHashSet<>();
        for (List<String> group : mustGroups) {
            for (String word : group) {
                if (!word.isEmpty() && lower.contains(word.toLowerCase(Locale.ROOT))) {
                    found.add(word);
                }
            }
        }
        if (found.isEmpty()) {
            return "";
        }
        String joined = String.join(",", found);
        return joined.length() > MAX_HIT_TEXT ? joined.substring(0, MAX_HIT_TEXT) : joined;
    }

    /**
     * 普通单词关键词：只检索、不过滤。
     *
     * @param text 词
     * @return 规格
     */
    public static KeywordSpec simple(String text) {
        KeywordSpec spec = new KeywordSpec();
        spec.setRaw(text);
        spec.setKeywordType("fuzzy");
        spec.setFilterMode(FilterMode.OFF);
        spec.setSearchTerms(new ArrayList<>());
        if (text != null && !text.isBlank()) {
            spec.getSearchTerms().add(text.trim());
        }
        return spec;
    }

    /**
     * 由组合表达式构建。
     *
     * @param keywordId       关键词ID
     * @param raw             原始文本
     * @param keywordType     类型
     * @param keywordCategory 分类
     * @param expression      已解析表达式
     * @param searchGroup     检索词组选择：last / first / fewest
     * @return 规格
     */
    public static KeywordSpec fromExpression(Long keywordId, String raw, String keywordType,
                                             String keywordCategory, KeywordExpression expression,
                                             String searchGroup) {
        KeywordSpec spec = new KeywordSpec();
        spec.setKeywordId(keywordId);
        spec.setRaw(raw);
        spec.setKeywordType(keywordType);
        spec.setKeywordCategory(keywordCategory);
        spec.setMustGroups(new ArrayList<>(expression.getGroups()));
        spec.setExcludeTerms(new ArrayList<>(expression.getExcludes()));
        spec.setSearchTerms(pickSearchTerms(expression.getGroups(), searchGroup));
        spec.setFilterMode(FilterMode.STRICT);
        if (spec.getSearchTerms().isEmpty()) {
            spec.setParseError("表达式缺少检索词组，无法发起检索");
        }
        return spec;
    }

    /**
     * 解析失败的占位规格。
     *
     * @param keywordId 关键词ID
     * @param raw       原始文本
     * @param message   失败原因
     * @return 规格
     */
    public static KeywordSpec failed(Long keywordId, String raw, String message) {
        KeywordSpec spec = new KeywordSpec();
        spec.setKeywordId(keywordId);
        spec.setRaw(raw);
        spec.setParseError(message);
        return spec;
    }

    /**
     * 选择检索词组。
     *
     * @param groups 全部组
     * @param mode   last（默认）/ first / fewest
     * @return 检索词
     */
    private static List<String> pickSearchTerms(List<List<String>> groups, String mode) {
        List<String> terms = new ArrayList<>();
        if (groups == null || groups.isEmpty()) {
            return terms;
        }
        int index;
        if ("first".equalsIgnoreCase(mode)) {
            index = 0;
        } else if ("fewest".equalsIgnoreCase(mode)) {
            index = 0;
            for (int i = 1; i < groups.size(); i++) {
                if (groups.get(i).size() < groups.get(index).size()) {
                    index = i;
                }
            }
        } else {
            index = groups.size() - 1;
        }
        terms.addAll(groups.get(index));
        return terms;
    }
}
