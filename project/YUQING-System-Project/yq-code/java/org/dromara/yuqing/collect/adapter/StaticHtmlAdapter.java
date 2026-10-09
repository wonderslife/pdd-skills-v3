package org.dromara.yuqing.collect.adapter;

import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.http.FetchRequest;
import org.dromara.yuqing.collect.http.FetchResponse;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 静态 HTML 适配器：HttpClient 直连 + Jsoup 选择器解析（《技术架构说明》§5.1 A 档）。
 *
 * <p>覆盖新闻门户、政务网站、地方媒体等静态源，是成本最低、最稳的通道。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class StaticHtmlAdapter extends AbstractSiteAdapter {

    public StaticHtmlAdapter(HttpFetcher httpFetcher, YqCollectProperties props) {
        super(httpFetcher, props);
    }

    @Override
    public String entryType() {
        return "static";
    }

    @Override
    public List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception {
        if (spec.getListItemSelector() == null || spec.getListItemSelector().isBlank()) {
            throw new IllegalStateException("适配器 " + spec.getCode() + " 缺少 listItemSelector，无法解析列表页");
        }
        return fetchForEachKeyword(unit, ctx.getMaxRecords(), (keyword, budget, seenUrls) ->
            fetchByKeyword(unit, spec, ctx, keyword, budget, seenUrls));
    }

    /**
     * 按单个检索词抓取若干页。
     *
     * @param budget   本词条数上限；0 表示不限
     * @param seenUrls 跨检索词共享的批内 URL 去重集合
     */
    private List<RawOpinion> fetchByKeyword(CollectUnit unit, AdapterSpec spec, AdapterContext ctx,
                                           String keyword, int budget, Set<String> seenUrls) throws Exception {
        List<RawOpinion> result = new ArrayList<>();
        int start = spec.getPageRule() == null ? 1 : spec.getPageRule().getStart();
        int maxPages = Math.max(1, Math.min(spec.maxPage(), ctx.getMaxPages()));
        for (int page = start; page < start + maxPages; page++) {
            String url = fillUrl(spec.getListUrl(), keyword, page);
            FetchRequest request = buildRequest(unit, spec, url, keyword);
            FetchResponse response = httpFetcher.execute(request);
            if (response.getBlockSignal().isBlocked()) {
                throw new IOException("列表页被拦截: " + response.getBlockSignal().getDetail());
            }
            Document doc = Jsoup.parse(response.getBody(), url);
            Elements items = doc.select(spec.getListItemSelector());
            if (items.isEmpty()) {
                break;
            }
            boolean pageContributed = false;
            for (Element item : items) {
                RawOpinion opinion = mapItem(item, unit, spec, ctx, keyword);
                if (opinion == null) {
                    continue;
                }
                boolean fresh = !beforeWatermark(opinion.getPublishTime(), ctx.getWatermark())
                    && seenUrls.add(opinion.getOpinionUrl());
                if (fresh) {
                    pageContributed = true;
                    result.add(opinion);
                }
                if (budget > 0 && result.size() >= budget) {
                    return result;
                }
            }
            /* 整页无新增 → 终止翻页（《技术架构说明》§5.4 增量水位线 + 批内去重）。
               除「整页早于水位线」外，也能防住忽略 page 参数、每页回同一批的坏站点。 */
            if (!pageContributed) {
                break;
            }
        }
        return result;
    }

    /**
     * 把列表项映射为原始舆情。
     */
    private RawOpinion mapItem(Element item, CollectUnit unit, AdapterSpec spec, AdapterContext ctx, String keyword) {
        String title = extract(item, spec.field("title"));
        String url = extract(item, spec.field("opinionUrl"));
        if (url == null || url.isBlank()) {
            return null;
        }
        RawOpinion opinion = new RawOpinion();
        opinion.setTitle(title);
        opinion.setOpinionUrl(url);
        String author = extract(item, spec.field("author"));
        opinion.setAuthor(author);
        opinion.setPublishTime(TimeParser.parse(extract(item, spec.field("publishTime")), patternOf(spec, "publishTime")));
        opinion.setRegion(extract(item, spec.field("region")));
        opinion.setDeviceInfo(extract(item, spec.field("deviceInfo")));
        opinion.setTopicTags(extract(item, spec.field("topicTags")));
        opinion.setLikeCount(parseLong(extract(item, spec.field("likeCount"))));
        opinion.setCommentCount(parseLong(extract(item, spec.field("commentCount"))));
        opinion.setShareCount(parseLong(extract(item, spec.field("shareCount"))));
        opinion.setReadCount(parseLong(extract(item, spec.field("readCount"))));
        opinion.setContent(extract(item, spec.field("content")));
        fillCommon(opinion, unit, ctx, keyword);
        return opinion;
    }

    /**
     * 按规则抽取字段值。
     */
    private String extract(Element scope, AdapterSpec.FieldRule rule) {
        if (rule == null || rule.getSelector() == null || rule.getSelector().isBlank()) {
            return rule == null ? null : emptyToNull(rule.getDefaultValue());
        }
        Element target = scope.selectFirst(rule.getSelector());
        if (target == null) {
            return emptyToNull(rule.getDefaultValue());
        }
        String attr = rule.getAttr() == null ? "text" : rule.getAttr().trim();
        String value;
        if ("text".equalsIgnoreCase(attr)) {
            value = target.text();
        } else if ("html".equalsIgnoreCase(attr) || "innerHtml".equalsIgnoreCase(attr)) {
            value = target.html();
        } else if ("href".equalsIgnoreCase(attr) || "src".equalsIgnoreCase(attr)) {
            String abs = target.absUrl(attr);
            value = abs == null || abs.isBlank() ? target.attr(attr) : abs;
        } else {
            value = target.attr(attr);
        }
        if (value == null || value.isBlank()) {
            return emptyToNull(rule.getDefaultValue());
        }
        value = value.trim();
        String prefix = rule.getPrefix();
        if (prefix != null && !prefix.isBlank() && !value.startsWith("http")) {
            value = prefix + value;
        }
        String suffix = rule.getSuffix();
        if (suffix != null && !suffix.isBlank()) {
            value = value + suffix;
        }
        return value;
    }

    private String patternOf(AdapterSpec spec, String field) {
        AdapterSpec.FieldRule rule = spec.field(field);
        return rule == null ? null : rule.getPattern();
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /**
     * 互动量解析：支持「1.2万」「3,456」「1234」等写法。
     *
     * @param text 原始文本
     * @return 数值；无法解析返回 null
     */
    public static Long parseLong(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String s = text.trim().replace(",", "").replace(" ", "");
        double multiplier = 1.0D;
        if (s.endsWith("万")) {
            multiplier = 10000.0D;
            s = s.substring(0, s.length() - 1);
        } else if (s.endsWith("亿")) {
            multiplier = 100000000.0D;
            s = s.substring(0, s.length() - 1);
        } else if (s.endsWith("w") || s.endsWith("W")) {
            multiplier = 10000.0D;
            s = s.substring(0, s.length() - 1);
        }
        StringBuilder digits = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (Character.isDigit(ch) || ch == '.') {
                digits.append(ch);
            }
        }
        if (digits.length() == 0) {
            return null;
        }
        try {
            return (long) (Double.parseDouble(digits.toString()) * multiplier);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 详情页正文抓取（供需要正文的场景调用，正文选择器来自 detailRule）。
     *
     * @param unit    采集单元
     * @param spec    适配器配置
     * @param opinion 待补全的舆情
     * @throws IOException 抓取失败
     */
    public void fillDetail(CollectUnit unit, AdapterSpec spec, RawOpinion opinion) throws IOException {
        AdapterSpec.DetailRule detailRule = spec.getDetailRule();
        if (detailRule == null || !detailRule.isEnabled() || detailRule.getContentSelector() == null
            || detailRule.getContentSelector().isBlank()) {
            return;
        }
        FetchRequest request = buildRequest(unit, spec, opinion.getOpinionUrl(), opinion.getHitKeywords());
        FetchResponse response = httpFetcher.execute(request);
        if (response.getBlockSignal().isBlocked()) {
            log.warn("[采集] 详情页被拦截 url={} detail={}", opinion.getOpinionUrl(), response.getBlockSignal().getDetail());
            return;
        }
        Document doc = Jsoup.parse(response.getBody(), opinion.getOpinionUrl());
        Element content = doc.selectFirst(detailRule.getContentSelector());
        if (content != null) {
            opinion.setContent(content.text());
        }
        opinion.setRawHtml(response.getBody());
    }

    /**
     * 便于单测：直接解析一段 HTML。
     *
     * @param html   HTML 文本
     * @param spec   适配器配置
     * @param unit   采集单元
     * @param ctx    上下文
     * @param baseUri 基准地址
     * @return 原始舆情列表
     */
    public List<RawOpinion> parseHtml(String html, AdapterSpec spec, CollectUnit unit, AdapterContext ctx, String baseUri) {
        Document doc = Jsoup.parse(html, baseUri);
        Elements items = doc.select(spec.getListItemSelector());
        List<RawOpinion> result = new ArrayList<>();
        String keyword = firstSearchTerm(unit);
        for (Element item : items) {
            RawOpinion opinion = mapItem(item, unit, spec, ctx, keyword);
            if (opinion == null) {
                continue;
            }
            if (ctx.getWatermark() != null && beforeWatermark(opinion.getPublishTime(), ctx.getWatermark())) {
                continue;
            }
            result.add(opinion);
        }
        return cap(result, ctx.getMaxRecords());
    }
}
