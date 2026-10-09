package org.dromara.yuqing.collect.adapter;

import tools.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.json.CollectJson;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.http.FetchRequest;
import org.dromara.yuqing.collect.http.FetchResponse;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 开放接口适配器：直连 JSON API（《技术架构说明》§5.1 C 档，最稳最合规）。
 *
 * <p>能用官方接口就不解析页面 —— 优先级高于静态与渲染通道。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class JsonApiAdapter extends AbstractSiteAdapter {

    public JsonApiAdapter(HttpFetcher httpFetcher, YqCollectProperties props) {
        super(httpFetcher, props);
    }

    @Override
    public String entryType() {
        return "api";
    }

    @Override
    public List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception {
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
                throw new IOException("接口被拦截: " + response.getBlockSignal().getDetail());
            }
            JsonNode root = CollectJson.readTree(response.getBody());
            JsonNode listNode = at(root, spec.getListJsonPath());
            if (listNode == null || !listNode.isArray() || listNode.isEmpty()) {
                break;
            }
            boolean pageContributed = false;
            /* Jackson 3 移除了 elements()，改用 values() 返回 Collection<JsonNode> */
            for (JsonNode node : listNode.values()) {
                RawOpinion opinion = mapNode(node, unit, spec, ctx, keyword);
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
            /* 整页无新增 → 终止翻页。除「整页早于水位线」的正常增量场景外，
               还能防住一类常见坏接口：忽略 page 参数、每页都回同一批数据。 */
            if (!pageContributed) {
                break;
            }
        }
        return result;
    }

    private RawOpinion mapNode(JsonNode node, CollectUnit unit, AdapterSpec spec, AdapterContext ctx, String keyword) {
        String url = extract(node, spec.field("opinionUrl"));
        if (url == null || url.isBlank()) {
            return null;
        }
        RawOpinion opinion = new RawOpinion();
        opinion.setTitle(extract(node, spec.field("title")));
        opinion.setOpinionUrl(url);
        opinion.setAuthor(extract(node, spec.field("author")));
        opinion.setPublishTime(TimeParser.parse(extract(node, spec.field("publishTime")), patternOf(spec, "publishTime")));
        opinion.setContent(extract(node, spec.field("content")));
        opinion.setRegion(extract(node, spec.field("region")));
        opinion.setDeviceInfo(extract(node, spec.field("deviceInfo")));
        opinion.setTopicTags(extract(node, spec.field("topicTags")));
        opinion.setLikeCount(StaticHtmlAdapter.parseLong(extract(node, spec.field("likeCount"))));
        opinion.setCommentCount(StaticHtmlAdapter.parseLong(extract(node, spec.field("commentCount"))));
        opinion.setShareCount(StaticHtmlAdapter.parseLong(extract(node, spec.field("shareCount"))));
        opinion.setReadCount(StaticHtmlAdapter.parseLong(extract(node, spec.field("readCount"))));
        fillCommon(opinion, unit, ctx, keyword);
        return opinion;
    }

    private String extract(JsonNode scope, AdapterSpec.FieldRule rule) {
        if (rule == null) {
            return null;
        }
        String path = rule.getJsonPath() != null && !rule.getJsonPath().isBlank() ? rule.getJsonPath() : rule.getSelector();
        if (path == null || path.isBlank()) {
            return rule.getDefaultValue() == null || rule.getDefaultValue().isBlank() ? null : rule.getDefaultValue();
        }
        JsonNode node = at(scope, path);
        if (node == null || node.isNull()) {
            return rule.getDefaultValue() == null || rule.getDefaultValue().isBlank() ? null : rule.getDefaultValue();
        }
        String value = node.isValueNode() ? node.asText() : node.toString();
        if (value == null || value.isBlank()) {
            return rule.getDefaultValue() == null || rule.getDefaultValue().isBlank() ? null : rule.getDefaultValue();
        }
        value = value.trim();
        if (rule.getPrefix() != null && !rule.getPrefix().isBlank() && !value.startsWith("http")) {
            value = rule.getPrefix() + value;
        }
        if (rule.getSuffix() != null && !rule.getSuffix().isBlank()) {
            value = value + rule.getSuffix();
        }
        return value;
    }

    /**
     * 点分路径取值，支持数组下标，如 {@code data.list} / {@code data[0].items}。
     *
     * @param root 根节点
     * @param path 路径
     * @return 节点；找不到返回 null
     */
    private JsonNode at(JsonNode root, String path) {
        if (root == null) {
            return null;
        }
        if (path == null || path.isBlank()) {
            return root;
        }
        JsonNode current = root;
        for (String rawSegment : path.split("[.]")) {
            String segment = rawSegment.trim();
            if (segment.isEmpty()) {
                continue;
            }
            int open = segment.indexOf('[');
            if (open > 0 && segment.endsWith("]")) {
                String name = segment.substring(0, open);
                int index;
                try {
                    index = Integer.parseInt(segment.substring(open + 1, segment.length() - 1));
                } catch (NumberFormatException e) {
                    return null;
                }
                current = current.get(name);
                if (current == null || !current.isArray() || current.size() <= index) {
                    return null;
                }
                current = current.get(index);
            } else {
                current = current.get(segment);
            }
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private String patternOf(AdapterSpec spec, String field) {
        AdapterSpec.FieldRule rule = spec.field(field);
        return rule == null ? null : rule.getPattern();
    }
}
