package org.dromara.yuqing.collect;

import org.dromara.yuqing.collect.adapter.AbstractSiteAdapter;
import org.dromara.yuqing.collect.adapter.AdapterContext;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.adapter.AdapterSpec;
import org.dromara.yuqing.collect.anti.BlockDetector;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.clean.NoiseRuleCompiler;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.guard.CollectHealthGuard;
import org.dromara.yuqing.collect.http.HttpFetcher;
import org.dromara.yuqing.collect.keyword.KeywordExpression;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.keyword.KeywordSpec;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.dromara.yuqing.collect.pipeline.CollectPipeline;
import org.dromara.yuqing.collect.pipeline.DorisStreamLoader;
import org.dromara.yuqing.collect.pipeline.SnapshotStore;
import org.dromara.yuqing.collect.pipeline.UrlHashDeduplicator;
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
 * 关键词链路离线自测：关键词库（F-002）→ 采集引擎（F-004）。
 *
 * <p>覆盖「(地区组)+(主题组)」这类组合关键词从解析、校验、检索词展开，
 * 到本地匹配过滤、任务级排除词降噪、普通词兼容的完整行为。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
class YqKeywordPipelineTest {

    private static final String COMBO = "(辽宁|沈阳|大连)+(药监局|药品监管)";

    /* ------------------------------------------------------------ 表达式解析 */

    @Test
    @DisplayName("组合表达式：地区组 AND 主题组，取末组作为检索词组")
    void parseCombo() {
        KeywordExpression expression = KeywordExpression.parse(COMBO);
        Assertions.assertEquals(2, expression.getGroups().size(), "应解析为 2 个 AND 组");
        Assertions.assertEquals(List.of("辽宁", "沈阳", "大连"), expression.getGroups().get(0));
        Assertions.assertEquals(List.of("药监局", "药品监管"), expression.getGroups().get(1));
        Assertions.assertTrue(expression.getExcludes().isEmpty());
        Assertions.assertEquals(List.of("药监局", "药品监管"), expression.primaryGroup(),
            "检索词组取最后一组：请求量 = 主题词个数，而不是笛卡尔积 3 x 2");
        Assertions.assertEquals(5, expression.wordCount());
    }

    @Test
    @DisplayName("组合表达式：末尾 - 组解析为排除词")
    void parseExclude() {
        KeywordExpression expression = KeywordExpression.parse("(东北超|辽超)+(药企|医药企业)-(广告|代理)");
        Assertions.assertEquals(2, expression.getGroups().size());
        Assertions.assertEquals(List.of("广告", "代理"), expression.getExcludes());
        Assertions.assertEquals(List.of("药企", "医药企业"), expression.primaryGroup());
    }

    @Test
    @DisplayName("全角输入宽容：全角括号 / 竖线 / 加号 / 顿号均可识别")
    void fullWidthTolerance() {
        KeywordExpression expression = KeywordExpression.parse("（辽宁｜沈阳）＋（药监局、药品监管）");
        Assertions.assertEquals(2, expression.getGroups().size());
        Assertions.assertEquals(List.of("辽宁", "沈阳"), expression.getGroups().get(0));
        Assertions.assertEquals(List.of("药监局", "药品监管"), expression.getGroups().get(1));
    }

    @Test
    @DisplayName("不带括号的 OR 组同样可用")
    void bareOrGroup() {
        KeywordExpression expression = KeywordExpression.parse("药监局|药品监管|医疗器械监管");
        Assertions.assertEquals(1, expression.getGroups().size());
        Assertions.assertEquals(3, expression.getGroups().get(0).size());
    }

    /* ------------------------------------------------------------ 语法校验（F-002 验收标准 3） */

    @Test
    @DisplayName("语法校验：合法表达式无问题，非法表达式给出带列位置的说明")
    void validateExpression() {
        Assertions.assertTrue(KeywordExpression.validate(COMBO).isEmpty(), "合法表达式不应报错");
        Assertions.assertTrue(KeywordExpression.validate("药监局|药品监管").isEmpty());

        List<String> missingClose = KeywordExpression.validate("(辽宁|沈阳)+(药监局|药品监管");
        Assertions.assertFalse(missingClose.isEmpty());
        Assertions.assertTrue(missingClose.get(0).contains("列"), "应带列位置：" + missingClose.get(0));
        Assertions.assertTrue(missingClose.get(0).contains("右括号"), missingClose.get(0));

        List<String> nested = KeywordExpression.validate("(辽宁|(沈阳))+(药监局)");
        Assertions.assertTrue(nested.get(0).contains("嵌套"), nested.get(0));

        List<String> extraClose = KeywordExpression.validate("(辽宁|沈阳))");
        Assertions.assertTrue(extraClose.get(0).contains("右括号"), extraClose.get(0));

        List<String> trailingPlus = KeywordExpression.validate("(辽宁|沈阳)+");
        Assertions.assertTrue(trailingPlus.get(0).contains("连接符"), trailingPlus.get(0));

        List<String> onlyExclude = KeywordExpression.validate("-(广告|代理)");
        Assertions.assertTrue(onlyExclude.get(0).contains("只包含排除词"), onlyExclude.get(0));

        Assertions.assertEquals(List.of("表达式为空"), KeywordExpression.validate("  "));
    }

    /* ------------------------------------------------------------ 检索词选择 */

    @Test
    @DisplayName("检索词组选择：last / first / fewest 三种策略")
    void searchTermSelection() {
        KeywordExpression expression = KeywordExpression.parse("(辽宁|沈阳|大连|鞍山)+(药监局|药品监管)");
        Assertions.assertEquals(List.of("药监局", "药品监管"),
            KeywordSpec.fromExpression(1L, COMBO, "combo", "core", expression, "last").getSearchTerms());
        Assertions.assertEquals(List.of("辽宁", "沈阳", "大连", "鞍山"),
            KeywordSpec.fromExpression(1L, COMBO, "combo", "core", expression, "first").getSearchTerms());
        Assertions.assertEquals(List.of("药监局", "药品监管"),
            KeywordSpec.fromExpression(1L, COMBO, "combo", "core", expression, "fewest").getSearchTerms(),
            "fewest 应选词数最少的组");
    }

    /* ------------------------------------------------------------ 匹配语义 */

    @Test
    @DisplayName("STRICT 匹配：两个组都要命中，且不含排除词")
    void strictMatch() {
        KeywordMatcher matcher = KeywordMatcher.builder()
            .spec(spec(COMBO))
            .build();
        Assertions.assertTrue(matcher.accept("辽宁-沈阳 药监局发布药品监管新规"), "两组都命中应通过");
        Assertions.assertFalse(matcher.accept("广东-深圳 药监局发布药品监管新规"),
            "缺地区组不应通过（这正是整串塞进 wd= 时静默采不到的形态）");
        Assertions.assertFalse(matcher.accept("辽宁-沈阳 市场监管局发布通告"), "缺主题组不应通过");
    }

    @Test
    @DisplayName("普通词不做本地过滤，避免搜索引擎分词扩召回被误杀")
    void plainKeywordNotFiltered() {
        KeywordMatcher matcher = KeywordMatcher.builder().spec(KeywordSpec.simple("演示企业")).build();
        Assertions.assertTrue(matcher.enabled());
        Assertions.assertFalse(matcher.filterEnabled(), "普通词默认不过滤");
        Assertions.assertTrue(matcher.accept("任何不含该词的正文也应放行"));
        Assertions.assertEquals(List.of("演示企业"), matcher.effectiveSearchTerms());
    }

    @Test
    @DisplayName("无关键词时匹配器恒放行（链接导入 F-005 复用同一管道不被误过滤）")
    void emptyMatcher() {
        KeywordMatcher matcher = KeywordMatcher.builder().build();
        Assertions.assertFalse(matcher.enabled());
        Assertions.assertTrue(matcher.accept("任意内容"));
        Assertions.assertEquals(List.of(""), matcher.effectiveSearchTerms(), "无词时返回单元素空串");
    }

    /* ------------------------------------------------------------ 端到端 */

    @Test
    @DisplayName("端到端：组合关键词按主题词分别检索，只有地区+主题双命中才入库")
    void comboKeywordEndToEnd() {
        Fixture fixture = new Fixture(keyword -> samples(keyword, false));
        CollectResult result = fixture.pipeline.run(unit(matcher(COMBO, List.of())));
        fixture.sink.flushAll();

        Assertions.assertEquals(4, result.getFetchedCount(), "2 个主题词 x 每词 2 条 = 4 条召回");
        Assertions.assertEquals(2, result.getInsertedCount(), "每词只有 1 条满足「地区 AND 主题」");
        Assertions.assertEquals(2, result.getFilteredCount(), "被关键词条件剔除 2 条");
        Assertions.assertEquals(0, result.getDupCount(), "过滤发生在去重之前，不应占去重配额");
        Assertions.assertEquals(2, fixture.sink.loadedOpinionCount(), "不合格内容不得进 Doris");
        Assertions.assertEquals(1, fixture.sink.loadedLogCount());
    }

    @Test
    @DisplayName("端到端：任务级排除词命中即剔除")
    void excludeTermsEndToEnd() {
        Fixture fixture = new Fixture(keyword -> samples(keyword, true));
        CollectResult result = fixture.pipeline.run(unit(matcher(COMBO, List.of("通报"))));
        fixture.sink.flushAll();

        Assertions.assertEquals(4, result.getFetchedCount());
        Assertions.assertEquals(2, result.getInsertedCount(), "含排除词的条目应被剔除");
        Assertions.assertEquals(2, result.getFilteredCount());
        Assertions.assertEquals(2, fixture.sink.loadedOpinionCount());
    }

    @Test
    @DisplayName("端到端：命中词回写 hit_keywords，便于核查「为什么抓到这条」")
    void hitKeywordsWritten() {
        Fixture fixture = new Fixture(keyword -> samples(keyword, false));
        fixture.pipeline.run(unit(matcher(COMBO, List.of())));

        List<RawOpinion> buffered = fixture.sink.bufferedOpinions();
        Assertions.assertEquals(2, buffered.size());
        String hits = buffered.get(0).getHitKeywords();
        Assertions.assertNotNull(hits);
        Assertions.assertTrue(hits.contains("辽宁"), hits);
        Assertions.assertTrue(hits.contains("药监局"), hits);
    }

    @Test
    @DisplayName("端到端：全部被过滤时给出可识别信号（不触发连续异常告警）")
    void allFilteredSignal() {
        Fixture fixture = new Fixture(keyword -> samples(keyword, false));
        CollectResult result = fixture.pipeline.run(unit(matcher("(新疆|西藏)+(药监局|药品监管)", List.of())));
        fixture.sink.flushAll();

        Assertions.assertEquals(4, result.getFetchedCount(), "检索本身是成功的");
        Assertions.assertEquals(0, result.getInsertedCount());
        Assertions.assertEquals(4, result.getFilteredCount(), "全部被地区组过滤");
        Assertions.assertTrue(result.isAllFiltered(), "应可识别为「抓到了但全不符合关键词」");
        Assertions.assertFalse(result.isAbnormal(), "正常空窗不应计入连续异常告警");
        Assertions.assertEquals("success", result.getResultStatus());
    }

    /* ------------------------------------------------------------ 夹具 */

    private static KeywordSpec spec(String expression) {
        return KeywordSpec.fromExpression(1L, expression, "combo", "core",
            KeywordExpression.parse(expression), "last");
    }

    private static KeywordMatcher matcher(String expression, List<String> excludeTerms) {
        return KeywordMatcher.builder()
            .spec(spec(expression))
            .excludeTerms(excludeTerms)
            .searchGroup("last")
            .maxSearchTerms(8)
            .build();
    }

    /**
     * 每个检索词产出 2 条：一条地区+主题双命中，一条只命中主题。
     *
     * @param withExcludedWord true 时第二条改为「地区命中但含排除词」，用于验证降噪
     */
    private static List<RawOpinion> samples(String keyword, boolean withExcludedWord) {
        List<RawOpinion> list = new ArrayList<>(2);
        list.add(sample(keyword, "辽宁-沈阳", "辽宁沈阳药监局发布药品监管新规", 1));
        String secondTitle = withExcludedWord
            ? "辽宁大连药监局通报药品监管抽查情况"
            : "深圳药监局通报药品监管抽查情况";
        list.add(sample(keyword, "广东-深圳", secondTitle, 2));
        return list;
    }

    private static RawOpinion sample(String keyword, String region, String title, int index) {
        RawOpinion opinion = new RawOpinion();
        opinion.setTitle(title);
        opinion.setContent(title);
        opinion.setRegion(region);
        opinion.setPublishTime(LocalDateTime.now());
        opinion.setOpinionUrl("https://stub.yuqing.local/"
            + Integer.toUnsignedString(String.valueOf(keyword).hashCode(), 36) + "/"
            + Integer.toUnsignedString(region.hashCode(), 36) + "/" + index);
        return opinion;
    }

    private static CollectUnit unit(KeywordMatcher matcher) {
        CollectUnit unit = new CollectUnit();
        unit.setTaskId(11L);
        unit.setTaskName("关键词链路演示任务");
        unit.setChannelId(22L);
        unit.setChannelName("关键词链路演示渠道");
        unit.setAdapterCode("STUB_KEYWORD");
        unit.setCollectStrategy("polling");
        unit.setIntervalSeconds(60);
        unit.setBatchNo("kw-batch");
        unit.setMatcher(matcher);
        return unit;
    }

    private static HttpFetcher throwingFetcher() {
        return request -> {
            throw new IOException("离线测试禁止真实网络请求");
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
     * 受控桩适配器：按检索词产出可预测数据，不发起任何外部请求。
     */
    private static final class StubAdapter extends AbstractSiteAdapter {

        private final Function<String, List<RawOpinion>> generator;

        StubAdapter(YqCollectProperties owner, Function<String, List<RawOpinion>> generator) {
            super(throwingFetcher(), owner);
            this.generator = generator;
        }

        @Override
        public String entryType() {
            return "mock";
        }

        @Override
        public List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception {
            return fetchForEachKeyword(unit, ctx.getMaxRecords(),
                (keyword, budget, seenUrls) -> generator.apply(keyword));
        }
    }

    /**
     * 采集管道测试夹具：真组件 + 桩件，不依赖 Spring / Doris / Redis。
     */
    private static final class Fixture {

        private final CollectPipeline pipeline;

        private final DorisStreamLoader sink;

        Fixture(Function<String, List<RawOpinion>> generator) {
            YqCollectProperties props = new YqCollectProperties();
            props.getSink().setMode("noop");
            props.getDedup().setRedisEnabled(false);
            props.getKeywordFilter().setSearchGroup("last");
            props.setMaxRecordsPerBatch(500);
            /* 本用例只验证关键词链路，净化判定由 F006CleanTest 单独覆盖（短样本会被判为无意义短句） */
            props.getClean().setEnabled(false);

            AdapterSpec spec = new AdapterSpec();
            spec.setCode("STUB_KEYWORD");
            spec.setEntryType("mock");
            Map<String, AdapterSpec> adapters = new LinkedHashMap<>();
            adapters.put("STUB_KEYWORD", spec);
            props.setAdapters(adapters);

            StubAdapter adapter = new StubAdapter(props, generator);
            AdapterRegistry registry = new AdapterRegistry(props, List.of(adapter));
            registry.init();

            CollectMetrics metrics = new CollectMetrics();
            this.sink = new DorisStreamLoader(props, emptyProvider());
            this.pipeline = new CollectPipeline(props, registry, new UrlHashDeduplicator(props),
                new SnapshotStore(props, emptyProvider()), sink, metrics, new BlockDetector(),
                new CollectHealthGuard(props, metrics),
                new NoiseEngine(new NoiseRuleCompiler(null, props), props));
        }
    }
}
