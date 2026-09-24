package org.dromara.yuqing.collect;

import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;
import org.dromara.yuqing.collect.clean.CleanVerdict;
import org.dromara.yuqing.collect.clean.CompiledNoiseRule;
import org.dromara.yuqing.collect.clean.ContentPurifier;
import org.dromara.yuqing.collect.clean.CrossChannelMerger;
import org.dromara.yuqing.collect.clean.NoiseCategory;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.clean.NoiseRuleCompiler;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-006 数据净化与链接去重 离线自测。
 *
 * <p>引擎全部是纯函数 / 无 Spring 容器依赖（mapper 传 null，规则表走空列表降级），
 * 因此可以在没有数据库的环境里直接跑，验证净化、七类降噪、按天去重与统计口径。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
class F006CleanTest {

    /** 离线引擎：规则库为空，只验证内置兜底判定 */
    private static NoiseEngine engine() {
        YqCollectProperties props = new YqCollectProperties();
        return new NoiseEngine(new NoiseRuleCompiler(null, props), props);
    }

    private static RawOpinion raw(String title, String content) {
        RawOpinion raw = new RawOpinion();
        raw.setTitle(title);
        raw.setContent(content);
        return raw;
    }

    private static YqNoiseRule rule(String category, String matchType, String value, int priority) {
        YqNoiseRule rule = new YqNoiseRule();
        rule.setRuleId(1L);
        rule.setRuleName("测试规则");
        rule.setNoiseCategory(category);
        rule.setMatchType(matchType);
        rule.setMatchValue(value);
        rule.setPriority(priority);
        return rule;
    }

    private static RawOpinion row(LocalDate date, String hash, Long channelId, LocalDateTime collectTime) {
        RawOpinion row = new RawOpinion();
        row.setCollectDate(date);
        row.setUrlHash(hash);
        row.setChannelId(channelId);
        row.setCollectTime(collectTime);
        row.setOpinionUrl("https://example.com/" + hash);
        return row;
    }

    @Test
    @DisplayName("净化剥离 script/style 块与全部 HTML 标签")
    void purifyStripsTagsAndScripts() {
        String html = "<div class=\"a\"><p>市场监管局通报</p><script>alert(1)</script>"
            + "<style>.x{color:red}</style></div>";
        String text = ContentPurifier.purify(html);
        assertFalse(text.contains("script"), text);
        assertFalse(text.contains("alert"), text);
        assertFalse(text.contains("color"), text);
        assertEquals("市场监管局通报", text);
    }

    @Test
    @DisplayName("净化解码实体并把全角转半角")
    void purifyDecodesEntitiesAndFullwidth() {
        assertEquals("AB&12 测试", ContentPurifier.purify("ＡＢ＆１２　测试"));
        assertTrue(ContentPurifier.purify("风险&nbsp;提示&amp;处置").contains("风险 提示&处置"));
    }

    @Test
    @DisplayName("标题净化把换行压成单空格")
    void purifyTitleCollapsesNewlines() {
        assertEquals("沈阳 药监局 通报", ContentPurifier.purifyTitle("沈阳\n药监局\r\n  通报"));
    }

    @Test
    @DisplayName("有效字符数忽略零宽字符（emoji 按 1 个字符计）")
    void effectiveLengthIgnoresZeroWidth() {
        assertEquals(4, ContentPurifier.effectiveLength("沈\u200B阳监管"));
        assertEquals(1, ContentPurifier.effectiveLength("\uD83D\uDE00"));
    }

    @Test
    @DisplayName("七类降噪类别与字典取值一一对应")
    void noiseCategoryCoversSeven() {
        assertEquals(7, NoiseCategory.values().length);
        String[] codes = {"spam", "advertisement", "flooding", "meaningless", "bot", "blank", "violation"};
        for (String code : codes) {
            assertNotNull(NoiseCategory.of(code), code);
            assertEquals(code, NoiseCategory.of(code).code());
        }
        assertNull(NoiseCategory.of("unknown"));
        assertNull(NoiseCategory.of(""));
    }

    @Test
    @DisplayName("空白内容判为 blank")
    void blankRejected() {
        CleanVerdict verdict = engine().evaluate(raw("", "   "));
        assertTrue(verdict.isRejected());
        assertEquals(NoiseCategory.BLANK, verdict.getCategory());
        assertEquals(CleanVerdict.REJECTED, verdict.getCleanStatus());
    }

    @Test
    @DisplayName("无意义短句判为 meaningless")
    void meaninglessRejected() {
        CleanVerdict verdict = engine().evaluate(raw("顶", ""));
        assertTrue(verdict.isRejected());
        assertEquals(NoiseCategory.MEANINGLESS, verdict.getCategory());
    }

    @Test
    @DisplayName("连续重复字符判为 flooding")
    void floodingRejected() {
        CleanVerdict verdict = engine().evaluate(raw("评论", "哈".repeat(25)));
        assertTrue(verdict.isRejected());
        assertEquals(NoiseCategory.FLOODING, verdict.getCategory());
    }

    @Test
    @DisplayName("作者名含机器人特征判为 bot")
    void botRejected() {
        RawOpinion raw = raw("每日播报", "本条消息由平台自动汇总生成，供内部参考，不代表本平台立场。");
        raw.setAuthor("newsbot");
        CleanVerdict verdict = engine().evaluate(raw);
        assertTrue(verdict.isRejected());
        assertEquals(NoiseCategory.BOT, verdict.getCategory());
    }

    @Test
    @DisplayName("正常舆情通过净化，且保留溯源字段")
    void normalAcceptedKeepsSourceFields() {
        RawOpinion raw = raw("沈阳市市场监管局通报药品抽检结果",
            "本次抽检共涉及 120 批次样品，不合格 3 批次，已依法处置。");
        raw.setOpinionUrl("https://example.com/a/1");
        raw.setPublishTime(LocalDateTime.of(2026, 9, 22, 8, 0));
        CleanVerdict verdict = engine().evaluate(raw);
        assertFalse(verdict.isRejected());
        assertEquals(CleanVerdict.CLEANED, verdict.getCleanStatus());
        assertNull(verdict.getNoiseReason());
        assertEquals("https://example.com/a/1", raw.getOpinionUrl());
        assertEquals(LocalDateTime.of(2026, 9, 22, 8, 0), raw.getPublishTime());
    }

    @Test
    @DisplayName("关键词规则命中并返回证据")
    void keywordRuleHits() {
        CompiledNoiseRule compiled = CompiledNoiseRule.from(
            rule("advertisement", "keyword", "加微信,代购,刷单", 10));
        assertNotNull(compiled);
        assertEquals(NoiseCategory.ADVERTISEMENT, compiled.getCategory());
        assertFalse(compiled.isDegraded());
        assertTrue(compiled.hits("厂家直销，加微信下单"));
        assertFalse(compiled.hits("市监局发布抽检通报"));
        assertEquals("加微信", compiled.evidence("厂家直销，加微信下单"));
    }

    @Test
    @DisplayName("正则规则命中")
    void regexRuleHits() {
        CompiledNoiseRule compiled = CompiledNoiseRule.from(
            rule("spam", "regex", "加(微信|QQ|群)", 10));
        assertNotNull(compiled);
        assertFalse(compiled.isDegraded());
        assertTrue(compiled.hits("扫码加QQ领红包"));
        assertFalse(compiled.hits("市监局发布抽检通报"));
    }

    @Test
    @DisplayName("正则写错时降级为字面量匹配，不让整条链路失败")
    void badRegexDegradesToLiteral() {
        CompiledNoiseRule compiled = CompiledNoiseRule.from(
            rule("spam", "regex", "加(微信", 10));
        assertNotNull(compiled);
        assertTrue(compiled.isDegraded());
        assertTrue(compiled.getCompileError().contains("降级"));
        // 降级后按字面量匹配：原文里真有这一串仍能命中，正常内容不受影响
        assertTrue(compiled.hits("点击 加(微信 领取"));
        assertFalse(compiled.hits("市监局发布抽检通报"));
    }

    @Test
    @DisplayName("类别无法识别的规则被丢弃而不是默认成 spam")
    void unknownCategoryDropped() {
        assertNull(CompiledNoiseRule.from(rule("unknown", "keyword", "广告", 10)));
        assertNull(CompiledNoiseRule.from(rule("spam", "keyword", "   ", 10)));
    }

    @Test
    @DisplayName("规则按 priority 升序执行（数字小的先判定）")
    void rulesOrderedByPriority() {
        List<CompiledNoiseRule> rules = new ArrayList<>();
        rules.add(CompiledNoiseRule.from(rule("advertisement", "keyword", "广告", 20)));
        rules.add(CompiledNoiseRule.from(rule("spam", "keyword", "广告", 5)));
        rules.sort(Comparator.comparingInt(CompiledNoiseRule::getPriority));
        assertEquals(NoiseCategory.SPAM, rules.get(0).getCategory());
        assertEquals(5, rules.get(0).getPriority());
    }

    @Test
    @DisplayName("同日同链接跨渠道：保留首条并把其余渠道补到首条")
    void crossChannelKeepsFirstAndMergesChannels() {
        LocalDate d = LocalDate.of(2026, 9, 22);
        List<RawOpinion> rows = new ArrayList<>();
        rows.add(row(d, "h1", 101L, LocalDateTime.of(2026, 9, 22, 10, 0)));
        rows.add(row(d, "h1", 102L, LocalDateTime.of(2026, 9, 22, 9, 0)));
        rows.add(row(d, "h1", 103L, LocalDateTime.of(2026, 9, 22, 11, 0)));
        CrossChannelMerger.MergeOutcome outcome = CrossChannelMerger.merge(rows);
        assertEquals(1, outcome.getKeepers().size());
        assertEquals(2, outcome.getDupCount());
        assertEquals(2, outcome.getDupChannelCount());
        // 首条 = 采集时间最早的那条
        assertEquals(Long.valueOf(102L), outcome.getKeepers().get(0).getChannelId());
        String merged = outcome.getKeepers().get(0).getDupChannelIds();
        assertNotNull(merged);
        assertTrue(merged.contains("101"), merged);
        assertTrue(merged.contains("103"), merged);
        assertFalse(merged.contains("102"), "首条自身渠道不该出现在重复列表里");
    }

    @Test
    @DisplayName("跨天同链接不算重复（按天去重）")
    void crossDayNotDuplicate() {
        LocalDate d = LocalDate.of(2026, 9, 22);
        List<RawOpinion> rows = new ArrayList<>();
        rows.add(row(d, "h1", 101L, LocalDateTime.of(2026, 9, 22, 10, 0)));
        rows.add(row(d.plusDays(1), "h1", 102L, LocalDateTime.of(2026, 9, 23, 10, 0)));
        CrossChannelMerger.MergeOutcome outcome = CrossChannelMerger.merge(rows);
        assertEquals(2, outcome.getKeepers().size());
        assertEquals(0, outcome.getDupCount());
        assertEquals(0, outcome.getDupChannelCount());
    }

    @Test
    @DisplayName("去重率与降噪率按扫描条数计算，按类别可下钻")
    void statsRatesAndCategoryBreakdown() {
        CleanBatchStats stats = new CleanBatchStats();
        stats.setTotalCount(1000);
        stats.setDupCount(250);
        assertEquals(0, new BigDecimal("25.00").compareTo(stats.dupRate()));
        stats.incRejected(NoiseCategory.ADVERTISEMENT);
        stats.incRejected(NoiseCategory.ADVERTISEMENT);
        stats.incRejected(NoiseCategory.SPAM);
        assertEquals(2, stats.countOf(NoiseCategory.ADVERTISEMENT));
        assertEquals(1, stats.countOf(NoiseCategory.SPAM));
        assertEquals(0, stats.countOf(NoiseCategory.VIOLATION));
        assertEquals(3, stats.getRejectedCount());
        assertEquals(0, new BigDecimal("0.30").compareTo(stats.rejectRate()));
        assertTrue(stats.summary().contains("去重率 25.00%"));
    }

    @Test
    @DisplayName("重跑范围必须闭合且不能无范围全表重扫")
    void scopeValidation() {
        CleanBatchScope scope = new CleanBatchScope();
        assertThrows(IllegalArgumentException.class, scope::assertValid);

        scope.setScopeStartDate(LocalDate.of(2026, 1, 1));
        scope.setScopeEndDate(LocalDate.of(2026, 3, 1));
        assertThrows(IllegalArgumentException.class, scope::assertValid, "缺任务/渠道范围");

        scope.setScopeTaskId(1L);
        scope.assertValid();

        scope.setScopeEndDate(LocalDate.of(2025, 12, 31));
        assertThrows(IllegalArgumentException.class, scope::assertValid, "截止日早于起始日");
    }
}
