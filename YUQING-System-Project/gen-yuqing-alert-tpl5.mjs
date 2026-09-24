/**
 * F-010 / F-011 离线自测模板 + 配置样例
 */
export const TEST_TPL = [

  /* ------------------------------------------------------------ 配置样例 */
  {
    rel: 'config/yq_alert.yml',
    content: `# ============================================================================
# 舆情监测平台 · 预警与推送配置（F-010 + F-011）
#
# 落位：application-<profile>.yml 的 spring.config.import 或直接追加到 application.yml
# 前缀：yuqing.alert
# ============================================================================
yuqing:
  alert:
    # 预警引擎总开关；关闭时扫描任务直接返回，不产生任何查询
    enabled: true

    # 每次扫描回看的时间范围（分钟）：扫描 [now-30min, now) 内新增舆情
    scan-window-minutes: 30

    # 单次扫描最多载入的舆情条数（保护性上限）
    max-scan-records: 2000

    # 突发增量基线：取最近 7 个同长度窗口的算术平均
    baseline-windows: 7

    # 突发增量最小条数下限：低于该值不判定为突发（防「0 → 2 条」算成无限倍）
    min-burst-count: 5

    # 规则未显式配置时的默认突发倍数阈值
    default-burst-ratio: 3.0

    # 规则未显式配置时的默认冷却期（分钟）
    default-cooldown-minutes: 360

    # 需要在列表/台账做醒目提示（红标）的预警级别
    highlight-levels: warning,urgent

    push:
      # 推送总开关
      enabled: true

      # ---- 企业微信自建应用凭据 ----
      # ⚠ 强烈建议走环境变量注入，不要提交明文 secret 到代码库：
      #    corp-id: \${YUQING_WECOM_CORP_ID:}
      #    corp-secret: \${YUQING_WECOM_CORP_SECRET:}
      #    agent-id: \${YUQING_WECOM_AGENT_ID:}
      # 任一为空时，推送通道降级为日志并把结果标记为 failed（不会静默假成功）
      corp-id: ""
      corp-secret: ""
      agent-id: ""

      api-base: https://qyapi.weixin.qq.com
      connect-timeout-ms: 3000
      read-timeout-ms: 8000

      # 单条文本消息正文最大字符数（企微应用消息上限 2048 字节，中文按 3 字节留冗余）
      max-content-chars: 1500

      # 失败重试上限（推送规则可覆盖，硬上限 10）
      max-retry: 3

      # 重试退避基数（毫秒），实际等待 = backoff * 2^(attempt-1)
      retry-backoff-ms: 2000

      # H5 查看入口基址，用于拼接「查看详情」链接；为空则不下发链接
      h5-base-url: ""

      # 高风险即时推送是否穿透免打扰时段（默认 true）
      # 免打扰是为了不打扰休息时间，不该把最要紧的预警一起吞掉
      immediate-pierce-quiet: true

      # 演练模式：不真正发送，按成功留痕。仅联调期使用，生产必须 false
      dry-run: false
`,
  },

  /* ---------------------------------------------------------- 离线自测类 */
  {
    rel: 'test/java/org/dromara/yuqing/alert/F010AlertPushTest.java',
    content: `package org.dromara.yuqing.alert;

import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.push.LoggingWecomTransport;
import org.dromara.yuqing.push.PushDispatcher;
import org.dromara.yuqing.push.PushOutcome;
import org.dromara.yuqing.push.PushRequest;
import org.dromara.yuqing.push.PushRetryPolicy;
import org.dromara.yuqing.push.PushTargetResolver;
import org.dromara.yuqing.push.PushTemplateRenderer;
import org.dromara.yuqing.push.PushUserDirectory;
import org.dromara.yuqing.push.QuietHours;
import org.dromara.yuqing.push.WecomTransport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-010 风险预警 + F-011 企业微信推送 离线自测
 *
 * <p>不依赖 Spring 上下文与数据库：计数来源、用户目录、消息通道全部用内存实现替换，
 * 因此可以在纯 javac + junit-jupiter 的离线环境里执行。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
@DisplayName("F-010 预警 / F-011 推送 离线自测")
public class F010AlertPushTest {

    /* ================================================================ 工具 */

    private static YqAlertProperties props() {
        YqAlertProperties p = new YqAlertProperties();
        p.setEnabled(true);
        p.setScanWindowMinutes(30);
        p.setBaselineWindows(7);
        p.setMinBurstCount(5);
        p.setDefaultBurstRatio(3.0d);
        p.setDefaultCooldownMinutes(360);
        p.setHighlightLevels("warning,urgent");
        return p;
    }

    private static AlertCandidate candidate(Long id, String title, String senti) {
        return AlertCandidate.builder()
            .opinionId(id)
            .taskId(1001L)
            .channelId(2001L)
            .title(title)
            .content("正文内容示例，用于推送渲染测试。")
            .opinionUrl("https://example.com/a/" + id)
            .publishTime(LocalDateTime.of(2026, 9, 22, 10, 0))
            .sentiAttr(senti)
            .analyzeStatus("raw")
            .build();
    }

    private static AlertRuleSpec rule(String scenes, String level, String risk, String spread) {
        YqAlertRule r = new YqAlertRule();
        r.setRuleId(1L);
        r.setRuleName("测试规则");
        r.setTriggerScenes(scenes);
        r.setWindowMinutes(10);
        r.setRiskLevelThreshold(risk);
        r.setSpreadThreshold(spread);
        r.setAlertLevel(level);
        r.setPushLevel("immediate");
        r.setStatus("0");
        return AlertRuleSpec.from(r, 3.0d, 5, 360);
    }

    /** 固定返回同一个计数值的计数来源 */
    private static AlertCountSource fixedCount(long n) {
        return (taskId, channelId, sentiAttr, from, to) -> n;
    }

    /** 按窗口时长区分：当前窗口给 cur，其余给 baseline */
    private static AlertCountSource shapedCount(long cur, long baseline, LocalDateTime now, int windowMin) {
        LocalDateTime curStart = now.minusMinutes(windowMin);
        return (taskId, channelId, sentiAttr, from, to) -> from.isBefore(curStart) ? baseline : cur;
    }

    private static final class MemDirectory implements PushUserDirectory {
        final Set<Long> role = new LinkedHashSet<>(Arrays.asList(11L, 12L));
        final Set<Long> dept = new LinkedHashSet<>(Arrays.asList(21L));
        final java.util.Map<Long, String> wecom = new java.util.HashMap<>();

        MemDirectory() {
            wecom.put(11L, "zhang_san");
            wecom.put(12L, "li_si");
            wecom.put(21L, "wang_wu");
        }

        @Override
        public Set<Long> byRole(Long roleId) {
            return new LinkedHashSet<>(role);
        }

        @Override
        public Set<Long> byDept(Long deptId) {
            return new LinkedHashSet<>(dept);
        }

        @Override
        public Set<Long> byExplicit(String csvIds) {
            Set<Long> out = new LinkedHashSet<>();
            if (csvIds == null || csvIds.isBlank()) {
                return out;
            }
            for (String s : csvIds.split(",")) {
                String t = s.trim();
                if (!t.isEmpty()) {
                    out.add(Long.valueOf(t));
                }
            }
            return out;
        }

        @Override
        public String wecomUserId(Long userId) {
            return wecom.get(userId);
        }
    }

    /** 恒成功的通道 */
    private static final class OkTransport implements WecomTransport {
        int calls = 0;

        @Override
        public String name() {
            return "test-ok";
        }

        @Override
        public SendResult sendText(String touser, String content) {
            calls++;
            return SendResult.ok("{\\"errcode\\":0}");
        }

        @Override
        public SendResult sendMarkdown(String touser, String content) {
            return sendText(touser, content);
        }

        @Override
        public SendResult sendFile(String touser, String fileName, byte[] bytes) {
            return sendText(touser, fileName);
        }
    }

    /** 前 N 次失败、之后成功，用于验证指数退避重试 */
    private static final class FlakyTransport implements WecomTransport {
        private final int failTimes;
        private int calls = 0;

        FlakyTransport(int failTimes) {
            this.failTimes = failTimes;
        }

        @Override
        public String name() {
            return "test-flaky";
        }

        @Override
        public SendResult sendText(String touser, String content) {
            calls++;
            if (calls <= failTimes) {
                return SendResult.fail(45009, "api freq out of limit");
            }
            return SendResult.ok(null);
        }

        @Override
        public SendResult sendMarkdown(String touser, String content) {
            return sendText(touser, content);
        }

        @Override
        public SendResult sendFile(String touser, String fileName, byte[] bytes) {
            return sendText(touser, fileName);
        }
    }

    /* ==================================================== F-010 场景字典 */

    @Test
    @DisplayName("验收1：四类预警场景可解析，未知取值静默丢弃")
    public void testSceneParse() {
        Set<String> all = AlertScene.parse("new_negative,high_risk,burst_increment,special_topic");
        assertEquals(4, all.size());
        assertTrue(AlertScene.contains("new_negative,high_risk", AlertScene.HIGH_RISK));
        assertTrue(AlertScene.parse("new_negative,unknown_scene").size() == 1);
        assertTrue(AlertScene.parse(null).isEmpty());
        assertTrue(AlertScene.parse("  ").isEmpty());
    }

    @Test
    @DisplayName("验收1：场景串支持中英文逗号、分号与空白分隔")
    public void testSceneSeparators() {
        Set<String> s = AlertScene.parse("new_negative，high_risk; burst_increment special_topic");
        assertEquals(4, s.size());
    }

    /* ================================================ F-010 规则编译与序位 */

    @Test
    @DisplayName("验收2：规则阈值编译进 AlertRuleSpec")
    public void testRuleSpecCompile() {
        YqAlertRule r = new YqAlertRule();
        r.setRuleId(9L);
        r.setRuleName("阈值规则");
        r.setTriggerScenes("new_negative");
        r.setWindowMinutes(15);
        r.setCountThreshold(8);
        r.setHeatThreshold(70);
        r.setRiskLevelThreshold("severe");
        r.setSpreadThreshold("high");
        r.setBurstRatio(new BigDecimal("4.50"));
        r.setMinBurstCount(6);
        r.setCooldownMinutes(120);
        r.setTopicTags("安全生产,环保督查");
        r.setAlertLevel("urgent");
        r.setPushLevel("immediate");
        r.setStatus("0");

        AlertRuleSpec spec = AlertRuleSpec.from(r, 3.0d, 5, 360);
        assertEquals(15, spec.safeWindowMinutes(10));
        assertEquals(4.5d, spec.safeBurstRatio(3.0d), 0.0001d);
        assertEquals(6, spec.safeMinBurstCount(5));
        assertEquals(120, spec.safeCooldownMinutes(360));
        assertEquals(3, spec.riskThresholdRank());
        assertEquals(3, spec.spreadThresholdRank());
        assertTrue(spec.enabled());
        assertTrue(spec.supports(AlertScene.NEW_NEGATIVE));
        assertFalse(spec.supports(AlertScene.HIGH_RISK));
    }

    @Test
    @DisplayName("验收2：风险/传播序位映射，未知值归零")
    public void testRanks() {
        assertEquals(1, AlertRuleSpec.riskRank("general"));
        assertEquals(2, AlertRuleSpec.riskRank("moderate"));
        assertEquals(3, AlertRuleSpec.riskRank("severe"));
        assertEquals(0, AlertRuleSpec.riskRank("unknown"));
        assertEquals(0, AlertRuleSpec.riskRank(null));
        assertEquals(1, AlertRuleSpec.spreadRank("low"));
        assertEquals(4, AlertRuleSpec.spreadRank("viral"));
        assertEquals(0, AlertRuleSpec.spreadRank(null));
    }

    @Test
    @DisplayName("验收2：停用规则不参与判定")
    public void testRuleDisabled() {
        YqAlertRule r = new YqAlertRule();
        r.setRuleId(1L);
        r.setTriggerScenes("high_risk");
        r.setStatus("1");
        AlertRuleSpec spec = AlertRuleSpec.from(r, 3.0d, 5, 360);
        assertFalse(spec.enabled());
    }

    @Test
    @DisplayName("验收2：重点专项标签按命中判断")
    public void testTopicHit() {
        AlertRuleSpec spec = rule("special_topic", "warning", "moderate", "medium");
        AlertRuleSpec withTags = AlertRuleSpec.from(tagRule("安全生产"), 3.0d, 5, 360);
        assertTrue(withTags.hitTopic("安全生产,环保"));
        assertFalse(withTags.hitTopic("其它话题"));
        assertFalse(withTags.hitTopic(null));
        assertFalse(spec.hitTopic("安全生产"));
    }

    private static YqAlertRule tagRule(String tags) {
        YqAlertRule r = new YqAlertRule();
        r.setRuleId(2L);
        r.setTriggerScenes("special_topic");
        r.setTopicTags(tags);
        r.setAlertLevel("warning");
        r.setPushLevel("immediate");
        r.setStatus("0");
        return r;
    }

    /* ================================================== F-010 兜底分级器 */

    @Test
    @DisplayName("兜底分级：传播量级按阅读量分四档")
    public void testResolveSpread() {
        AlertCandidate a = candidate(1L, "t", "neutral");
        a.setReadCount(500L);
        assertEquals("low", LevelResolver.resolveSpread(a));
        a.setReadCount(5000L);
        assertEquals("medium", LevelResolver.resolveSpread(a));
        a.setReadCount(50000L);
        assertEquals("high", LevelResolver.resolveSpread(a));
        a.setReadCount(120000L);
        assertEquals("viral", LevelResolver.resolveSpread(a));
    }

    @Test
    @DisplayName("兜底分级：阅读量缺失时用互动量之和")
    public void testResolveSpreadFallback() {
        AlertCandidate a = candidate(1L, "t", "neutral");
        a.setLikeCount(600L);
        a.setCommentCount(500L);
        a.setShareCount(0L);
        assertEquals(1100L, LevelResolver.spreadMetric(a));
        assertEquals("medium", LevelResolver.resolveSpread(a));
    }

    @Test
    @DisplayName("兜底分级：非负面舆情无风险等级")
    public void testResolveRiskNonNegative() {
        AlertCandidate positive = candidate(1L, "好消息", "positive");
        positive.setHeatScore(99);
        positive.setReadCount(999999L);
        assertNull(LevelResolver.resolveRisk(positive));
    }

    @Test
    @DisplayName("兜底分级：负面舆情按热度与传播量定风险三级")
    public void testResolveRiskLevels() {
        AlertCandidate mild = candidate(1L, "投诉", "negative");
        mild.setHeatScore(10);
        mild.setReadCount(100L);
        assertEquals("general", LevelResolver.resolveRisk(mild));

        AlertCandidate mid = candidate(2L, "质疑", "negative");
        mid.setHeatScore(60);
        mid.setReadCount(100L);
        assertEquals("moderate", LevelResolver.resolveRisk(mid));

        AlertCandidate bad = candidate(3L, "事故", "negative");
        bad.setHeatScore(20);
        bad.setReadCount(200000L);
        assertEquals("severe", LevelResolver.resolveRisk(bad));
    }

    @Test
    @DisplayName("兜底分级：严重且高传播判紧急")
    public void testResolveLevelUrgent() {
        AlertCandidate a = candidate(1L, "事故", "negative");
        a.setHeatScore(90);
        a.setReadCount(300000L);
        LevelResolver.resolve(a);
        assertEquals("severe", a.getRiskLevel());
        assertEquals("viral", a.getSpreadLevel());
        assertEquals("urgent", a.getOpinionLevel());
    }

    @Test
    @DisplayName("兜底分级：只补空值，不覆盖已有判定（F-007 落地后可接管）")
    public void testResolveDoesNotOverwrite() {
        AlertCandidate a = candidate(1L, "事故", "negative");
        a.setOpinionLevel("attention");
        a.setRiskLevel("general");
        a.setSpreadLevel("low");
        a.setAnalyzeStatus(LevelResolver.ANALYZED);
        a.setHeatScore(100);
        a.setReadCount(999999L);
        assertFalse(LevelResolver.resolve(a));
        assertEquals("attention", a.getOpinionLevel());
        assertEquals("general", a.getRiskLevel());
        assertEquals("low", a.getSpreadLevel());
    }

    /* ================================================== F-010 突发增量 */

    @Test
    @DisplayName("验收2：突发增量命中（当前 40 条 / 基线 4 条 = 10 倍）")
    public void testBurstHit() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 22, 12, 0);
        AlertCountSource src = shapedCount(40L, 4L, now, 10);
        BurstDetector.BurstOutcome o = BurstDetector.detect(src, 1001L, now, 10, 7, 3.0d, 5);
        assertTrue(o.isHit());
        assertEquals(40L, o.getCurrentCount());
        assertEquals(10.0d, o.getRatio(), 0.0001d);
        assertTrue(o.getDescription().contains("10.00"));
    }

    @Test
    @DisplayName("验收2：增量未达倍数阈值不触发")
    public void testBurstBelowRatio() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 22, 12, 0);
        AlertCountSource src = shapedCount(10L, 8L, now, 10);
        assertFalse(BurstDetector.detect(src, 1001L, now, 10, 7, 3.0d, 5).isHit());
    }

    @Test
    @DisplayName("验收2：当前窗口条数低于下限不触发（防小样本虚高）")
    public void testBurstBelowMinCount() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 22, 12, 0);
        AlertCountSource src = shapedCount(2L, 0L, now, 10);
        BurstDetector.BurstOutcome o = BurstDetector.detect(src, 1001L, now, 10, 7, 3.0d, 5);
        assertFalse(o.isHit());
        assertTrue(o.getDescription().contains("低于下限"));
    }

    @Test
    @DisplayName("验收2：基线为 0 时按 1 兜底，避免除零与无限倍")
    public void testBurstZeroBaseline() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 22, 12, 0);
        AlertCountSource src = shapedCount(6L, 0L, now, 10);
        BurstDetector.BurstOutcome o = BurstDetector.detect(src, 1001L, now, 10, 7, 3.0d, 5);
        assertTrue(o.isHit());
        assertEquals(6.0d, o.getRatio(), 0.0001d);
    }

    /* ================================================== F-010 聚合指纹 */

    @Test
    @DisplayName("验收7：有事件聚合ID时按 cluster 聚合")
    public void testFingerprintCluster() {
        AlertCandidate a = candidate(1L, "标题A", "negative");
        a.setClusterId(8888L);
        assertEquals("cluster:8888", AlertFingerprint.of(a));
    }

    @Test
    @DisplayName("验收7：无聚合ID时按 任务+标题指纹 聚合，标题归一化")
    public void testFingerprintTitle() {
        AlertCandidate a = candidate(1L, "某公司 发生！事故（续报）", "negative");
        AlertCandidate b = candidate(2L, "某公司发生事故续报", "negative");
        assertEquals(AlertFingerprint.of(a), AlertFingerprint.of(b));
        assertEquals("某公司发生事故续报", AlertFingerprint.normalize("某公司 发生！事故（续报）"));
        assertEquals(16, AlertFingerprint.sha16("abc").length());
        assertTrue(AlertFingerprint.sha16("abc").matches("[0-9a-f]{16}"));
    }

    /* ================================================== F-010 主引擎 */

    @Test
    @DisplayName("验收2/3：新增负面达到条数阈值即命中并带触发值")
    public void testEngineNewNegative() {
        YqAlertRule raw = new YqAlertRule();
        raw.setRuleId(1L);
        raw.setTriggerScenes("new_negative");
        raw.setWindowMinutes(10);
        raw.setCountThreshold(3);
        raw.setAlertLevel("warning");
        raw.setPushLevel("immediate");
        raw.setStatus("0");
        AlertRuleSpec spec = AlertRuleSpec.from(raw, 3.0d, 5, 360);

        AlertEngine engine = new AlertEngine(props(), fixedCount(5L));
        List<AlertDecision> out = engine.evaluate(
            List.of(candidate(1L, "负面一", "negative")), List.of(spec), new LinkedHashSet<>(),
            LocalDateTime.of(2026, 9, 22, 12, 0));
        assertEquals(1, out.size());
        assertEquals(AlertScene.NEW_NEGATIVE, out.get(0).getScene());
        assertTrue(out.get(0).getTriggerValue().contains("阈值 3"));
    }

    @Test
    @DisplayName("验收2：条数未达阈值不命中")
    public void testEngineNewNegativeBelowThreshold() {
        YqAlertRule raw = new YqAlertRule();
        raw.setRuleId(1L);
        raw.setTriggerScenes("new_negative");
        raw.setWindowMinutes(10);
        raw.setCountThreshold(10);
        raw.setAlertLevel("warning");
        raw.setPushLevel("immediate");
        raw.setStatus("0");
        AlertRuleSpec spec = AlertRuleSpec.from(raw, 3.0d, 5, 360);
        AlertEngine engine = new AlertEngine(props(), fixedCount(2L));
        assertTrue(engine.evaluate(List.of(candidate(1L, "负面一", "negative")), List.of(spec),
            new LinkedHashSet<>(), LocalDateTime.now()).isEmpty());
    }

    @Test
    @DisplayName("验收2：中性/正面舆情不触发 new_negative")
    public void testEngineSkipsNonNegative() {
        AlertRuleSpec spec = rule("new_negative", "warning", "moderate", "medium");
        AlertEngine engine = new AlertEngine(props(), fixedCount(99L));
        assertTrue(engine.evaluate(List.of(candidate(1L, "中性消息", "neutral")), List.of(spec),
            new LinkedHashSet<>(), LocalDateTime.now()).isEmpty());
    }

    @Test
    @DisplayName("验收2：高风险场景按风险等级阈值命中")
    public void testEngineHighRisk() {
        AlertRuleSpec spec = rule("high_risk", "urgent", "moderate", "high");
        AlertCandidate c = candidate(1L, "严重事故", "negative");
        c.setRiskLevel("severe");
        c.setSpreadLevel("low");
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        List<AlertDecision> out = engine.evaluate(List.of(c), List.of(spec), new LinkedHashSet<>(), LocalDateTime.now());
        assertEquals(1, out.size());
        assertEquals(AlertScene.HIGH_RISK, out.get(0).getScene());
        assertTrue(out.get(0).getTriggerValue().contains("风险"));
    }

    @Test
    @DisplayName("验收2：传播量级达阈值也可触发高风险场景")
    public void testEngineHighRiskBySpread() {
        AlertRuleSpec spec = rule("high_risk", "warning", "severe", "medium");
        AlertCandidate c = candidate(1L, "热帖", "negative");
        c.setRiskLevel("general");
        c.setSpreadLevel("viral");
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        List<AlertDecision> out = engine.evaluate(List.of(c), List.of(spec), new LinkedHashSet<>(), LocalDateTime.now());
        assertEquals(1, out.size());
        assertTrue(out.get(0).getTriggerValue().contains("传播"));
    }

    @Test
    @DisplayName("验收1：重点专项场景按话题标签命中")
    public void testEngineSpecialTopic() {
        AlertRuleSpec spec = AlertRuleSpec.from(tagRule("安全生产"), 3.0d, 5, 360);
        AlertCandidate c = candidate(1L, "某厂安全事件", "neutral");
        c.setTopicTags("安全生产,应急管理");
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        List<AlertDecision> out = engine.evaluate(List.of(c), List.of(spec), new LinkedHashSet<>(), LocalDateTime.now());
        assertEquals(1, out.size());
        assertEquals(AlertScene.SPECIAL_TOPIC, out.get(0).getScene());
    }

    @Test
    @DisplayName("验收1：突发增量场景按任务只判定一次，避免每条舆情都发一遍")
    public void testEngineBurstOncePerTask() {
        LocalDateTime now = LocalDateTime.of(2026, 9, 22, 12, 0);
        YqAlertRule raw = new YqAlertRule();
        raw.setRuleId(1L);
        raw.setTriggerScenes("burst_increment");
        raw.setWindowMinutes(10);
        raw.setBurstRatio(new BigDecimal("3.00"));
        raw.setAlertLevel("warning");
        raw.setPushLevel("immediate");
        raw.setStatus("0");
        AlertRuleSpec spec = AlertRuleSpec.from(raw, 3.0d, 5, 360);

        AlertCountSource src = shapedCount(40L, 4L, now, 10);
        AlertEngine engine = new AlertEngine(props(), src);
        List<AlertCandidate> batch = new ArrayList<>(Arrays.asList(
            candidate(1L, "突发一", "neutral"),
            candidate(2L, "突发二", "neutral"),
            candidate(3L, "突发三", "neutral")));
        List<AlertDecision> out = engine.evaluate(batch, List.of(spec), new LinkedHashSet<>(), now);
        assertEquals(1, out.size(), "同一任务一轮内只应产出 1 条突发预警");
        assertEquals(AlertScene.BURST_INCREMENT, out.get(0).getScene());
    }

    @Test
    @DisplayName("验收7：冷却期内同指纹被抑制，不重复预警")
    public void testEngineCooldownSuppress() {
        AlertRuleSpec spec = rule("high_risk", "warning", "moderate", "medium");
        AlertCandidate c = candidate(1L, "同一事件", "negative");
        c.setClusterId(777L);
        c.setRiskLevel("severe");
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        Set<String> cooled = new LinkedHashSet<>(List.of("cluster:777"));
        assertTrue(engine.evaluate(List.of(c), List.of(spec), cooled, LocalDateTime.now()).isEmpty());
    }

    @Test
    @DisplayName("验收7：同一轮内相同指纹只产出一次")
    public void testEngineSameRoundDedupe() {
        AlertRuleSpec spec = rule("high_risk", "warning", "moderate", "medium");
        AlertCandidate a = candidate(1L, "同一事件转发", "negative");
        AlertCandidate b = candidate(2L, "同一事件转发", "negative");
        a.setRiskLevel("severe");
        b.setRiskLevel("severe");
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        List<AlertDecision> out = engine.evaluate(List.of(a, b), List.of(spec), new LinkedHashSet<>(), LocalDateTime.now());
        assertEquals(1, out.size());
    }

    @Test
    @DisplayName("验收2：无规则或无候选时返回空结果，不抛异常")
    public void testEngineEmptyInputs() {
        AlertEngine engine = new AlertEngine(props(), fixedCount(0L));
        assertTrue(engine.evaluate(new ArrayList<>(), List.of(rule("high_risk", "warning", "moderate", "medium")),
            new LinkedHashSet<>(), LocalDateTime.now()).isEmpty());
        assertTrue(engine.evaluate(List.of(candidate(1L, "t", "negative")), new ArrayList<>(),
            new LinkedHashSet<>(), LocalDateTime.now()).isEmpty());
    }

    /* ============================================== F-010 处置状态机 */

    @Test
    @DisplayName("验收5：状态流转矩阵合法与非法")
    public void testStatusTransit() {
        assertTrue(AlertStatusMachine.canTransit("pending", "processing"));
        assertTrue(AlertStatusMachine.canTransit("pending", "handled"));
        assertTrue(AlertStatusMachine.canTransit("processing", "handled"));
        assertFalse(AlertStatusMachine.canTransit("handled", "processing"));
        assertFalse(AlertStatusMachine.canTransit("ignored", "handled"));
        assertFalse(AlertStatusMachine.canTransit("pending", "unknown"));
    }

    @Test
    @DisplayName("验收6：标记已处置未填说明则拒绝提交")
    public void testValidateHandleRequiresRemark() {
        YqAlert a = new YqAlert();
        a.setAlertId(1L);
        a.setStatus(AlertStatusMachine.HANDLED);
        assertThrows(ServiceException.class, () -> AlertStatusMachine.validate(a, "1"));
    }

    @Test
    @DisplayName("验收6：处置说明过短同样拒绝")
    public void testValidateHandleRemarkTooShort() {
        YqAlert a = new YqAlert();
        a.setAlertId(1L);
        a.setStatus(AlertStatusMachine.HANDLED);
        a.setProcessRemark("已办");
        assertThrows(ServiceException.class, () -> AlertStatusMachine.validate(a, "1"));
    }

    @Test
    @DisplayName("验收6：处置说明合规时通过校验；已忽略也要求说明")
    public void testValidatePass() {
        YqAlert a = new YqAlert();
        a.setAlertId(1L);
        a.setStatus(AlertStatusMachine.HANDLED);
        a.setProcessRemark("已联系主管部门核实并发布通报");
        AlertStatusMachine.validate(a, "1");

        YqAlert b = new YqAlert();
        b.setAlertId(2L);
        b.setStatus(AlertStatusMachine.IGNORED);
        assertThrows(ServiceException.class, () -> AlertStatusMachine.validate(b, "1"));
        b.setProcessRemark("重复推送，与事件聚合编号 8888 同一事件");
        AlertStatusMachine.validate(b, "1");
    }

    @Test
    @DisplayName("验收5：处置中状态不强制说明（允许边处置边补）")
    public void testValidateProcessingNoRemark() {
        YqAlert a = new YqAlert();
        a.setAlertId(1L);
        a.setStatus(AlertStatusMachine.PROCESSING);
        AlertStatusMachine.validate(a, "1");
    }

    /* ================================================== F-011 免打扰 */

    @Test
    @DisplayName("验收1：免打扰同日区间判定")
    public void testQuietSameDay() {
        assertTrue(QuietHours.inQuiet("12:00", "14:00", LocalTime.of(13, 0)));
        assertFalse(QuietHours.inQuiet("12:00", "14:00", LocalTime.of(15, 0)));
        assertFalse(QuietHours.inQuiet("12:00", "14:00", LocalTime.of(11, 59)));
    }

    @Test
    @DisplayName("验收1：免打扰跨夜区间判定（22:00-08:00）")
    public void testQuietCrossNight() {
        assertTrue(QuietHours.inQuiet("22:00", "08:00", LocalTime.of(23, 30)));
        assertTrue(QuietHours.inQuiet("22:00", "08:00", LocalTime.of(3, 0)));
        assertFalse(QuietHours.inQuiet("22:00", "08:00", LocalTime.of(9, 0)));
    }

    @Test
    @DisplayName("验收1：未配置或起止相同视为不在免打扰（宁可多发不可漏发）")
    public void testQuietUnset() {
        assertFalse(QuietHours.inQuiet(null, "08:00", LocalTime.of(3, 0)));
        assertFalse(QuietHours.inQuiet("22:00", null, LocalTime.of(3, 0)));
        assertFalse(QuietHours.inQuiet("bad", "08:00", LocalTime.of(3, 0)));
        assertFalse(QuietHours.inQuiet("22:00", "22:00", LocalTime.of(22, 30)));
    }

    @Test
    @DisplayName("验收1：HH:mm 支持单数字小时（9:00）")
    public void testQuietSingleDigitHour() {
        assertNotNull(QuietHours.parse("9:00"));
        assertTrue(QuietHours.inQuiet("9:00", "10:00", LocalTime.of(9, 30)));
    }

    /* ============================================ F-011 重试策略 */

    @Test
    @DisplayName("验收8：重试上限归一化与硬上限 10")
    public void testRetryNormalize() {
        assertEquals(3, PushRetryPolicy.normalizeMaxRetry(0, 3));
        assertEquals(5, PushRetryPolicy.normalizeMaxRetry(5, 3));
        assertEquals(10, PushRetryPolicy.normalizeMaxRetry(99, 3));
        assertEquals(0, PushRetryPolicy.normalizeMaxRetry(-1, 3));
    }

    @Test
    @DisplayName("验收8：指数退避与重试额度判断")
    public void testRetryBackoff() {
        assertEquals(2000L, PushRetryPolicy.backoffMs(2000L, 1));
        assertEquals(4000L, PushRetryPolicy.backoffMs(2000L, 2));
        assertEquals(8000L, PushRetryPolicy.backoffMs(2000L, 3));
        assertEquals(0L, PushRetryPolicy.backoffMs(0L, 3));
        assertTrue(PushRetryPolicy.canRetry(0, 3));
        assertFalse(PushRetryPolicy.canRetry(3, 3));
    }

    /* ============================================ F-011 模板渲染 */

    @Test
    @DisplayName("验收5：明细模板固定含 10 要素")
    public void testRenderDetailTenFields() {
        PushTemplateRenderer r = new PushTemplateRenderer(props());
        AlertCandidate c = candidate(1L, "某公司发生安全事故", "negative");
        c.setChannelName("新浪微博");
        c.setRiskLevel("severe");
        c.setSpreadLevel("high");
        c.setReadCount(50000L);
        String text = r.renderDetail(c, "urgent", LocalDateTime.of(2026, 9, 22, 12, 0));

        assertTrue(text.contains("舆情标题") || text.contains("某公司发生安全事故"));
        assertTrue(text.contains("舆情等级：紧急"));
        assertTrue(text.contains("发布平台：新浪微博"));
        assertTrue(text.contains("发布时间：2026-09-22 10:00"));
        assertTrue(text.contains("核心内容："));
        assertTrue(text.contains("风险分析：严重"));
        assertTrue(text.contains("传播态势：高"));
        assertTrue(text.contains("原文链接：https://example.com/a/1"));
        assertTrue(text.contains("处置建议："));
        assertTrue(text.contains("推送时间：2026-09-22 12:00"));
    }

    @Test
    @DisplayName("验收7：超长正文被截断且不超过上限")
    public void testRenderTruncate() {
        YqAlertProperties p = props();
        p.getPush().setMaxContentChars(200);
        PushTemplateRenderer r = new PushTemplateRenderer(p);
        AlertCandidate c = candidate(1L, "长文", "negative");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 500; i++) {
            sb.append("内容");
        }
        c.setContent(sb.toString());
        String text = r.renderDetail(c, "warning", LocalDateTime.now());
        assertTrue(text.length() <= 200);
        assertTrue(text.endsWith("…"));
    }

    @Test
    @DisplayName("验收5：渠道名缺失时回落显示渠道ID而不是空白")
    public void testRenderChannelFallback() {
        PushTemplateRenderer r = new PushTemplateRenderer(props());
        AlertCandidate c = candidate(1L, "标题", "negative");
        String text = r.renderDetail(c, "warning", LocalDateTime.now());
        assertTrue(text.contains("发布平台：2001"));
    }

    @Test
    @DisplayName("验收6：摘要模板包含采集概况与负面明细")
    public void testRenderSummary() {
        PushTemplateRenderer r = new PushTemplateRenderer(props());
        AlertCandidate a = candidate(1L, "负面一", "negative");
        a.setChannelName("微博");
        a.setRiskLevel("moderate");
        String text = r.renderSummary("重点任务A", 120, 18, 60, 95, List.of(a), LocalDateTime.of(2026, 9, 22, 12, 0));
        assertTrue(text.contains("【舆情采集概况】重点任务A"));
        assertTrue(text.contains("采集总数：120"));
        assertTrue(text.contains("负面：18"));
        assertTrue(text.contains("中性：60"));
        assertTrue(text.contains("去重后：95"));
        assertTrue(text.contains("1. 负面一"));
        assertTrue(text.contains("链接：https://example.com/a/1"));
    }

    @Test
    @DisplayName("验收6：无负面时摘要显示（无）而不是空段")
    public void testRenderSummaryEmpty() {
        PushTemplateRenderer r = new PushTemplateRenderer(props());
        String text = r.renderSummary("任务", 10, 0, 10, 10, new ArrayList<>(), LocalDateTime.now());
        assertTrue(text.contains("（无）"));
    }

    @Test
    @DisplayName("验收5：自定义模板占位符替换，未提供的占位符替换为空")
    public void testApplyTemplate() {
        PushTemplateRenderer r = new PushTemplateRenderer(props());
        java.util.Map<String, String> vars = new java.util.LinkedHashMap<>();
        vars.put("title", "标题X");
        vars.put("level", "预警");
        String out = r.applyTemplate("【{level}】{title} 链接：{url}", vars);
        assertEquals("【预警】标题X 链接：", out);
    }

    /* ============================================ F-011 目标解析 */

    @Test
    @DisplayName("验收1：按角色/部门/指定人员三种口径解析")
    public void testTargetResolve() {
        PushTargetResolver resolver = new PushTargetResolver(new MemDirectory());
        assertEquals(2, resolver.resolve("role", "1").size());
        assertEquals(1, resolver.resolve("dept", "3").size());
        assertEquals(2, resolver.resolve("user", "11,12").size());
    }

    @Test
    @DisplayName("验收1：未知目标类型返回空集合，不误发给全部人")
    public void testTargetUnknownType() {
        PushTargetResolver resolver = new PushTargetResolver(new MemDirectory());
        assertTrue(resolver.resolve("org", "1").isEmpty());
        assertTrue(resolver.resolve("role", "").isEmpty());
    }

    @Test
    @DisplayName("验收1：企微成员ID映射，无法映射的按人留痕而不静默丢弃")
    public void testTargetWecomMapping() {
        PushTargetResolver resolver = new PushTargetResolver(new MemDirectory());
        PushTargetResolver.WecomTargets t = resolver.toWecom(new LinkedHashSet<>(Arrays.asList(11L, 12L, 99L)));
        assertEquals("zhang_san|li_si", t.getTouser());
        assertEquals("99", t.getUnmappedUserIds());
        assertEquals(2, t.getMapped());
        assertEquals(3, t.getTotal());
        assertFalse(t.isEmpty());
    }

    @Test
    @DisplayName("验收1：全部无法映射时结果为空并按失败处理")
    public void testTargetAllUnmapped() {
        PushTargetResolver resolver = new PushTargetResolver(new MemDirectory());
        PushTargetResolver.WecomTargets t = resolver.toWecom(new LinkedHashSet<>(List.of(99L)));
        assertTrue(t.isEmpty());
        assertEquals("99", t.getUnmappedUserIds());
    }

    /* ============================================ F-011 调度器 */

    @Test
    @DisplayName("验收3/4：即时推送在无免打扰时正常发送并记录耗时")
    public void testDispatchImmediate() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("high_risk").pushLevel("immediate").content("内容")
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .quietStart("22:00").quietEnd("08:00")
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertEquals(PushOutcome.SENT, o.getKind());
        assertTrue(o.isSuccess());
        assertEquals("success", o.getSendStatus());
        assertEquals("zhang_san", o.getWecomTargets());
        assertEquals(1, transport.calls);
        assertNull(o.getReason());
    }

    @Test
    @DisplayName("验收1：定时批量落在免打扰时段被顺延，且不下发消息")
    public void testDispatchScheduledDeferred() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("batch_completed").pushLevel("scheduled").content("汇总")
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .quietStart("22:00").quietEnd("08:00")
            .now(LocalDateTime.of(2026, 9, 22, 23, 30))
            .build());
        assertEquals(PushOutcome.DEFERRED, o.getKind());
        assertEquals("pending", o.getSendStatus());
        assertEquals(0, transport.calls);
        assertNotNull(o.getDeferredUntil());
    }

    @Test
    @DisplayName("验收1：高风险即时推送穿透免打扰（默认开启）")
    public void testDispatchHighPriorityPierce() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("high_risk").pushLevel("immediate").content("紧急")
            .highPriority(true)
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .quietStart("22:00").quietEnd("08:00")
            .now(LocalDateTime.of(2026, 9, 22, 2, 0))
            .build());
        assertEquals(PushOutcome.SENT, o.getKind());
        assertTrue(o.isSuccess());
        assertEquals(1, transport.calls);
    }

    @Test
    @DisplayName("验收1：关闭穿透开关后即时推送同样顺延")
    public void testDispatchPierceDisabled() {
        YqAlertProperties p = props();
        p.getPush().setImmediatePierceQuiet(false);
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("high_risk").pushLevel("immediate").content("紧急")
            .highPriority(true)
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .quietStart("22:00").quietEnd("08:00")
            .now(LocalDateTime.of(2026, 9, 22, 2, 0))
            .build());
        assertEquals(PushOutcome.DEFERRED, o.getKind());
        assertEquals(0, transport.calls);
    }

    @Test
    @DisplayName("验收11：推送总开关关闭时全部跳过，不消耗通道")
    public void testDispatchMasterSwitchOff() {
        YqAlertProperties p = props();
        p.getPush().setEnabled(false);
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("new_opinion").pushLevel("immediate").content("x")
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .now(LocalDateTime.now())
            .build());
        assertEquals(PushOutcome.SKIPPED, o.getKind());
        assertEquals(0, transport.calls);
        assertTrue(o.getReason().contains("总开关"));
    }

    @Test
    @DisplayName("验收11：目标解析为空时标记失败并说明原因")
    public void testDispatchNoTarget() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("new_opinion").pushLevel("immediate").content("x")
            .targetUserIds(new LinkedHashSet<>())
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertEquals(PushOutcome.SKIPPED, o.getKind());
        assertEquals("failed", o.getSendStatus());
        assertEquals(0, transport.calls);
    }

    @Test
    @DisplayName("验收8：发送失败按退避重试，耗尽后保留最终失败原因")
    public void testDispatchRetryExhausted() {
        YqAlertProperties p = props();
        p.getPush().setRetryBackoffMs(0L);
        FlakyTransport transport = new FlakyTransport(99);
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("high_risk").pushLevel("immediate").content("x").maxRetry(2)
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertEquals(PushOutcome.SENT, o.getKind());
        assertFalse(o.isSuccess());
        assertEquals("failed", o.getSendStatus());
        assertEquals(2, o.getRetryCount());
        assertEquals(3, transport.calls, "首次 + 重试 2 次");
        assertTrue(o.getReason().contains("45009"));
    }

    @Test
    @DisplayName("验收8：重试后成功则记录实际重试次数")
    public void testDispatchRetryThenSuccess() {
        YqAlertProperties p = props();
        p.getPush().setRetryBackoffMs(0L);
        FlakyTransport transport = new FlakyTransport(1);
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("high_risk").pushLevel("immediate").content("x").maxRetry(3)
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertTrue(o.isSuccess());
        assertEquals(1, o.getRetryCount());
        assertEquals(2, transport.calls);
    }

    @Test
    @DisplayName("验收8：凭据缺失降级通道必须标记失败，不得静默假成功")
    public void testUnconfiguredTransportFails() {
        LoggingWecomTransport transport = new LoggingWecomTransport();
        WecomTransport.SendResult r = transport.sendText("u", "c");
        assertFalse(r.isOk());
        assertTrue(r.failReason().contains("未配置"));
        assertEquals("logging-fallback", transport.name());
    }

    @Test
    @DisplayName("验收3：演练模式通道按成功留痕，与凭据缺失区分开")
    public void testDryRunTransportSucceeds() {
        LoggingWecomTransport transport = LoggingWecomTransport.dryRun();
        assertTrue(transport.sendText("u", "c").isOk());
        assertEquals("logging-dryrun", transport.name());
    }

    @Test
    @DisplayName("验收10：文件推送在内容为空时直接失败，不发空消息")
    public void testDispatchFileEmpty() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("report_ready").pushLevel("immediate").content("报告")
            .msgType("file").fileName("报告.docx")
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertFalse(o.isSuccess());
        assertTrue(o.getReason().contains("文件内容为空"));
        assertEquals(0, transport.calls);
    }

    @Test
    @DisplayName("验收10：文件推送正常下发")
    public void testDispatchFileOk() {
        YqAlertProperties p = props();
        OkTransport transport = new OkTransport();
        PushDispatcher d = new PushDispatcher(p, new PushTargetResolver(new MemDirectory()), transport);
        PushOutcome o = d.dispatch(PushRequest.builder()
            .scene("report_ready").pushLevel("immediate").content("报告")
            .msgType("file").fileName("报告.docx").fileBytes(new byte[]{1, 2, 3})
            .targetUserIds(new LinkedHashSet<>(List.of(11L)))
            .now(LocalDateTime.of(2026, 9, 22, 12, 0))
            .build());
        assertTrue(o.isSuccess());
        assertEquals(1, transport.calls);
    }

    @Test
    @DisplayName("验收9：通道名随实现变化，便于推送记录溯源")
    public void testTransportName() {
        assertEquals("test-ok", new OkTransport().name());
        assertEquals("test-flaky", new FlakyTransport(0).name());
    }

    /* ============================================ 配置兜底 */

    @Test
    @DisplayName("配置：凭据齐全判定与醒目级别判定")
    public void testPropertiesHelpers() {
        YqAlertProperties p = props();
        assertFalse(p.wecomConfigured());
        p.getPush().setCorpId("ww123");
        p.getPush().setCorpSecret("secret");
        assertFalse(p.wecomConfigured());
        p.getPush().setAgentId("1000002");
        assertTrue(p.wecomConfigured());

        assertTrue(p.isHighlight("urgent"));
        assertTrue(p.isHighlight("WARNING"));
        assertFalse(p.isHighlight("info"));
        assertFalse(p.isHighlight(null));
    }
}
`,
  },

];
