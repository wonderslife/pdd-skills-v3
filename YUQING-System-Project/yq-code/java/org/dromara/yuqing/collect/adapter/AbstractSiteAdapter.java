package org.dromara.yuqing.collect.adapter;

import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.http.FetchRequest;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 适配器公共逻辑：请求装配、占位符替换、公共字段回填。
 *
 * @author ruoyi
 */
public abstract class AbstractSiteAdapter implements SiteAdapter {

    protected final HttpFetcher httpFetcher;

    protected final YqCollectProperties props;

    protected AbstractSiteAdapter(HttpFetcher httpFetcher, YqCollectProperties props) {
        this.httpFetcher = httpFetcher;
        this.props = props;
    }

    /**
     * 本单元生效的检索词。
     *
     * <p>组合关键词会把「地区组 + 主题组」这类表达式展开为多个主题词，每个词各发一轮请求
     * （请求量 = 主题词个数，而不是笛卡尔积）。无关键词时返回单元素空串，
     * 保持「政务列表页这类本来就不需要关键词」的站点仍能正常抓取。</p>
     *
     * @param unit 采集单元
     * @return 检索词列表，至少含一个元素
     */
    protected List<String> searchTerms(CollectUnit unit) {
        KeywordMatcher matcher = unit.getMatcher();
        if (matcher == null || !matcher.enabled()) {
            return List.of("");
        }
        return matcher.effectiveSearchTerms();
    }

    /**
     * 首个检索词（供只解析一次的便捷入口与单测使用）。
     *
     * @param unit 采集单元
     * @return 检索词；无词返回空串
     */
    protected String firstSearchTerm(CollectUnit unit) {
        List<String> terms = searchTerms(unit);
        return terms.isEmpty() ? "" : terms.get(0);
    }

    /**
     * 按检索词逐个抓取并合并。
     *
     * <p>单批条数预算在所有检索词之间均分，保证每个词都有机会被召回（不会第一个词吃满配额），
     * 批内 URL 去重跨检索词共享，避免同一链接因多个词命中而重复入库。</p>
     *
     * @param unit       采集单元
     * @param maxRecords 单批最大产出条数；0 表示不限
     * @param fetcher    单检索词抓取回调
     * @return 合并后的原始舆情
     * @throws Exception 抓取或解析失败
     */
    protected List<RawOpinion> fetchForEachKeyword(CollectUnit unit, int maxRecords, KeywordFetch fetcher)
        throws Exception {
        List<String> terms = searchTerms(unit);
        int total = Math.max(0, maxRecords);
        int perKeyword = total > 0 ? Math.max(1, (int) Math.ceil((double) total / terms.size())) : 0;
        Set<String> seenUrls = new HashSet<>();
        List<RawOpinion> all = new ArrayList<>();
        for (String term : terms) {
            int budget = total > 0 ? Math.min(total - all.size(), perKeyword) : 0;
            if (total > 0 && budget <= 0) {
                break;
            }
            List<RawOpinion> part = fetcher.fetch(term, budget, seenUrls);
            if (part != null && !part.isEmpty()) {
                all.addAll(part);
            }
        }
        return cap(all, maxRecords);
    }

    /**
     * 单检索词抓取回调。
     */
    @FunctionalInterface
    protected interface KeywordFetch {
        /**
         * @param keyword  检索词
         * @param budget   本词条数上限；0 表示不限
         * @param seenUrls 跨检索词共享的批内去重集合
         * @return 原始舆情
         * @throws Exception 抓取失败
         */
        List<RawOpinion> fetch(String keyword, int budget, Set<String> seenUrls) throws Exception;
    }

    /**
     * 替换列表页模板占位符。
     *
     * @param template 模板
     * @param keyword  检索词
     * @param page     页码
     * @return 实际地址
     */
    protected String fillUrl(String template, String keyword, int page) {
        if (template == null) {
            return "";
        }
        String url = template.replace(props.getKeywordPlaceholder(), urlEncode(keyword));
        return url.replace(props.getPagePlaceholder(), String.valueOf(page));
    }

    /**
     * 装配抓取请求（把渠道限流参数与适配器反爬参数挂上去）。
     *
     * @param unit    采集单元
     * @param spec    适配器配置
     * @param url     地址
     * @param keyword 检索词
     * @return 请求
     */
    protected FetchRequest buildRequest(CollectUnit unit, AdapterSpec spec, String url, String keyword) {
        FetchRequest request = new FetchRequest();
        request.setUrl(url);
        request.setMethod(spec.getMethod() == null ? "GET" : spec.getMethod());
        request.setBody(spec.getRequestBody());
        request.setChannelId(unit.getChannelId());
        request.setAdapterCode(spec.getCode());
        request.setProxyGroupId(unit.getProxyGroupId());
        request.setRequestIntervalMs(unit.getRequestIntervalMs());
        request.setConcurrencyLimit(unit.getConcurrencyLimit());
        request.setKeyword(keyword);
        AdapterSpec.AntiBotRule antiBot = spec.getAntiBot();
        if (antiBot != null) {
            request.setUseProxy(antiBot.isUseProxy());
            request.setMinIntervalMs(antiBot.getMinIntervalMs());
            request.setMaxIntervalMs(antiBot.getMaxIntervalMs());
            if (StringUtils.isNotBlank(antiBot.getReferer())) {
                request.getHeaders().put("Referer", antiBot.getReferer());
            }
        }
        if (spec.getHeaders() != null) {
            request.getHeaders().putAll(spec.getHeaders());
        }
        return request;
    }

    /**
     * 回填采集公共字段（验收标准 4：批次 + 采集时间，用于溯源）。
     *
     * @param opinion 原始舆情
     * @param unit    采集单元
     * @param ctx     上下文
     * @param keyword 检索词
     */
    protected void fillCommon(RawOpinion opinion, CollectUnit unit, AdapterContext ctx, String keyword) {
        opinion.setTaskId(unit.getTaskId());
        opinion.setChannelId(unit.getChannelId());
        opinion.setBatchNo(ctx.getBatchNo());
        opinion.setCollectTime(LocalDateTime.now());
        opinion.setCollectDate(opinion.getCollectTime().toLocalDate());
        opinion.setCollectSource("auto");
        opinion.setHitKeywords(keyword == null ? "" : keyword);
        if (opinion.getPublishTime() == null) {
            opinion.setPublishTime(opinion.getCollectTime());
        }
    }

    /**
     * 判断某条内容是否早于增量水位线。
     *
     * @param publishTime 发布时间
     * @param watermark   水位线
     * @return true 表示已处理过，可停止翻页
     */
    protected boolean beforeWatermark(LocalDateTime publishTime, LocalDateTime watermark) {
        return watermark != null && publishTime != null && !publishTime.isAfter(watermark);
    }

    /**
     * 结果集截断到上限。
     *
     * @param list 列表
     * @param max  上限
     * @return 截断后的列表
     */
    protected List<RawOpinion> cap(List<RawOpinion> list, int max) {
        if (max > 0 && list.size() > max) {
            return list.subList(0, max);
        }
        return list;
    }

    /**
     * 检索词做 URL 编码，避免中文直接拼进地址导致请求异常。
     *
     * @param text 原文
     * @return 已编码文本
     */
    protected String urlEncode(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        try {
            return java.net.URLEncoder.encode(text, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return text;
        }
    }
}
