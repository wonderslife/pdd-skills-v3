/**
 * F-010 预警引擎模板（配置 + 领域 + 判定）
 *
 * 拆分为独立 ES module 的目的：主生成器 gen-yuqing-alert.mjs 直接 import 本文件，
 * 不存在「part 文件合并覆盖生成器」的历史坑；每个 part 都能单独 node --check。
 */
export const ALERT_TPL = [

  /* ---------------------------------------------------------------- 配置 */
  {
    rel: 'alert/config/YqAlertProperties.java',
    content: `package org.dromara.yuqing.alert.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 预警 / 推送引擎配置（F-010 + F-011）
 *
 * <p>配置前缀 {@code yuqing.alert}，样例见 {@code script/sql/yuqing/config/yq_alert.yml}。</p>
 *
 * <p>安全约定：企业微信凭据（corpSecret）只允许走配置中心 / 环境变量，禁止硬编码进代码。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.alert")
public class YqAlertProperties {

    /** 预警引擎总开关 */
    private boolean enabled = true;

    /** 每次扫描回看的时间范围（分钟）：扫描 [now-scanWindowMinutes, now) 内新增舆情 */
    private int scanWindowMinutes = 30;

    /** 单次扫描最多载入的舆情条数（保护性上限） */
    private int maxScanRecords = 2000;

    /** 突发增量基线取最近多少个同长度窗口的移动均值 */
    private int baselineWindows = 7;

    /** 突发增量最小条数下限：低于该值不判定为突发（防小样本虚高） */
    private int minBurstCount = 5;

    /** 规则未显式配置时的默认突发倍数阈值 */
    private double defaultBurstRatio = 3.0d;

    /** 规则未显式配置时的默认冷却期（分钟） */
    private int defaultCooldownMinutes = 360;

    /** 需要在列表/台账做醒目提示（红标）的预警级别，逗号分隔 */
    private String highlightLevels = "warning,urgent";

    /** 企业微信推送（F-011）配置 */
    private Push push = new Push();

    /**
     * 企业微信自建应用消息通道配置
     */
    @Data
    public static class Push {

        /** 推送总开关 */
        private boolean enabled = true;

        /** 企业微信 corpId */
        private String corpId = "";

        /** 自建应用 secret（敏感，仅从配置/环境变量读取） */
        private String corpSecret = "";

        /** 自建应用 agentId */
        private String agentId = "";

        /** 企业微信 API 基址 */
        private String apiBase = "https://qyapi.weixin.qq.com";

        /** 连接超时（毫秒） */
        private int connectTimeoutMs = 3000;

        /** 读取超时（毫秒） */
        private int readTimeoutMs = 8000;

        /** 单条文本消息正文最大字符数（企业微信应用消息上限 2048 字节，中文按 3 字节算故留冗余） */
        private int maxContentChars = 1500;

        /** 失败重试上限（规则可覆盖） */
        private int maxRetry = 3;

        /** 重试退避基数（毫秒），实际间隔 = backoff * 2^attempt */
        private long retryBackoffMs = 2000L;

        /** H5 查看入口基址，用于拼接「查看详情」链接；为空则不下发链接 */
        private String h5BaseUrl = "";

        /**
         * 高风险即时推送是否穿透免打扰时段。
         *
         * <p>默认 <b>true</b>：免打扰的设计目的是不让常规批量消息打扰休息时间，
         * 若把最要紧的高风险即时预警也一起吞掉，就变成了「最该被看到的消息最看不到」的
         * 安全反模式。定时批量（scheduled）一律遵守免打扰并顺延到时段结束。</p>
         */
        private boolean immediatePierceQuiet = true;

        /**
         * 演练模式：不真正调用企业微信，只落推送记录并标记 success。
         * <b>与「无凭据降级」不是一回事</b>——无凭据是配置缺失，必须标记 failed；
         * 演练是人为开关，用于联调期避免打扰真实用户。
         */
        private boolean dryRun = false;
    }

    /** 判断指定预警级别是否需要醒目提示 */
    public boolean isHighlight(String alertLevel) {
        if (alertLevel == null || highlightLevels == null) {
            return false;
        }
        for (String part : highlightLevels.split("[,，\\s]+")) {
            if (part.trim().equalsIgnoreCase(alertLevel)) {
                return true;
            }
        }
        return false;
    }

    /** 企业微信凭据是否齐全；不齐全时不发真实请求，直接标记失败 */
    public boolean wecomConfigured() {
        Push p = getPush();
        return p != null
            && p.getCorpId() != null && !p.getCorpId().isBlank()
            && p.getCorpSecret() != null && !p.getCorpSecret().isBlank()
            && p.getAgentId() != null && !p.getAgentId().isBlank();
    }
}
`,
  },

  /* ------------------------------------------------------------- 场景常量 */
  {
    rel: 'alert/AlertScene.java',
    content: `package org.dromara.yuqing.alert;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 预警触发场景（F-010 验收标准 1 / 字典 {@code yq_alert_scene}）
 *
 * <p>四类：新增负面 / 高风险 / 突发增量 / 重点专项。</p>
 *
 * @author ruoyi
 */
public final class AlertScene {

    /** 新增负面 */
    public static final String NEW_NEGATIVE = "new_negative";

    /** 高风险 */
    public static final String HIGH_RISK = "high_risk";

    /** 突发增量 */
    public static final String BURST_INCREMENT = "burst_increment";

    /** 重点专项 */
    public static final String SPECIAL_TOPIC = "special_topic";

    private AlertScene() {
    }

    /** 是否为已知场景 */
    public static boolean isKnown(String scene) {
        return NEW_NEGATIVE.equals(scene) || HIGH_RISK.equals(scene)
            || BURST_INCREMENT.equals(scene) || SPECIAL_TOPIC.equals(scene);
    }

    /**
     * 解析逗号分隔的场景串；忽略空白与未知取值，保持声明顺序。
     *
     * <p>未知取值静默丢弃而不是抛异常：规则表里存了已下线场景时不应让整条规则失效，
     * 也不应让一次扫描全批失败（与 F-006「正则写错降级为字面量」同一套纵深防御）。</p>
     */
    public static Set<String> parse(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；\\s]+")) {
            String s = part.trim();
            if (isKnown(s)) {
                out.add(s);
            }
        }
        return out;
    }

    /** 逗号分隔场景串是否包含指定场景 */
    public static boolean contains(String csv, String scene) {
        return parse(csv).contains(scene);
    }
}
`,
  },

  /* -------------------------------------------------------- 待判定舆情切片 */
  {
    rel: 'alert/AlertCandidate.java',
    content: `package org.dromara.yuqing.alert;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 待预警判定的舆情切片
 *
 * <p>只携带判定所需字段，不直接把 {@code YqOpinion} 拖进引擎——
 * 一是 Doris 实体字段多、二是便于离线自测直接构造样本。</p>
 *
 * <p>⚠ 必须同时标注 {@code @NoArgsConstructor} 与 {@code @AllArgsConstructor}：
 * 只写 {@code @Builder} 时 Lombok 会收回默认无参构造，导致 {@code new AlertCandidate()}
 * 编译失败（推送渲染器需要一个「空对象」兜底）。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCandidate {

    private Long opinionId;
    private Long taskId;
    private Long channelId;
    /** 来源渠道名称（推送模板「发布平台」要素用） */
    private String channelName;
    private Long clusterId;

    private String title;
    private String content;
    private String opinionUrl;
    private LocalDateTime publishTime;

    private String sentiAttr;
    private String opinionLevel;
    private String riskLevel;
    private String spreadLevel;
    private Integer heatScore;
    private String analyzeStatus;

    /** 话题标签（逗号分隔），重点专项场景匹配用 */
    private String topicTags;

    private Long readCount;
    private Long likeCount;
    private Long commentCount;
    private Long shareCount;

    /** 从 YqOpinion 转换 */
    public static AlertCandidate from(org.dromara.yuqing.domain.YqOpinion o) {
        if (o == null) {
            return null;
        }
        return AlertCandidate.builder()
            .opinionId(o.getOpinionId())
            .taskId(o.getTaskId())
            .channelId(o.getChannelId())
            .clusterId(o.getClusterId())
            .title(o.getTitle())
            .content(o.getContent())
            .opinionUrl(o.getOpinionUrl())
            .publishTime(o.getPublishTime() == null ? o.getCollectTime() : o.getPublishTime())
            .sentiAttr(o.getSentiAttr())
            .opinionLevel(o.getOpinionLevel())
            .riskLevel(o.getRiskLevel())
            .spreadLevel(o.getSpreadLevel())
            .heatScore(o.getHeatScore())
            .analyzeStatus(o.getAnalyzeStatus())
            .topicTags(o.getTopicTags())
            .readCount(o.getReadCount())
            .likeCount(o.getLikeCount())
            .commentCount(o.getCommentCount())
            .shareCount(o.getShareCount())
            .build();
    }
}
`,
  },

  /* ---------------------------------------------------------- 编译后的规则 */
  {
    rel: 'alert/AlertRuleSpec.java',
    content: `package org.dromara.yuqing.alert;

import lombok.Data;
import org.dromara.yuqing.domain.YqAlertRule;

import java.math.BigDecimal;
import java.util.Set;

/**
 * 编译后的预警规则
 *
 * <p>把 {@link YqAlertRule} 的零散字段整理成判定可直接消费的形态：
 * 场景集合、窗口长度、各阈值、冷却期、预警/推送级别。</p>
 *
 * @author ruoyi
 */
@Data
public class AlertRuleSpec {

    private Long ruleId;
    private String ruleName;
    private Set<String> scenes;

    private int windowMinutes = 10;
    private Integer countThreshold;
    private Integer heatThreshold;
    private String riskLevelThreshold = "moderate";
    private String spreadThreshold = "medium";

    private double burstRatio = 3.0d;
    private int minBurstCount = 5;
    private int cooldownMinutes = 360;

    /** 重点专项标签集合 */
    private Set<String> topicTags;

    private String alertLevel = "warning";
    private String pushLevel = "immediate";
    private String notifyUserIds;
    private String status = "0";

    /** 规则是否启用（status = 0 正常） */
    public boolean enabled() {
        return "0".equals(status);
    }

    /** 是否支持指定场景 */
    public boolean supports(String scene) {
        return scenes != null && scenes.contains(scene);
    }

    /** 窗口长度兜底：非法值回落到 10 分钟 */
    public int safeWindowMinutes(int fallback) {
        return windowMinutes > 0 ? windowMinutes : fallback;
    }

    public double safeBurstRatio(double fallback) {
        return burstRatio > 0 ? burstRatio : fallback;
    }

    public int safeMinBurstCount(int fallback) {
        return minBurstCount > 0 ? minBurstCount : fallback;
    }

    public int safeCooldownMinutes(int fallback) {
        return cooldownMinutes > 0 ? cooldownMinutes : fallback;
    }

    /** 风险等级序位：general=1 / moderate=2 / severe=3，未知=0 */
    public static int riskRank(String riskLevel) {
        if (riskLevel == null) {
            return 0;
        }
        switch (riskLevel) {
            case "general":
                return 1;
            case "moderate":
                return 2;
            case "severe":
                return 3;
            default:
                return 0;
        }
    }

    /** 传播量级序位：low=1 / medium=2 / high=3 / viral=4，未知=0 */
    public static int spreadRank(String spreadLevel) {
        if (spreadLevel == null) {
            return 0;
        }
        switch (spreadLevel) {
            case "low":
                return 1;
            case "medium":
                return 2;
            case "high":
                return 3;
            case "viral":
                return 4;
            default:
                return 0;
        }
    }

    public int riskThresholdRank() {
        return riskRank(riskLevelThreshold);
    }

    public int spreadThresholdRank() {
        return spreadRank(spreadThreshold);
    }

    /** 标签集合是否命中候选的任一话题标签 */
    public boolean hitTopic(String candidateTags) {
        if (topicTags == null || topicTags.isEmpty() || candidateTags == null || candidateTags.isBlank()) {
            return false;
        }
        for (String part : candidateTags.split("[,，;；]+")) {
            String t = part.trim();
            if (!t.isEmpty() && topicTags.contains(t)) {
                return true;
            }
        }
        return false;
    }

    /** 从实体编译 */
    public static AlertRuleSpec from(YqAlertRule r, double defaultBurstRatio, int defaultMinBurst, int defaultCooldown) {
        AlertRuleSpec s = new AlertRuleSpec();
        s.setRuleId(r.getRuleId());
        s.setRuleName(r.getRuleName());
        s.setScenes(AlertScene.parse(r.getTriggerScenes()));
        s.setWindowMinutes(r.getWindowMinutes() == null ? 0 : r.getWindowMinutes());
        s.setCountThreshold(r.getCountThreshold());
        s.setHeatThreshold(r.getHeatThreshold());
        s.setRiskLevelThreshold(r.getRiskLevelThreshold());
        s.setSpreadThreshold(r.getSpreadThreshold());
        BigDecimal br = r.getBurstRatio();
        s.setBurstRatio(br == null ? defaultBurstRatio : br.doubleValue());
        Integer mb = r.getMinBurstCount();
        s.setMinBurstCount(mb == null ? defaultMinBurst : mb);
        Integer cd = r.getCooldownMinutes();
        s.setCooldownMinutes(cd == null ? defaultCooldown : cd);
        s.setTopicTags(parseTags(r.getTopicTags()));
        s.setAlertLevel(r.getAlertLevel());
        s.setPushLevel(r.getPushLevel());
        s.setNotifyUserIds(r.getNotifyUserIds());
        s.setStatus(r.getStatus());
        return s;
    }

    private static Set<String> parseTags(String csv) {
        Set<String> out = new java.util.LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；]+")) {
            String t = part.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }
}
`,
  },

  /* ------------------------------------------------------------ 兜底分级器 */
  {
    rel: 'alert/LevelResolver.java',
    content: `package org.dromara.yuqing.alert;

/**
 * 舆情分级兜底判定器（F-010 依赖 F-008 分级体系）
 *
 * <p><b>为什么需要兜底：</b>F-007「智能研判」落地前，{@code yq_opinion.analyze_status}
 * 在采集链路里只会被写成 {@code pending}，分级/风险/传播量级三个字段为空。若引擎直接跳过空值，
 * 预警链路就是一条死链。这里按 F-008 的字典口径做本地可解释判定，
 * <b>F-007 落地后自动让位</b>（只补空值，不覆盖已有判定）。</p>
 *
 * <p>F-007 已落地（见 {@code org.dromara.yuqing.analysis}），研判结论会把三个字段
 * 直接回写主表；本兜底仍然保留 —— 它是「大模型不可用 + 规则也没跑」时的最后一道保险，
 * 成本是一次内存判定，收益是预警链路永不空转。</p>
 *
 * <p>判定口径（全部可解释、可单测）：</p>
 * <ul>
 *   <li>传播量级：阅读量 {@code <1千=low / <1万=medium / <10万=high / >=10万=viral}；
 *       阅读量缺失时用 点赞+评论+转发 之和按同一组阈值。</li>
 *   <li>风险等级：仅负面舆情有风险；{@code severe}=负面且(热度>=80 或 传播>=high)，
 *       {@code moderate}=负面且(热度>=50 或 传播>=medium)，其余负面为 {@code general}。</li>
 *   <li>舆情分级：{@code urgent}=severe 且 传播>=high；{@code warning}=severe 或 (moderate 且 传播>=medium)；
 *       {@code attention}=moderate 或 general 且 传播>=medium；其余 {@code normal}。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class LevelResolver {

    private static final long THOUSAND = 1_000L;
    private static final long TEN_THOUSAND = 10_000L;
    private static final long HUNDRED_THOUSAND = 100_000L;

    private LevelResolver() {
    }

    /**
     * 判定完成标记。
     *
     * <p><b>取值必须是 {@code completed}</b> —— 与字典 {@code yq_analyze_status}
     * （pending/processing/completed/failed）以及 F-007 的
     * {@code AnalysisOpinionDao.ST_COMPLETED} 三方一致。
     * 早期这里是 {@code "done"}，那是全项目从未被任何一方写入过的死常量：
     * 字典里没有它、台账按它筛选永远筛不到、F-007 也不会产出它。</p>
     */
    public static final String ANALYZED = "completed";

    /**
     * 就地补齐候选的分级字段（只填空，不覆盖）。
     *
     * @return true 表示本次发生了兜底判定
     */
    public static boolean resolve(AlertCandidate c) {
        if (c == null) {
            return false;
        }
        boolean filled = false;
        if (blank(c.getSpreadLevel())) {
            c.setSpreadLevel(resolveSpread(c));
            filled = true;
        }
        if (blank(c.getRiskLevel())) {
            c.setRiskLevel(resolveRisk(c));
            filled = true;
        }
        if (blank(c.getOpinionLevel())) {
            c.setOpinionLevel(resolveLevel(c));
            filled = true;
        }
        return filled;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** 传播量级 */
    public static String resolveSpread(AlertCandidate c) {
        long metric = spreadMetric(c);
        if (metric >= HUNDRED_THOUSAND) {
            return "viral";
        }
        if (metric >= TEN_THOUSAND) {
            return "high";
        }
        if (metric >= THOUSAND) {
            return "medium";
        }
        return "low";
    }

    /** 传播量取值：优先阅读量，缺失时用互动量之和 */
    public static long spreadMetric(AlertCandidate c) {
        Long read = c.getReadCount();
        if (read != null && read > 0) {
            return read;
        }
        return nz(c.getLikeCount()) + nz(c.getCommentCount()) + nz(c.getShareCount());
    }

    /** 风险等级：非负面一律无风险（返回 null，表示不参与风险阈值比较） */
    public static String resolveRisk(AlertCandidate c) {
        if (!"negative".equals(c.getSentiAttr())) {
            return null;
        }
        int heat = c.getHeatScore() == null ? 0 : c.getHeatScore();
        int spread = AlertRuleSpec.spreadRank(resolveSpread(c));
        if (heat >= 80 || spread >= AlertRuleSpec.spreadRank("high")) {
            return "severe";
        }
        if (heat >= 50 || spread >= AlertRuleSpec.spreadRank("medium")) {
            return "moderate";
        }
        return "general";
    }

    /** 舆情分级 */
    public static String resolveLevel(AlertCandidate c) {
        String risk = c.getRiskLevel() == null ? resolveRisk(c) : c.getRiskLevel();
        int spread = AlertRuleSpec.spreadRank(c.getSpreadLevel() == null ? resolveSpread(c) : c.getSpreadLevel());
        int riskRank = AlertRuleSpec.riskRank(risk);
        if (riskRank >= 3 && spread >= AlertRuleSpec.spreadRank("high")) {
            return "urgent";
        }
        if (riskRank >= 3 || (riskRank >= 2 && spread >= AlertRuleSpec.spreadRank("medium"))) {
            return "warning";
        }
        if (riskRank >= 2 || spread >= AlertRuleSpec.spreadRank("medium")) {
            return "attention";
        }
        return "normal";
    }

    private static long nz(Long v) {
        return v == null ? 0L : Math.max(0L, v);
    }
}
`,
  },

  /* -------------------------------------------------------------- 计数来源 */
  {
    rel: 'alert/AlertCountSource.java',
    content: `package org.dromara.yuqing.alert;

import java.time.LocalDateTime;

/**
 * 窗口计数来源
 *
 * <p>抽成接口是为了让突发增量判定可以离线单测——测试注入内存实现，
 * 生产注入基于 {@code yq_opinion} 的 JDBC 实现。</p>
 *
 * @author ruoyi
 */
public interface AlertCountSource {

    /**
     * 统计 [from, to) 区间内的舆情条数
     *
     * @param taskId    任务过滤，为空表示不过滤
     * @param channelId 渠道过滤，为空表示不过滤
     * @param sentiAttr 舆情属性过滤（positive/neutral/negative），为空表示不过滤
     * @param from      起始（含）
     * @param to        结束（不含）
     * @return 条数
     */
    long count(Long taskId, Long channelId, String sentiAttr, LocalDateTime from, LocalDateTime to);
}
`,
  },

  {
    rel: 'alert/YqOpinionReader.java',
    content: `package org.dromara.yuqing.alert;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 舆情只读访问器（{@code @DS("doris")} 路由）
 *
 * <p>把「读 Doris」与「写 MySQL」拆成两个 Bean 的原因：本项目 yq_opinion 在 Doris
 * （Unique Key 模型，业务侧只读），而 yq_alert / yq_push_record 在主库。
 * {@code @DS} 是类级 AOP，一个类里混读写两张库路由会错乱；
 * 拆开之后 {@code YqAlertDispatchServiceImpl} 走默认主库、本类走 Doris，职责清晰。</p>
 *
 * <p><b>安全：</b>全部条件走 {@link LambdaQueryWrapper} 预编译占位符，不拼接任何用户输入；
 * {@code limit} 由常量上限约束。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@DS("doris")
public class YqOpinionReader implements AlertCountSource {

    private final YqOpinionMapper opinionMapper;

    @Override
    public long count(Long taskId, Long channelId, String sentiAttr, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || !from.isBefore(to)) {
            return 0L;
        }
        Long n = opinionMapper.selectCount(base(taskId, channelId, sentiAttr, from, to));
        return n == null ? 0L : n;
    }

    /**
     * 载入待预警判定的舆情切片
     *
     * @param taskId   任务过滤，为空表示全部任务
     * @param from     发布时间下界（含）
     * @param to       发布时间上界（不含）
     * @param limit    上限
     */
    public List<AlertCandidate> loadCandidates(Long taskId, LocalDateTime from, LocalDateTime to, int limit) {
        if (from == null || to == null || !from.isBefore(to)) {
            return new ArrayList<>();
        }
        LambdaQueryWrapper<YqOpinion> lqw = base(taskId, null, null, from, to);
        lqw.orderByAsc(YqOpinion::getPublishTime);
        lqw.last("limit " + Math.max(1, Math.min(limit, 20000)));
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        if (rows == null || rows.isEmpty()) {
            return new ArrayList<>();
        }
        // 渠道名称由 Service 层用主库的 yq_channel 回填（本 Bean 走 Doris 路由，
        // 不能在这里跨库查 yq_channel，否则会打到 Doris 上报「表不存在」）
        List<AlertCandidate> out = new ArrayList<>(rows.size());
        for (YqOpinion o : rows) {
            AlertCandidate c = AlertCandidate.from(o);
            if (c != null) {
                out.add(c);
            }
        }
        return out;
    }

    private LambdaQueryWrapper<YqOpinion> base(Long taskId, Long channelId, String sentiAttr,
                                              LocalDateTime from, LocalDateTime to) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        lqw.eq(Objects.nonNull(taskId), YqOpinion::getTaskId, taskId);
        lqw.eq(Objects.nonNull(channelId), YqOpinion::getChannelId, channelId);
        lqw.eq(sentiAttr != null && !sentiAttr.isBlank(), YqOpinion::getSentiAttr, sentiAttr);
        lqw.ge(YqOpinion::getPublishTime, from);
        lqw.lt(YqOpinion::getPublishTime, to);
        return lqw;
    }
}
`,
  },

  /* ------------------------------------------------------------ 突发增量 */
  {
    rel: 'alert/BurstDetector.java',
    content: `package org.dromara.yuqing.alert;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 突发增量判定器（F-010 验收标准 1 之 {@code burst_increment}）
 *
 * <p>口径：把当前窗口之前 {@code baselineWindows} 个同长度窗口的条数取算术平均作为基线，
 * 当前窗口条数与基线之比即增量倍数。同时要求当前窗口条数达到 {@code minBurstCount} 下限，
 * 避免「0 → 2 条」被算成无限倍而误报。</p>
 *
 * <pre>
 *   时间轴  ──►
 *   | w-N | ... | w-2 | w-1 | 当前窗口 |
 *              ↑ 基线 = 均值            ↑ cur
 * </pre>
 *
 * @author ruoyi
 */
public final class BurstDetector {

    private BurstDetector() {
    }

    /**
     * 判定指定任务是否出现突发增量
     *
     * @param source      计数来源
     * @param taskId      任务（为空表示全站口径）
     * @param now         当前时刻（窗口右开边界）
     * @param windowMin   窗口长度（分钟）
     * @param baselineN   基线窗口数
     * @param burstRatio  倍数阈值
     * @param minCount    当前窗口条数下限
     * @return 判定结果（含实际值，便于写入 {@code trigger_value} 留痕）
     */
    public static BurstOutcome detect(AlertCountSource source, Long taskId, LocalDateTime now,
                                      int windowMin, int baselineN, double burstRatio, int minCount) {
        int w = windowMin > 0 ? windowMin : 10;
        int n = baselineN > 0 ? baselineN : 7;
        LocalDateTime curEnd = now;
        LocalDateTime curStart = now.minusMinutes(w);

        long cur = source.count(taskId, null, null, curStart, curEnd);
        if (cur < minCount) {
            return new BurstOutcome(false, cur, 0.0d, burstRatio, minCount, "当前窗口 " + cur + " 条，低于下限 " + minCount);
        }

        long sum = 0L;
        for (int i = 1; i <= n; i++) {
            LocalDateTime end = now.minusMinutes((long) w * i);
            LocalDateTime start = end.minusMinutes(w);
            sum += source.count(taskId, null, null, start, end);
        }
        double baseline = sum / (double) n;
        double ratio = cur / Math.max(baseline, 1.0d);
        boolean hit = ratio >= burstRatio;
        return new BurstOutcome(hit, cur, ratio, burstRatio, minCount,
            "当前窗口 " + cur + " 条 / 基线 " + String.format("%.2f", baseline) + " 条 = " + String.format("%.2f", ratio) + " 倍");
    }

    /** 突发增量判定结果 */
    @Data
    public static class BurstOutcome {

        private final boolean hit;
        /** 当前窗口条数 */
        private final long currentCount;
        /** 实际增量倍数 */
        private final double ratio;
        /** 阈值倍数 */
        private final double thresholdRatio;
        /** 条数下限 */
        private final int minCount;
        /** 人类可读的触发值描述，直接落 trigger_value */
        private final String description;

        public BurstOutcome(boolean hit, long currentCount, double ratio, double thresholdRatio,
                            int minCount, String description) {
            this.hit = hit;
            this.currentCount = currentCount;
            this.ratio = ratio;
            this.thresholdRatio = thresholdRatio;
            this.minCount = minCount;
            this.description = description;
        }
    }
}
`,
  },

  /* ------------------------------------------------------------ 聚合指纹 */
  {
    rel: 'alert/AlertFingerprint.java',
    content: `package org.dromara.yuqing.alert;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/**
 * 预警事件聚合指纹（F-010 验收标准 7）
 *
 * <p>同一事件持续发酵时，多条舆情应聚合到同一预警，避免重复预警刷屏：
 * 有事件聚合 ID 时按 {@code cluster:<id>}，否则退化为
 * {@code task:<id>:<标题指纹>}。</p>
 *
 * @author ruoyi
 */
public final class AlertFingerprint {

    private AlertFingerprint() {
    }

    /** 生成聚合指纹；长度恒定，可直接入库并建索引 */
    public static String of(AlertCandidate c) {
        if (c == null) {
            return "unknown";
        }
        if (c.getClusterId() != null) {
            return "cluster:" + c.getClusterId();
        }
        long taskId = c.getTaskId() == null ? 0L : c.getTaskId();
        return "task:" + taskId + ":" + sha16(normalize(c.getTitle()));
    }

    /** 标题归一化：去空白、去标点、转小写 */
    public static String normalize(String title) {
        if (title == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(title.length());
        for (int i = 0; i < title.length(); i++) {
            char ch = title.charAt(i);
            if (Character.isWhitespace(ch) || Character.isSpaceChar(ch)) {
                continue;
            }
            if (Character.isLetterOrDigit(ch)) {
                sb.append(Character.toLowerCase(ch));
            }
        }
        return sb.toString();
    }

    /** SHA-256 前 16 位十六进制 */
    public static String sha16(String raw) {
        String base = raw == null ? "" : raw;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(base.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(32);
            for (int i = 0; i < 8; i++) {
                sb.append(String.format(Locale.ROOT, "%02x", digest[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 强制实现的算法，走到这里说明运行环境异常；退化为长度受限的可读串
            String safe = base.length() > 32 ? base.substring(0, 32) : base;
            return "plain:" + safe;
        }
    }
}
`,
  },

  /* ---------------------------------------------------------- 处置状态机 */
  {
    rel: 'alert/AlertStatusMachine.java',
    content: `package org.dromara.yuqing.alert;

import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.domain.YqAlert;

import java.util.Set;

/**
 * 预警处置状态机（F-010 验收标准 5 / 6）
 *
 * <p>状态：{@code pending}（未处置）→ {@code processing}（处置中）→ {@code handled}（已处置）/ {@code ignored}（已忽略）。</p>
 *
 * <p>硬约束：标记「已处置」必须填写处置说明，未填写直接拒绝提交（验收标准 6）。</p>
 *
 * @author ruoyi
 */
public final class AlertStatusMachine {

    public static final String PENDING = "pending";
    public static final String PROCESSING = "processing";
    public static final String HANDLED = "handled";
    public static final String IGNORED = "ignored";

    private static final Set<String> ALL = Set.of(PENDING, PROCESSING, HANDLED, IGNORED);

    private AlertStatusMachine() {
    }

    /** 是否为合法状态 */
    public static boolean isValid(String status) {
        return status != null && ALL.contains(status);
    }

    /**
     * 状态流转是否允许
     *
     * <p>已终结（handled / ignored）不允许再改，避免处置结论被悄悄推翻后无法追溯。</p>
     */
    public static boolean canTransit(String from, String to) {
        if (!isValid(from) || !isValid(to)) {
            return false;
        }
        if (HANDLED.equals(from) || IGNORED.equals(from)) {
            return false;
        }
        if (PENDING.equals(from)) {
            return PROCESSING.equals(to) || HANDLED.equals(to) || IGNORED.equals(to);
        }
        // processing
        return HANDLED.equals(to) || IGNORED.equals(to);
    }

    /**
     * 校验一次处置提交
     *
     * @param alert    待更新记录（status 已由调用方置为新状态）
     * @param operator 操作人，用于异常消息定位
     * @throws ServiceException 状态非法 / 流转不允许 / 已处置但缺处置说明
     */
    public static void validate(YqAlert alert, String operator) {
        if (alert == null) {
            throw new ServiceException("预警记录不存在");
        }
        String to = alert.getStatus();
        if (!isValid(to)) {
            throw new ServiceException("处置状态非法: " + to);
        }
        if (HANDLED.equals(to)) {
            String remark = alert.getProcessRemark();
            if (remark == null || remark.trim().isEmpty()) {
                throw new ServiceException("标记为「已处置」时必须填写处置说明");
            }
            if (remark.trim().length() < 5) {
                throw new ServiceException("处置说明过短，请不少于 5 个字符描述具体处置动作");
            }
        }
        if (IGNORED.equals(to)) {
            String remark = alert.getProcessRemark();
            if (remark == null || remark.trim().isEmpty()) {
                throw new ServiceException("标记为「已忽略」时必须填写忽略理由");
            }
        }
    }
}
`,
  },

  /* -------------------------------------------------------------- 判定结果 */
  {
    rel: 'alert/AlertDecision.java',
    content: `package org.dromara.yuqing.alert;

import lombok.Builder;
import lombok.Data;

/**
 * 一次预警判定结果
 *
 * <p>由 {@link AlertEngine} 产出，由 Service 落库为 {@code yq_alert} 并驱动推送。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
public class AlertDecision {

    /** 触发规则 */
    private Long ruleId;
    private String ruleName;

    /** 关联舆情 / 事件 */
    private Long opinionId;
    private Long clusterId;

    /** 触发场景 */
    private String scene;
    /** 预警级别 */
    private String alertLevel;
    /** 联动的推送级别 */
    private String pushLevel;

    /** 预警标题 */
    private String alertTitle;
    /** 触发值描述（落 trigger_value，用于事后复盘） */
    private String triggerValue;
    /** 事件聚合指纹 */
    private String fingerprint;

    /** 候选舆情快照（推送渲染用） */
    private AlertCandidate candidate;
}
`,
  },

  /* ---------------------------------------------------------------- 主引擎 */
  {
    rel: 'alert/AlertEngine.java',
    content: `package org.dromara.yuqing.alert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 预警判定引擎（F-010）
 *
 * <p>四类场景判定：</p>
 * <ol>
 *   <li>{@code new_negative}：候选为负面，且窗口内同任务负面条数达到条数阈值（阈值空则不校验条数）。</li>
 *   <li>{@code high_risk}：候选风险等级序位 ≥ 规则阈值，或传播量级序位 ≥ 规则阈值。</li>
 *   <li>{@code burst_increment}：任务级判定，由 {@link BurstDetector} 出结论；命中后只在该任务本轮
 *       第一条候选上挂一次预警，避免同一轮里每条舆情都发一次突发预警。</li>
 *   <li>{@code special_topic}：候选话题标签命中规则配置的重点专项标签。</li>
 * </ol>
 *
 * <p>冷却去重（验收标准 7）：同一 {@code fingerprint} 在冷却期内已产生过未终结预警则跳过，
 * 由调用方传入 {@code cooledFingerprints}；同一轮内命中多次也只取一次。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertEngine {

    private final YqAlertProperties props;
    private final AlertCountSource countSource;

    /**
     * @param candidates         本轮候选舆情
     * @param rules              启用的预警规则
     * @param cooledFingerprints 冷却期内的聚合指纹（命中即抑制）
     * @param now                当前时刻
     * @return 判定结果
     */
    public List<AlertDecision> evaluate(List<AlertCandidate> candidates,
                                        List<AlertRuleSpec> rules,
                                        Set<String> cooledFingerprints,
                                        LocalDateTime now) {
        List<AlertDecision> out = new ArrayList<>();
        if (candidates == null || candidates.isEmpty() || rules == null || rules.isEmpty()) {
            return out;
        }
        Set<String> cooled = cooledFingerprints == null ? new HashSet<>() : cooledFingerprints;
        // 同一轮内已产出过的指纹，避免一轮里重复
        Set<String> produced = new HashSet<>();
        // 突发增量按任务只判定一次
        Map<Long, Boolean> burstChecked = new LinkedHashMap<>();

        for (AlertCandidate c : candidates) {
            LevelResolver.resolve(c);
            String fp = AlertFingerprint.of(c);
            if (cooled.contains(fp) || produced.contains(fp)) {
                continue;
            }
            for (AlertRuleSpec rule : rules) {
                if (!rule.enabled()) {
                    continue;
                }
                AlertDecision d = match(c, rule, fp, now, burstChecked);
                if (d == null) {
                    continue;
                }
                out.add(d);
                produced.add(fp);
                // 一条舆情被某条规则命中后不再被其它规则重复命中（防止刷屏）
                break;
            }
        }
        return out;
    }

    private AlertDecision match(AlertCandidate c, AlertRuleSpec rule, String fp,
                                LocalDateTime now, Map<Long, Boolean> burstChecked) {
        int window = rule.safeWindowMinutes(10);

        if (rule.supports(AlertScene.NEW_NEGATIVE) && "negative".equals(c.getSentiAttr())) {
            Integer threshold = rule.getCountThreshold();
            if (threshold == null || threshold <= 0) {
                return build(c, rule, fp, AlertScene.NEW_NEGATIVE, "新增负面舆情（未设条数阈值，单条即触发）");
            }
            LocalDateTime from = now.minusMinutes(window);
            long n = countSource.count(c.getTaskId(), null, "negative", from, now);
            if (n >= threshold) {
                return build(c, rule, fp, AlertScene.NEW_NEGATIVE,
                    "窗口 " + window + " 分钟内负面 " + n + " 条（阈值 " + threshold + "）");
            }
            return null;
        }

        if (rule.supports(AlertScene.HIGH_RISK)) {
            int riskRank = AlertRuleSpec.riskRank(c.getRiskLevel());
            int spreadRank = AlertRuleSpec.spreadRank(c.getSpreadLevel());
            boolean riskHit = rule.riskThresholdRank() > 0 && riskRank >= rule.riskThresholdRank();
            boolean spreadHit = rule.spreadThresholdRank() > 0 && spreadRank >= rule.spreadThresholdRank();
            if (riskHit || spreadHit) {
                StringBuilder sb = new StringBuilder();
                if (riskHit) {
                    sb.append("风险 ").append(c.getRiskLevel()).append(" ≥ ").append(rule.getRiskLevelThreshold());
                }
                if (spreadHit) {
                    if (sb.length() > 0) {
                        sb.append("；");
                    }
                    sb.append("传播 ").append(c.getSpreadLevel()).append(" ≥ ").append(rule.getSpreadThreshold());
                }
                return build(c, rule, fp, AlertScene.HIGH_RISK, sb.toString());
            }
            return null;
        }

        if (rule.supports(AlertScene.SPECIAL_TOPIC) && rule.hitTopic(c.getTopicTags())) {
            return build(c, rule, fp, AlertScene.SPECIAL_TOPIC, "命中重点专项标签: " + c.getTopicTags());
        }

        if (rule.supports(AlertScene.BURST_INCREMENT)) {
            Long taskKey = c.getTaskId() == null ? 0L : c.getTaskId();
            if (Boolean.TRUE.equals(burstChecked.get(taskKey))) {
                return null;
            }
            BurstDetector.BurstOutcome outcome = BurstDetector.detect(countSource, c.getTaskId(), now,
                window, props.getBaselineWindows(),
                rule.safeBurstRatio(props.getDefaultBurstRatio()),
                rule.safeMinBurstCount(props.getMinBurstCount()));
            burstChecked.put(taskKey, Boolean.TRUE);
            if (outcome.isHit()) {
                return build(c, rule, fp, AlertScene.BURST_INCREMENT,
                    outcome.getDescription() + "（阈值 " + String.format("%.2f", outcome.getThresholdRatio()) + " 倍）");
            }
        }
        return null;
    }

    private AlertDecision build(AlertCandidate c, AlertRuleSpec rule, String fp, String scene, String triggerValue) {
        String title = c.getTitle() == null ? "(无标题)" : c.getTitle();
        String shortTitle = title.length() > 80 ? title.substring(0, 80) + "…" : title;
        return AlertDecision.builder()
            .ruleId(rule.getRuleId())
            .ruleName(rule.getRuleName())
            .opinionId(c.getOpinionId())
            .clusterId(c.getClusterId())
            .scene(scene)
            .alertLevel(rule.getAlertLevel())
            .pushLevel(rule.getPushLevel())
            .alertTitle(shortTitle)
            .triggerValue(triggerValue)
            .fingerprint(fp)
            .candidate(c)
            .build();
    }
}
`,
  },

];
