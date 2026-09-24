package org.dromara.yuqing.collect;

import org.dromara.yuqing.collect.adapter.AdapterContext;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.adapter.AdapterSpec;
import org.dromara.yuqing.collect.adapter.JsonApiAdapter;
import org.dromara.yuqing.collect.adapter.MockAdapter;
import org.dromara.yuqing.collect.adapter.SiteAdapter;
import org.dromara.yuqing.collect.adapter.StaticHtmlAdapter;
import org.dromara.yuqing.collect.anti.BlockDetector;
import org.dromara.yuqing.collect.anti.ChannelRateLimiter;
import org.dromara.yuqing.collect.anti.HeaderPool;
import org.dromara.yuqing.collect.anti.ProxyProvider;
import org.dromara.yuqing.collect.anti.RetryPolicy;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.clean.NoiseRuleCompiler;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.guard.CollectHealthGuard;
import org.dromara.yuqing.collect.http.FetchRequest;
import org.dromara.yuqing.collect.http.FetchResponse;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.http.JdkHttpFetcher;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.keyword.KeywordSpec;
import org.dromara.yuqing.collect.model.BlockType;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.IntervalSpec;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.collect.pipeline.CollectJdbcWriter;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.dromara.yuqing.collect.pipeline.CollectPipeline;
import org.dromara.yuqing.collect.pipeline.DorisStreamLoader;
import org.dromara.yuqing.collect.pipeline.SnapshotStore;
import org.dromara.yuqing.collect.pipeline.UrlHashDeduplicator;
import org.dromara.yuqing.collect.pipeline.UrlNormalizer;
import org.dromara.common.oss.client.OssClient;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * F-004「全网自动采集与调度」离线自测。
 *
 * <p>不依赖 Doris / Redis / 外网：Doris 落库走 noop 通道、去重走进程内、HTTP 走桩件。
 * 覆盖 dev-specs/F-004-collect.md 的验收标准 2 / 3 / 4 / 5 / 7 / 8 / 9 / 10。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
@DisplayName("F-004 采集调度引擎离线自测")
public class YqCollectEngineTest {

    /* ------------------------------------------------------------ 验收标准 7：链接去重 */

    @Test
    @DisplayName("AC7 链接归一化：追踪参数被剔除、参数顺序无关、哈希稳定")
    void urlNormalize() {
        String a = UrlNormalizer.normalize("https://News.Example.com:443/a/1/?utm_source=wx&id=7&from=share");
        String b = UrlNormalizer.normalize("https://news.example.com/a/1?id=7");
        Assertions.assertEquals("https://news.example.com/a/1?id=7", a);
        Assertions.assertEquals(a, b, "归一化结果应一致");
        Assertions.assertEquals(UrlNormalizer.sha256(a), UrlNormalizer.sha256(b), "哈希应一致");
        Assertions.assertEquals(64, UrlNormalizer.hash(a).length(), "SHA-256 十六进制长度为 64");
    }

    /* ------------------------------------------------------------ 验收标准 2：频率四档与限流下限 */

    @Test
    @DisplayName("AC2 频率四档换算 + 渠道限流下限校验")
    void intervalSpec() {
        Assertions.assertEquals(30, IntervalSpec.toSeconds(30, "s"));
        Assertions.assertEquals(300, IntervalSpec.toSeconds(5, "m"));
        Assertions.assertEquals(3600, IntervalSpec.toSeconds(1, "h"));
        Assertions.assertEquals(86400, IntervalSpec.toSeconds(1, "d"));
        Assertions.assertEquals("m", IntervalSpec.unitOf(180));
        Assertions.assertEquals("h", IntervalSpec.unitOf(7200));
        Assertions.assertEquals("d", IntervalSpec.unitOf(86400));
        Assertions.assertEquals("s", IntervalSpec.unitOf(90));
        Assertions.assertEquals("3 分钟", IntervalSpec.describe(180));

        // 请求间隔 3000ms × 并发 2 = 6s 下限
        Assertions.assertEquals(6, IntervalSpec.rateFloorSeconds(3000, 2));
        Assertions.assertTrue(IntervalSpec.validate(3, 3000, 2, 1).size() == 1, "3 秒低于 6 秒下限，应报错");
        Assertions.assertTrue(IntervalSpec.validate(10, 3000, 2, 30).size() == 1, "10 秒低于全局最小 30 秒，应报错");
        Assertions.assertTrue(IntervalSpec.validate(60, 3000, 2, 30).isEmpty(), "60 秒应通过");
        Assertions.assertTrue(IntervalSpec.validate(null, 3000, 2, 30).size() == 1, "空间隔应报错");
    }

    /* ------------------------------------------------------------ 验收标准 5：退避重试 */

    @Test
    @DisplayName("AC5 指数退避 + 抖动 + 封顶")
    void retryPolicy() {
        YqCollectProperties props = baseProps();
        props.getRetry().setInitialBackoffMs(100);
        props.getRetry().setMultiplier(2.0);
        props.getRetry().setMaxBackoffMs(500);
        props.getRetry().setJitterRatio(0.0);
        RetryPolicy policy = new RetryPolicy(props);

        Assertions.assertEquals(3, policy.maxAttempts());
        Assertions.assertEquals(100, policy.backoffMillis(1));
        Assertions.assertEquals(200, policy.backoffMillis(2));
        Assertions.assertEquals(400, policy.backoffMillis(3));
        Assertions.assertEquals(500, policy.backoffMillis(4), "超过上限应封顶");

        props.getRetry().setJitterRatio(0.3);
        for (int i = 1; i <= 20; i++) {
            long v = policy.backoffMillis(2);
            Assertions.assertTrue(v >= 140 && v <= 260, "抖动应落在 ±30% 区间，实际 " + v);
        }
    }

    /* ------------------------------------------------------------ 反爬：被拦信号识别 */

    @Test
    @DisplayName("反爬 命中限流 / 验证码 / 空壳 / 蜜罐 / 放行")
    void blockDetector() {
        BlockDetector detector = new BlockDetector();
        Assertions.assertEquals(BlockType.RATE_LIMITED, detect(detector, 429, "too many requests", null).getType());
        Assertions.assertEquals(BlockType.HTTP_ERROR, detect(detector, 403, "forbidden", null).getType());
        Assertions.assertEquals(BlockType.HTTP_ERROR, detect(detector, 503, "", null).getType());
        Assertions.assertEquals(BlockType.CAPTCHA, detect(detector, 200, "<html>请完成滑动验证后继续</html>", null).getType());
        Assertions.assertEquals(BlockType.RENDER_REQUIRED, detect(detector, 200, "", null).getType());
        Assertions.assertEquals(BlockType.RENDER_REQUIRED,
            detect(detector, 200, "<html><body><div id=\"app\"></div><script src=1.js></script></body></html>", null).getType());
        Assertions.assertEquals(BlockType.IRRELEVANT,
            detect(detector, 200, "<html><body>完全无关的页面内容，长度足够长以避免空壳判定</body></html>", "演示企业").getType());
        Assertions.assertEquals(BlockType.NONE,
            detect(detector, 200, "<html><body>演示企业 服务保障 相关新闻正文</body></html>", "演示企业").getType());
        Assertions.assertTrue(new HeaderPool().next("https://news.example.com").containsKey("User-Agent"));
    }

    /* ------------------------------------------------------------ 安全：file: 协议默认关闭 */

    @Test
    @DisplayName("安全 file: 协议默认关闭，避免成为本机任意文件读取入口")
    void localFileSchemeBlocked() {
        YqCollectProperties props = baseProps();
        Assertions.assertFalse(props.isAllowLocalFile(), "默认必须关闭");

        JdkHttpFetcher fetcher = new JdkHttpFetcher(new HeaderPool(), new ProxyProvider(props),
            new BlockDetector(), new RetryPolicy(props), new ChannelRateLimiter(), props);

        FetchRequest request = new FetchRequest();
        request.setUrl("file:///c:/windows/win.ini");
        IOException blocked = Assertions.assertThrows(IOException.class, () -> fetcher.execute(request));
        Assertions.assertTrue(blocked.getMessage().contains("file:"), "应明确拒绝并说明原因");

        /* 显式打开开关后应放行到「读文件」阶段：文件不存在仍报 IOException，
           但不再是闸门拒绝 —— 以此证明开关本身生效。 */
        props.setAllowLocalFile(true);
        FetchRequest missing = new FetchRequest();
        missing.setUrl("file:///definitely/not/exists-yq-xyz.html");
        IOException opened = Assertions.assertThrows(IOException.class, () -> fetcher.execute(missing));
        Assertions.assertFalse(opened.getMessage().contains("已禁用"), "开关打开后不应再被闸门拦下");
    }

    /* ------------------------------------------------------------ 验收标准 3：12 字段解析 */

    @Test
    @DisplayName("AC3 静态 HTML 适配器解析出验收标准 3 要求的全部 12 个字段")
    void staticHtmlAdapter() {
        YqCollectProperties props = baseProps();
        StaticHtmlAdapter adapter = new StaticHtmlAdapter(throwingFetcher(), props);
        AdapterSpec spec = staticSpec();
        CollectUnit unit = unit("static-1");
        List<RawOpinion> list = adapter.parseHtml(SAMPLE_HTML, spec, unit, ctx(), "https://news.example.com/");

        Assertions.assertEquals(2, list.size(), "样例 HTML 含 2 条列表项");
        RawOpinion first = list.get(0);
        Assertions.assertEquals("演示企业服务保障获评优秀", first.getTitle());
        Assertions.assertEquals("https://news.example.com/a/1001", first.getOpinionUrl());
        Assertions.assertEquals(LocalDateTime.of(2026, 9, 18, 15, 30), first.getPublishTime());
        Assertions.assertEquals("北方日报", first.getAuthor());
        Assertions.assertEquals(12000L, first.getLikeCount(), "1.2万 应解析为 12000");
        Assertions.assertEquals(3456L, first.getCommentCount(), "带千分位应解析为 3456");
        Assertions.assertEquals(1_3000_0000L, first.getShareCount(), "1.3亿 应解析为 130000000");
        Assertions.assertEquals(2048L, first.getReadCount());
        Assertions.assertEquals("辽宁-沈阳", first.getRegion());
        Assertions.assertEquals("iPhone 15 Pro", first.getDeviceInfo());
        Assertions.assertEquals("服务保障,优秀", first.getTopicTags());
        Assertions.assertEquals("演示企业", first.getHitKeywords());
        Assertions.assertEquals("demo-static", first.getBatchNo(), "AC4 批次号应回填用于溯源");
        Assertions.assertNotNull(first.getCollectTime(), "AC4 采集时间应回填用于溯源");
    }

    /* ------------------------------------------------------------ 开放接口适配器 */

    @Test
    @DisplayName("JSON 接口适配器：点分路径 + 数组下标 + 前缀补全")
    void jsonApiAdapter() throws Exception {
        YqCollectProperties props = baseProps();
        String json = "{\"data\":{\"list\":[{\"title\":\"接口标题\",\"url\":\"/n/1\",\"publishTime\":\"2026-09-18 10:00:00\","
            + "\"author\":{\"name\":\"接口作者\"},\"stats\":{\"like\":15,\"comment\":3,\"share\":2,\"read\":999},"
            + "\"region\":\"辽宁-大连\",\"tags\":\"接口,测试\"}]}}";
        HttpFetcher fetcher = request -> {
            FetchResponse response = new FetchResponse();
            response.setStatusCode(200);
            response.setBody(json);
            return response;
        };
        AdapterSpec spec = apiSpec();
        JsonApiAdapter adapter = new JsonApiAdapter(fetcher, props);
        List<RawOpinion> list = adapter.fetch(unit("api-1"), spec, ctx());

        Assertions.assertEquals(1, list.size());
        Assertions.assertEquals("接口标题", list.get(0).getTitle());
        Assertions.assertEquals("https://api.example.com/n/1", list.get(0).getOpinionUrl());
        Assertions.assertEquals("接口作者", list.get(0).getAuthor());
        Assertions.assertEquals(15L, list.get(0).getLikeCount());
        Assertions.assertEquals(999L, list.get(0).getReadCount());
    }

    /* ------------------------------------------------------------ 验收标准 4 / 7 / 10：端到端管道 */

    @Test
    @DisplayName("AC4+AC7+AC10 端到端：首次入库 30 条、重复执行全去重、批次日志逐条落库")
    void pipelineEndToEnd() {
        Fixture fixture = new Fixture(new MockAdapter(throwingFetcher(), baseProps()));
        CollectUnit unit = fixture.unit("MOCK_TEST");

        CollectResult first = fixture.pipeline.run(unit);
        fixture.sink.flushAll();
        Assertions.assertEquals(30, first.getFetchedCount(), "抓取 30 条");
        Assertions.assertEquals(30, first.getInsertedCount(), "首次全部入库");
        Assertions.assertEquals(0, first.getDupCount(), "首次无重复");
        Assertions.assertEquals("success", first.getResultStatus());
        Assertions.assertEquals(30, fixture.sink.loadedOpinionCount(), "AC4 明细已落库");
        Assertions.assertEquals(1, fixture.sink.loadedLogCount(), "AC10 已生成 1 条采集日志");
        Assertions.assertTrue(first.getCostMs() >= 0);

        // 同一批次再跑一次：链接完全相同 → 全部被去重剔除（AC7）
        CollectResult second = fixture.pipeline.run(unit);
        fixture.sink.flushAll();
        Assertions.assertEquals(30, second.getFetchedCount());
        Assertions.assertEquals(0, second.getInsertedCount(), "重复链接不应重复入库");
        Assertions.assertEquals(30, second.getDupCount(), "AC7 重复链接应全部剔除");
        Assertions.assertEquals(30, fixture.sink.loadedOpinionCount(), "去重后明细总数不变");
        Assertions.assertEquals(2, fixture.sink.loadedLogCount(), "AC10 两次执行各留一条日志");

        // AC8 概览计数
        Map<String, Long> today = fixture.metrics.today();
        Assertions.assertEquals(60L, today.get("fetched"));
        Assertions.assertEquals(30L, today.get("inserted"));
        Assertions.assertEquals(30L, today.get("dup"));
        Assertions.assertEquals(2L, today.get("batches"));
        Assertions.assertEquals(60L, fixture.metrics.totalFetched());
    }

    /* ------------------------------------------------------------ AC1 增量水位线 */

    @Test
    @DisplayName("AC1 增量抓取：全部早于水位线时不再翻页/不再产出")
    void incrementalWatermark() {
        YqCollectProperties props = baseProps();
        StaticHtmlAdapter adapter = new StaticHtmlAdapter(throwingFetcher(), props);
        AdapterSpec spec = staticSpec();
        CollectUnit unit = unit("static-2");
        AdapterContext future = new AdapterContext("B-1", 500, 3, LocalDateTime.now().plusDays(1));
        List<RawOpinion> list = adapter.parseHtml(SAMPLE_HTML, spec, unit, future, "https://news.example.com/");
        Assertions.assertTrue(list.isEmpty(), "水位线在未来 → 全部内容视为已处理");
    }

    /* ------------------------------------------------------------ 验收标准 9：连续异常告警 */

    @Test
    @DisplayName("AC9 连续零采集/全失败达阈值触发异常计数与告警")
    void unhealthyGuard() {
        Fixture fixture = new Fixture(new ThrowingAdapter());
        CollectUnit unit = fixture.unit("MOCK_FAIL");
        CollectResult last = null;
        for (int i = 0; i < 3; i++) {
            last = fixture.pipeline.run(unit);
        }
        Assertions.assertNotNull(last);
        Assertions.assertEquals("failed", last.getResultStatus());
        Assertions.assertEquals(1, last.getFailedCount(), "适配器抛异常 → 记 1 条失败");
        Assertions.assertEquals(3, fixture.metrics.abnormalCount("77:88"), "连续异常次数应为 3");
        Assertions.assertTrue(fixture.metrics.abnormalUnits(3).containsKey("77:88"), "应被识别为异常单元");
    }

    /* ============================================================ 测试脚手架 */

    private static final String SAMPLE_HTML = "<html><body><div class=\"result-item\">"
        + "<h3><a href=\"/a/1001\">演示企业服务保障获评优秀</a></h3>"
        + "<span class=\"time\">2026-09-18 15:30</span><span class=\"source\">北方日报</span>"
        + "<span class=\"region\">辽宁-沈阳</span><span class=\"like\">1.2万</span>"
        + "<span class=\"comment\">3,456</span><span class=\"share\">1.3亿</span>"
        + "<span class=\"read\">2048</span><span class=\"tags\">服务保障,优秀</span>"
        + "<span class=\"device\">iPhone 15 Pro</span></div>"
        + "<div class=\"result-item\">"
        + "<h3><a href=\"/a/1002\">演示企业价格争议说明</a></h3>"
        + "<span class=\"time\">2026-09-18 14:00</span><span class=\"source\">南方晚报</span>"
        + "<span class=\"region\">辽宁-大连</span><span class=\"like\">9</span>"
        + "<span class=\"comment\">1</span><span class=\"share\">0</span>"
        + "<span class=\"read\">100</span><span class=\"tags\">价格争议</span>"
        + "<span class=\"device\">Windows 11</span></div>"
        + "</body></html>";

    private static YqCollectProperties baseProps() {
        YqCollectProperties props = new YqCollectProperties();
        props.setEnabled(true);
        props.setUnhealthyThreshold(3);
        props.setMinIntervalSeconds(1);
        props.setMaxRecordsPerBatch(500);
        props.setMaxPagesPerBatch(5);
        props.getSink().setMode("noop");
        props.getSink().setBatchSize(1000);
        props.getDedup().setRedisEnabled(false);
        props.getSnapshot().setEnabled(false);
        props.getProxy().setEnabled(false);
        props.getNotify().setEnabled(false);
        return props;
    }

    private static AdapterSpec staticSpec() {
        AdapterSpec spec = new AdapterSpec();
        spec.setCode("STATIC_TEST");
        spec.setEntryType("static");
        spec.setListUrl("https://news.example.com/search?q={kw}&p={page}");
        spec.setListItemSelector("div.result-item");
        spec.setFields(fields(
            "title", "h3 a", "text", "",
            "opinionUrl", "h3 a", "href", "",
            "publishTime", "span.time", "text", "yyyy-MM-dd HH:mm",
            "author", "span.source", "text", "",
            "region", "span.region", "text", "",
            "likeCount", "span.like", "text", "",
            "commentCount", "span.comment", "text", "",
            "shareCount", "span.share", "text", "",
            "readCount", "span.read", "text", "",
            "topicTags", "span.tags", "text", "",
            "deviceInfo", "span.device", "text", ""
        ));
        return spec;
    }

    private static AdapterSpec apiSpec() {
        AdapterSpec spec = new AdapterSpec();
        spec.setCode("API_TEST");
        spec.setEntryType("api");
        spec.setListUrl("https://api.example.com/search?keyword={kw}&page={page}");
        spec.setListJsonPath("data.list");
        AdapterSpec.FieldRule url = new AdapterSpec.FieldRule();
        url.setJsonPath("url");
        url.setPrefix("https://api.example.com");
        AdapterSpec.FieldRule title = new AdapterSpec.FieldRule();
        title.setJsonPath("title");
        AdapterSpec.FieldRule author = new AdapterSpec.FieldRule();
        author.setJsonPath("author.name");
        AdapterSpec.FieldRule publish = new AdapterSpec.FieldRule();
        publish.setJsonPath("publishTime");
        publish.setPattern("yyyy-MM-dd HH:mm:ss");
        AdapterSpec.FieldRule like = new AdapterSpec.FieldRule();
        like.setJsonPath("stats.like");
        AdapterSpec.FieldRule read = new AdapterSpec.FieldRule();
        read.setJsonPath("stats.read");
        Map<String, AdapterSpec.FieldRule> fields = new LinkedHashMap<>();
        fields.put("title", title);
        fields.put("opinionUrl", url);
        fields.put("author", author);
        fields.put("publishTime", publish);
        fields.put("likeCount", like);
        fields.put("readCount", read);
        spec.setFields(fields);
        spec.setPageRule(new AdapterSpec.PageRule());
        return spec;
    }

    private static Map<String, AdapterSpec.FieldRule> fields(String... tuples) {
        Map<String, AdapterSpec.FieldRule> map = new LinkedHashMap<>();
        for (int i = 0; i + 3 < tuples.length; i += 4) {
            AdapterSpec.FieldRule rule = new AdapterSpec.FieldRule();
            rule.setSelector(tuples[i + 1]);
            rule.setAttr(tuples[i + 2]);
            if (!tuples[i + 3].isEmpty()) {
                rule.setPattern(tuples[i + 3]);
            }
            map.put(tuples[i], rule);
        }
        return map;
    }

    private static AdapterContext ctx() {
        return new AdapterContext("demo-static", 500, 5, null);
    }

    private static CollectUnit unit(String adapterCode) {
        CollectUnit unit = new CollectUnit();
        unit.setTaskId(77L);
        unit.setTaskName("演示任务");
        unit.setChannelId(88L);
        unit.setChannelName("演示渠道");
        unit.setAdapterCode(adapterCode);
        unit.setCollectStrategy("polling");
        unit.setIntervalSeconds(60);
        unit.setBatchNo("demo-static");
        unit.setMatcher(KeywordMatcher.builder().spec(KeywordSpec.simple("演示企业")).build());
        return unit;
    }

    private static org.dromara.yuqing.collect.model.BlockSignal detect(BlockDetector detector, int status, String body, String keyword) {
        FetchResponse response = new FetchResponse();
        response.setStatusCode(status);
        response.setBody(body);
        return detector.detect(response, keyword, 200);
    }

    private static HttpFetcher throwingFetcher() {
        return request -> {
            throw new IOException("测试环境禁止真实网络请求");
        };
    }

    private static <T> ObjectProvider<T> emptyProvider() {
        return new ObjectProvider<>() {
            @Override
            public T getObject() throws BeansException {
                return null;
            }

            @Override
            public T getObject(Object... args) throws BeansException {
                return null;
            }

            @Override
            public T getIfAvailable() {
                return null;
            }

            @Override
            public T getIfUnique() {
                return null;
            }
        };
    }

    /**
     * 采集管道测试夹具：真组件 + 桩件，不依赖 Spring / Doris / Redis。
     */
    private static final class Fixture {

        private final YqCollectProperties props;

        private final CollectMetrics metrics;

        private final DorisStreamLoader sink;

        private final CollectPipeline pipeline;

        Fixture(SiteAdapter adapter) {
            this.props = baseProps();
            AdapterSpec mockSpec = new AdapterSpec();
            mockSpec.setCode("MOCK_TEST");
            mockSpec.setEntryType("mock");
            mockSpec.setMockSize(30);
            AdapterSpec failSpec = new AdapterSpec();
            failSpec.setCode("MOCK_FAIL");
            failSpec.setEntryType("mock");
            failSpec.setMockSize(30);
            Map<String, AdapterSpec> adapters = new LinkedHashMap<>();
            adapters.put("MOCK_TEST", mockSpec);
            adapters.put("MOCK_FAIL", failSpec);
            props.setAdapters(adapters);
            /* 本用例只验证调度/去重/落库，净化判定由 F006CleanTest 单独覆盖；
               开着净化会让 mock 的短样本被判为无意义短句，改变这里的断言口径。 */
            props.getClean().setEnabled(false);

            AdapterRegistry registry = new AdapterRegistry(props, List.of(adapter));
            registry.init();
            this.metrics = new CollectMetrics();
            this.sink = new DorisStreamLoader(props, emptyProvider());
            this.pipeline = new CollectPipeline(props, registry, new UrlHashDeduplicator(props),
                new SnapshotStore(props, emptyProvider()), sink, metrics, new BlockDetector(),
                new CollectHealthGuard(props, metrics),
                new NoiseEngine(new NoiseRuleCompiler(null, props), props));
        }

        CollectUnit unit(String adapterCode) {
            CollectUnit unit = YqCollectEngineTest.unit(adapterCode);
            unit.setTaskId(77L);
            unit.setChannelId(88L);
            return unit;
        }
    }

    /**
     * 永远抛异常的适配器：模拟站点被拦 / 采集全失败。
     */
    private static final class ThrowingAdapter implements SiteAdapter {

        @Override
        public String entryType() {
            return "mock";
        }

        @Override
        public List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception {
            throw new IOException("模拟站点被拦截（HTTP 429 触发限流）");
        }
    }
}
