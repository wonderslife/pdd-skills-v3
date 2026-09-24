package org.dromara.yuqing.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 采集单元级关键词匹配器：串起「检索词」与「本地匹配规则」。
 *
 * <p>由 {@code YqCollectServiceImpl} 在构建采集单元时装配一次，随单元传给适配器与管道：</p>
 * <ul>
 *   <li>适配器用 {@link #effectiveSearchTerms()} 决定要为哪几个词各发一轮请求</li>
 *   <li>管道用 {@link #accept(String)} 决定哪条内容允许进 Doris</li>
 * </ul>
 *
 * <p>空匹配器（没有任何关键词）时 {@link #accept(String)} 恒为 true ——
 * 链接导入（F-005）等非爬虫入口复用同一条管道时不会被误过滤。</p>
 *
 * @author ruoyi
 */
@Data
public class KeywordMatcher implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 命中词回写上限 */
    private static final int MAX_HIT_TEXT = 300;

    /** 全部关键词规格（含只检索不过滤的） */
    private List<KeywordSpec> specs = new ArrayList<>();

    /** 仅启用本地过滤的规格 */
    private List<KeywordSpec> filters = new ArrayList<>();

    /** 去重截断后的检索词；空表示「不带关键词抓取列表页」 */
    private List<String> searchTerms = new ArrayList<>();

    /** 降噪排除规则 */
    private List<ExcludeRule> excludeRules = new ArrayList<>();

    /** 表达式解析失败的关键词（调度日志中暴露，避免静默采不到） */
    private List<String> parseErrors = new ArrayList<>();

    /**
     * 是否配置了关键词。
     *
     * @return true 表示有检索诉求
     */
    public boolean enabled() {
        return !specs.isEmpty();
    }

    /**
     * 是否需要做本地过滤。
     *
     * @return true 表示有过滤规则或排除规则
     */
    public boolean filterEnabled() {
        return !filters.isEmpty() || !excludeRules.isEmpty();
    }

    /**
     * 适配器实际使用的检索词；无关键词时返回单元素空串，保持「无词也能抓列表页」的行为。
     *
     * @return 检索词列表
     */
    public List<String> effectiveSearchTerms() {
        return searchTerms.isEmpty() ? List.of("") : searchTerms;
    }

    /**
     * 是否接纳这条内容。
     *
     * @param text 待检文本
     * @return true 表示允许入库
     */
    public boolean accept(String text) {
        if (!filterEnabled()) {
            return true;
        }
        if (text == null || text.isEmpty()) {
            return filters.isEmpty();
        }
        for (ExcludeRule rule : excludeRules) {
            if (rule.hit(text)) {
                return false;
            }
        }
        if (filters.isEmpty()) {
            return true;
        }
        for (KeywordSpec spec : filters) {
            if (spec.matches(text)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 命中的关键词（回写 hit_keywords，用于核查「为什么抓到这条」）。
     *
     * @param text 待检文本
     * @return 命中词串
     */
    public String hitOf(String text) {
        if (text == null || text.isEmpty() || filters.isEmpty()) {
            return "";
        }
        Set<String> hits = new LinkedHashSet<>();
        for (KeywordSpec spec : filters) {
            String hit = spec.hits(text);
            if (!hit.isEmpty()) {
                hits.add(hit);
            }
        }
        if (hits.isEmpty()) {
            return "";
        }
        String joined = String.join(",", hits);
        return joined.length() > MAX_HIT_TEXT ? joined.substring(0, MAX_HIT_TEXT) : joined;
    }

    public static Builder builder() {
        return new Builder();
    }

    /**
     * 匹配器构建器。
     */
    public static class Builder {

        private final List<KeywordSpec> specs = new ArrayList<>();

        private final List<String> excludeTerms = new ArrayList<>();

        private final List<ExcludeRule> rules = new ArrayList<>();

        private String searchGroup = "last";

        private int maxSearchTerms = 8;

        public Builder spec(KeywordSpec spec) {
            if (spec != null) {
                this.specs.add(spec);
            }
            return this;
        }

        public Builder specs(Collection<KeywordSpec> list) {
            if (list != null) {
                for (KeywordSpec spec : list) {
                    spec(spec);
                }
            }
            return this;
        }

        public Builder excludeTerms(Collection<String> terms) {
            if (terms != null) {
                for (String term : terms) {
                    if (term != null && !term.isBlank()) {
                        this.excludeTerms.add(term.trim());
                    }
                }
            }
            return this;
        }

        public Builder rules(Collection<ExcludeRule> list) {
            if (list != null) {
                this.rules.addAll(list);
            }
            return this;
        }

        public Builder searchGroup(String mode) {
            if (mode != null && !mode.isBlank()) {
                this.searchGroup = mode;
            }
            return this;
        }

        public Builder maxSearchTerms(int max) {
            this.maxSearchTerms = max;
            return this;
        }

        public KeywordMatcher build() {
            KeywordMatcher matcher = new KeywordMatcher();
            matcher.setSpecs(new ArrayList<>(specs));
            List<ExcludeRule> excludeRules = new ArrayList<>(rules);
            for (String term : excludeTerms) {
                excludeRules.add(ExcludeRule.keyword("关键词库否定词", term));
            }
            matcher.setExcludeRules(excludeRules);

            List<KeywordSpec> filters = new ArrayList<>();
            Set<String> terms = new LinkedHashSet<>();
            List<String> errors = new ArrayList<>();
            for (KeywordSpec spec : specs) {
                if (spec.isFilterEnabled()) {
                    filters.add(spec);
                }
                terms.addAll(spec.getSearchTerms());
                if (spec.getParseError() != null) {
                    errors.add("关键词「" + spec.getRaw() + "」" + spec.getParseError());
                }
            }
            matcher.setFilters(filters);
            List<String> list = new ArrayList<>(terms);
            if (maxSearchTerms > 0 && list.size() > maxSearchTerms) {
                list = new ArrayList<>(list.subList(0, maxSearchTerms));
            }
            matcher.setSearchTerms(list);
            matcher.setParseErrors(errors);
            return matcher;
        }
    }
}
