package org.dromara.yuqing.collect.adapter;

import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 模拟适配器：离线自测与联调用，不发起任何外部请求。
 *
 * <p>产出地址由「适配器标识 + 任务 + 渠道 + 序号」确定性拼接，因此重复执行会命中同一条
 * {@code url_hash}，正好用来验证验收标准 7（链接去重）。</p>
 *
 * @author ruoyi
 */
@Component
public class MockAdapter extends AbstractSiteAdapter {

    private static final String[] SENTIMENTS = {"negative", "neutral", "positive"};

    private static final String[] TOPICS = {"服务保障", "价格争议", "产品质量", "售后响应", "环保合规", "员工权益"};

    private static final String[] REGIONS = {"辽宁-沈阳", "辽宁-大连", "辽宁-鞍山", "吉林-长春", "黑龙江-哈尔滨"};

    private static final String[] DEVICES = {"iPhone 15 Pro / iOS 17.5", "Xiaomi 14 / Android 14", "Windows 11 / Chrome 126", "HUAWEI Mate 60 / HarmonyOS 4"};

    public MockAdapter(HttpFetcher httpFetcher, YqCollectProperties props) {
        super(httpFetcher, props);
    }

    @Override
    public String entryType() {
        return "mock";
    }

    @Override
    public List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception {
        return fetchForEachKeyword(unit, ctx.getMaxRecords(), (keyword, budget, seenUrls) ->
            mockByKeyword(unit, spec, ctx, keyword, budget));
    }

    /**
     * 按单个检索词产出模拟数据。
     *
     * <p>链接里带上检索词指纹：不同关键词必须产出不同 {@code url_hash}，
     * 否则批内去重会把多个关键词的结果误判成同一条。</p>
     *
     * @param budget 本词条数上限；0 表示不限
     */
    private List<RawOpinion> mockByKeyword(CollectUnit unit, AdapterSpec spec, AdapterContext ctx,
                                           String keyword, int budget) {
        int size = spec.getMockSize() > 0 ? spec.getMockSize() : 30;
        if (budget > 0) {
            size = Math.min(size, budget);
        }
        String code = spec.getCode() == null ? "MOCK" : spec.getCode();
        String tag = keyword == null || keyword.isBlank()
            ? "all" : Integer.toUnsignedString(keyword.hashCode(), 36);
        LocalDateTime now = LocalDateTime.now();
        List<RawOpinion> result = new ArrayList<>(size);
        for (int i = 1; i <= size; i++) {
            RawOpinion opinion = new RawOpinion();
            opinion.setTitle("【模拟样本】" + code + " 第 " + i + " 条：" + keyword + "相关舆情");
            opinion.setContent("这是用于离线自测与联调的模拟正文，序号 " + i + "。全文不做有损截断，"
                + "用于验证采集链路字段完整性、批次溯源与链接去重行为。" + code + "-" + i);
            opinion.setOpinionUrl("https://mock.yuqing.local/" + code + "/" + unit.getTaskId() + "/"
                + unit.getChannelId() + "/" + tag + "/a/" + i);
            opinion.setPublishTime(now.minusMinutes(size - i));
            opinion.setAuthor("模拟作者" + (i % 7 + 1));
            opinion.setLikeCount((long) ThreadLocalRandom.current().nextInt(0, 5000));
            opinion.setCommentCount((long) ThreadLocalRandom.current().nextInt(0, 800));
            opinion.setShareCount((long) ThreadLocalRandom.current().nextInt(0, 300));
            opinion.setReadCount((long) ThreadLocalRandom.current().nextInt(100, 200000));
            opinion.setRegion(REGIONS[i % REGIONS.length]);
            opinion.setDeviceInfo(DEVICES[i % DEVICES.length]);
            opinion.setTopicTags(TOPICS[i % TOPICS.length] + ",模拟");
            fillCommon(opinion, unit, ctx, keyword);
            result.add(opinion);
        }
        return result;
    }
}
