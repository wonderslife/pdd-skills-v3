#!/usr/bin/env node
/**
 * 舆情监测平台 · F-004「全网自动采集与调度」代码生成器
 *
 * 依据：
 *   - dev-specs/F-004-collect.md（10 条验收标准）
 *   - my-feature.prd  §5.2（yq_collect_log / yq_channel / yq_opinion 字段）、§6.2（内部接口）、§6.3（数据源路由）
 *   - docs/技术架构说明.md §5（数据采集技术方案：源分档 / 采集引擎 / 站点适配器 / 调度模型 / 反爬对抗 / 代理池 / 管道 / 合规）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/collect/**            采集引擎（配置 / 模型 / HTTP / 反爬 / 适配器 / 管道）
 *   java/org/dromara/yuqing/collect/keyword/**     关键词组合表达式（解析 / 校验 / 匹配，F-002 → F-004 契约）
 *   java/org/dromara/yuqing/service/IYqCollectService.java
 *   java/org/dromara/yuqing/service/impl/YqCollectServiceImpl.java
 *   java/org/dromara/yuqing/job/YqCollectJobExecutor.java
 *   java/org/dromara/yuqing/controller/YqCollectController.java
 *   config/yq_collect.yml                          配置样例（含 4 个示例站点适配器）
 *   sql/yq_doris_mysql_fallback.sql                无 Doris 时的 MySQL 兼容建表（本地联调）
 *   sql/yq_demo_seed.sql                           演示数据（1 任务 + 2 关键词 + 2 渠道）
 *   pc/api/yuqing/collect/**                       PC 端采集运维接口封装
 *
 * 用法: node gen-yuqing-collect.mjs
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'yq-code');
const PKG = 'org.dromara.yuqing';
const JAVA_BASE = path.join(SRC, 'java', 'org', 'dromara', 'yuqing');

const FILES = [];
const file = (rel, content) => FILES.push({ rel: rel.replace(/\\/g, '/'), content });

/* ==========================================================================
 * 1. 采集引擎配置
 * ========================================================================== */

file('collect/config/YqCollectProperties.java', `package ${PKG}.collect.config;

import lombok.Data;
import org.dromara.yuqing.collect.adapter.AdapterSpec;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 采集调度引擎配置（PRD §5.5 / 《技术架构说明》§5）
 *
 * <p>配置前缀 {@code yuqing.collect}，样例见 {@code script/sql/yuqing/config/yq_collect.yml}。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.collect")
public class YqCollectProperties {

    /** 采集引擎总开关；关闭时调度任务直接返回，不产生任何外部请求 */
    private boolean enabled = false;

    /** 单次调度最多处理的任务数（保护性上限，防止任务表异常膨胀拖垮调度） */
    private int maxTasksPerDispatch = 200;

    /** 单次调度最多下发的采集单元（任务 × 渠道）数 */
    private int maxUnitsPerDispatch = 500;

    /** 同一任务的多渠道并发度 */
    private int unitConcurrency = 4;

    /** 单批次最大翻页数（覆盖适配器 pageRule.maxPage 的硬上限） */
    private int maxPagesPerBatch = 20;

    /** 单个采集单元单批次最大产出条数（保护性上限） */
    private int maxRecordsPerBatch = 500;

    /** 最小采集间隔（秒）。校验任务频率不低于该值与渠道限流下限 */
    private int minIntervalSeconds = 30;

    /** 连续「零采集」或「全失败」多少次触发异常告警 */
    private int unhealthyThreshold = 3;

    /** 是否允许以 {@code file:} 协议读取本机文件。仅离线自测 / 快照复采用，生产必须保持 false */
    private boolean allowLocalFile = false;

    /** 启动后是否立即执行一次调度（仅本地调试用，生产保持 false） */
    private boolean dispatchOnStartup = false;

    /** 采集单元异常时是否中断整批（false = 单单元失败不影响其它单元，验收标准 5） */
    private boolean failFast = false;

    /** 检索词占位符与分页占位符（适配器 listUrl 模板中替换） */
    private String keywordPlaceholder = "{kw}";
    private String pagePlaceholder = "{page}";

    /** 重试与退避策略 */
    private Retry retry = new Retry();

    /** 落库出口 */
    private Sink sink = new Sink();

    /** 快照留存 */
    private Snapshot snapshot = new Snapshot();

    /** 代理池 */
    private Proxy proxy = new Proxy();

    /** 去重前置 */
    private Dedup dedup = new Dedup();

    /** 异常通知 */
    private Notify notify = new Notify();

    /** 关键词链路：组合表达式检索与本地匹配（F-002 关键词库 → F-004 采集） */
    private KeywordFilter keywordFilter = new KeywordFilter();

    /** 净化去重（F-006）：正文标准化 + 七类降噪 + 按天链接去重 + 跨渠道合并 */
    private Clean clean = new Clean();

    /** 站点适配器：key 对应 {@code yq_channel.adapter_class} */
    private Map<String, AdapterSpec> adapters = new LinkedHashMap<>();

    /**
     * 退避重试（验收标准 5）
     */
    @Data
    public static class Retry {
        /** 最大尝试次数（含首次） */
        private int maxAttempts = 3;
        /** 首次退避毫秒 */
        private long initialBackoffMs = 1000L;
        /** 退避倍数 */
        private double multiplier = 2.0D;
        /** 退避上限毫秒 */
        private long maxBackoffMs = 60000L;
        /** 抖动比例 0~1，避免同一时刻大量重试形成脉冲 */
        private double jitterRatio = 0.3D;
    }

    /**
     * 落库出口（验收标准 4）
     */
    @Data
    public static class Sink {
        /**
         * 写入模式：
         * <ul>
         *   <li>{@code stream-load} —— Doris Stream Load（默认，生产）</li>
         *   <li>{@code jdbc}        —— 走 {@code @DS("doris")} 数据源批量 INSERT（本地无 Doris 时把数据源指向 MySQL）</li>
         *   <li>{@code noop}        —— 只计数不落库（离线自测 / 压测）</li>
         * </ul>
         */
        private String mode = "stream-load";
        /** 攒批条数（达到即刷） */
        private int batchSize = 1000;
        /** 攒批间隔毫秒（到点即刷） */
        private long flushIntervalMs = 5000L;
        /** 队列积压上限，超过则丢弃并计失败，避免 OOM */
        private int maxQueueSize = 200000;
        /** 是否写入采集日志表 yq_collect_log */
        private boolean writeCollectLog = true;
        /** Doris 连接 */
        private Doris doris = new Doris();

        @Data
        public static class Doris {
            /** Doris FE HTTP 端口地址，多个用逗号分隔（轮询） */
            private String feHttp = "http://127.0.0.1:8030";
            /** 目标库 */
            private String database = "yq_dwd";
            /** Stream Load 账号（建议独立账号，只授 LOAD 权限） */
            private String username = "yq_writer";
            private String password = "ChangeMe_Doris_Writer";
            /** 单价：单条记录最大字节数，超限直接截断并记失败（防止异常大文档打爆 BE） */
            private int maxRecordBytes = 2000000;
            /** 请求超时毫秒 */
            private long timeoutMs = 30000L;
            /** 允许的过滤比例（脏数据容忍度） */
            private String maxFilterRatio = "0.1";
        }
    }

    /**
     * 快照留存（《技术架构说明》§5.7：HTML 原文 + 关键截图存 MinIO，保留 30 天）
     */
    @Data
    public static class Snapshot {
        /** 是否开启快照 */
        private boolean enabled = false;
        /** 存储桶 */
        private String bucket = "yuqing";
        /** 对象键前缀 */
        private String keyPrefix = "collect-snapshot";
        /** 保留天数（仅记录在配置中，生命周期由 MinIO 桶策略执行） */
        private int retentionDays = 30;
        /** 单条快照最大字节数，超过不落盘 */
        private int maxBytes = 3000000;
    }

    /**
     * 自研代理池（《技术架构说明》§5.6）
     */
    @Data
    public static class Proxy {
        /** 是否启用 IP 轮换（验收标准 6） */
        private boolean enabled = false;
        /** 取 IP 策略：rotate（轮换） / sticky（粘性会话） */
        private String strategy = "rotate";
        /** 是否在失败后立即摘除该出口 IP */
        private boolean evictOnFailure = true;
        /**
         * 代理分组配置：key = 代理池分组标识。
         * <p>同一条目支持多出口，用逗号分隔；支持 {@code host:port} 与 {@code user:pass@host:port} 两种写法。</p>
         */
        private Map<String, String> groups = new LinkedHashMap<>();
        /** 粘性会话保持时长（秒） */
        private int stickyTtlSeconds = 300;
    }

    /**
     * 去重前置（验收标准 7）
     */
    @Data
    public static class Dedup {
        /** 是否用 Redis 做跨批次快速去重（真实去重仍由 Doris Unique Key 兜底） */
        private boolean redisEnabled = true;
        /** Redis 去重键保留时长（秒），默认 3 天 */
        private int ttlSeconds = 259200;
        /** 内存兜底上限（Redis 不可用时使用） */
        private int localCacheSize = 200000;
    }

    /**
     * 异常通知（验收标准 9）
     */
    @Data
    public static class Notify {
        /** 是否启用异常通知 */
        private boolean enabled = false;
        /**
         * 通知通道：{@code log} 只打日志；{@code webhook} POST 到 {@link #webhookUrl}。
         * <p>企业微信推送（F-011）落地后，把通道切到 {@code wecom} 并注入对应实现即可。</p>
         */
        private String channel = "log";
        /** webhook 地址 */
        private String webhookUrl = "";
        /** 通知超时毫秒 */
        private long timeoutMs = 5000L;
    }

    /**
     * 关键词链路（F-002 关键词库 → F-004 采集）
     *
     * <p>把关键词库录入的组合表达式（如 {@code (辽宁|沈阳)+(药监局|药品监管)}）落成
     * 「主题词检索 + 地区词本地过滤」，避免把整串表达式当成一次查询串发出
     * （搜索引擎与政务站内搜索都不认这个语法，会静默返回 0 条）。</p>
     */
    @Data
    public static class KeywordFilter {

        /**
         * 组合表达式中哪一组作为检索词：
         * <ul>
         *   <li>{@code last}（默认）—— 最后一组，符合「先收窄范围、最后落到主题词」的书写习惯</li>
         *   <li>{@code first} —— 第一组</li>
         *   <li>{@code fewest} —— 词数最少的组（通常最具体）</li>
         * </ul>
         */
        private String searchGroup = "last";

        /** 单采集单元最多使用多少个检索词（超出截断，防止把渠道限流打爆） */
        private int maxSearchTermsPerUnit = 8;

        /** 是否启用任务级排除词（{@code yq_keyword.keyword_type = negative}，经 yq_task_keyword 关联） */
        private boolean excludeEnabled = true;

        /**
         * 是否套用 {@code yq_noise_rule} 全局降噪规则。
         *
         * <p>默认 false：全局规则没有任务维度，直接用在采集侧会误杀高价值舆情。
         * 深度降噪归 F-006 净化去重。</p>
         */
        private boolean applyGlobalNoise = false;

        /** 全局降噪规则单次加载上限 */
        private int maxExcludeRules = 500;
    }

    /**
     * 净化去重（F-006 数据净化与链接去重）
     *
     * <p>采集链路只做「正文标准化 + 七类降噪 + 按天链接去重」；跨渠道合并与历史重跑
     * 由 {@code YqCleanReplayService} 承担 —— 采集侧是攒批写入，来不及做「回头改首条」。</p>
     */
    @Data
    public static class Clean {

        /** 是否启用净化管线（关闭时采集只做链接去重，正文原样入库） */
        private boolean enabled = true;

        /** 是否对正文做 HTML 剥离与空白归一 */
        private boolean purifyHtml = true;

        /** 降噪规则缓存有效期（秒）；改规则后最长等这么久生效，也可调接口强制刷新 */
        private long ruleCacheSeconds = 60L;

        /** 单条正文保留的最大字符数（超出截断，防止异常大文档打爆后续环节） */
        private int maxContentChars = 20000;

        /** 无意义短句判定阈值：正文【有效字符数】低于该值即判为 meaningless */
        private int meaninglessChars = 15;

        /** 灌水判定阈值：同一 12 字窗口重复出现达到该次数即判为 flooding */
        private int floodingRepeat = 3;

        /** 灌水判定使用的窗口长度（字符） */
        private int floodingWindow = 12;

        /**
         * 去重粒度：
         * <ul>
         *   <li>{@code day}（默认）—— 按 {@code (collect_date, url_hash)} 去重，跨天不算重复；
         *       契合 Doris 分区语义，保留「同一事件多天传播」的观测能力</li>
         *   <li>{@code global} —— 全局去重（暂未实现，配置成 global 会按 day 处理并打告警日志）</li>
         * </ul>
         */
        private String dedupScope = "day";

        /** 单批次重跑最大处理条数（保护性上限） */
        private int maxReplayRecords = 200000;

        /**
         * 重跑时是否把已剔除（rejected）的记录重新纳入判定。
         *
         * <p>默认 true：规则放宽后要能把之前误杀的数据救回来，否则「重跑」只能越跑越严，
         * 永远纠正不了误判。确知只需加严时才关成 false（少扫一批数据）。</p>
         */
        private boolean replayIncludeRejected = true;
    }
}
`);

/* ==========================================================================
 * 2. 采集模型
 * ========================================================================== */

file('collect/model/CollectUnit.java', `package ${PKG}.collect.model;

import lombok.Data;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 采集单元 —— 调度的最小粒度：一个「任务 × 渠道」组合。
 *
 * <p>由 {@code YqCollectService.dispatch} 按任务、渠道与频率生成（PRD §6.2）。</p>
 *
 * @author ruoyi
 */
@Data
public class CollectUnit implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 任务ID */
    private Long taskId;

    /** 任务名称 */
    private String taskName;

    /** 渠道ID */
    private Long channelId;

    /** 渠道名称 */
    private String channelName;

    /** 站点适配器标识（yq_channel.adapter_class → yuqing.collect.adapters 的 key） */
    private String adapterCode;

    /** 采集策略：polling / incremental / realtime（验收标准 1） */
    private String collectStrategy;

    /** 本单元生效的采集间隔（秒）：任务级 channel 覆盖 > 任务 collectInterval */
    private Integer intervalSeconds;

    /** 采集批次号（一次下发生成一个，贯穿日志与溯源） */
    private String batchNo;

    /** 增量水位线：该渠道最近一次采集时间，早于它的内容不再抓取 */
    private LocalDateTime watermark;

    /** 关键词匹配器：检索词 + 本地组合匹配规则（F-002 关键词库 → F-004 采集） */
    private KeywordMatcher matcher;

    /** 渠道并发上限 */
    private Integer concurrencyLimit;

    /** 渠道请求间隔（毫秒） */
    private Integer requestIntervalMs;

    /** 代理池分组ID */
    private Long proxyGroupId;

    /** 失败率告警阈值（%） */
    private Integer failRateThreshold;

    /** 不下发原因（间隔越界、适配器缺失、渠道停用等）；非空则跳过本单元并计入日志 */
    private String skipReason;

    /**
     * 是否可下发。
     *
     * @return true 表示参数齐备可进入采集
     */
    public boolean dispatchable() {
        return skipReason == null || skipReason.isBlank();
    }

    /**
     * 采集单元业务键，用于日志与去重键拼接。
     *
     * @return taskId:channelId
     */
    public String unitKey() {
        return taskId + ":" + channelId;
    }
}
`);

file('collect/model/RawOpinion.java', `package ${PKG}.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 原始采集数据（未净化、未研判）。
 *
 * <p>字段覆盖 F-004 验收标准 3 要求的 12 项：标题、原文内容、发布链接、发布时间、发布作者、
 * 点赞量、评论量、转发量、阅读量、发布地域、设备信息、话题标签。</p>
 *
 * @author ruoyi
 */
@Data
public class RawOpinion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 舆情ID（落库时由雪花算法分配） */
    private Long opinionId;

    /** 分区列 = 采集日期 */
    private LocalDate collectDate;

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 舆情标题 */
    private String title;

    /** 原文内容（不做有损截断，验收标准 4） */
    private String content;

    /** 原文链接 */
    private String opinionUrl;

    /** 链接 SHA-256（归一化后计算，唯一去重主键载体） */
    private String urlHash;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 发布作者 / 主体 */
    private String author;

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 发布地域 */
    private String region;

    /** 设备信息 */
    private String deviceInfo;

    /** 话题标签（逗号分隔） */
    private String topicTags;

    /** 采集来源：auto / manual_link / file_import */
    private String collectSource;

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 采集批次号（溯源依据） */
    private String batchNo;

    /** 命中关键词（多词用逗号分隔，便于核查为什么抓到这条） */
    private String hitKeywords;

    /** 原始 HTML 快照（可选，落 MinIO 后清空，不写入 Doris） */
    private String rawHtml;

    /** 快照对象键（落 MinIO 成功时回填） */
    private String snapshotKey;

    /** 管道处理结果：inserted / duplicated / rejected，仅内存流转 */
    private String pipelineStatus;

    /** 清洗状态：raw / cleaned / rejected（F-006 验收标准 5） */
    private String cleanStatus = "raw";

    /** 降噪剔除原因（取 yq_noise_category 取值，F-006 验收标准 3） */
    private String noiseReason;

    /** 跨渠道重复时的其余渠道ID（逗号分隔，验收标准 8） */
    private String dupChannelIds;

    /** 净化时间 */
    private java.time.LocalDateTime cleanTime;
}
`);

file('collect/model/BlockType.java', `package ${PKG}.collect.model;

/**
 * 被拦信号类型（《技术架构说明》§5.5.1）。
 *
 * @author ruoyi
 */
public enum BlockType {

    /** 未被拦截 */
    NONE("未被拦截"),
    /** HTTP 4xx/5xx 错误 */
    HTTP_ERROR("HTTP 错误"),
    /** 触发限流（429） */
    RATE_LIMITED("触发限流"),
    /** 返回内容为空或仅 JS 壳，需要渲染通道 */
    RENDER_REQUIRED("需要动态渲染"),
    /** 跳转验证码 / 滑块页 */
    CAPTCHA("触发人机校验"),
    /** 连接重置 / TLS 握手失败 */
    CONNECTION_RESET("连接被重置"),
    /** 返回内容与关键词无关（蜜罐页或降级内容） */
    IRRELEVANT("内容与检索词无关"),
    /** 内容长度异常（疑似蜜罐 / 陷阱字段） */
    ABNORMAL_LENGTH("内容长度异常"),
    /** 登录墙 / 付费墙（合规红线，不破解） */
    PAYWALL("登录墙或付费墙");

    private final String label;

    BlockType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
`);

file('collect/model/BlockSignal.java', `package ${PKG}.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 反爬判定结果。
 *
 * @author ruoyi
 */
@Data
public class BlockSignal implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 信号类型 */
    private BlockType type = BlockType.NONE;

    /** 判定依据（写进采集日志 fail_reason，便于运维定位） */
    private String detail;

    /** HTTP 状态码 */
    private int statusCode;

    private BlockSignal() {
    }

    /**
     * 未被拦截。
     *
     * @return 放行信号
     */
    public static BlockSignal ok() {
        return new BlockSignal();
    }

    /**
     * 命中拦截。
     *
     * @param type   信号类型
     * @param detail 判定依据
     * @return 拦截信号
     */
    public static BlockSignal blocked(BlockType type, String detail) {
        BlockSignal s = new BlockSignal();
        s.type = type;
        s.detail = detail;
        return s;
    }

    /**
     * 是否被拦截。
     *
     * @return true = 需要进入对抗策略
     */
    public boolean isBlocked() {
        return type != BlockType.NONE;
    }
}
`);

file('collect/model/CollectResult.java', `package ${PKG}.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 单批次采集执行结果（对应 yq_collect_log 一行，验收标准 10）。
 *
 * @author ruoyi
 */
@Data
public class CollectResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 采集批次号 */
    private String batchNo;

    private Long taskId;

    private String taskName;

    private Long channelId;

    private String channelName;

    private String strategy;

    /** 抓取条数 */
    private int fetchedCount;

    /** 入库条数 */
    private int insertedCount;

    /** 去重剔除条数 */
    private int dupCount;

    /** 降噪剔除条数（净化环节回填；本模块会把关键词组合条件不匹配的条数也计入） */
    private int rejectedCount;

    /** 关键词组合条件不匹配而剔除的条数（已包含在 rejectedCount 内，用于定位「采到了但不符合关键词」） */
    private int filteredCount;

    /**
     * 跨渠道重复条数（F-006 验收标准 8）。
     *
     * <p>已包含在 {@link #dupCount} 内：同一链接被另一渠道先采到时，本条不入库，
     * 只把本渠道ID补到首条记录的 {@code dup_channel_ids} 上。</p>
     */
    private int dupChannelCount;

    /** 失败条数 */
    private int failedCount;

    /** 耗时（毫秒） */
    private long costMs;

    /** 执行结果：success / partial / failed */
    private String resultStatus = "success";

    /** 失败原因（截断到 1000 字符，对齐 yq_collect_log.fail_reason） */
    private String failReason;

    /** 失败明细（逐条，最多保留 50 条） */
    private List<String> failDetails = new ArrayList<>();

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 命中的被拦信号类型（便于反爬统计） */
    private BlockType blockType = BlockType.NONE;

    /**
     * 记录一条失败明细，并同步维护失败条数与原因。
     *
     * @param detail 失败描述
     */
    public void addFailure(String detail) {
        this.failedCount++;
        if (failDetails.size() < 50) {
            failDetails.add(detail);
        }
        String merged = this.failReason == null ? detail : this.failReason + " | " + detail;
        this.failReason = merged.length() > 1000 ? merged.substring(0, 1000) : merged;
    }

    /**
     * 采集条数与失败条数判断执行结果。
     */
    public void settle() {
        if (failedCount > 0 && insertedCount == 0) {
            resultStatus = "failed";
        } else if (failedCount > 0 || dupCount > 0) {
            resultStatus = "partial";
        } else {
            resultStatus = "success";
        }
    }

    /**
     * 是否「零采集」——用于连续异常判定（验收标准 9）。
     *
     * @return true 表示本次抓取条数为 0
     */
    public boolean isEmptyFetch() {
        return fetchedCount == 0;
    }

    /**
     * 是否「全部失败」——用于连续异常判定（验收标准 9）。
     *
     * @return true 表示有失败且无任何入库
     */
    public boolean isAllFailed() {
        return failedCount > 0 && insertedCount == 0;
    }

    /**
     * 是否异常批次。
     *
     * @return true 表示零采集或全失败
     */
    public boolean isAbnormal() {
        return isEmptyFetch() || isAllFailed();
    }

    /**
     * 是否「抓到了但全被关键词条件过滤掉」。
     *
     * <p>典型成因是组合表达式写错（例如地区组与站点覆盖范围不相交），
     * 值得在采集日志中显式提示；但它是正常业务现象（某轮确实没有匹配内容），
     * 因此不纳入异常告警计数，避免误报。</p>
     *
     * @return true 表示命中数为 0 且全部被过滤
     */
    public boolean isAllFiltered() {
        return fetchedCount > 0 && insertedCount == 0 && filteredCount >= fetchedCount;
    }
}
`);

file('collect/model/CollectOverview.java', `package ${PKG}.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 采集运行概览（F-004 验收标准 8）。
 *
 * @author ruoyi
 */
@Data
public class CollectOverview implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 引擎是否开启 */
    private boolean engineEnabled;

    /** 落库模式 */
    private String sinkMode;

    /** 去重模式 */
    private String dedupMode;

    /** 累计采集条数 */
    private long totalFetched;

    /** 当日采集条数 */
    private long todayFetched;

    /** 当日入库条数 */
    private long todayInserted;

    /** 当日去重剔除条数 */
    private long todayDup;

    /** 当日失败条数 */
    private long todayFailed;

    /** 当日批次总数 */
    private long todayBatches;

    /** 启用中的任务数 */
    private long enabledTasks;

    /** 启用中的渠道数 */
    private long enabledChannels;

    /** 已配置的站点适配器数 */
    private int adapterCount;

    /** 各任务最近执行状态 */
    private List<TaskRunState> taskStates = new ArrayList<>();

    /** 连续异常（零采集 / 全失败达到阈值）的采集单元 */
    private List<String> unhealthyUnits = new ArrayList<>();

    /** 服务端时间 */
    private LocalDateTime serverTime;

    /**
     * 单任务最近执行状态。
     */
    @Data
    public static class TaskRunState implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Long taskId;

        private String taskName;

        /** 最近一次调度时间 */
        private LocalDateTime lastScheduleTime;

        /** 最近执行结果 */
        private String lastResultStatus;

        /** 连续异常次数 */
        private int consecutiveAbnormal;

        /** 是否异常 */
        private boolean abnormal;
    }
}
`);

file('collect/model/IntervalSpec.java', `package ${PKG}.collect.model;

import java.util.ArrayList;
import java.util.List;

/**
 * 采集频率四档换算与校验（F-004 验收标准 2）。
 *
 * <p>支持秒级 / 分钟级 / 小时级 / 日级四档；校验采集间隔不低于「渠道限流下限」与「全局最小间隔」。</p>
 *
 * @author ruoyi
 */
public final class IntervalSpec {

    /** 秒级 */
    public static final String UNIT_SECOND = "s";
    /** 分钟级 */
    public static final String UNIT_MINUTE = "m";
    /** 小时级 */
    public static final String UNIT_HOUR = "h";
    /** 日级 */
    public static final String UNIT_DAY = "d";

    private static final int SEC_MINUTE = 60;
    private static final int SEC_HOUR = 3600;
    private static final int SEC_DAY = 86400;

    private IntervalSpec() {
    }

    /**
     * 档位换算为秒。
     *
     * @param value 数值，必须为正
     * @param unit  档位：s / m / h / d，为空按秒处理
     * @return 秒数；参数非法返回 -1
     */
    public static int toSeconds(int value, String unit) {
        if (value <= 0) {
            return -1;
        }
        String u = unit == null ? UNIT_SECOND : unit.trim().toLowerCase();
        return switch (u) {
            case UNIT_MINUTE -> value * SEC_MINUTE;
            case UNIT_HOUR -> value * SEC_HOUR;
            case UNIT_DAY -> value * SEC_DAY;
            default -> value;
        };
    }

    /**
     * 秒数落到四档的哪一档。
     *
     * @param seconds 秒数
     * @return 档位字符；非四档整数倍返回粒度最细的 s
     */
    public static String unitOf(int seconds) {
        if (seconds > 0 && seconds % SEC_DAY == 0) {
            return UNIT_DAY;
        }
        if (seconds > 0 && seconds % SEC_HOUR == 0) {
            return UNIT_HOUR;
        }
        if (seconds > 0 && seconds % SEC_MINUTE == 0) {
            return UNIT_MINUTE;
        }
        return UNIT_SECOND;
    }

    /**
     * 秒数换算为对应档位下的数值。
     *
     * @param seconds 秒数
     * @return 档位数值
     */
    public static int valueOf(int seconds) {
        String unit = unitOf(seconds);
        return switch (unit) {
            case UNIT_DAY -> seconds / SEC_DAY;
            case UNIT_HOUR -> seconds / SEC_HOUR;
            case UNIT_MINUTE -> seconds / SEC_MINUTE;
            default -> seconds;
        };
    }

    /**
     * 人类可读描述。
     *
     * @param seconds 秒数
     * @return 例如「30 秒」「5 分钟」「1 小时」「1 天」
     */
    public static String describe(int seconds) {
        if (seconds <= 0) {
            return "未配置";
        }
        int v = valueOf(seconds);
        String unit = unitOf(seconds);
        String label = switch (unit) {
            case UNIT_DAY -> "天";
            case UNIT_HOUR -> "小时";
            case UNIT_MINUTE -> "分钟";
            default -> "秒";
        };
        return v + " " + label;
    }

    /**
     * 计算渠道限流下限（秒）：请求间隔 × 并发上限，即该渠道在满载情况下的最小平均出词周期。
     *
     * @param requestIntervalMs 渠道请求间隔（毫秒），空按 0 处理
     * @param concurrencyLimit  渠道并发上限，空按 1 处理
     * @return 限流下限（秒），向上取整，最小 1
     */
    public static int rateFloorSeconds(Integer requestIntervalMs, Integer concurrencyLimit) {
        int interval = requestIntervalMs == null ? 0 : Math.max(requestIntervalMs, 0);
        int concurrency = concurrencyLimit == null || concurrencyLimit <= 0 ? 1 : concurrencyLimit;
        if (interval <= 0) {
            return 1;
        }
        long msFloor = (long) interval * concurrency;
        return (int) Math.max(1L, (msFloor + 999L) / 1000L);
    }

    /**
     * 校验采集间隔是否合法。
     *
     * @param intervalSeconds   配置的采集间隔（秒）
     * @param requestIntervalMs 渠道请求间隔（毫秒）
     * @param concurrencyLimit  渠道并发上限
     * @param globalMinSeconds  全局最小间隔（秒）
     * @return 问题列表，空表示合法
     */
    public static List<String> validate(Integer intervalSeconds, Integer requestIntervalMs,
                                       Integer concurrencyLimit, int globalMinSeconds) {
        List<String> issues = new ArrayList<>();
        if (intervalSeconds == null || intervalSeconds <= 0) {
            issues.add("采集间隔未配置或非正数");
            return issues;
        }
        if (globalMinSeconds > 0 && intervalSeconds < globalMinSeconds) {
            issues.add("采集间隔 " + describe(intervalSeconds) + " 低于全局最小间隔 " + describe(globalMinSeconds));
        }
        int floor = rateFloorSeconds(requestIntervalMs, concurrencyLimit);
        if (intervalSeconds < floor) {
            issues.add("采集间隔 " + describe(intervalSeconds) + " 低于渠道限流下限 " + describe(floor)
                + "（请求间隔 " + (requestIntervalMs == null ? 0 : requestIntervalMs) + "ms × 并发 "
                + (concurrencyLimit == null ? 1 : concurrencyLimit) + "）");
        }
        return issues;
    }
}
`);

/* ==========================================================================
 * 3. HTTP 通道
 * ========================================================================== */

file('collect/http/FetchRequest.java', `package ${PKG}.collect.http;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一次抓取请求的完整描述。
 *
 * <p>把「限流参数、代理分组、随机延时区间、附加请求头」都挂在请求上，下载器与适配器解耦：</p>
 *
 * @author ruoyi
 */
@Data
public class FetchRequest {

    /** 目标地址；支持 http/https 与 file: 前缀（离线自测用） */
    private String url;

    /** 请求方法：GET / POST */
    private String method = "GET";

    /** 请求体（POST 时使用） */
    private String body;

    /** 请求体类型 */
    private String contentType = "application/json;charset=UTF-8";

    /** 附加请求头（适配器级别，会覆盖 HeaderPool 的同名项） */
    private Map<String, String> headers = new LinkedHashMap<>();

    /** 渠道ID（限流、粘性代理会话的维度） */
    private Long channelId;

    /** 站点适配器标识（日志定位用） */
    private String adapterCode;

    /** 代理池分组ID */
    private Long proxyGroupId;

    /** 是否使用代理 */
    private boolean useProxy = true;

    /** 随机延时下限（毫秒），反爬的频率算法对抗 */
    private Integer minIntervalMs;

    /** 随机延时上限（毫秒） */
    private Integer maxIntervalMs;

    /** 检索词（用于蜜罐/降级内容判定） */
    private String keyword;

    /** 超时毫秒 */
    private long timeoutMs = 20000L;

    /** 是否跟随重定向 */
    private boolean followRedirect = true;

    /** 最低可接受内容长度（低于该长度且含脚本壳 → 判为需渲染） */
    private int minContentLength = 200;

    /** 渠道请求间隔（毫秒），限流闸门用 */
    private Integer requestIntervalMs;

    /** 渠道并发上限，限流闸门用 */
    private Integer concurrencyLimit;

    /**
     * 复制一份请求并替换地址，避免适配器之间互相污染。
     *
     * @param newUrl 新地址
     * @return 新请求对象
     */
    public FetchRequest copyWithUrl(String newUrl) {
        FetchRequest r = new FetchRequest();
        r.url = newUrl;
        r.method = this.method;
        r.body = this.body;
        r.contentType = this.contentType;
        r.headers = new LinkedHashMap<>(this.headers);
        r.channelId = this.channelId;
        r.adapterCode = this.adapterCode;
        r.proxyGroupId = this.proxyGroupId;
        r.useProxy = this.useProxy;
        r.minIntervalMs = this.minIntervalMs;
        r.maxIntervalMs = this.maxIntervalMs;
        r.keyword = this.keyword;
        r.timeoutMs = this.timeoutMs;
        r.followRedirect = this.followRedirect;
        r.minContentLength = this.minContentLength;
        r.requestIntervalMs = this.requestIntervalMs;
        r.concurrencyLimit = this.concurrencyLimit;
        return r;
    }
}
`);

file('collect/http/FetchResponse.java', `package ${PKG}.collect.http;

import lombok.Data;
import org.dromara.yuqing.collect.model.BlockSignal;

import java.util.List;
import java.util.Map;

/**
 * 一次抓取响应。
 *
 * @author ruoyi
 */
@Data
public class FetchResponse {

    /** HTTP 状态码；本地文件读取时为 200 */
    private int statusCode;

    /** 解码后的文本正文 */
    private String body;

    /** 原始字节（快照留存用） */
    private byte[] bytes;

    /** 响应头 */
    private Map<String, List<String>> headers;

    /** 最终地址（跟随重定向后） */
    private String finalUrl;

    /** 实际使用的出口代理 */
    private String proxyUsed;

    /** 耗时毫秒 */
    private long costMs;

    /** 重试次数 */
    private int attempts;

    /** 反爬判定结果 */
    private BlockSignal blockSignal = BlockSignal.ok();

    /**
     * 是否 HTTP 成功。
     *
     * @return 2xx 返回 true
     */
    public boolean isHttpOk() {
        return statusCode >= 200 && statusCode < 300;
    }

    /**
     * 正文长度。
     *
     * @return 字符数；正文为空返回 0
     */
    public int bodyLength() {
        return body == null ? 0 : body.length();
    }
}
`);

file('collect/http/HttpFetcher.java', `package ${PKG}.collect.http;

import java.io.IOException;

/**
 * 下载器 SPI。
 *
 * <p>《技术架构说明》§5.2 主选 Apache HttpClient 5；本实现为控制离线构建依赖，
 * 采用 JDK 21 内置 {@code java.net.http.HttpClient}（HTTP/2 + 连接池 + 每请求代理），
 * 能力等价。后续如需 JA3/JA4 指纹伪装（§5.5 二级对抗），把本接口的实现换成
 * curl-impersonate 通道即可，上层适配器与管道无需改动。</p>
 *
 * @author ruoyi
 */
public interface HttpFetcher {

    /**
     * 执行抓取。内部完成：限流闸门 → 代理选取 → 请求头轮换 → 随机延时 →
     * 反爬判定 → 退避重试。
     *
     * @param request 请求描述
     * @return 响应；被判定拦截时 {@code blockSignal.isBlocked()} 为 true
     * @throws IOException 网络层失败（重试耗尽后抛出）
     */
    FetchResponse execute(FetchRequest request) throws IOException;
}
`);

file('collect/http/TextDecoder.java', `package ${PKG}.collect.http;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;

/**
 * 响应体解码工具。
 *
 * <p>中文站点常见 GBK / GB2312，且大量站点 Content-Type 声明与真实编码不符，
 * 因此这里做「声明优先 + BOM 嗅探 + UTF-8 误解码自检回退 GBK」三重处理。</p>
 *
 * @author ruoyi
 */
public final class TextDecoder {

    private static final byte[] BOM_UTF8 = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};
    private static final byte[] BOM_UTF16LE = {(byte) 0xFF, (byte) 0xFE};

    private TextDecoder() {
    }

    /**
     * 解码字节数组。
     *
     * @param bytes       原始字节
     * @param contentType 响应头里的 Content-Type
     * @return 解码后的文本；入参为空返回空串
     */
    public static String decode(byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) {
            return "";
        }
        Charset charset = fromBom(bytes);
        if (charset == null) {
            charset = fromContentType(contentType);
        }
        if (charset == null) {
            charset = StandardCharsets.UTF_8;
        }
        String text = new String(bytes, charset);
        if (charset == StandardCharsets.UTF_8 && text.indexOf(0xFFFD) >= 0) {
            String gbk = tryCharset(bytes, "GBK");
            if (gbk != null && gbk.indexOf(0xFFFD) < 0) {
                return gbk;
            }
        }
        return text;
    }

    private static Charset fromBom(byte[] bytes) {
        if (bytes.length >= 3 && bytes[0] == BOM_UTF8[0] && bytes[1] == BOM_UTF8[1] && bytes[2] == BOM_UTF8[2]) {
            return StandardCharsets.UTF_8;
        }
        if (bytes.length >= 2 && bytes[0] == BOM_UTF16LE[0] && bytes[1] == BOM_UTF16LE[1]) {
            return StandardCharsets.UTF_16LE;
        }
        return null;
    }

    private static Charset fromContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return null;
        }
        String lower = contentType.toLowerCase();
        int idx = lower.indexOf("charset=");
        if (idx < 0) {
            return null;
        }
        String name = contentType.substring(idx + 8).trim();
        int semi = name.indexOf(';');
        if (semi > 0) {
            name = name.substring(0, semi);
        }
        name = name.replace("\\"", "").replace("'", "").trim();
        if (name.isEmpty() || "utf8".equalsIgnoreCase(name)) {
            name = name.isEmpty() ? "" : "UTF-8";
        }
        try {
            return name.isEmpty() ? null : Charset.forName(name);
        } catch (Exception e) {
            return null;
        }
    }

    private static String tryCharset(byte[] bytes, String name) {
        try {
            return new String(bytes, Charset.forName(name));
        } catch (Exception e) {
            return null;
        }
    }
}
`);

file('collect/anti/ProxyEndpoint.java', `package ${PKG}.collect.anti;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 代理出口。
 *
 * @author ruoyi
 */
@Data
@AllArgsConstructor
public class ProxyEndpoint {

    private String host;

    private int port;

    private String user;

    private String pass;

    /**
     * 解析 {@code host:port} 或 {@code user:pass@host:port}。
     *
     * @param raw 配置原文
     * @return 端点；格式非法返回 null
     */
    public static ProxyEndpoint parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim();
        String user = null;
        String pass = null;
        int at = s.indexOf('@');
        if (at > 0) {
            String cred = s.substring(0, at);
            s = s.substring(at + 1);
            int c = cred.indexOf(':');
            if (c > 0) {
                user = cred.substring(0, c);
                pass = cred.substring(c + 1);
            } else {
                user = cred;
            }
        }
        int colon = s.lastIndexOf(':');
        if (colon <= 0 || colon == s.length() - 1) {
            return null;
        }
        String host = s.substring(0, colon).trim();
        int port;
        try {
            port = Integer.parseInt(s.substring(colon + 1).trim());
        } catch (NumberFormatException e) {
            return null;
        }
        if (host.isEmpty() || port <= 0 || port > 65535) {
            return null;
        }
        return new ProxyEndpoint(host, port, user, pass);
    }

    /**
     * 是否需要代理鉴权。
     *
     * @return true 表示配置了账号
     */
    public boolean needAuth() {
        return user != null && !user.isEmpty();
    }

    /**
     * 唯一标识。
     *
     * @return host:port
     */
    public String raw() {
        return host + ":" + port;
    }
}
`);

file('collect/anti/ProxyProvider.java', `package ${PKG}.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.net.PasswordAuthentication;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 自研代理池（《技术架构说明》§5.6）。
 *
 * <p>能力：分组取用、轮换 / 粘性会话、失败即时摘除。IP 轮换是验收标准 6 的一环。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProxyProvider {

    private final YqCollectProperties props;

    /** 分组缓存：groupKey -> 出口列表 */
    private final Map<String, List<ProxyEndpoint>> groups = new ConcurrentHashMap<>();

    /** 粘性会话：sessionKey -> [endpoint, 过期时间戳] */
    private final Map<String, Object[]> sticky = new ConcurrentHashMap<>();

    /** 已摘除的出口 */
    private final Set<String> evicted = ConcurrentHashMap.newKeySet();

    private final AtomicInteger rotateIndex = new AtomicInteger();

    /**
     * 取一个可用出口。
     *
     * @param groupId    代理池分组ID（对应配置 yuqing.collect.proxy.groups 的 key）
     * @param sessionKey 粘性会话键，通常用 channelId
     * @return 出口；未启用或无可用户口返回 {@link Optional#empty()}
     */
    public Optional<ProxyEndpoint> acquire(Long groupId, String sessionKey) {
        if (!props.getProxy().isEnabled() || groupId == null) {
            return Optional.empty();
        }
        List<ProxyEndpoint> all = group(String.valueOf(groupId));
        if (all.isEmpty()) {
            return Optional.empty();
        }
        List<ProxyEndpoint> usable = new ArrayList<>();
        for (ProxyEndpoint ep : all) {
            if (!evicted.contains(ep.raw())) {
                usable.add(ep);
            }
        }
        if (usable.isEmpty()) {
            log.warn("[采集代理] 分组 {} 出口全部被摘除，本轮直连", groupId);
            return Optional.empty();
        }
        if ("sticky".equalsIgnoreCase(props.getProxy().getStrategy()) && sessionKey != null) {
            long now = System.currentTimeMillis();
            Object[] cached = sticky.get(sessionKey);
            if (cached != null && (long) cached[1] > now) {
                ProxyEndpoint ep = (ProxyEndpoint) cached[0];
                if (!evicted.contains(ep.raw())) {
                    return Optional.of(ep);
                }
            }
            ProxyEndpoint ep = usable.get(Math.floorMod(rotateIndex.getAndIncrement(), usable.size()));
            sticky.put(sessionKey, new Object[]{ep, now + props.getProxy().getStickyTtlSeconds() * 1000L});
            return Optional.of(ep);
        }
        return Optional.of(usable.get(Math.floorMod(rotateIndex.getAndIncrement(), usable.size())));
    }

    /**
     * 上报失败：按配置摘除出口，避免继续踩同一个被拉黑的 IP。
     *
     * @param endpoint 出口
     */
    public void reportFailure(ProxyEndpoint endpoint) {
        if (endpoint == null) {
            return;
        }
        if (props.getProxy().isEvictOnFailure()) {
            evicted.add(endpoint.raw());
        }
    }

    /**
     * 上报成功：清空该出口的失败标记。
     *
     * @param endpoint 出口
     */
    public void reportSuccess(ProxyEndpoint endpoint) {
        if (endpoint != null) {
            evicted.remove(endpoint.raw());
        }
    }

    /**
     * 为 JDK HttpClient 的全局 Authenticator 提供代理凭据。
     *
     * @param host 代理主机
     * @param port 代理端口
     * @return 凭据；无匹配返回 null
     */
    public PasswordAuthentication credentials(String host, int port) {
        if (host == null) {
            return null;
        }
        for (List<ProxyEndpoint> list : groups.values()) {
            for (ProxyEndpoint ep : list) {
                if (ep.needAuth() && ep.getHost().equalsIgnoreCase(host) && ep.getPort() == port) {
                    return new PasswordAuthentication(ep.getUser(), ep.getPass() == null ? new char[0] : ep.getPass().toCharArray());
                }
            }
        }
        return null;
    }

    /**
     * 解析并缓存分组。
     *
     * @param groupKey 分组 key
     * @return 出口列表，可能为空
     */
    private List<ProxyEndpoint> group(String groupKey) {
        return groups.computeIfAbsent(groupKey, k -> {
            String raw = props.getProxy().getGroups().get(k);
            if (raw == null || raw.isBlank()) {
                return Collections.emptyList();
            }
            List<ProxyEndpoint> list = new ArrayList<>();
            for (String part : raw.split(",")) {
                ProxyEndpoint ep = ProxyEndpoint.parse(part);
                if (ep != null) {
                    list.add(ep);
                }
            }
            if (list.isEmpty()) {
                log.warn("[采集代理] 分组 {} 配置无有效出口: {}", k, raw);
            }
            return list;
        });
    }
}
`);

file('collect/anti/HeaderPool.java', `package ${PKG}.collect.anti;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 请求头池：UA / Accept-Language / Referer 随机轮换（《技术架构说明》§5.5.2）。
 *
 * <p>真实浏览器 Header 库随机取值，并补全 Referer 链与语言偏好，绕过朴素 Header 校验。</p>
 *
 * @author ruoyi
 */
@Component
public class HeaderPool {

    private static final List<String> USER_AGENTS = List.of(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; PGT-AN10 Build/HUAWEIPGT-AN10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; 22081212C Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
    );

    private static final List<String> ACCEPT_LANGUAGES = List.of(
        "zh-CN,zh;q=0.9,en;q=0.8",
        "zh-CN,zh;q=0.9",
        "zh-CN,zh-Hans;q=0.9,en-US;q=0.8,en;q=0.7",
        "zh-CN,zh;q=0.8,en-GB;q=0.6"
    );

    /**
     * 生成一组随机请求头。
     *
     * @param referer 来源页；为空时不带 Referer
     * @return 请求头 Map（有序）
     */
    public Map<String, String> next(String referer) {
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("User-Agent", pick(USER_AGENTS));
        headers.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
        headers.put("Accept-Language", pick(ACCEPT_LANGUAGES));
        headers.put("Cache-Control", "no-cache");
        headers.put("Pragma", "no-cache");
        headers.put("Upgrade-Insecure-Requests", "1");
        if (referer != null && !referer.isBlank()) {
            headers.put("Referer", referer);
        }
        return headers;
    }

    private String pick(List<String> pool) {
        return pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
    }
}
`);

file('collect/anti/BlockDetector.java', `package ${PKG}.collect.anti;

import org.dromara.yuqing.collect.http.FetchResponse;
import org.dromara.yuqing.collect.model.BlockSignal;
import org.dromara.yuqing.collect.model.BlockType;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 被拦信号识别（《技术架构说明》§5.5.1）。
 *
 * <p>先识别是否被拦，再决定是否升级对抗手段 —— 而不是一上来就上无头浏览器。</p>
 *
 * @author ruoyi
 */
@Component
public class BlockDetector {

    /** 人机校验特征 */
    private static final List<String> CAPTCHA_MARKS = List.of(
        "验证码", "滑动验证", "安全验证", "人机验证", "拖动滑块", "点击完成验证",
        "captcha", "geetest", "nc_1_n1z", "cf-challenge", "verify you are human"
    );

    /** 登录墙 / 付费墙特征（合规红线，不破解，仅识别并留痕） */
    private static final List<String> PAYWALL_MARKS = List.of(
        "登录后查看全文", "开通会员", "付费阅读", "订阅后可见", "请先登录", "登录后继续"
    );

    /** 前端渲染壳特征 */
    private static final List<String> SHELL_MARKS = List.of(
        "<div id=\\"app\\"></div>", "<div id=\\"root\\"></div>", "window.__INITIAL_STATE__",
        "__NEXT_DATA__", "noscript"
    );

    /**
     * 判定响应是否被拦截。
     *
     * @param response         响应
     * @param keyword          检索词，用于蜜罐 / 降级内容判定；为 null 时跳过该检查
     * @param minContentLength 有效内容长度下限
     * @return 判定结果
     */
    public BlockSignal detect(FetchResponse response, String keyword, int minContentLength) {
        if (response == null) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "响应为空");
        }
        int code = response.getStatusCode();
        if (code == 429) {
            return BlockSignal.blocked(BlockType.RATE_LIMITED, "HTTP 429 触发限流");
        }
        if (code == 403 || code == 401 || code == 407) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP " + code + " 拒绝访问");
        }
        if (code == 503) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP 503 服务不可用");
        }
        if (code >= 400) {
            return BlockSignal.blocked(BlockType.HTTP_ERROR, "HTTP " + code);
        }
        String body = response.getBody();
        if (body == null || body.isBlank()) {
            return BlockSignal.blocked(BlockType.RENDER_REQUIRED, "HTTP 200 但正文为空");
        }
        String lower = body.toLowerCase();
        for (String mark : CAPTCHA_MARKS) {
            if (lower.contains(mark.toLowerCase())) {
                return BlockSignal.blocked(BlockType.CAPTCHA, "命中人机校验特征: " + mark);
            }
        }
        for (String mark : PAYWALL_MARKS) {
            if (body.contains(mark)) {
                return BlockSignal.blocked(BlockType.PAYWALL, "命中登录/付费墙特征: " + mark);
            }
        }
        if (looksLikeShell(body, minContentLength)) {
            return BlockSignal.blocked(BlockType.RENDER_REQUIRED, "疑似前端渲染壳，需切渲染通道");
        }
        if (keyword != null && !keyword.isBlank() && !body.contains(keyword)) {
            return BlockSignal.blocked(BlockType.IRRELEVANT, "返回内容未命中检索词，疑似蜜罐或降级内容");
        }
        return BlockSignal.ok();
    }

    /**
     * 是否为空壳页（HTML 标签极少但含脚本）。
     *
     * @param body 正文
     * @param minLength 最低内容长度
     * @return true 表示需要渲染通道
     */
    public boolean looksLikeShell(String body, int minLength) {
        if (body == null || body.length() > Math.max(minLength, 400)) {
            return false;
        }
        String lower = body.toLowerCase();
        if (!lower.contains("<script")) {
            return false;
        }
        for (String mark : SHELL_MARKS) {
            if (lower.contains(mark.toLowerCase())) {
                return true;
            }
        }
        int tagCount = lower.split("<").length - 1;
        return tagCount < 12;
    }

    /**
     * 内容长度异常检测（蜜罐 / 陷阱字段）。
     *
     * @param text      文本
     * @param minLength 有效内容下限
     * @return true 表示疑似无效内容
     */
    public boolean looksLikeTrap(String text, int minLength) {
        return text == null || text.trim().length() < minLength;
    }
}
`);

file('collect/anti/RetryPolicy.java', `package ${PKG}.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * 退避重试策略（F-004 验收标准 5）。
 *
 * <p>指数退避 + 抖动。抖动用于避免同批任务在同一时刻集中重试，形成对目标站点的脉冲式压力。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetryPolicy {

    private final YqCollectProperties props;

    /**
     * 最大尝试次数（含首次）。
     *
     * @return 至少为 1
     */
    public int maxAttempts() {
        return Math.max(1, props.getRetry().getMaxAttempts());
    }

    /**
     * 计算第 N 次失败后的退避时长。
     *
     * @param attempt 已失败次数，从 1 开始
     * @return 退避毫秒，含抖动
     */
    public long backoffMillis(int attempt) {
        YqCollectProperties.Retry cfg = props.getRetry();
        double base = cfg.getInitialBackoffMs() * Math.pow(Math.max(1.0D, cfg.getMultiplier()), Math.max(0, attempt - 1));
        long capped = (long) Math.min(base, cfg.getMaxBackoffMs());
        double jitterRatio = Math.max(0.0D, Math.min(1.0D, cfg.getJitterRatio()));
        if (jitterRatio <= 0) {
            return capped;
        }
        long jitter = (long) (capped * jitterRatio);
        return Math.max(1L, capped + ThreadLocalRandom.current().nextLong(-jitter, jitter + 1));
    }

    /**
     * 按退避时长休眠。
     *
     * @param millis 毫秒
     */
    public void sleep(long millis) {
        if (millis <= 0) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[采集重试] 退避休眠被中断");
        }
    }

    /**
     * 生成适配器要求的随机请求延时（反爬：频率算法对抗，请求间隔随机化）。
     *
     * @param minMs 下限
     * @param maxMs 上限
     * @return 毫秒；参数非法返回 0
     */
    public long randomDelayMillis(Integer minMs, Integer maxMs) {
        int lo = minMs == null ? 0 : Math.max(0, minMs);
        int hi = maxMs == null ? lo : Math.max(lo, maxMs);
        if (hi <= 0) {
            return 0L;
        }
        return lo == hi ? lo : ThreadLocalRandom.current().nextLong(lo, hi + 1L);
    }
}
`);

file('collect/anti/ChannelRateLimiter.java', `package ${PKG}.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.SpringUtils;
import org.redisson.api.RRateLimiter;
import org.redisson.api.RSemaphore;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * 渠道限流闸门（F-004 验收标准 6）。
 *
 * <p>双重闸门：</p>
 * <ol>
 *   <li><b>令牌桶</b>：按渠道 QPS 限速，速率由「请求间隔（毫秒）」换算，Redisson 实现跨实例共享；</li>
 *   <li><b>并发闸门</b>：按渠道并发上限放行，Redisson {@code RSemaphore} 实现跨实例共享。</li>
 * </ol>
 *
 * <p>Redis 不可用时自动降级为进程内信号量，保证采集链路不因限流组件故障而中断。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChannelRateLimiter {

    /** 排队等待上限：超过则放行并记降级告警，避免整批任务被单渠道卡死 */
    private static final long ACQUIRE_WAIT_MS = 30000L;

    private final Map<Long, Semaphore> localGates = new ConcurrentHashMap<>();

    private volatile RedissonClient redisClient;

    private volatile boolean redisResolved = false;

    /**
     * 申请一次抓取许可。
     *
     * @param channelId         渠道ID
     * @param requestIntervalMs 渠道请求间隔（毫秒）
     * @param concurrencyLimit  渠道并发上限
     * @return 许可句柄，务必在 finally / try-with-resources 中释放
     */
    public Permit acquire(Long channelId, Integer requestIntervalMs, Integer concurrencyLimit) {
        int limit = concurrencyLimit == null || concurrencyLimit <= 0 ? 1 : concurrencyLimit;
        int intervalMs = requestIntervalMs == null || requestIntervalMs <= 0 ? 1000 : requestIntervalMs;
        long key = channelId == null ? 0L : channelId;
        RedissonClient client = redis();
        if (client != null) {
            try {
                RSemaphore semaphore = client.getSemaphore("yq:collect:gate:" + key);
                semaphore.trySetPermits(limit);
                boolean got = semaphore.tryAcquire(ACQUIRE_WAIT_MS, TimeUnit.MILLISECONDS);
                if (!got) {
                    log.warn("[采集限流] 渠道 {} 并发闸门排队超时，本请求直放", channelId);
                    return Permit.noop();
                }
                RRateLimiter rateLimiter = client.getRateLimiter("yq:collect:rate:" + key);
                rateLimiter.trySetRate(RateType.OVERALL, Math.max(1L, 1000L / intervalMs), Duration.ofSeconds(1));
                rateLimiter.tryAcquire(Math.max(intervalMs * 2L, 1000L), TimeUnit.MILLISECONDS);
                return new Permit(semaphore, null, true, false);
            } catch (Throwable e) {
                log.warn("[采集限流] Redis 闸门不可用，降级为进程内限流: {}", e.getMessage());
            }
        }
        Semaphore local = localGates.computeIfAbsent(key, k -> new Semaphore(limit));
        boolean acquired = false;
        try {
            acquired = local.tryAcquire(ACQUIRE_WAIT_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return new Permit(null, local, false, acquired);
    }

    private RedissonClient redis() {
        if (redisResolved) {
            return redisClient;
        }
        synchronized (this) {
            if (!redisResolved) {
                try {
                    redisClient = SpringUtils.getBean(RedissonClient.class);
                } catch (Throwable ignored) {
                    redisClient = null;
                }
                redisResolved = true;
            }
        }
        return redisClient;
    }

    /**
     * 限流许可句柄。
     */
    public static final class Permit implements AutoCloseable {

        private final RSemaphore redisSemaphore;

        private final Semaphore localSemaphore;

        private final boolean redisAcquired;

        private final boolean localAcquired;

        private Permit(RSemaphore redisSemaphore, Semaphore localSemaphore, boolean redisAcquired, boolean localAcquired) {
            this.redisSemaphore = redisSemaphore;
            this.localSemaphore = localSemaphore;
            this.redisAcquired = redisAcquired;
            this.localAcquired = localAcquired;
        }

        static Permit noop() {
            return new Permit(null, null, false, false);
        }

        @Override
        public void close() {
            if (redisAcquired && redisSemaphore != null) {
                redisSemaphore.release();
            }
            if (localAcquired && localSemaphore != null) {
                localSemaphore.release();
            }
        }
    }
}
`);

/* ==========================================================================
 * 4. 下载器实现（JDK HttpClient）
 * ========================================================================== */

file('collect/http/JdkHttpFetcher.java', `package ${PKG}.collect.http;

import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.anti.ChannelRateLimiter;
import org.dromara.yuqing.collect.anti.HeaderPool;
import org.dromara.yuqing.collect.anti.ProxyEndpoint;
import org.dromara.yuqing.collect.anti.ProxyProvider;
import org.dromara.yuqing.collect.anti.RetryPolicy;
import org.dromara.yuqing.collect.anti.BlockDetector;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.BlockSignal;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.Authenticator;
import java.net.InetSocketAddress;
import java.net.PasswordAuthentication;
import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 下载器实现：JDK 21 内置 HttpClient。
 *
 * <p>整条链路的执行顺序（对齐《技术架构说明》§5.2 分层与 §5.5 反爬）：</p>
 * <ol>
 *   <li>随机延时（频率算法对抗）</li>
 *   <li>渠道限流闸门（令牌桶 + 并发闸门，验收标准 6）</li>
 *   <li>代理池取出口（IP 轮换，验收标准 6）+ 请求头池轮换</li>
 *   <li>发起请求 → 反爬判定 → 命中拦截则退避重试（验收标准 5）</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class JdkHttpFetcher implements HttpFetcher {

    private static final String FILE_SCHEME = "file:";

    private final HeaderPool headerPool;

    private final ProxyProvider proxyProvider;

    private final BlockDetector blockDetector;

    private final RetryPolicy retryPolicy;

    private final ChannelRateLimiter rateLimiter;

    /**
     * 本线程当次请求的代理出口。
     * <p>JDK {@link HttpClient} 的代理只能在客户端级配置（{@code HttpRequest.Builder} 无 proxy 方法），
     * 而代理池要求「一次请求换一个出口」。折中做法：客户端挂一个可变的 {@link ProxySelector}，
     * 真正选出口时读本 ThreadLocal —— 既保住连接池复用，又满足轮换语义。</p>
     */
    private final ThreadLocal<Proxy> currentProxy = new ThreadLocal<>();

    private volatile HttpClient httpClient;

    private final YqCollectProperties props;

    public JdkHttpFetcher(HeaderPool headerPool, ProxyProvider proxyProvider, BlockDetector blockDetector,
                          RetryPolicy retryPolicy, ChannelRateLimiter rateLimiter, YqCollectProperties props) {
        this.headerPool = headerPool;
        this.proxyProvider = proxyProvider;
        this.blockDetector = blockDetector;
        this.retryPolicy = retryPolicy;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    @Override
    public FetchResponse execute(FetchRequest request) throws IOException {
        if (request.getUrl() == null || request.getUrl().isBlank()) {
            throw new IOException("采集地址为空");
        }
        if (request.getUrl().startsWith(FILE_SCHEME)) {
            /* 安全：file: 协议能读本机任意文件，属「本地文件读取」风险面。
               因此默认关闭（yuqing.collect.allow-local-file=false），
               只在离线自测 / 历史快照复采时显式打开，避免配置被改写后变成任意文件读取入口。 */
            if (!props.isAllowLocalFile()) {
                throw new IOException("已禁用 file: 协议（如需离线自测请显式设置 yuqing.collect.allow-local-file=true）");
            }
            return readLocalFile(request);
        }
        int maxAttempts = retryPolicy.maxAttempts();
        FetchResponse last = null;
        IOException lastError = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            retryPolicy.sleep(retryPolicy.randomDelayMillis(request.getMinIntervalMs(), request.getMaxIntervalMs()));
            ProxyEndpoint endpoint = request.isUseProxy()
                ? proxyProvider.acquire(request.getProxyGroupId(),
                    request.getChannelId() == null ? null : String.valueOf(request.getChannelId())).orElse(null)
                : null;
            try (ChannelRateLimiter.Permit ignored = rateLimiter.acquire(request.getChannelId(),
                request.getRequestIntervalMs(), request.getConcurrencyLimit())) {
                long start = System.currentTimeMillis();
                FetchResponse response = send(request, endpoint);
                response.setCostMs(System.currentTimeMillis() - start);
                response.setAttempts(attempt);
                BlockSignal signal = blockDetector.detect(response, request.getKeyword(), request.getMinContentLength());
                response.setBlockSignal(signal);
                if (signal.isBlocked()) {
                    proxyProvider.reportFailure(endpoint);
                    last = response;
                    if (attempt < maxAttempts) {
                        log.debug("[采集] 命中拦截 url={} type={} detail={}", request.getUrl(), signal.getType(), signal.getDetail());
                        retryPolicy.sleep(retryPolicy.backoffMillis(attempt));
                        continue;
                    }
                    return response;
                }
                proxyProvider.reportSuccess(endpoint);
                return response;
            } catch (IOException e) {
                lastError = e;
                proxyProvider.reportFailure(endpoint);
                log.debug("[采集] 请求失败 url={} attempt={} err={}", request.getUrl(), attempt, e.getMessage());
                if (attempt < maxAttempts) {
                    retryPolicy.sleep(retryPolicy.backoffMillis(attempt));
                }
            }
        }
        if (last != null) {
            return last;
        }
        throw lastError != null ? lastError : new IOException("采集失败：重试 " + maxAttempts + " 次仍未成功");
    }

    /**
     * 发起单次 HTTP 请求。
     */
    private FetchResponse send(FetchRequest request, ProxyEndpoint endpoint) throws IOException {
        URI uri = URI.create(encodeUrl(request.getUrl()));
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(Duration.ofMillis(request.getTimeoutMs()));
        Map<String, String> headers = headerPool.next(null);
        if (request.getHeaders() != null) {
            headers.putAll(request.getHeaders());
        }
        headers.forEach((k, v) -> {
            if (v != null && !v.isBlank()) {
                builder.header(k, v);
            }
        });
        /* 代理是客户端级配置：把本次出口放进 ThreadLocal，由 DynamicProxySelector 按请求返回 */
        if (endpoint != null) {
            currentProxy.set(new Proxy(Proxy.Type.HTTP, new InetSocketAddress(endpoint.getHost(), endpoint.getPort())));
        } else {
            currentProxy.remove();
        }
        String method = request.getMethod() == null ? "GET" : request.getMethod().toUpperCase(Locale.ROOT);
        if ("POST".equals(method)) {
            String body = request.getBody() == null ? "" : request.getBody();
            builder.header("Content-Type", request.getContentType());
            builder.POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8));
        } else {
            builder.GET();
        }
        try {
            HttpResponse<byte[]> response = client().send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            FetchResponse out = new FetchResponse();
            out.setStatusCode(response.statusCode());
            out.setBytes(response.body());
            out.setHeaders(response.headers().map());
            out.setFinalUrl(uri.toString());
            out.setProxyUsed(endpoint == null ? null : endpoint.raw());
            String contentType = response.headers().firstValue("Content-Type").orElse(null);
            out.setBody(TextDecoder.decode(response.body(), contentType));
            return out;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("采集被中断", e);
        } finally {
            currentProxy.remove();
        }
    }

    /**
     * 可变代理选择器：每次建连时读取 {@link #currentProxy}，为空则直连。
     */
    private final class DynamicProxySelector extends ProxySelector {

        @Override
        public List<Proxy> select(URI uri) {
            Proxy proxy = currentProxy.get();
            return List.of(proxy == null ? Proxy.NO_PROXY : proxy);
        }

        @Override
        public void connectFailed(URI uri, SocketAddress sa, IOException ioe) {
            /* 不放这里淘汰代理：失败由 execute() 的 catch 分支统一 reportFailure，
               避免同一故障被计数两次。 */
            log.debug("[采集] 代理连接失败 uri={} addr={} err={}", uri, sa, ioe.getMessage());
        }
    }

    /**
     * 读取本地文件（离线自测 / 历史快照复采）。
     */
    private FetchResponse readLocalFile(FetchRequest request) throws IOException {
        String raw = request.getUrl().substring(FILE_SCHEME.length());
        if (raw.startsWith("///")) {
            raw = raw.substring(2);
        } else if (raw.startsWith("//")) {
            raw = raw.substring(2);
        }
        if (raw.length() > 2 && raw.charAt(0) == '/' && raw.charAt(2) == ':') {
            raw = raw.substring(1);
        }
        byte[] bytes = Files.readAllBytes(Path.of(raw));
        FetchResponse out = new FetchResponse();
        out.setStatusCode(200);
        out.setBytes(bytes);
        out.setBody(TextDecoder.decode(bytes, null));
        out.setFinalUrl(request.getUrl());
        out.setAttempts(1);
        out.setBlockSignal(BlockSignal.ok());
        return out;
    }

    private HttpClient client() {
        HttpClient c = httpClient;
        if (c == null) {
            synchronized (this) {
                c = httpClient;
                if (c == null) {
                    c = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(15))
                        .followRedirects(HttpClient.Redirect.NORMAL)
                        .version(HttpClient.Version.HTTP_1_1)
                        .proxy(new DynamicProxySelector())
                        .authenticator(new ProxyAuthenticator(proxyProvider))
                        .build();
                    httpClient = c;
                }
            }
        }
        return c;
    }

    /**
     * 地址编码：站点模板里的检索词常带中文或空格，直接 URI.create 会抛异常。
     */
    private String encodeUrl(String url) {
        try {
            return new URI(url).toASCIIString();
        } catch (URISyntaxException e) {
            StringBuilder sb = new StringBuilder(url.length() + 16);
            for (int i = 0; i < url.length(); i++) {
                char ch = url.charAt(i);
                if (ch == ' ') {
                    sb.append("%20");
                } else if (ch > 127) {
                    byte[] bytes = String.valueOf(ch).getBytes(StandardCharsets.UTF_8);
                    for (byte b : bytes) {
                        sb.append('%').append(String.format("%02X", b & 0xFF));
                    }
                } else {
                    sb.append(ch);
                }
            }
            return sb.toString();
        }
    }

    /**
     * 代理鉴权：JDK HttpClient 的代理凭据是客户端级配置，这里按 host:port 反查代理池配置。
     */
    private static final class ProxyAuthenticator extends Authenticator {

        private final ProxyProvider proxyProvider;

        private ProxyAuthenticator(ProxyProvider proxyProvider) {
            this.proxyProvider = proxyProvider;
        }

        @Override
        protected PasswordAuthentication getPasswordAuthentication() {
            if (getRequestorType() != RequestorType.PROXY) {
                return null;
            }
            return proxyProvider.credentials(getRequestingHost(), getRequestingPort());
        }
    }
}
`);

/* ==========================================================================
 * 5. 站点适配器
 * ========================================================================== */

file('collect/adapter/AdapterSpec.java', `package ${PKG}.collect.adapter;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 站点适配器配置规格：把「每站怎么写」变成配置（《技术架构说明》§5.3）。
 *
 * <p>站点改版导致采集失效时，改配置即可恢复，无需发版。</p>
 *
 * @author ruoyi
 */
@Data
public class AdapterSpec {

    /** 适配器标识，对应 yq_channel.adapter_class 与配置 key */
    private String code;

    /** 渠道展示名 */
    private String channelName;

    /** 入口类型：static（静态 HTML）/ render（动态渲染）/ api（开放接口）/ mock（离线自测） */
    private String entryType = "static";

    /** 列表页地址模板，支持 {kw} 与 {page} 占位符 */
    private String listUrl;

    /** 列表项选择器（static / render） */
    private String listItemSelector;

    /** 列表 JSON 数组路径（api），如 data.list 或 data[0].items */
    private String listJsonPath;

    /** 请求方法（api） */
    private String method = "GET";

    /** 请求体模板（api POST） */
    private String requestBody;

    /** 附加请求头 */
    private Map<String, String> headers = new LinkedHashMap<>();

    /** 字段抽取规则 */
    private Map<String, FieldRule> fields = new LinkedHashMap<>();

    /** 分页规则 */
    private PageRule pageRule = new PageRule();

    /** 详情页规则 */
    private DetailRule detailRule = new DetailRule();

    /** 反爬参数 */
    private AntiBotRule antiBot = new AntiBotRule();

    /** mock 适配器生成条数 */
    private int mockSize = 30;

    /** 合规备注：是否允许采集、robots 策略、是否需授权（PRD §8.4 待确认项 3） */
    private String compliance = "";

    /**
     * 生效最大翻页数。
     *
     * @return 至少为 1
     */
    public int maxPage() {
        return pageRule == null ? 1 : Math.max(1, pageRule.getMaxPage());
    }

    /**
     * 取字段规则。
     *
     * @param name 逻辑字段名，如 title / opinionUrl
     * @return 规则；未配置返回 null
     */
    public FieldRule field(String name) {
        return fields == null ? null : fields.get(name);
    }

    /**
     * 分页规则。
     */
    @Data
    public static class PageRule {
        /** 起始页 */
        private int start = 1;
        /** 每页条数（仅作参考，实际以解析结果为准） */
        private int size = 20;
        /** 最大翻页数 */
        private int maxPage = 5;
    }

    /**
     * 单字段抽取规则。
     */
    @Data
    public static class FieldRule {
        /** CSS 选择器（static / render）或点分路径（api） */
        private String selector;
        /** 取值方式：text / html / href / src / 任意属性名 */
        private String attr = "text";
        /** 前缀（相对链接补全） */
        private String prefix = "";
        /** 后缀 */
        private String suffix = "";
        /** 时间格式，如 yyyy-MM-dd HH:mm */
        private String pattern = "";
        /** api 专用：点分路径（优先于 selector） */
        private String jsonPath = "";
        /** 缺失时的兜底值 */
        private String defaultValue = "";
    }

    /**
     * 详情页规则。
     */
    @Data
    public static class DetailRule {
        /** 是否抓取详情页正文 */
        private boolean enabled = false;
        /** 正文容器选择器 */
        private String contentSelector = "";
        /** 详情页翻页数 */
        private int pageNum = 1;
    }

    /**
     * 反爬参数。
     */
    @Data
    public static class AntiBotRule {
        /** 是否走代理 */
        private boolean useProxy = true;
        /** 随机延时下限（毫秒） */
        private int minIntervalMs = 1500;
        /** 随机延时上限（毫秒） */
        private int maxIntervalMs = 4000;
        /** 固定 Referer */
        private String referer = "";
    }
}
`);

file('collect/adapter/AdapterContext.java', `package ${PKG}.collect.adapter;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 适配器运行上下文。
 *
 * @author ruoyi
 */
@Data
@AllArgsConstructor
public class AdapterContext {

    /** 采集批次号 */
    private String batchNo;

    /** 单批次最大产出条数 */
    private int maxRecords;

    /** 单批次最大翻页数 */
    private int maxPages;

    /** 增量水位线（早于该时间的内容停止翻页） */
    private java.time.LocalDateTime watermark;
}
`);

file('collect/adapter/SiteAdapter.java', `package ${PKG}.collect.adapter;

import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;

import java.util.List;

/**
 * 站点适配器 SPI。
 *
 * <p>新站点接入不改代码：新增一个 {@link AdapterSpec} 配置即可。需要新抓取通道（如渲染、APP 接口）
 * 时才实现本接口并注册为 Bean。</p>
 *
 * @author ruoyi
 */
public interface SiteAdapter {

    /**
     * 入口类型标识，与 {@link AdapterSpec#getEntryType()} 对应。
     *
     * @return static / render / api / mock
     */
    String entryType();

    /**
     * 抓取一批原始舆情（未去重、未净化）。
     *
     * @param unit 采集单元
     * @param spec 适配器配置
     * @param ctx  运行上下文
     * @return 原始舆情列表
     * @throws Exception 抓取或解析失败
     */
    List<RawOpinion> fetch(CollectUnit unit, AdapterSpec spec, AdapterContext ctx) throws Exception;
}
`);

file('collect/adapter/AbstractSiteAdapter.java', `package ${PKG}.collect.adapter;

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
`);

file('collect/adapter/TimeParser.java', `package ${PKG}.collect.adapter;

import cn.hutool.core.date.DateUtil;
import cn.hutool.core.date.LocalDateTimeUtil;

import java.time.LocalDateTime;

/**
 * 发布时间解析：站点时间格式千奇百怪，统一归一化为 LocalDateTime。
 *
 * @author ruoyi
 */
public final class TimeParser {

    private TimeParser() {
    }

    /**
     * 解析时间文本。
     *
     * @param text              原始文本，如「2026-09-18 15:00」「2026年09月18日」
     * @param preferredPattern  适配器指定的时间格式，可空
     * @return 时间；无法解析返回 null
     */
    public static LocalDateTime parse(String text, String preferredPattern) {
        if (text == null) {
            return null;
        }
        String normalized = normalize(text);
        if (normalized.isEmpty()) {
            return null;
        }
        if (isDigits(normalized)) {
            long value = Long.parseLong(normalized);
            if (normalized.length() == 10) {
                return LocalDateTime.ofInstant(java.time.Instant.ofEpochSecond(value), java.time.ZoneId.systemDefault());
            }
            if (normalized.length() == 13) {
                return LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(value), java.time.ZoneId.systemDefault());
            }
        }
        if (preferredPattern != null && !preferredPattern.isBlank()) {
            try {
                return LocalDateTimeUtil.parse(normalized, preferredPattern);
            } catch (Exception ignored) {
                // 适配器给的格式不匹配时继续走兜底解析
            }
        }
        try {
            return LocalDateTimeUtil.of(DateUtil.parse(normalized));
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * 归一化：全角转半角、中文单位转符号、压缩空白。
     *
     * @param text 原文
     * @return 归一化文本
     */
    private static String normalize(String text) {
        String s = text.trim()
            .replace('年', '-')
            .replace('月', '-')
            .replace('/', '-')
            .replace('日', ' ')
            .replace('T', ' ')
            .replace('：', ':');
        StringBuilder sb = new StringBuilder(s.length());
        boolean lastSpace = false;
        for (int i = 0; i < s.length(); i++) {
            char ch = s.charAt(i);
            if (ch == ' ' || ch == '\\t' || ch == '\\n' || ch == '\\r') {
                if (!lastSpace && sb.length() > 0) {
                    sb.append(' ');
                }
                lastSpace = true;
            } else {
                sb.append(ch);
                lastSpace = false;
            }
        }
        return sb.toString().trim();
    }

    private static boolean isDigits(String s) {
        for (int i = 0; i < s.length(); i++) {
            if (!Character.isDigit(s.charAt(i))) {
                return false;
            }
        }
        return !s.isEmpty();
    }
}
`);

file('collect/adapter/StaticHtmlAdapter.java', `package ${PKG}.collect.adapter;

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
`);

file('collect/adapter/JsonApiAdapter.java', `package ${PKG}.collect.adapter;

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
`);

file('collect/adapter/MockAdapter.java', `package ${PKG}.collect.adapter;

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
`);

file('collect/adapter/AdapterRegistry.java', `package ${PKG}.collect.adapter;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 站点适配器注册表。
 *
 * <p>配置来自 {@code yuqing.collect.adapters}，按 {@code entryType} 路由到对应实现。
 * {@code render} 类型在未接入 Playwright 渲染通道前降级为静态解析（对 SSR 页面可用），并打印一次告警。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdapterRegistry {

    private final YqCollectProperties props;

    private final List<SiteAdapter> adapters;

    private final Map<String, SiteAdapter> byType = new HashMap<>();

    @PostConstruct
    public void init() {
        for (SiteAdapter adapter : adapters) {
            byType.put(adapter.entryType().toLowerCase(), adapter);
        }
        if (props.getAdapters() != null) {
            for (Map.Entry<String, AdapterSpec> entry : props.getAdapters().entrySet()) {
                AdapterSpec spec = entry.getValue();
                if (spec == null) {
                    continue;
                }
                if (spec.getCode() == null || spec.getCode().isBlank()) {
                    spec.setCode(entry.getKey());
                }
                SiteAdapter adapter = byType.get(String.valueOf(spec.getEntryType()).toLowerCase());
                if (adapter == null) {
                    log.warn("[采集适配器] {} 声明的 entryType={} 无对应实现，将回退静态解析",
                        entry.getKey(), spec.getEntryType());
                }
            }
        }
        log.info("[采集适配器] 已加载 {} 个站点适配器，通道实现 {} 个: {}", codes().size(), byType.size(), byType.keySet());
    }

    /**
     * 取适配器配置。
     *
     * @param code 适配器标识（yq_channel.adapter_class）
     * @return 配置
     * @throws ServiceException 未配置时抛出，携带可读原因
     */
    public AdapterSpec spec(String code) {
        if (code == null || code.isBlank()) {
            throw new ServiceException("渠道未绑定站点适配器（adapter_class 为空）");
        }
        AdapterSpec spec = props.getAdapters() == null ? null : props.getAdapters().get(code);
        if (spec == null) {
            throw new ServiceException("未找到站点适配器配置: " + code + "，请在 yuqing.collect.adapters 中补充");
        }
        return spec;
    }

    /**
     * 按配置路由到适配器实现。
     *
     * @param spec 适配器配置
     * @return 适配器实现
     */
    public SiteAdapter adapterFor(AdapterSpec spec) {
        String type = spec.getEntryType() == null ? "static" : spec.getEntryType().trim().toLowerCase();
        SiteAdapter adapter = byType.get(type);
        if (adapter == null && "render".equals(type)) {
            adapter = byType.get("static");
            if (adapter != null) {
                log.warn("[采集适配器] {} 为 render 通道，但未接入 Playwright，已降级为静态解析", spec.getCode());
            }
        }
        if (adapter == null) {
            throw new ServiceException("适配器 " + spec.getCode() + " 的 entryType=" + type + " 无可用实现");
        }
        return adapter;
    }

    /**
     * 全部适配器标识。
     *
     * @return 标识列表
     */
    public List<String> codes() {
        return props.getAdapters() == null ? new ArrayList<>() : new ArrayList<>(props.getAdapters().keySet());
    }

    /**
     * 是否存在指定适配器。
     *
     * @param code 标识
     * @return true 表示已配置
     */
    public boolean has(String code) {
        return code != null && props.getAdapters() != null && props.getAdapters().containsKey(code);
    }
}
`);

/* ==========================================================================
 * 6. 采集管道（去重 / 快照 / 攒批落库 / 指标）
 * ========================================================================== */

file('collect/pipeline/UrlNormalizer.java', `package ${PKG}.collect.pipeline;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * 链接归一化与 SHA-256 指纹。
 *
 * <p>同一篇文章在不同渠道会带不同追踪参数（utm_*、spm、share_token……），
 * 不归一化就会「同一篇算两条」。归一化后计算 {@code url_hash}，与 Doris
 * {@code Unique Key(collect_date, url_hash)} 天然对齐（《技术架构说明》§5.7）。</p>
 *
 * @author ruoyi
 */
public final class UrlNormalizer {

    /** 需要在去重时忽略的追踪参数 */
    private static final List<String> TRACKING_PARAMS = List.of(
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "from", "spm", "share_token", "share_from", "share_source", "ref", "referer",
        "wxshare", "tt_from", "isappinstalled", "timestamp", "_t", "channel", "scene"
    );

    private UrlNormalizer() {
    }

    /**
     * 归一化链接。
     *
     * @param raw 原始链接
     * @return 归一化链接；无法解析时返回原值
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        String url = raw.trim();
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                return url;
            }
            String scheme = uri.getScheme() == null ? "http" : uri.getScheme().toLowerCase(Locale.ROOT);
            host = host.toLowerCase(Locale.ROOT);
            int port = uri.getPort();
            if (("http".equals(scheme) && port == 80) || ("https".equals(scheme) && port == 443)) {
                port = -1;
            }
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (path.length() > 1 && path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }
            StringBuilder sb = new StringBuilder(96);
            sb.append(scheme).append("://").append(host);
            if (port > 0) {
                sb.append(':').append(port);
            }
            sb.append(path.isEmpty() ? "/" : path);
            String query = filterQuery(uri.getRawQuery());
            if (!query.isEmpty()) {
                sb.append('?').append(query);
            }
            return sb.toString();
        } catch (Exception e) {
            return url;
        }
    }

    /**
     * 计算归一化链接的 SHA-256 十六进制指纹。
     *
     * @param text 归一化后的链接
     * @return 64 位小写十六进制串
     */
    public static String sha256(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest((text == null ? "" : text).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                sb.append(String.format("%02x", b & 0xFF));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("当前 JVM 不支持 SHA-256", e);
        }
    }

    /**
     * 归一化并直接取指纹。
     *
     * @param rawUrl 原始链接
     * @return SHA-256 指纹
     */
    public static String hash(String rawUrl) {
        return sha256(normalize(rawUrl));
    }

    private static String filterQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) {
            return "";
        }
        List<String> kept = new ArrayList<>();
        for (String pair : rawQuery.split("&")) {
            if (pair.isBlank()) {
                continue;
            }
            int eq = pair.indexOf('=');
            String key = (eq > 0 ? pair.substring(0, eq) : pair).toLowerCase(Locale.ROOT);
            if (TRACKING_PARAMS.contains(key)) {
                continue;
            }
            kept.add(pair);
        }
        Collections.sort(kept);
        return String.join("&", kept);
    }
}
`);

file('collect/pipeline/UrlHashDeduplicator.java', `package ${PKG}.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 链接去重前置（F-004 验收标准 7）。
 *
 * <p>三层防线：</p>
 * <ol>
 *   <li><b>批次内</b>：管道内的 HashSet（见 {@code CollectPipeline}）</li>
 *   <li><b>跨批次</b>：本类 —— Redis {@code SETNX} 带 TTL，快速拦截近期重复链接，并给出准确的去重计数</li>
 *   <li><b>最终一致</b>：Doris {@code Unique Key}，即使前两层漏判也会被吸收，不会重复入库</li>
 * </ol>
 *
 * <p>Redis 不可用时降级为进程内近似去重，链路不中断。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UrlHashDeduplicator {

    private static final String KEY_PREFIX = "yq:collect:dedup:";

    private final YqCollectProperties props;

    private final Map<String, Long> localCache = new ConcurrentHashMap<>();

    private final Deque<String> localOrder = new ConcurrentLinkedDeque<>();

    /**
     * 是否为首次出现。
     *
     * @param urlHash 链接指纹
     * @return true 表示首次出现（可进入后续环节）
     */
    public boolean firstSeen(String urlHash) {
        if (urlHash == null || urlHash.isBlank()) {
            return false;
        }
        if (props.getDedup().isRedisEnabled()) {
            try {
                return RedisUtils.setObjectIfAbsent(KEY_PREFIX + urlHash, "1",
                    Duration.ofSeconds(props.getDedup().getTtlSeconds()));
            } catch (Throwable e) {
                log.debug("[采集去重] Redis 不可用，降级为进程内去重: {}", e.getMessage());
            }
        }
        return localFirstSeen(urlHash);
    }

    /**
     * 回滚一次标记（写入失败时使用，避免「标记了却没入库」导致后续永久漏采）。
     *
     * @param urlHash 链接指纹
     */
    public void rollback(String urlHash) {
        if (urlHash == null || urlHash.isBlank()) {
            return;
        }
        if (props.getDedup().isRedisEnabled()) {
            try {
                RedisUtils.deleteObject(KEY_PREFIX + urlHash);
                return;
            } catch (Throwable ignored) {
                // 回落内存
            }
        }
        localCache.remove(urlHash);
    }

    private boolean localFirstSeen(String urlHash) {
        if (localCache.putIfAbsent(urlHash, System.currentTimeMillis()) != null) {
            return false;
        }
        localOrder.addLast(urlHash);
        int limit = Math.max(1000, props.getDedup().getLocalCacheSize());
        while (localCache.size() > limit) {
            String oldest = localOrder.pollFirst();
            if (oldest == null) {
                break;
            }
            localCache.remove(oldest);
        }
        return true;
    }
}
`);

file('collect/pipeline/SnapshotStore.java', `package ${PKG}.collect.pipeline;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.oss.client.OssClient;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * 采集快照留存（《技术架构说明》§5.7：HTML 原文存 MinIO，保留 30 天，供溯源复核）。
 *
 * <p>快照属于「有更好、没有也能跑」的能力：MinIO 未配置或上传失败时静默降级，只打一行 debug 日志，
 * 不影响采集主链路。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class SnapshotStore {

    private final YqCollectProperties props;

    private final ObjectProvider<OssClient> ossClientProvider;

    public SnapshotStore(YqCollectProperties props, ObjectProvider<OssClient> ossClientProvider) {
        this.props = props;
        this.ossClientProvider = ossClientProvider;
    }

    /**
     * 落一份 HTML 快照。
     *
     * @param opinion 原始舆情（读取 rawHtml）
     * @return 对象键；未开启或失败返回 null
     */
    public String store(RawOpinion opinion) {
        if (!props.getSnapshot().isEnabled() || opinion == null || opinion.getRawHtml() == null) {
            return null;
        }
        byte[] bytes = opinion.getRawHtml().getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > props.getSnapshot().getMaxBytes()) {
            log.debug("[采集快照] 内容为空或超限(={}B)，跳过", bytes.length);
            return null;
        }
        OssClient client = ossClientProvider.getIfAvailable();
        if (client == null || !client.isInitialized()) {
            log.debug("[采集快照] 对象存储未就绪，跳过快照");
            return null;
        }
        String key = props.getSnapshot().getKeyPrefix() + "/" + opinion.getCollectDate() + "/" + opinion.getUrlHash() + ".html";
        try {
            client.bucketUpload(props.getSnapshot().getBucket(), key, bytes);
            return key;
        } catch (Exception e) {
            log.warn("[采集快照] 上传失败 key={} err={}", key, e.getMessage());
            return null;
        }
    }
}
`);

file('collect/pipeline/CollectMetrics.java', `package ${PKG}.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.CollectResult;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 采集运行计数器（F-004 验收标准 8、9）。
 *
 * <p>累计 / 当日 / 去重 / 失败计数走 Redis 原子计数（多实例共享）；异常连续次数按采集单元计数。
 * Redis 不可用时降级为进程内计数，采集主链路不受影响。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CollectMetrics {

    private static final String NS = "yq:collect:metric:";

    private static final String ABNORMAL_PREFIX = "yq:collect:abnormal:";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final Map<String, AtomicLong> localCounters = new ConcurrentHashMap<>();

    /**
     * 记录一个批次的计数。
     *
     * @param result 批次结果
     */
    public void record(CollectResult result) {
        if (result == null) {
            return;
        }
        incr(NS + "total:fetched", result.getFetchedCount());
        incr(NS + "total:inserted", result.getInsertedCount());
        incr(NS + "total:dup", result.getDupCount());
        incr(NS + "total:failed", result.getFailedCount());
        incr(NS + "total:batches", 1L);
        String day = LocalDate.now().format(DAY);
        incr(NS + day + ":fetched", result.getFetchedCount());
        incr(NS + day + ":inserted", result.getInsertedCount());
        incr(NS + day + ":dup", result.getDupCount());
        incr(NS + day + ":failed", result.getFailedCount());
        incr(NS + day + ":batches", 1L);
    }

    /**
     * 累计采集条数。
     *
     * @return 条数
     */
    public long totalFetched() {
        return read(NS + "total:fetched");
    }

    /**
     * 当日计数快照。
     *
     * @return fetched / inserted / dup / failed / batches
     */
    public Map<String, Long> today() {
        String day = LocalDate.now().format(DAY);
        Map<String, Long> map = new LinkedHashMap<>();
        map.put("fetched", read(NS + day + ":fetched"));
        map.put("inserted", read(NS + day + ":inserted"));
        map.put("dup", read(NS + day + ":dup"));
        map.put("failed", read(NS + day + ":failed"));
        map.put("batches", read(NS + day + ":batches"));
        return map;
    }

    /**
     * 更新某采集单元的连续异常次数。
     *
     * @param unitKey   单元键 taskId:channelId
     * @param abnormal  本批次是否异常
     * @return 更新后的连续异常次数（正常返回 0）
     */
    public int bumpAbnormal(String unitKey, boolean abnormal) {
        if (unitKey == null || unitKey.isBlank()) {
            return 0;
        }
        String key = ABNORMAL_PREFIX + unitKey;
        if (abnormal) {
            incr(key, 1L);
            return (int) read(key);
        }
        clear(key);
        return 0;
    }

    /**
     * 连续异常次数。
     *
     * @param unitKey 单元键
     * @return 次数
     */
    public int abnormalCount(String unitKey) {
        return unitKey == null || unitKey.isBlank() ? 0 : (int) read(ABNORMAL_PREFIX + unitKey);
    }

    /**
     * 达到阈值的异常单元列表（F-004 验收标准 9）。
     *
     * @param threshold 阈值
     * @return 单元键 -> 连续异常次数
     */
    public Map<String, Integer> abnormalUnits(int threshold) {
        Map<String, Integer> result = new LinkedHashMap<>();
        try {
            Collection<String> keys = RedisUtils.keys(ABNORMAL_PREFIX + "*");
            for (String key : keys) {
                long count = RedisUtils.getAtomicValue(key);
                if (count >= threshold) {
                    result.put(key.substring(ABNORMAL_PREFIX.length()), (int) count);
                }
            }
        } catch (Throwable e) {
            log.debug("[采集指标] Redis 异常单元扫描不可用，回退进程内计数: {}", e.getMessage());
            localCounters.forEach((k, v) -> {
                if (k.startsWith(ABNORMAL_PREFIX) && v.get() >= threshold) {
                    result.put(k.substring(ABNORMAL_PREFIX.length()), (int) v.get());
                }
            });
        }
        return result;
    }

    private void incr(String key, long delta) {
        if (delta == 0) {
            return;
        }
        try {
            long v = RedisUtils.incrAtomicValue(key);
            if (v == delta) {
                RedisUtils.expire(key, Duration.ofDays(40));
            }
        } catch (Throwable e) {
            local(key).addAndGet(delta);
        }
    }

    private long read(String key) {
        try {
            return RedisUtils.getAtomicValue(key);
        } catch (Throwable e) {
            AtomicLong value = localCounters.get(key);
            return value == null ? 0L : value.get();
        }
    }

    private void clear(String key) {
        try {
            RedisUtils.deleteObject(key);
        } catch (Throwable e) {
            localCounters.remove(key);
        }
        localCounters.remove(key);
    }

    private AtomicLong local(String key) {
        return localCounters.computeIfAbsent(key, k -> new AtomicLong());
    }
}
`);

file('collect/pipeline/CollectJdbcWriter.java', `package ${PKG}.collect.pipeline;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.domain.YqCollectLog;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqCollectLogMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * JDBC 落库通道（{@code yuqing.collect.sink.mode=jdbc}）。
 *
 * <p>用途：本地没有 Doris 时，把 {@code doris} 数据源指向一个与 Doris 同名表结构的 MySQL，
 * 先跑通全链路再切 Stream Load（见 config/yq_datasource.yml 与
 * sql/yq_doris_mysql_fallback.sql）。</p>
 *
 * <p>⚠ 本类属于「采集 Worker 侧写入通道」，与业务侧 {@code IYqOpinionService}（只读）职责不同。
 * 业务代码不得引用本类。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
@DS("doris")
public class CollectJdbcWriter {

    private final YqOpinionMapper opinionMapper;

    private final YqCollectLogMapper collectLogMapper;

    /**
     * 批量写入舆情明细。
     *
     * @param list 原始舆情
     * @return 写入条数
     */
    public int insertOpinions(List<RawOpinion> list) {
        if (list == null || list.isEmpty()) {
            return 0;
        }
        List<YqOpinion> entities = new ArrayList<>(list.size());
        for (RawOpinion raw : list) {
            entities.add(toEntity(raw));
        }
        opinionMapper.insertBatch(entities, 500);
        return entities.size();
    }

    /**
     * 写入一条采集日志。
     *
     * @param row 日志实体
     * @return 写入条数
     */
    public int insertLog(YqCollectLog row) {
        if (row == null) {
            return 0;
        }
        if (row.getLogId() == null) {
            row.setLogId(IdWorker.getId());
        }
        if (row.getCreateTime() == null) {
            row.setCreateTime(java.time.LocalDateTime.now());
        }
        return collectLogMapper.insert(row) > 0 ? 1 : 0;
    }

    /**
     * 原始舆情转明细实体。
     *
     * @param raw 原始舆情
     * @return 明细实体
     */
    public static YqOpinion toEntity(RawOpinion raw) {
        YqOpinion entity = new YqOpinion();
        entity.setOpinionId(raw.getOpinionId() == null ? IdWorker.getId() : raw.getOpinionId());
        entity.setCollectDate(raw.getCollectDate());
        entity.setTaskId(raw.getTaskId());
        entity.setChannelId(raw.getChannelId());
        entity.setTitle(raw.getTitle());
        entity.setContent(raw.getContent());
        entity.setOpinionUrl(raw.getOpinionUrl());
        entity.setUrlHash(raw.getUrlHash());
        entity.setPublishTime(raw.getPublishTime());
        entity.setAuthor(raw.getAuthor());
        entity.setLikeCount(raw.getLikeCount());
        entity.setCommentCount(raw.getCommentCount());
        entity.setShareCount(raw.getShareCount());
        entity.setReadCount(raw.getReadCount());
        entity.setRegion(raw.getRegion());
        entity.setDeviceInfo(raw.getDeviceInfo());
        entity.setTopicTags(raw.getTopicTags());
        entity.setCollectSource(raw.getCollectSource());
        entity.setCollectTime(raw.getCollectTime());
        entity.setBatchNo(raw.getBatchNo());
        entity.setCleanStatus("pending");
        entity.setAnalyzeStatus("pending");
        entity.setAlertFlag("0");
        entity.setPushFlag("0");
        entity.setDelFlag("0");
        return entity;
    }
}
`);

file('collect/pipeline/DorisStreamLoader.java', `package ${PKG}.collect.pipeline;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import tools.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.json.CollectJson;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCollectLog;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 攒批落库（《技术架构说明》§4.6：Doris Stream Load 直写，无消息中间件）。
 *
 * <p>攒批策略：达到 {@code sink.batch-size}（默认 1000 条）或到 {@code sink.flush-interval-ms}
 * （默认 5s）即触发一次 Stream Load；{@code label} 以批次号 + 序号生成，
 * 重试复用同一 label，Doris 侧自动幂等吸收。</p>
 *
 * <p>三种模式：{@code stream-load}（生产）/ {@code jdbc}（本地无 Doris）/ {@code noop}（离线自测）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class DorisStreamLoader {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final YqCollectProperties props;

    private final ObjectProvider<CollectJdbcWriter> jdbcWriterProvider;

    private final Object lock = new Object();

    private final List<RawOpinion> opinionBuffer = new ArrayList<>();

    private final List<YqCollectLog> logBuffer = new ArrayList<>();

    private final AtomicLong loadedOpinions = new AtomicLong();

    private final AtomicLong loadedLogs = new AtomicLong();

    private final AtomicLong dropped = new AtomicLong();

    private final AtomicLong loadFailures = new AtomicLong();

    private final AtomicLong labelSeq = new AtomicLong();

    private final AtomicInteger feIndex = new AtomicInteger();

    private volatile HttpClient httpClient;

    private ScheduledExecutorService scheduler;

    public DorisStreamLoader(YqCollectProperties props, ObjectProvider<CollectJdbcWriter> jdbcWriterProvider) {
        this.props = props;
        this.jdbcWriterProvider = jdbcWriterProvider;
    }

    @PostConstruct
    public void start() {
        long interval = Math.max(500L, props.getSink().getFlushIntervalMs());
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "yq-collect-flush");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleWithFixedDelay(this::flushAll, interval, interval, TimeUnit.MILLISECONDS);
        log.info("[采集落库] 攒批通道已启动 mode={} batchSize={} flushInterval={}ms",
            props.getSink().getMode(), props.getSink().getBatchSize(), interval);
    }

    @PreDestroy
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        flushAll();
    }

    /**
     * 追加待落库的舆情明细。
     *
     * @param list 原始舆情
     */
    public void appendOpinions(Collection<RawOpinion> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        boolean overflow = false;
        synchronized (lock) {
            for (RawOpinion raw : list) {
                if (opinionBuffer.size() >= props.getSink().getMaxQueueSize()) {
                    overflow = true;
                    dropped.incrementAndGet();
                    continue;
                }
                raw.setPipelineStatus("inserted");
                opinionBuffer.add(raw);
            }
        }
        if (overflow) {
            log.warn("[采集落库] 队列已满({})，本批部分记录被丢弃", props.getSink().getMaxQueueSize());
        }
        if (sizeOfOpinions() >= Math.max(1, props.getSink().getBatchSize())) {
            flushAll();
        }
    }

    /**
     * 追加一条采集日志（验收标准 10）。
     *
     * @param row 日志实体
     */
    public void appendLog(YqCollectLog row) {
        if (row == null || !props.getSink().isWriteCollectLog()) {
            return;
        }
        synchronized (lock) {
            logBuffer.add(row);
        }
    }

    /**
     * 立即刷写所有缓冲。
     */
    public void flushAll() {
        List<RawOpinion> opinions;
        List<YqCollectLog> logs;
        synchronized (lock) {
            opinions = new ArrayList<>(opinionBuffer);
            opinionBuffer.clear();
            logs = new ArrayList<>(logBuffer);
            logBuffer.clear();
        }
        if (!opinions.isEmpty()) {
            writeOpinions(opinions);
        }
        for (YqCollectLog row : logs) {
            writeLog(row);
        }
    }

    /**
     * 已成功落库的明细条数。
     *
     * @return 条数
     */
    /**
     * 当前尚未刷写的正文缓冲副本（只读快照）。
     *
     * <p>供自测与排障使用：{@code mode=noop} 时数据只进缓冲不落盘，
     * 通过它能确认「到底准备写什么」，也用于验证命中关键词是否已回写。</p>
     *
     * @return 正文缓冲副本
     */
    public List<RawOpinion> bufferedOpinions() {
        synchronized (lock) {
            return new ArrayList<>(opinionBuffer);
        }
    }

    public long loadedOpinionCount() {
        return loadedOpinions.get();
    }

    /**
     * 已成功落库的日志条数。
     *
     * @return 条数
     */
    public long loadedLogCount() {
        return loadedLogs.get();
    }

    /**
     * 因队列溢出被丢弃的条数。
     *
     * @return 条数
     */
    public long droppedCount() {
        return dropped.get();
    }

    /**
     * 落库失败次数。
     *
     * @return 次数
     */
    public long loadFailureCount() {
        return loadFailures.get();
    }

    private long sizeOfOpinions() {
        synchronized (lock) {
            return opinionBuffer.size();
        }
    }

    private void writeOpinions(List<RawOpinion> batch) {
        String mode = mode();
        if ("noop".equals(mode)) {
            loadedOpinions.addAndGet(batch.size());
            log.debug("[采集落库] noop 模式，跳过写入 {} 条", batch.size());
            return;
        }
        if ("jdbc".equals(mode)) {
            CollectJdbcWriter writer = jdbcWriterProvider.getIfAvailable();
            if (writer == null) {
                loadFailures.incrementAndGet();
                log.warn("[采集落库] jdbc 模式但未装配 CollectJdbcWriter");
                return;
            }
            try {
                loadedOpinions.addAndGet(writer.insertOpinions(batch));
            } catch (Exception e) {
                loadFailures.incrementAndGet();
                log.error("[采集落库] JDBC 写入失败 {} 条: {}", batch.size(), e.getMessage());
            }
            return;
        }
        List<Map<String, Object>> rows = new ArrayList<>(batch.size());
        int overSized = 0;
        int maxBytes = Math.max(1024, props.getSink().getDoris().getMaxRecordBytes());
        for (RawOpinion raw : batch) {
            Map<String, Object> row = toOpinionRow(raw);
            String json = CollectJson.toJsonString(row);
            if (json.getBytes(StandardCharsets.UTF_8).length > maxBytes) {
                overSized++;
                dropped.incrementAndGet();
                continue;
            }
            rows.add(row);
        }
        if (overSized > 0) {
            log.warn("[采集落库] {} 条记录超过单条字节上限({}B)，已丢弃", overSized, maxBytes);
        }
        if (rows.isEmpty()) {
            return;
        }
        String label = "yq_op_" + labelSeq.incrementAndGet() + "_" + System.currentTimeMillis();
        try {
            streamLoad("yq_opinion", CollectJson.toJsonString(rows), label);
            loadedOpinions.addAndGet(rows.size());
        } catch (Exception e) {
            loadFailures.incrementAndGet();
            log.error("[采集落库] Stream Load 失败 {} 条 label={}: {}", rows.size(), label, e.getMessage());
        }
    }

    private void writeLog(YqCollectLog row) {
        String mode = mode();
        try {
            if ("noop".equals(mode)) {
                loadedLogs.incrementAndGet();
                return;
            }
            if ("jdbc".equals(mode)) {
                CollectJdbcWriter writer = jdbcWriterProvider.getIfAvailable();
                if (writer == null) {
                    loadFailures.incrementAndGet();
                    return;
                }
                loadedLogs.addAndGet(writer.insertLog(row));
                return;
            }
            Map<String, Object> map = toLogRow(row);
            String label = "yq_log_" + labelSeq.incrementAndGet() + "_" + System.currentTimeMillis();
            streamLoad("yq_collect_log", CollectJson.toJsonString(List.of(map)), label);
            loadedLogs.incrementAndGet();
        } catch (Exception e) {
            loadFailures.incrementAndGet();
            log.error("[采集落库] 采集日志写入失败 batchNo={}: {}", row.getBatchNo(), e.getMessage());
        }
    }

    /**
     * 执行一次 Doris Stream Load（HTTP PUT，label 幂等）。
     */
    private void streamLoad(String table, String jsonBody, String label) throws IOException {
        YqCollectProperties.Sink.Doris cfg = props.getSink().getDoris();
        String[] endpoints = cfg.getFeHttp().split(",");
        String fe = endpoints[Math.floorMod(feIndex.getAndIncrement(), endpoints.length)].trim();
        String url = fe + "/api/" + cfg.getDatabase() + "/" + table + "/_stream_load";
        String auth = Base64.getEncoder()
            .encodeToString((cfg.getUsername() + ":" + cfg.getPassword()).getBytes(StandardCharsets.UTF_8));
        // 注意：JDK HttpClient 把 Expect / Connection / Content-Length 列为受限头，
        // 设置会抛 IllegalArgumentException；Doris 不依赖 Expect: 100-continue，故不设置。
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(cfg.getTimeoutMs()))
            .header("Authorization", "Basic " + auth)
            .header("label", label)
            .header("format", "json")
            .header("strip_outer_array", "true")
            .header("read_json_by_line", "false")
            .header("max_filter_ratio", cfg.getMaxFilterRatio())
            .PUT(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
            .build();
        try {
            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            if (response.statusCode() != 200) {
                throw new IOException("HTTP " + response.statusCode() + " " + shorten(body));
            }
            JsonNode node = CollectJson.readTree(body);
            String status = node.path("Status").asText();
            if (!"Success".equalsIgnoreCase(status)) {
                throw new IOException("Doris 返回 " + status + " " + shorten(body));
            }
            log.debug("[采集落库] Stream Load 成功 table={} label={} rows={}", table, label, node.path("NumberLoadedRows").asText());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Stream Load 被中断", e);
        }
    }

    private Map<String, Object> toOpinionRow(RawOpinion raw) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("collect_date", raw.getCollectDate() == null ? LocalDate.now().format(DATE) : raw.getCollectDate().format(DATE));
        row.put("url_hash", raw.getUrlHash());
        row.put("opinion_id", raw.getOpinionId() == null ? IdWorker.getId() : raw.getOpinionId());
        row.put("task_id", raw.getTaskId());
        row.put("channel_id", raw.getChannelId() == null ? 0L : raw.getChannelId());
        row.put("title", blankTo(raw.getTitle(), "（无标题）"));
        row.put("content", raw.getContent());
        row.put("opinion_url", blankTo(raw.getOpinionUrl(), ""));
        row.put("publish_time", format(raw.getPublishTime()));
        row.put("author", raw.getAuthor());
        row.put("like_count", raw.getLikeCount());
        row.put("comment_count", raw.getCommentCount());
        row.put("share_count", raw.getShareCount());
        row.put("read_count", raw.getReadCount());
        row.put("region", raw.getRegion());
        row.put("device_info", raw.getDeviceInfo());
        row.put("topic_tags", raw.getTopicTags());
        row.put("collect_source", blankTo(raw.getCollectSource(), "auto"));
        row.put("collect_time", format(raw.getCollectTime() == null ? LocalDateTime.now() : raw.getCollectTime()));
        row.put("batch_no", raw.getBatchNo());
        row.put("clean_status", "pending");
        row.put("analyze_status", "pending");
        row.put("alert_flag", "0");
        row.put("push_flag", "0");
        row.put("del_flag", "0");
        return row;
    }

    private Map<String, Object> toLogRow(YqCollectLog row) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("log_id", row.getLogId() == null ? IdWorker.getId() : row.getLogId());
        map.put("task_id", row.getTaskId());
        map.put("channel_id", row.getChannelId());
        map.put("batch_no", blankTo(row.getBatchNo(), ""));
        map.put("collect_source", blankTo(row.getCollectSource(), "auto"));
        map.put("strategy", row.getStrategy());
        map.put("fetched_count", row.getFetchedCount());
        map.put("inserted_count", row.getInsertedCount());
        map.put("dup_count", row.getDupCount());
        map.put("rejected_count", row.getRejectedCount());
        map.put("failed_count", row.getFailedCount());
        map.put("cost_ms", row.getCostMs());
        map.put("result_status", blankTo(row.getResultStatus(), "success"));
        map.put("fail_reason", row.getFailReason());
        map.put("create_time", format(row.getCreateTime() == null ? LocalDateTime.now() : row.getCreateTime()));
        return map;
    }

    private String mode() {
        String mode = props.getSink().getMode();
        return mode == null ? "stream-load" : mode.trim().toLowerCase();
    }

    private String format(LocalDateTime time) {
        return time == null ? null : time.format(DATETIME);
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String shorten(String body) {
        if (body == null) {
            return "";
        }
        return body.length() > 500 ? body.substring(0, 500) : body;
    }

    private HttpClient client() {
        HttpClient c = httpClient;
        if (c == null) {
            synchronized (this) {
                c = httpClient;
                if (c == null) {
                    c = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .version(HttpClient.Version.HTTP_1_1)
                        .build();
                    httpClient = c;
                }
            }
        }
        return c;
    }
}
`);

file('collect/pipeline/CollectPipeline.java', `package ${PKG}.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.adapter.AdapterContext;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.adapter.AdapterSpec;
import org.dromara.yuqing.collect.adapter.SiteAdapter;
import org.dromara.yuqing.collect.anti.BlockDetector;
import org.dromara.yuqing.collect.clean.CleanVerdict;
import org.dromara.yuqing.collect.clean.CrossChannelMerger;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.guard.CollectHealthGuard;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCollectLog;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 采集管道：抓取 → 解析 → 去重 → 快照 → 攒批落库 → 记录日志。
 *
 * <p>对齐《技术架构说明》§5.2 的 {@code Pipeline（清洗 → 去重 → 快照落 MinIO → 攒批 Stream Load 入 Doris）}；
 * 深度降噪与状态流转属 F-006 净化去重，本模块只做「无效内容剔除 + 链接去重 + 批次日志」。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CollectPipeline {

    private final YqCollectProperties props;

    private final AdapterRegistry adapterRegistry;

    private final UrlHashDeduplicator deduplicator;

    private final SnapshotStore snapshotStore;

    private final DorisStreamLoader sink;

    private final CollectMetrics metrics;

    private final BlockDetector blockDetector;

    private final CollectHealthGuard guard;

    /** 净化降噪引擎（F-006）；开关关闭时管线跳过净化，只做去重 */
    private final NoiseEngine noiseEngine;

    /**
     * 执行一个采集单元（一个任务 × 一个渠道）。
     *
     * @param unit 采集单元
     * @return 批次结果（同时写入采集日志）
     */
    public CollectResult run(CollectUnit unit) {
        CollectResult result = new CollectResult();
        result.setBatchNo(unit.getBatchNo());
        result.setTaskId(unit.getTaskId());
        result.setTaskName(unit.getTaskName());
        result.setChannelId(unit.getChannelId());
        result.setChannelName(unit.getChannelName());
        result.setStrategy(unit.getCollectStrategy());
        result.setCollectTime(LocalDateTime.now());
        long start = System.currentTimeMillis();
        try {
            if (!unit.dispatchable()) {
                result.addFailure(unit.getSkipReason());
            } else {
                doRun(unit, result);
            }
        } catch (Exception e) {
            result.addFailure(rootMessage(e));
            log.warn("[采集] 批次执行异常 batchNo={} task={} channel={}: {}",
                unit.getBatchNo(), unit.getTaskId(), unit.getChannelId(), rootMessage(e));
        } finally {
            result.setCostMs(System.currentTimeMillis() - start);
            result.settle();
            sink.appendLog(toLog(result));
            metrics.record(result);
            guard.evaluate(result);
        }
        return result;
    }

    private void doRun(CollectUnit unit, CollectResult result) throws Exception {
        AdapterSpec spec = adapterRegistry.spec(unit.getAdapterCode());
        SiteAdapter adapter = adapterRegistry.adapterFor(spec);
        AdapterContext context = new AdapterContext(unit.getBatchNo(),
            Math.max(1, props.getMaxRecordsPerBatch()),
            Math.max(1, Math.min(spec.maxPage(), props.getMaxPagesPerBatch())),
            unit.getWatermark());
        List<RawOpinion> fetched = adapter.fetch(unit, spec, context);
        result.setFetchedCount(fetched.size());
        List<RawOpinion> accepted = dedupeAndFilter(fetched, result, unit);
        result.setInsertedCount(accepted.size());
        // 攒批交由 sink 定时 / 定量触发，避免每批都刷写而失去攒批收益
        sink.appendOpinions(accepted);
    }

    /**
     * 原始数据落库 + 链接去重（PRD §6.2 的 {@code YqCollectService.saveRaw}）。
     *
     * <p>供「链接导入 F-005」「文件导入」等非爬虫入口复用同一条去重与落库链路。</p>
     *
     * @param unit    采集单元（提供任务/渠道/批次溯源信息）
     * @param rawList 原始舆情
     * @return 批次结果
     */
    public CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList) {
        CollectResult result = new CollectResult();
        result.setBatchNo(unit.getBatchNo());
        result.setTaskId(unit.getTaskId());
        result.setChannelId(unit.getChannelId());
        result.setStrategy(unit.getCollectStrategy());
        result.setCollectTime(LocalDateTime.now());
        long start = System.currentTimeMillis();
        try {
            List<RawOpinion> list = rawList == null ? List.of() : rawList;
            result.setFetchedCount(list.size());
            List<RawOpinion> accepted = dedupeAndFilter(list, result, unit);
            result.setInsertedCount(accepted.size());
            sink.appendOpinions(accepted);
        } catch (Exception e) {
            result.addFailure(rootMessage(e));
        } finally {
            result.setCostMs(System.currentTimeMillis() - start);
            result.settle();
            sink.appendLog(toLog(result));
            metrics.record(result);
            guard.evaluate(result);
        }
        return result;
    }

    /**
     * 归一化链接 → 关键词组合条件过滤 → 净化降噪（F-006）→ 跨批次去重 → 按天跨渠道合并 → 快照留存。
     *
     * <p><b>顺序有讲究：</b>关键词过滤最先（不匹配的条目不占用去重配额），
     * 净化降噪次之（脏数据不该消耗快照存储与写入配额），去重放最后——
     * 先去重再净化会让「首次进来被判垃圾、下次就不再进来」的错误永久化。</p>
     *
     * @param unit 采集单元（提供关键词匹配器）；为空或未配置关键词时不启用过滤
     */
    private List<RawOpinion> dedupeAndFilter(List<RawOpinion> fetched, CollectResult result, CollectUnit unit) {
        KeywordMatcher matcher = unit == null ? null : unit.getMatcher();
        boolean filtering = matcher != null && matcher.filterEnabled();
        boolean cleaning = props.getClean().isEnabled();
        LocalDate today = LocalDate.now();
        List<RawOpinion> candidates = new ArrayList<>(fetched.size());
        for (RawOpinion raw : fetched) {
            if (StringUtils.isBlank(raw.getOpinionUrl())) {
                continue;
            }
            String normalized = UrlNormalizer.normalize(raw.getOpinionUrl());
            raw.setOpinionUrl(normalized);
            String hash = UrlNormalizer.sha256(normalized);
            raw.setUrlHash(hash);
            /* 按天去重的分区键：采集日缺省时补今天，保证 (collect_date, url_hash) 永不为空 */
            if (raw.getCollectDate() == null) {
                raw.setCollectDate(today);
            }
            /* 关键词组合条件过滤（P0-1）：检索词只是「召回」，命中全部组且不含排除词才允许进 Doris。
               不通过的条目不占用去重配额，直接丢弃并计入降噪剔除（yq_collect_log.rejected_count）。 */
            if (filtering) {
                String keywordText = keywordText(raw);
                if (!matcher.accept(keywordText)) {
                    result.setRejectedCount(result.getRejectedCount() + 1);
                    result.setFilteredCount(result.getFilteredCount() + 1);
                    continue;
                }
                String hits = matcher.hitOf(keywordText);
                if (StringUtils.isNotBlank(hits)) {
                    raw.setHitKeywords(hits);
                }
            }
            if (cleaning) {
                /* F-006 净化降噪：正文标准化 + 七类规则判定，并回填三态清洗状态 */
                CleanVerdict verdict = noiseEngine.evaluate(raw);
                raw.setTitle(verdict.getPurifiedTitle());
                raw.setContent(verdict.getPurifiedContent());
                raw.setCleanStatus(verdict.getCleanStatus());
                raw.setNoiseReason(verdict.getNoiseReason());
                raw.setCleanTime(LocalDateTime.now());
                if (verdict.isRejected()) {
                    result.setRejectedCount(result.getRejectedCount() + 1);
                    continue;
                }
            } else if (blockDetector.looksLikeTrap(raw.getTitle(), 4) && blockDetector.looksLikeTrap(raw.getContent(), 10)) {
                // 净化开关关闭时的兜底：只挡空壳记录
                result.setRejectedCount(result.getRejectedCount() + 1);
                continue;
            }
            candidates.add(raw);
        }
        /* 按天跨渠道合并（验收标准 8）：同一 (采集日, 链接) 只保留首条，
           其余渠道ID补进首条的 dup_channel_ids 后再做跨批次去重。 */
        CrossChannelMerger.MergeOutcome merged = CrossChannelMerger.merge(candidates);
        result.setDupCount(result.getDupCount() + merged.getDupCount());
        result.setDupChannelCount(result.getDupChannelCount() + merged.getDupChannelCount());
        List<RawOpinion> accepted = new ArrayList<>(merged.getKeepers().size());
        for (RawOpinion keeper : merged.getKeepers()) {
            if (!deduplicator.firstSeen(keeper.getUrlHash())) {
                result.setDupCount(result.getDupCount() + 1);
                continue;
            }
            keeper.setSnapshotKey(snapshotStore.store(keeper));
            accepted.add(keeper);
        }
        return accepted;
    }

    /**
     * 关键词匹配用的文本：标题 + 正文 + 话题标签 + 发布地域。
     *
     * <p>把地域纳入匹配范围，组合表达式里的「地区组」才能对政务站内搜索结果生效
     * （这类站点常把地域放在独立字段而不是正文里）。</p>
     */
    private static String keywordText(RawOpinion raw) {
        StringBuilder sb = new StringBuilder();
        appendPart(sb, raw.getTitle());
        appendPart(sb, raw.getContent());
        appendPart(sb, raw.getTopicTags());
        appendPart(sb, raw.getRegion());
        return sb.toString();
    }

    private static void appendPart(StringBuilder sb, String part) {
        if (part != null && !part.isEmpty()) {
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(part);
        }
    }

    private void snapshotFlush() {
        try {
            sink.flushAll();
        } catch (Exception e) {
            log.debug("[采集] 收尾刷写失败: {}", e.getMessage());
        }
    }

    /**
     * 立即刷写攒批缓冲（供手动触发 / 关停前调用）。
     */
    public void flush() {
        snapshotFlush();
    }

    /**
     * 批次结果转采集日志（验收标准 10：任务、渠道、批次、结果、耗时、失败原因逐条记录）。
     *
     * @param result 批次结果
     * @return 日志实体
     */
    public YqCollectLog toLog(CollectResult result) {
        YqCollectLog row = new YqCollectLog();
        row.setTaskId(result.getTaskId());
        row.setChannelId(result.getChannelId());
        row.setBatchNo(result.getBatchNo());
        row.setCollectSource("auto");
        row.setStrategy(result.getStrategy());
        row.setFetchedCount(result.getFetchedCount());
        row.setInsertedCount(result.getInsertedCount());
        row.setDupCount(result.getDupCount());
        row.setRejectedCount(result.getRejectedCount());
        row.setFailedCount(result.getFailedCount());
        row.setCostMs((int) Math.min(Integer.MAX_VALUE, result.getCostMs()));
        row.setResultStatus(result.getResultStatus());
        row.setFailReason(result.getFailReason());
        row.setCreateTime(result.getCollectTime() == null ? LocalDateTime.now() : result.getCollectTime());
        return row;
    }

    /**
     * 提取异常根因信息。
     *
     * @param e 异常
     * @return 可读原因
     */
    public static String rootMessage(Throwable e) {
        Throwable cur = e;
        String message = e.getMessage();
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
            if (!StringUtils.isBlank(cur.getMessage())) {
                message = cur.getMessage();
            }
        }
        String type = e.getClass().getSimpleName();
        return StringUtils.isBlank(message) ? type : type + ": " + message;
    }
}
`);

/* ==========================================================================
 * 7. 调度模型 / 执行器 / 频率校验
 * ========================================================================== */

file('collect/model/DispatchSummary.java', `package ${PKG}.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 一次调度下发的汇总结果。
 *
 * @author ruoyi
 */
@Data
public class DispatchSummary implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 调度批次号 */
    private String batchNo;

    /** 引擎是否开启 */
    private boolean engineEnabled;

    /** 扫描到的任务数 */
    private int taskCount;

    /** 下发的采集单元数 */
    private int unitCount;

    /** 因参数/配置问题未实际发起采集的单元数（原因见各单元日志） */
    private int skippedCount;

    private int successCount;

    private int partialCount;

    private int failedCount;

    /** 耗时毫秒 */
    private long costMs;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    /** 可读说明 */
    private String message;

    /** 逐单元明细 */
    private List<CollectResult> details = new ArrayList<>();
}
`);

file('collect/schedule/CollectExecutor.java', `package ${PKG}.collect.schedule;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 采集单元执行线程池。
 *
 * <p>池大小由 {@code yuqing.collect.unit-concurrency} 控制；线程为守护线程，不阻塞进程退出。
 * 真正的「单渠道并发上限」由 {@code ChannelRateLimiter} 的分布式信号量保证，
 * 本池只决定 Worker 的整体吞吐。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class CollectExecutor {

    private final YqCollectProperties props;

    private final AtomicInteger seq = new AtomicInteger();

    private volatile ExecutorService pool;

    public CollectExecutor(YqCollectProperties props) {
        this.props = props;
    }

    /**
     * 获取线程池（懒创建）。
     *
     * @return 线程池
     */
    public ExecutorService pool() {
        ExecutorService current = pool;
        if (current == null) {
            synchronized (this) {
                current = pool;
                if (current == null) {
                    int size = Math.max(1, props.getUnitConcurrency());
                    ThreadFactory factory = r -> {
                        Thread t = new Thread(r, "yq-collect-unit-" + seq.incrementAndGet());
                        t.setDaemon(true);
                        return t;
                    };
                    current = Executors.newFixedThreadPool(size, factory);
                    pool = current;
                    log.info("[采集调度] 单元线程池已创建，并发度 {}", size);
                }
            }
        }
        return current;
    }

    @PreDestroy
    public void shutdown() {
        ExecutorService current = pool;
        if (current != null) {
            current.shutdownNow();
        }
    }
}
`);

file('collect/schedule/CollectScheduleValidator.java', `package ${PKG}.collect.schedule;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.IntervalSpec;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 采集频率校验（F-004 验收标准 2）。
 *
 * <p>规则：任务 × 渠道的生效间隔（任务级覆盖 &gt; 渠道级覆盖 &gt; 任务默认）不得低于
 * 「渠道限流下限」（请求间隔 × 并发上限）与全局最小间隔。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
public class CollectScheduleValidator {

    private final YqCollectProperties props;

    private final YqTaskChannelMapper taskChannelMapper;

    private final YqChannelMapper channelMapper;

    /**
     * 校验任务的采集频率配置。
     *
     * @param task 任务
     * @return 问题列表；空表示合法
     */
    public List<String> validate(YqTask task) {
        List<String> issues = new ArrayList<>();
        if (task == null) {
            issues.add("任务不存在");
            return issues;
        }
        Map<Long, YqChannel> channels = boundChannels(task.getTaskId());
        if (channels.isEmpty()) {
            issues.add("任务未绑定任何采集渠道，调度不会产生采集单元");
            return issues;
        }
        List<YqTaskChannel> relations = taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, task.getTaskId()));
        for (YqTaskChannel relation : relations) {
            YqChannel channel = channels.get(relation.getChannelId());
            int interval = effectiveInterval(task, relation, channel);
            List<String> one = IntervalSpec.validate(interval,
                channel == null ? null : channel.getRequestInterval(),
                channel == null ? null : channel.getConcurrencyLimit(),
                props.getMinIntervalSeconds());
            String name = channel == null ? String.valueOf(relation.getChannelId()) : channel.getChannelName();
            for (String issue : one) {
                issues.add("渠道「" + name + "」：" + issue);
            }
        }
        return issues;
    }

    /**
     * 计算生效间隔（秒）。
     *
     * @param task    任务
     * @param relation 任务渠道关联
     * @param channel 渠道
     * @return 生效间隔
     */
    public int effectiveInterval(YqTask task, YqTaskChannel relation, YqChannel channel) {
        if (relation != null && relation.getOverrideInterval() != null && relation.getOverrideInterval() > 0) {
            return relation.getOverrideInterval();
        }
        if (channel != null && channel.getIntervalOverride() != null && channel.getIntervalOverride() > 0) {
            return channel.getIntervalOverride();
        }
        return task == null || task.getCollectInterval() == null ? 0 : task.getCollectInterval();
    }

    /**
     * 任务绑定的渠道（仅启用中的）。
     *
     * @param taskId 任务ID
     * @return channelId -> channel
     */
    public Map<Long, YqChannel> boundChannels(Long taskId) {
        List<YqTaskChannel> relations = taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, taskId));
        Set<Long> ids = relations.stream().map(YqTaskChannel::getChannelId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<YqChannel> channels = channelMapper.selectByIds(ids);
        Map<Long, YqChannel> map = new LinkedHashMap<>();
        for (YqChannel channel : channels) {
            map.put(channel.getChannelId(), channel);
        }
        return map;
    }
}
`);

/* ==========================================================================
 * 8. 健康守卫（连续零采集 / 全失败告警）
 * ========================================================================== */

file('collect/guard/CollectHealthGuard.java', `package ${PKG}.collect.guard;

import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.json.CollectJson;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 采集健康守卫（F-004 验收标准 9）。
 *
 * <p>某采集单元（任务 × 渠道）连续 N 次「零采集」或「全部失败」时生成告警，
 * 并按配置通道推送异常提醒。N 由 {@code yuqing.collect.unhealthy-threshold} 控制。</p>
 *
 * <p>通知通道：{@code log}（默认，只落日志与监控）/ {@code webhook}（POST JSON）/
 * {@code wecom}（企业微信，待 F-011 推送模块落地后接入，当前降级为日志）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class CollectHealthGuard {

    private final YqCollectProperties props;

    private final CollectMetrics metrics;

    private volatile HttpClient httpClient;

    public CollectHealthGuard(YqCollectProperties props, CollectMetrics metrics) {
        this.props = props;
        this.metrics = metrics;
    }

    /**
     * 评估一个批次结果：更新连续异常计数，达到阈值则告警。
     *
     * @param result 批次结果
     */
    public void evaluate(CollectResult result) {
        if (result == null || result.getTaskId() == null) {
            return;
        }
        String unitKey = result.getTaskId() + ":" + result.getChannelId();
        int count = metrics.bumpAbnormal(unitKey, result.isAbnormal());
        int threshold = Math.max(1, props.getUnhealthyThreshold());
        if (!result.isAbnormal() || count < threshold) {
            return;
        }
        // 达到阈值时告警一次，之后每累计 N 次再告警一次，避免刷屏
        if (count != threshold && count % threshold != 0) {
            return;
        }
        String message = buildMessage(result, count);
        log.error("[采集告警] {}", message);
        notifyExternal(result, count, message);
    }

    private String buildMessage(CollectResult result, int count) {
        String reason = result.isEmptyFetch() ? "连续零采集" : "连续采集失败";
        return "采集异常：" + reason + " " + count + " 次 | 任务「" + safe(result.getTaskName(), result.getTaskId())
            + "」× 渠道「" + safe(result.getChannelName(), result.getChannelId())
            + "」| 批次 " + result.getBatchNo() + " | 原因: " + safe(result.getFailReason(), "未记录");
    }

    private void notifyExternal(CollectResult result, int count, String message) {
        if (!props.getNotify().isEnabled()) {
            return;
        }
        String channel = props.getNotify().getChannel() == null ? "log" : props.getNotify().getChannel().trim().toLowerCase();
        if ("wecom".equals(channel)) {
            log.warn("[采集告警] 企业微信通道待 F-011 推送模块接入，本次仅记录日志");
            return;
        }
        if (!"webhook".equals(channel) || props.getNotify().getWebhookUrl().isBlank()) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "yuqing.collect.abnormal");
        payload.put("taskId", result.getTaskId());
        payload.put("taskName", result.getTaskName());
        payload.put("channelId", result.getChannelId());
        payload.put("channelName", result.getChannelName());
        payload.put("batchNo", result.getBatchNo());
        payload.put("consecutiveCount", count);
        payload.put("resultStatus", result.getResultStatus());
        payload.put("message", message);
        payload.put("timestamp", System.currentTimeMillis());
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(props.getNotify().getWebhookUrl()))
                .timeout(Duration.ofMillis(props.getNotify().getTimeoutMs()))
                .header("Content-Type", "application/json;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(CollectJson.toJsonString(payload), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            log.info("[采集告警] webhook 推送完成 status={}", response.statusCode());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("[采集告警] webhook 推送失败: {}", e.getMessage());
        }
    }

    private String safe(String value, Object fallback) {
        return value == null || value.isBlank() ? String.valueOf(fallback) : value;
    }

    private HttpClient client() {
        HttpClient c = httpClient;
        if (c == null) {
            synchronized (this) {
                c = httpClient;
                if (c == null) {
                    c = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                    httpClient = c;
                }
            }
        }
        return c;
    }
}
`);

/* ==========================================================================
 * 9. 采集服务（PRD §6.2 内部接口）
 * ========================================================================== */

file('service/IYqCollectService.java', `package ${PKG}.service;

import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqTask;

import java.util.List;

/**
 * 全网自动采集与调度 Service 接口（F-004）。
 *
 * <p>对应 PRD §6.2 内部接口：{@code YqCollectService.dispatch}（按任务与渠道下发采集批次）、
 * {@code YqCollectService.saveRaw}（原始数据落库 + 链接去重）。</p>
 *
 * <p>本功能点对外无 REST 接口（见 dev-specs/F-004-collect.md）；采集日志查询与导出归 F-018 运营监控。</p>
 *
 * @author ruoyi
 */
public interface IYqCollectService {

    /**
     * 按任务与渠道下发采集批次（调度器入口，SnailJob 定时调用）。
     *
     * @return 调度汇总
     */
    DispatchSummary dispatch();

    /**
     * 只下发指定任务的采集批次。
     *
     * @param taskId 任务ID
     * @return 调度汇总
     */
    DispatchSummary dispatchTask(Long taskId);

    /**
     * 立即执行单个采集单元。
     *
     * @param taskId    任务ID
     * @param channelId 渠道ID
     * @return 批次结果
     */
    CollectResult collectOnce(Long taskId, Long channelId);

    /**
     * 原始数据落库 + 链接去重（供链接导入、文件导入等非爬虫入口复用）。
     *
     * @param unit    采集单元
     * @param rawList 原始舆情
     * @return 批次结果
     */
    CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList);

    /**
     * 采集运行概览（验收标准 8）。
     *
     * @return 概览
     */
    CollectOverview overview();

    /**
     * 预览某任务可下发的采集单元（不执行），含跳过原因。
     *
     * @param taskId 任务ID，为空时预览全部启用任务
     * @return 采集单元列表
     */
    List<CollectUnit> planUnits(Long taskId);

    /**
     * 校验任务的采集频率是否满足渠道限流下限（验收标准 2）。
     *
     * @param task 任务
     * @return 问题列表
     */
    List<String> validateSchedule(YqTask task);

    /**
     * 校验关键词组合表达式语法（F-002 验收标准 3：提供语法校验并给出错误位置）。
     *
     * @param expression 表达式，如 {@code (辽宁|沈阳)+(药监局|药品监管)}
     * @return 问题列表（每条自带列位置）；空列表表示合法
     */
    List<String> validateKeywordExpression(String expression);
}
`);

file('service/impl/YqCollectServiceImpl.java', `package ${PKG}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.keyword.ExcludeRule;
import org.dromara.yuqing.collect.keyword.KeywordExpression;
import org.dromara.yuqing.collect.keyword.KeywordExpressionException;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.keyword.KeywordSpec;
import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.collect.model.IntervalSpec;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.dromara.yuqing.collect.pipeline.CollectPipeline;
import org.dromara.yuqing.collect.schedule.CollectExecutor;
import org.dromara.yuqing.collect.schedule.CollectScheduleValidator;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import org.dromara.yuqing.mapper.YqNoiseRuleMapper;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.service.IYqCollectService;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * 全网自动采集与调度 Service 业务层处理（F-004）。
 *
 * <p>调度模型（《技术架构说明》§5.4）：</p>
 * <ul>
 *   <li><b>任务矩阵</b>：任务 × 渠道 × 频次生成采集单元</li>
 *   <li><b>增量水位线</b>：按渠道的 {@code last_collect_time} 只抓新内容</li>
 *   <li><b>分片执行</b>：同一任务的多个渠道分片到线程池并发下发</li>
 *   <li><b>优先级 + 限流</b>：Redis 令牌桶按渠道配 QPS（见 ChannelRateLimiter）</li>
 *   <li><b>幂等</b>：url_hash 唯一键 + Stream Load label</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqCollectServiceImpl implements IYqCollectService {

    private static final DateTimeFormatter BATCH_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private static final String STATUS_ENABLED = "0";

    /** 关键词类型：组合表达式（yq_keyword_type） */
    private static final String COMBO_TYPE = "combo";

    /** 关键词类型：否定词 / 排除词（yq_keyword_type） */
    private static final String NEGATIVE_TYPE = "negative";

    /** 降噪规则匹配方式：正则（yq_match_type） */
    private static final String MATCH_TYPE_REGEX = "regex";

    private final YqCollectProperties props;

    private final YqTaskMapper taskMapper;

    private final YqTaskChannelMapper taskChannelMapper;

    private final YqTaskKeywordMapper taskKeywordMapper;

    private final YqKeywordMapper keywordMapper;

    private final YqChannelMapper channelMapper;

    private final YqNoiseRuleMapper noiseRuleMapper;

    private final AdapterRegistry adapterRegistry;

    private final CollectPipeline pipeline;

    private final CollectMetrics metrics;

    private final CollectExecutor executor;

    private final CollectScheduleValidator scheduleValidator;

    @Override
    public DispatchSummary dispatch() {
        return doDispatch(null, null);
    }

    @Override
    public DispatchSummary dispatchTask(Long taskId) {
        return doDispatch(taskId, null);
    }

    @Override
    public CollectResult collectOnce(Long taskId, Long channelId) {
        CollectUnit unit = buildUnit(taskMapper.selectById(taskId), channelId, newBatchNo(), true);
        if (unit == null) {
            CollectResult result = new CollectResult();
            result.setBatchNo(newBatchNo());
            result.setTaskId(taskId);
            result.setChannelId(channelId);
            result.setCollectTime(LocalDateTime.now());
            result.addFailure("任务或渠道不存在，或任务未绑定该渠道");
            result.settle();
            return result;
        }
        unit.setSkipReason(null);
        CollectResult result = pipeline.run(unit);
        pipeline.flush();
        return result;
    }

    @Override
    public CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList) {
        CollectResult result = pipeline.saveRaw(unit, rawList);
        pipeline.flush();
        return result;
    }

    @Override
    public CollectOverview overview() {
        CollectOverview overview = new CollectOverview();
        overview.setEngineEnabled(props.isEnabled());
        overview.setSinkMode(props.getSink().getMode());
        overview.setDedupMode(props.getDedup().isRedisEnabled() ? "redis+memory" : "memory");
        overview.setAdapterCount(adapterRegistry.codes().size());
        overview.setServerTime(LocalDateTime.now());
        overview.setTotalFetched(metrics.totalFetched());
        Map<String, Long> today = metrics.today();
        overview.setTodayFetched(today.getOrDefault("fetched", 0L));
        overview.setTodayInserted(today.getOrDefault("inserted", 0L));
        overview.setTodayDup(today.getOrDefault("dup", 0L));
        overview.setTodayFailed(today.getOrDefault("failed", 0L));
        overview.setTodayBatches(today.getOrDefault("batches", 0L));

        List<YqTask> tasks = taskMapper.selectList(new LambdaQueryWrapper<YqTask>()
            .orderByDesc(YqTask::getTaskId));
        overview.setEnabledTasks(tasks.stream().filter(t -> STATUS_ENABLED.equals(t.getStatus())).count());
        overview.setEnabledChannels(channelMapper.selectCount(new LambdaQueryWrapper<YqChannel>()
            .eq(YqChannel::getStatus, STATUS_ENABLED)));
        Map<Long, List<Long>> taskChannels = groupTaskChannels(
            tasks.stream().map(YqTask::getTaskId).filter(Objects::nonNull).toList());
        int threshold = Math.max(1, props.getUnhealthyThreshold());
        List<CollectOverview.TaskRunState> states = new ArrayList<>(tasks.size());
        for (YqTask task : tasks) {
            CollectOverview.TaskRunState state = new CollectOverview.TaskRunState();
            state.setTaskId(task.getTaskId());
            state.setTaskName(task.getTaskName());
            state.setLastScheduleTime(task.getLastScheduleTime());
            int maxAbnormal = 0;
            for (Long channelId : taskChannels.getOrDefault(task.getTaskId(), List.of())) {
                maxAbnormal = Math.max(maxAbnormal, metrics.abnormalCount(task.getTaskId() + ":" + channelId));
            }
            state.setConsecutiveAbnormal(maxAbnormal);
            state.setAbnormal("0".equals(task.getStatus()) && maxAbnormal >= threshold);
            states.add(state);
        }
        overview.setTaskStates(states);
        overview.setUnhealthyUnits(new ArrayList<>(metrics.abnormalUnits(threshold).keySet()));
        return overview;
    }

    @Override
    public List<CollectUnit> planUnits(Long taskId) {
        List<YqTask> tasks = loadTasks(taskId);
        String batchNo = newBatchNo();
        List<CollectUnit> units = new ArrayList<>();
        for (YqTask task : tasks) {
            units.addAll(buildUnits(task, batchNo, null, false));
        }
        return units;
    }

    @Override
    public List<String> validateSchedule(YqTask task) {
        return scheduleValidator.validate(task);
    }

    @Override
    public List<String> validateKeywordExpression(String expression) {
        return KeywordExpression.validate(expression);
    }

    /* ------------------------------------------------------------------ 内部实现 */

    private DispatchSummary doDispatch(Long taskId, Long channelId) {
        DispatchSummary summary = new DispatchSummary();
        summary.setBatchNo(newBatchNo());
        summary.setStartedAt(LocalDateTime.now());
        summary.setEngineEnabled(props.isEnabled());
        long start = System.currentTimeMillis();
        if (!props.isEnabled()) {
            summary.setCostMs(System.currentTimeMillis() - start);
            summary.setFinishedAt(LocalDateTime.now());
            summary.setMessage("采集引擎未开启（yuqing.collect.enabled=false），本次调度未下发任何请求");
            log.warn(summary.getMessage());
            return summary;
        }
        List<YqTask> tasks = loadTasks(taskId);
        summary.setTaskCount(tasks.size());
        int maxUnits = Math.max(1, props.getMaxUnitsPerDispatch());
        for (YqTask task : tasks) {
            if (summary.getUnitCount() >= maxUnits) {
                break;
            }
            List<CollectUnit> units = buildUnits(task, summary.getBatchNo(), channelId, true);
            if (units.isEmpty()) {
                continue;
            }
            if (summary.getUnitCount() + units.size() > maxUnits) {
                units = new ArrayList<>(units.subList(0, maxUnits - summary.getUnitCount()));
            }
            for (CollectUnit unit : units) {
                if (!unit.dispatchable()) {
                    summary.setSkippedCount(summary.getSkippedCount() + 1);
                }
            }
            summary.setUnitCount(summary.getUnitCount() + units.size());
            runUnits(units, summary);
            touchTask(task.getTaskId());
        }
        summary.setCostMs(System.currentTimeMillis() - start);
        summary.setFinishedAt(LocalDateTime.now());
        summary.setMessage("下发单元 " + summary.getUnitCount() + " 个（跳过 " + summary.getSkippedCount()
            + "），成功 " + summary.getSuccessCount() + " / 部分 " + summary.getPartialCount()
            + " / 失败 " + summary.getFailedCount() + "，耗时 " + summary.getCostMs() + "ms");
        log.info("[采集调度] {}", summary.getMessage());
        return summary;
    }

    /**
     * 并发执行一批采集单元；单单元失败不影响其它单元（验收标准 5）。
     */
    private void runUnits(List<CollectUnit> units, DispatchSummary summary) {
        List<Callable<CollectResult>> callables = units.stream()
            .map(unit -> (Callable<CollectResult>) () -> pipeline.run(unit))
            .collect(Collectors.toList());
        List<Future<CollectResult>> futures = new ArrayList<>(callables.size());
        try {
            for (Callable<CollectResult> callable : callables) {
                futures.add(executor.pool().submit(callable));
            }
        } catch (Exception e) {
            log.error("[采集调度] 提交采集单元失败: {}", CollectPipeline.rootMessage(e));
        }
        for (int i = 0; i < futures.size(); i++) {
            CollectUnit unit = units.get(i);
            try {
                CollectResult result = futures.get(i).get();
                summary.getDetails().add(result);
                if ("success".equals(result.getResultStatus())) {
                    summary.setSuccessCount(summary.getSuccessCount() + 1);
                } else if ("partial".equals(result.getResultStatus())) {
                    summary.setPartialCount(summary.getPartialCount() + 1);
                } else {
                    summary.setFailedCount(summary.getFailedCount() + 1);
                }
                touchChannel(unit.getChannelId());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                summary.setFailedCount(summary.getFailedCount() + 1);
                log.warn("[采集调度] 调度被中断");
                return;
            } catch (Exception e) {
                summary.setFailedCount(summary.getFailedCount() + 1);
                log.warn("[采集调度] 单元执行异常 task={} channel={}: {}",
                    unit.getTaskId(), unit.getChannelId(), CollectPipeline.rootMessage(e));
            }
        }
    }

    private List<YqTask> loadTasks(Long taskId) {
        LambdaQueryWrapper<YqTask> wrapper = new LambdaQueryWrapper<>();
        if (taskId != null) {
            wrapper.eq(YqTask::getTaskId, taskId);
        } else {
            LocalDateTime now = LocalDateTime.now();
            wrapper.eq(YqTask::getStatus, STATUS_ENABLED);
            wrapper.and(w -> w.isNull(YqTask::getStartTime).or().le(YqTask::getStartTime, now));
            wrapper.and(w -> w.isNull(YqTask::getEndTime).or().ge(YqTask::getEndTime, now));
            wrapper.orderByDesc(YqTask::getTaskId);
        }
        List<YqTask> tasks = taskMapper.selectList(wrapper);
        int limit = Math.max(1, props.getMaxTasksPerDispatch());
        return tasks.size() > limit ? new ArrayList<>(tasks.subList(0, limit)) : tasks;
    }

    /**
     * 构建一个任务下的采集单元。
     *
     * @param task      任务
     * @param channelId 指定渠道；为空表示任务绑定的全部渠道
     * @param batchNo   批次号
     * @param dueCheck  是否做「是否到期」判定
     * @return 采集单元
     */
    private CollectUnit buildUnit(YqTask task, Long channelId, String batchNo, boolean dueCheck) {
        if (task == null) {
            return null;
        }
        List<CollectUnit> units = buildUnits(task, batchNo, channelId, dueCheck);
        return units.isEmpty() ? null : units.get(0);
    }

    /**
     * 构建任务下的采集单元列表。
     */
    private List<CollectUnit> buildUnits(YqTask task, String batchNo, Long onlyChannelId, boolean dueCheck) {
        List<CollectUnit> units = new ArrayList<>();
        if (task == null) {
            return units;
        }
        LocalDateTime now = LocalDateTime.now();
        if (dueCheck) {
            if (!STATUS_ENABLED.equals(task.getStatus())) {
                return units;
            }
            if (task.getStartTime() != null && task.getStartTime().isAfter(now)) {
                return units;
            }
            if (task.getEndTime() != null && task.getEndTime().isBefore(now)) {
                return units;
            }
        }
        LambdaQueryWrapper<YqTaskChannel> relationQuery = new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, task.getTaskId());
        if (onlyChannelId != null) {
            relationQuery.eq(YqTaskChannel::getChannelId, onlyChannelId);
        }
        List<YqTaskChannel> relations = taskChannelMapper.selectList(relationQuery);
        if (relations.isEmpty()) {
            return units;
        }
        KeywordMatcher matcher = buildMatcher(task.getTaskId());
        Map<Long, YqChannel> channels = loadChannels(relations);
        for (YqTaskChannel relation : relations) {
            YqChannel channel = channels.get(relation.getChannelId());
            CollectUnit unit = new CollectUnit();
            unit.setTaskId(task.getTaskId());
            unit.setTaskName(task.getTaskName());
            unit.setChannelId(relation.getChannelId());
            unit.setBatchNo(batchNo);
            unit.setMatcher(matcher);
            unit.setCollectStrategy(task.getCollectStrategy());
            if (channel == null) {
                unit.setSkipReason("渠道不存在或已删除: " + relation.getChannelId());
                units.add(unit);
                continue;
            }
            unit.setChannelName(channel.getChannelName());
            unit.setAdapterCode(channel.getAdapterClass());
            unit.setConcurrencyLimit(channel.getConcurrencyLimit());
            unit.setRequestIntervalMs(channel.getRequestInterval());
            unit.setProxyGroupId(channel.getProxyGroupId());
            unit.setFailRateThreshold(channel.getFailRateThreshold());
            unit.setWatermark(channel.getLastCollectTime());
            int interval = scheduleValidator.effectiveInterval(task, relation, channel);
            unit.setIntervalSeconds(interval);
            if (!STATUS_ENABLED.equals(channel.getStatus())) {
                unit.setSkipReason("渠道已停用: " + channel.getChannelName());
            } else if (!adapterRegistry.has(unit.getAdapterCode())) {
                unit.setSkipReason("未配置站点适配器: " + unit.getAdapterCode()
                    + "（请在 yuqing.collect.adapters 中补充）");
            } else {
                List<String> issues = IntervalSpec.validate(interval, channel.getRequestInterval(),
                    channel.getConcurrencyLimit(), props.getMinIntervalSeconds());
                if (!issues.isEmpty()) {
                    unit.setSkipReason(String.join("；", issues));
                }
            }
            if (dueCheck) {
                if (unit.dispatchable() && !isDue(unit, channel)) {
                    continue;
                }
                if (!unit.dispatchable()) {
                    // 参数异常的单元仍下发一次，让日志留下可追溯的失败原因（验收标准 10）
                    units.add(unit);
                    continue;
                }
            }
            units.add(unit);
        }
        return units;
    }

    /**
     * 是否到期：以渠道最近采集时间（增量水位线）为基准。
     *
     * @param unit    采集单元
     * @param channel 渠道
     * @return true 表示应当下发
     */
    private boolean isDue(CollectUnit unit, YqChannel channel) {
        LocalDateTime last = channel.getLastCollectTime();
        if (last == null) {
            return true;
        }
        int interval = unit.getIntervalSeconds() == null ? 0 : unit.getIntervalSeconds();
        int tolerance = "realtime".equalsIgnoreCase(unit.getCollectStrategy()) ? 5 : interval;
        long elapsed = Duration.between(last, LocalDateTime.now()).getSeconds();
        return elapsed >= Math.max(1, tolerance);
    }

    /**
     * 装配任务的关键词匹配器（F-002 关键词库 → F-004 采集）。
     *
     * <p>把关键词库的完整语义（类型 / 分类 / 组合表达式 / 任务级匹配策略）落到采集侧：</p>
     * <ul>
     *   <li>{@code combineExpression} 或含括号竖线的文本 → 解析为「检索词组 + 匹配组 + 排除词」</li>
     *   <li>{@code keyword_type = negative} → 任务级排除词（经 yq_task_keyword 关联，天然带任务维度）</li>
     *   <li>表达式解析失败 → 记入 parseErrors 并随调度日志暴露，避免「静默采不到」</li>
     * </ul>
     *
     * @param taskId 任务ID
     * @return 关键词匹配器；任务无关键词时返回空匹配器（不过滤）
     */
    private KeywordMatcher buildMatcher(Long taskId) {
        YqCollectProperties.KeywordFilter conf = props.getKeywordFilter();
        List<YqTaskKeyword> relations = taskKeywordMapper.selectList(new LambdaQueryWrapper<YqTaskKeyword>()
            .eq(YqTaskKeyword::getTaskId, taskId));
        List<KeywordSpec> specs = new ArrayList<>();
        List<String> excludeTerms = new ArrayList<>();
        if (!relations.isEmpty()) {
            Map<Long, String> strategy = new HashMap<>();
            Set<Long> ids = new LinkedHashSet<>();
            for (YqTaskKeyword relation : relations) {
                if (relation.getKeywordId() == null) {
                    continue;
                }
                ids.add(relation.getKeywordId());
                if (StringUtils.isNotBlank(relation.getMatchStrategy())) {
                    strategy.put(relation.getKeywordId(), relation.getMatchStrategy());
                }
            }
            if (!ids.isEmpty()) {
                for (YqKeyword keyword : keywordMapper.selectByIds(ids)) {
                    if (!STATUS_ENABLED.equals(keyword.getStatus())) {
                        continue;
                    }
                    if (NEGATIVE_TYPE.equalsIgnoreCase(keyword.getKeywordType())) {
                        excludeTerms.addAll(splitTerms(keyword.getKeywordText()));
                        if (StringUtils.isNotBlank(keyword.getComboExpression())) {
                            excludeTerms.addAll(negativesOf(keyword.getComboExpression()));
                        }
                        continue;
                    }
                    specs.add(toSpec(keyword, strategy.get(keyword.getKeywordId()), conf.getSearchGroup()));
                }
            }
        }
        KeywordMatcher matcher = KeywordMatcher.builder()
            .specs(specs)
            .excludeTerms(conf.isExcludeEnabled() ? excludeTerms : new ArrayList<>())
            .rules(conf.isApplyGlobalNoise() ? loadGlobalNoise(conf.getMaxExcludeRules()) : new ArrayList<>())
            .searchGroup(conf.getSearchGroup())
            .maxSearchTerms(conf.getMaxSearchTermsPerUnit())
            .build();
        if (!matcher.getParseErrors().isEmpty()) {
            log.warn("[采集调度] 任务 {} 存在无法解析的关键词表达式：{}", taskId, matcher.getParseErrors());
        }
        return matcher;
    }

    /**
     * 关键词 → 采集规格。
     *
     * @param keyword       关键词
     * @param matchStrategy 任务级匹配策略（可为空）
     * @param searchGroup   检索词组选择策略
     * @return 规格；解析失败时返回带 parseError 的规格
     */
    private KeywordSpec toSpec(YqKeyword keyword, String matchStrategy, String searchGroup) {
        String text = keyword.getKeywordText();
        String expression = StringUtils.isNotBlank(keyword.getComboExpression())
            ? keyword.getComboExpression() : text;
        boolean combo = COMBO_TYPE.equalsIgnoreCase(keyword.getKeywordType())
            || StringUtils.isNotBlank(keyword.getComboExpression())
            || KeywordExpression.looksLikeExpression(expression);
        if (!combo) {
            /* 普通词：只做检索，不做本地过滤 —— 搜索引擎会做分词扩召回，
               强行要求原文包含该词会误杀大量真实命中。 */
            KeywordSpec spec = KeywordSpec.simple(text);
            spec.setKeywordId(keyword.getKeywordId());
            spec.setKeywordType(keyword.getKeywordType());
            spec.setKeywordCategory(keyword.getKeywordCategory());
            spec.setMatchStrategy(matchStrategy);
            return spec;
        }
        try {
            KeywordExpression parsed = KeywordExpression.parse(expression);
            KeywordSpec spec = KeywordSpec.fromExpression(keyword.getKeywordId(), text,
                keyword.getKeywordType(), keyword.getKeywordCategory(), parsed, searchGroup);
            spec.setMatchStrategy(matchStrategy);
            KeywordSpec.FilterMode mode = filterModeOf(matchStrategy);
            if (mode != null) {
                spec.setFilterMode(mode);
            }
            return spec;
        } catch (KeywordExpressionException e) {
            return KeywordSpec.failed(keyword.getKeywordId(), expression, e.getMessage());
        }
    }

    /**
     * 任务级匹配策略 → 过滤强度；无法识别返回 null 表示沿用默认。
     */
    private KeywordSpec.FilterMode filterModeOf(String matchStrategy) {
        if (StringUtils.isBlank(matchStrategy)) {
            return null;
        }
        String value = matchStrategy.trim().toLowerCase();
        return switch (value) {
            case "strict", "combo", "exact", "precise" -> KeywordSpec.FilterMode.STRICT;
            case "loose", "any" -> KeywordSpec.FilterMode.LOOSE;
            case "off", "none", "fuzzy" -> KeywordSpec.FilterMode.OFF;
            default -> null;
        };
    }

    /**
     * 全局降噪规则（默认不启用；深度降噪归 F-006）。
     */
    private List<ExcludeRule> loadGlobalNoise(int maxRules) {
        int limit = Math.max(1, maxRules);
        List<YqNoiseRule> rules = noiseRuleMapper.selectList(new LambdaQueryWrapper<YqNoiseRule>()
            .eq(YqNoiseRule::getStatus, STATUS_ENABLED)
            .orderByAsc(YqNoiseRule::getPriority)
            .last("limit " + limit));
        List<ExcludeRule> result = new ArrayList<>(rules.size());
        for (YqNoiseRule rule : rules) {
            if (StringUtils.isBlank(rule.getMatchValue())) {
                continue;
            }
            result.add(MATCH_TYPE_REGEX.equalsIgnoreCase(rule.getMatchType())
                ? ExcludeRule.regex(rule.getRuleName(), rule.getMatchValue())
                : ExcludeRule.keyword(rule.getRuleName(), rule.getMatchValue()));
        }
        return result;
    }

    /**
     * 排除词文本拆分为多条（支持 {@code 招聘|广告} 这类一行多词写法）。
     */
    private List<String> splitTerms(String text) {
        List<String> result = new ArrayList<>();
        if (StringUtils.isBlank(text)) {
            return result;
        }
        for (String part : text.split("[|,;，、；\\\\s]+")) {
            String word = part.trim();
            if (!word.isEmpty() && !result.contains(word)) {
                result.add(word);
            }
        }
        return result;
    }

    /**
     * 取组合表达式里的排除词（容错：解析失败不阻塞其它关键词）。
     */
    private List<String> negativesOf(String expression) {
        try {
            return KeywordExpression.parse(expression).getExcludes();
        } catch (KeywordExpressionException e) {
            return new ArrayList<>();
        }
    }

    private Map<Long, YqChannel> loadChannels(List<YqTaskChannel> relations) {
        Set<Long> ids = relations.stream().map(YqTaskChannel::getChannelId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, YqChannel> map = new LinkedHashMap<>();
        for (YqChannel channel : channelMapper.selectByIds(ids)) {
            map.put(channel.getChannelId(), channel);
        }
        return map;
    }

    private Map<Long, List<Long>> groupTaskChannels(List<Long> taskIds) {
        if (taskIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
                .in(YqTaskChannel::getTaskId, taskIds))
            .stream()
            .collect(Collectors.groupingBy(YqTaskChannel::getTaskId,
                Collectors.mapping(YqTaskChannel::getChannelId, Collectors.toList())));
    }

    /**
     * 回写渠道最近采集时间（增量水位线）。
     */
    private void touchChannel(Long channelId) {
        if (channelId == null) {
            return;
        }
        try {
            YqChannel update = new YqChannel();
            update.setChannelId(channelId);
            update.setLastCollectTime(LocalDateTime.now());
            channelMapper.updateById(update);
        } catch (Exception e) {
            log.warn("[采集调度] 回写渠道最近采集时间失败 channel={}: {}", channelId, e.getMessage());
        }
    }

    /**
     * 回写任务最近调度时间。
     */
    private void touchTask(Long taskId) {
        if (taskId == null) {
            return;
        }
        try {
            YqTask update = new YqTask();
            update.setTaskId(taskId);
            update.setLastScheduleTime(LocalDateTime.now());
            taskMapper.updateById(update);
        } catch (Exception e) {
            log.warn("[采集调度] 回写任务最近调度时间失败 task={}: {}", taskId, e.getMessage());
        }
    }

    private String newBatchNo() {
        return "B" + LocalDateTime.now().format(BATCH_FORMAT) + "-"
            + String.format("%03d", ThreadLocalRandom.current().nextInt(1, 1000));
    }
}
`);

/* ==========================================================================
 * 10. SnailJob 定时调度
 * ========================================================================== */

file('job/YqCollectJobExecutor.java', `package ${PKG}.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.service.IYqCollectService;
import org.springframework.stereotype.Component;

/**
 * 采集调度定时任务（SnailJob）。
 *
 * <p>在 SnailJob 控制台创建任务，执行器名填 {@code yuqingCollectDispatch}，
 * 建议调度周期 1 分钟（真正的频率控制由任务的 collect_interval 与渠道限流下限决定，
 * 调度周期只是「检查是否到期」的节拍）。</p>
 *
 * <p>⚠ 本任务不经 HTTP 暴露（dev-specs/F-004-collect.md）。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingCollectDispatch")
public class YqCollectJobExecutor {

    private final IYqCollectService collectService;

    /**
     * 执行一次采集下发。
     *
     * @param jobArgs 任务参数
     * @return 执行结果
     */
    public ExecuteResult jobExecute(JobArgs jobArgs) {
        try {
            DispatchSummary summary = collectService.dispatch();
            SnailJobLog.LOCAL.info("[采集调度] {}", summary.getMessage());
            return ExecuteResult.success(summary.getMessage());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[采集调度] 执行失败", e);
            return ExecuteResult.failure("采集调度失败: " + e.getMessage());
        }
    }
}
`);

/* ==========================================================================
 * 11. 运维接口（复用 F-018 运行监控权限）
 * ========================================================================== */

file('controller/YqCollectController.java', `package ${PKG}.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.service.IYqCollectService;
import org.dromara.yuqing.service.IYqTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 采集调度运维接口。
 *
 * <p>⚠ 范围说明：F-004 本身「无对外 REST 接口」（dev-specs/F-004-collect.md），
 * 采集日志查询 / 导出归 F-018 运营监控。这里仅暴露 3 个**运维必需**的能力
 * （概览、单元预览、手动触发），并直接复用 F-018 运行监控的按钮权限
 * {@code yuqing:monitor:list} / {@code yuqing:monitor:run}，不新增菜单与权限点。</p>
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/collect")
public class YqCollectController extends BaseController {

    private final IYqCollectService collectService;

    private final IYqTaskService taskService;

    /**
     * 采集运行概览（验收标准 8）。
     */
    @SaCheckPermission("yuqing:monitor:list")
    @GetMapping("/overview")
    public R<CollectOverview> overview() {
        return R.ok(collectService.overview());
    }

    /**
     * 预览可下发的采集单元（含跳过原因，便于排查「为什么不采」）。
     */
    @SaCheckPermission("yuqing:monitor:list")
    @GetMapping("/units")
    public R<List<CollectUnit>> units(@RequestParam(required = false) Long taskId) {
        return R.ok(collectService.planUnits(taskId));
    }

    /**
     * 手动触发采集调度。
     *
     * @param taskId 任务ID；为空时调度全部启用任务
     */
    @SaCheckPermission("yuqing:monitor:run")
    @Log(title = "采集调度", businessType = BusinessType.OTHER)
    @PostMapping("/dispatch")
    public R<DispatchSummary> dispatch(@RequestParam(required = false) Long taskId) {
        return R.ok(taskId == null ? collectService.dispatch() : collectService.dispatchTask(taskId));
    }

    /**
     * 立即采集指定任务 × 渠道（用于验证站点适配器是否可用）。
     */
    @SaCheckPermission("yuqing:monitor:run")
    @Log(title = "采集调度", businessType = BusinessType.OTHER)
    @PostMapping("/dispatch/{taskId}/{channelId}")
    public R<CollectResult> collectOnce(@PathVariable Long taskId, @PathVariable Long channelId) {
        return R.ok(collectService.collectOnce(taskId, channelId));
    }

    /**
     * 采集频率校验（验收标准 2）：返回不满足渠道限流下限的配置项。
     */
    @SaCheckPermission("yuqing:task:query")
    @GetMapping("/schedule-check/{taskId}")
    public R<List<String>> scheduleCheck(@PathVariable Long taskId) {
        YqTask task = taskService.queryById(taskId);
        return R.ok(collectService.validateSchedule(task));
    }

    /**
     * 关键词组合表达式语法校验（F-002 验收标准 3）：返回带列位置的错误说明，空列表表示合法。
     *
     * <p>关键词库录入界面在保存前调用，避免把 {@code (辽宁|沈阳)+(药监局|药品监管)} 这类
     * 表达式录错后「采集成功、入库 0 条」而无人察觉。</p>
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/keyword/validate")
    public R<List<String>> validateKeyword(@RequestParam String expression) {
        return R.ok(collectService.validateKeywordExpression(expression));
    }
}
`);

/* ==========================================================================
 * 12. 配置样例 / SQL / PC api
 * ========================================================================== */

file('config/yq_collect.yml', `# ============================================================
# 舆情监测平台 · F-004 采集调度引擎配置片段
# 追加到 ruoyi-admin/src/main/resources/application-dev.yml（或 -prod.yml）根节点下
#
# 说明（见 docs/技术架构说明.md §5）：
#   adapters 是「站点适配器」配置：新站点接入不改代码，只加配置。
#   key 必须与 yq_channel.adapter_class 一致。
#
# entryType 取值：
#   static  HttpClient + Jsoup 解析静态 HTML（A 档，最省资源）
#   api     直连 JSON 接口 / RSS / 授权 API（C 档，最稳最合规）
#   render  动态渲染 SPA（B 档）—— 未接入 Playwright 前降级为静态解析
#   mock    本地模拟数据，不发起任何外部请求（离线联调 / 冒烟）
#
# 上线前务必先把下面「示例站点」替换为真实站点，并核对合规边界
# （是否允许采集、robots 策略、是否需授权 —— PRD §8.4 待确认项 3）。
# ============================================================
yuqing:
  collect:
    # 引擎总开关。默认 false：不配置好适配器前不会发起任何外部请求
    enabled: false
    max-tasks-per-dispatch: 200
    max-units-per-dispatch: 500
    unit-concurrency: 4
    max-pages-per-batch: 20
    max-records-per-batch: 500
    # 频率下限：任务采集间隔不得低于此值，也不得低于「渠道请求间隔 × 并发上限」
    min-interval-seconds: 30
    # 连续 N 次零采集 / 全失败 → 告警（验收标准 9）
    unhealthy-threshold: 3
    fail-fast: false
    dispatch-on-startup: false
    # file: 协议读取本机文件。仅离线自测用，生产务必保持 false（安全：防本地文件读取）
    allow-local-file: false

    # 关键词链路：组合表达式（如 (辽宁|沈阳)+(药监局|药品监管)）落成
    # 「主题词检索 + 地区词本地过滤」，请求量 = 主题词个数，而不是笛卡尔积
    keyword-filter:
      # 哪一组作为检索词：last（默认，最后一组）/ first / fewest（词数最少的一组）
      search-group: last
      # 单采集单元最多用几个检索词；超出截断，避免把渠道限流打爆
      max-search-terms-per-unit: 8
      # 任务级排除词（yq_keyword.keyword_type=negative，经 yq_task_keyword 关联）
      exclude-enabled: true
      # 全局降噪规则 yq_noise_rule 默认不参与采集：它没有任务维度，直接用会误杀高价值舆情
      # 深度降噪归 F-006 净化去重
      apply-global-noise: false
      max-exclude-rules: 500

    retry:
      max-attempts: 3
      initial-backoff-ms: 1000
      multiplier: 2.0
      max-backoff-ms: 60000
      jitter-ratio: 0.3

    sink:
      # stream-load 生产 Doris；jdbc 本地无 Doris（doris 数据源指向 MySQL）；noop 只计数
      mode: noop
      batch-size: 1000
      flush-interval-ms: 5000
      max-queue-size: 200000
      write-collect-log: true
      doris:
        fe-http: http://127.0.0.1:8030
        database: yq_dwd
        username: yq_writer
        password: ChangeMe_Doris_Writer
        max-record-bytes: 2000000
        timeout-ms: 30000
        max-filter-ratio: "0.1"

    snapshot:
      enabled: false
      bucket: yuqing
      key-prefix: collect-snapshot
      retention-days: 30
      max-bytes: 3000000

    proxy:
      enabled: false
      strategy: rotate
      evict-on-failure: true
      sticky-ttl-seconds: 300
      groups:
        # 分组 key 对应 yq_channel.proxy_group_id
        # "1761400000000001017": "127.0.0.1:8888,user:pass@10.0.0.2:8080"
        "1": ""

    dedup:
      redis-enabled: true
      ttl-seconds: 259200
      local-cache-size: 200000

    notify:
      enabled: false
      channel: log
      webhook-url: ""
      timeout-ms: 5000

    # ------------------------------------------------------------
    # 站点适配器
    # ------------------------------------------------------------
    adapters:
      # === 离线自测：不发起任何外部请求，产出确定性链接便于验证去重 ===
      MOCK_DEMO:
        channel-name: 本地模拟渠道
        entry-type: mock
        mock-size: 30
        anti-bot:
          use-proxy: false
          min-interval-ms: 0
          max-interval-ms: 0

      # === A 档：静态新闻站（示例，请替换为真实站点） ===
      DEMO_NEWS_STATIC:
        channel-name: 某新闻网站
        entry-type: static
        compliance: "示例配置，上线前需确认站点 robots 与授权边界"
        list-url: "https://news.example.com/search?q={kw}&p={page}"
        list-item-selector: "div.result-item"
        page-rule:
          start: 1
          size: 20
          max-page: 5
        fields:
          title:
            selector: "h3 a"
            attr: text
          opinionUrl:
            selector: "h3 a"
            attr: href
            prefix: "https://news.example.com"
          publishTime:
            selector: "span.time"
            attr: text
            pattern: "yyyy-MM-dd HH:mm"
          author:
            selector: "span.source"
            attr: text
          region:
            selector: "span.region"
            attr: text
          likeCount:
            selector: "span.like"
            attr: text
          commentCount:
            selector: "span.comment"
            attr: text
          shareCount:
            selector: "span.share"
            attr: text
          readCount:
            selector: "span.read"
            attr: text
          topicTags:
            selector: "span.tags"
            attr: text
        detail-rule:
          enabled: true
          content-selector: "div.article-content"
          page-num: 1
        anti-bot:
          use-proxy: true
          min-interval-ms: 1500
          max-interval-ms: 4000

      # === C 档：开放接口 / 搜索聚合（最稳最合规） ===
      DEMO_SEARCH_API:
        channel-name: 某开放检索接口
        entry-type: api
        compliance: "需使用官方授权接口或公开 API"
        list-url: "https://api.example.com/search?keyword={kw}&page={page}&size=20"
        method: GET
        list-json-path: "data.list"
        headers:
          Accept: "application/json"
        page-rule:
          start: 1
          size: 20
          max-page: 3
        fields:
          title:
            jsonPath: "title"
          opinionUrl:
            jsonPath: "url"
          publishTime:
            jsonPath: "publishTime"
            pattern: "yyyy-MM-dd HH:mm:ss"
          author:
            jsonPath: "author.name"
          content:
            jsonPath: "summary"
          likeCount:
            jsonPath: "stats.like"
          commentCount:
            jsonPath: "stats.comment"
          shareCount:
            jsonPath: "stats.share"
          readCount:
            jsonPath: "stats.read"
          region:
            jsonPath: "region"
          topicTags:
            jsonPath: "tags"
        anti-bot:
          use-proxy: false
          min-interval-ms: 300
          max-interval-ms: 800

      # === B 档：动态渲染（接入 Playwright 前降级为静态解析） ===
      DEMO_RENDER_SPA:
        channel-name: 某动态渲染平台
        entry-type: render
        compliance: "渲染通道需接入 Playwright，且仅采集公开内容"
        list-url: "https://spa.example.com/search?q={kw}&page={page}"
        list-item-selector: "div.feed-item"
        page-rule:
          start: 1
          size: 20
          max-page: 3
        fields:
          title:
            selector: "div.title"
            attr: text
          opinionUrl:
            selector: "a.link"
            attr: href
          publishTime:
            selector: "div.time"
            attr: text
        detail-rule:
          enabled: false
        anti-bot:
          use-proxy: true
          min-interval-ms: 3000
          max-interval-ms: 8000
`);

file('sql/yq_doris_mysql_fallback.sql', `-- ============================================================
-- Doris 事实表的 MySQL 兼容建表（仅用于本地无 Doris 环境联调）
-- 用途: 当 yuqing.collect.sink.mode=jdbc 时，把 dynamic-datasource 的 doris 数据源
--       指向 MySQL，用本脚本在同名库中建出等价表结构，先跑通全链路。
-- ⚠ 生产环境必须用 yq_doris_schema.sql 在 Apache Doris 中建表（Unique Key + Merge-on-Write
--   才能带来去重与高吞吐写入能力，MySQL 版仅作结构等价替代）。
-- 对应产物: 9 张 Doris 事实表（含 F-009 的 yq_stats_dim / yq_stats_hot）
-- 执行顺序: 在 yq_schema.sql 之后执行
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS yq_opinion;
CREATE TABLE yq_opinion (
  collect_date     DATE          NOT NULL COMMENT '分区列=采集日期',
  url_hash         CHAR(64)      NOT NULL COMMENT '链接 SHA-256（唯一去重主键载体）',
  opinion_id       BIGINT        NOT NULL COMMENT '舆情ID',
  task_id          BIGINT        DEFAULT NULL COMMENT '所属任务ID',
  channel_id       BIGINT        NOT NULL COMMENT '来源渠道ID',
  title            VARCHAR(500)  NOT NULL COMMENT '舆情标题',
  content          MEDIUMTEXT    DEFAULT NULL COMMENT '原文内容',
  opinion_url      VARCHAR(1000) NOT NULL COMMENT '原文链接',
  publish_time     DATETIME      DEFAULT NULL COMMENT '发布时间',
  author           VARCHAR(200)  DEFAULT NULL COMMENT '发布作者/主体',
  like_count       BIGINT        DEFAULT NULL COMMENT '点赞量',
  comment_count    BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count      BIGINT        DEFAULT NULL COMMENT '转发量',
  read_count       BIGINT        DEFAULT NULL COMMENT '阅读量',
  region           VARCHAR(100)  DEFAULT NULL COMMENT '发布地域',
  device_info      VARCHAR(200)  DEFAULT NULL COMMENT '设备信息',
  topic_tags       VARCHAR(500)  DEFAULT NULL COMMENT '话题标签（逗号分隔）',
  heat_score       INT           DEFAULT NULL COMMENT '综合热度分值',
  senti_attr       VARCHAR(20)   DEFAULT NULL COMMENT '舆情属性',
  opinion_level    VARCHAR(20)   DEFAULT NULL COMMENT '舆情分级',
  risk_level       VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  spread_level     VARCHAR(20)   DEFAULT NULL COMMENT '传播量级',
  cluster_id       BIGINT        DEFAULT NULL COMMENT '事件聚合ID',
  collect_source   VARCHAR(20)   NOT NULL COMMENT '采集来源',
  collect_time     DATETIME      NOT NULL COMMENT '采集时间',
  batch_no         VARCHAR(50)   DEFAULT NULL COMMENT '采集批次号',
  clean_status     VARCHAR(20)   NOT NULL COMMENT '清洗状态',
  noise_reason     VARCHAR(200)  DEFAULT NULL COMMENT '降噪剔除原因',
  dup_channel_ids  VARCHAR(500)  DEFAULT NULL COMMENT '重复渠道ID（逗号分隔，F-006 验收标准 8）',
  clean_time       DATETIME      DEFAULT NULL COMMENT '净化时间（F-006）',
  analyze_status   VARCHAR(20)   NOT NULL COMMENT '研判状态',
  alert_flag       CHAR(1)       DEFAULT '0' COMMENT '是否已预警（0否 1是）',
  push_flag        CHAR(1)       DEFAULT '0' COMMENT '是否已推送（0否 1是）',
  del_flag         CHAR(1)       DEFAULT '0' COMMENT '删除标志（0存在 2删除）',
  PRIMARY KEY (collect_date, url_hash),
  KEY idx_yq_opinion_task (task_id),
  KEY idx_yq_opinion_channel (channel_id),
  KEY idx_yq_opinion_publish (publish_time),
  KEY idx_yq_opinion_clean (clean_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='舆情明细（Doris yq_opinion 的 MySQL 兼容镜像）';

DROP TABLE IF EXISTS yq_collect_log;
CREATE TABLE yq_collect_log (
  log_id          BIGINT        NOT NULL COMMENT '主键',
  task_id         BIGINT        DEFAULT NULL COMMENT '任务ID',
  channel_id      BIGINT        DEFAULT NULL COMMENT '渠道ID',
  batch_no        VARCHAR(50)   NOT NULL COMMENT '采集批次号',
  collect_source  VARCHAR(20)   NOT NULL COMMENT '采集来源',
  strategy        VARCHAR(20)   DEFAULT NULL COMMENT '采集策略',
  fetched_count   INT           DEFAULT NULL COMMENT '抓取条数',
  inserted_count  INT           DEFAULT NULL COMMENT '入库条数',
  dup_count       INT           DEFAULT NULL COMMENT '去重剔除条数',
  rejected_count  INT           DEFAULT NULL COMMENT '降噪剔除条数',
  failed_count    INT           DEFAULT NULL COMMENT '失败条数',
  cost_ms         INT           DEFAULT NULL COMMENT '耗时（毫秒）',
  result_status   VARCHAR(20)   NOT NULL COMMENT '执行结果',
  fail_reason     VARCHAR(1000) DEFAULT NULL COMMENT '失败原因',
  create_time     DATETIME      DEFAULT NULL COMMENT '记录时间',
  PRIMARY KEY (log_id),
  KEY idx_yq_log_task (task_id),
  KEY idx_yq_log_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采集日志（Doris yq_collect_log 的 MySQL 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_analysis;
CREATE TABLE yq_opinion_analysis (
  analysis_id     BIGINT        NOT NULL COMMENT '研判结果ID',
  opinion_id      BIGINT        NOT NULL COMMENT '舆情ID',
  topic           VARCHAR(200)  DEFAULT NULL COMMENT '主题识别结果',
  summary         VARCHAR(1000) DEFAULT NULL COMMENT '核心内容提炼',
  senti_attr      VARCHAR(20)   DEFAULT NULL COMMENT '情感倾向判定',
  risk_attr       VARCHAR(200)  DEFAULT NULL COMMENT '风险属性判定',
  risk_level      VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  opinion_level   VARCHAR(20)   DEFAULT NULL COMMENT '舆情分级',
  tags            VARCHAR(500)  DEFAULT NULL COMMENT '模型输出标签（逗号分隔）',
  match_evidence  VARCHAR(1000) DEFAULT NULL COMMENT '隐性/变体命中依据',
  suggestion      VARCHAR(1000) DEFAULT NULL COMMENT '处置建议',
  confidence      DECIMAL(5,2)  DEFAULT NULL COMMENT '置信度（%）',
  model_version   VARCHAR(50)   DEFAULT NULL COMMENT '模型版本',
  prompt_version  VARCHAR(50)   DEFAULT NULL COMMENT '提示词版本',
  analyze_version INT           DEFAULT NULL COMMENT '研判版本号',
  corrected_flag  CHAR(1)       DEFAULT '0' COMMENT '是否人工修正（0否 1是）',
  corrected_by    BIGINT        DEFAULT NULL COMMENT '修正人用户ID',
  corrected_time  DATETIME      DEFAULT NULL COMMENT '修正时间',
  analyze_time    DATETIME      DEFAULT NULL COMMENT '研判时间',
  fail_reason     VARCHAR(1000) DEFAULT NULL COMMENT '失败原因',
  PRIMARY KEY (analysis_id),
  KEY idx_yq_analysis_opinion (opinion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='研判结果（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_tag;
CREATE TABLE yq_opinion_tag (
  id          BIGINT       NOT NULL COMMENT '主键',
  opinion_id  BIGINT       NOT NULL COMMENT '舆情ID',
  tag_id      BIGINT       NOT NULL COMMENT '标签ID',
  tag_source  VARCHAR(20)  NOT NULL COMMENT '标签来源',
  PRIMARY KEY (id),
  KEY idx_yq_optag_opinion (opinion_id),
  KEY idx_yq_optag_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='舆情标签关联（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_cluster;
CREATE TABLE yq_opinion_cluster (
  cluster_id       BIGINT        NOT NULL COMMENT '聚合ID,主键',
  cluster_title    VARCHAR(200)  NOT NULL COMMENT '事件标题',
  cluster_topic    VARCHAR(200)  DEFAULT NULL COMMENT '事件主题',
  opinion_count    INT           DEFAULT NULL COMMENT '关联舆情条数',
  first_time       DATETIME      DEFAULT NULL COMMENT '首次出现时间',
  last_time        DATETIME      DEFAULT NULL COMMENT '最近出现时间',
  spread_path      VARCHAR(2000) DEFAULT NULL COMMENT '传播脉络（时间轴 JSON）',
  peak_heat        INT           DEFAULT NULL COMMENT '峰值热度',
  risk_level       VARCHAR(20)   DEFAULT NULL COMMENT '事件风险等级',
  create_time      DATETIME      DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (cluster_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='事件聚合（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_opinion_metric;
CREATE TABLE yq_opinion_metric (
  metric_id     BIGINT        NOT NULL COMMENT '指标ID,主键',
  opinion_id    BIGINT        DEFAULT NULL COMMENT '舆情ID',
  snapshot_date DATE          DEFAULT NULL COMMENT '快照日期',
  like_count    BIGINT        DEFAULT NULL COMMENT '点赞量',
  comment_count BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count   BIGINT        DEFAULT NULL COMMENT '转发量',
  read_count    BIGINT        DEFAULT NULL COMMENT '阅读量',
  heat_score    INT           DEFAULT NULL COMMENT '热度分值',
  create_time   DATETIME      DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (metric_id),
  KEY idx_yq_metric_opinion (opinion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='互动快照（Doris 兼容镜像）';

DROP TABLE IF EXISTS yq_stats_daily;
CREATE TABLE yq_stats_daily (
  stats_date     DATE         NOT NULL COMMENT '统计日期',
  task_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  stats_id       BIGINT       NOT NULL COMMENT '统计ID',
  total_count    INT          DEFAULT NULL COMMENT '舆情总量',
  positive_count INT          DEFAULT NULL COMMENT '正面条数',
  neutral_count  INT          DEFAULT NULL COMMENT '中性条数',
  negative_count INT          DEFAULT NULL COMMENT '负面条数',
  dup_count      INT          DEFAULT NULL COMMENT '去重剔除条数',
  rejected_count INT          DEFAULT NULL COMMENT '降噪剔除条数',
  alert_count    INT          DEFAULT NULL COMMENT '预警条数',
  push_count     INT          DEFAULT NULL COMMENT '推送条数',
  report_count   INT          DEFAULT NULL COMMENT '报告生成数',
  read_sum       BIGINT       DEFAULT NULL COMMENT '阅读量合计',
  comment_sum    BIGINT       DEFAULT NULL COMMENT '评论量合计',
  share_sum      BIGINT       DEFAULT NULL COMMENT '转发量合计',
  like_sum       BIGINT       DEFAULT NULL COMMENT '点赞量合计',
  negative_rate  DECIMAL(5,2) DEFAULT NULL COMMENT '负面占比（%）',
  create_time    DATETIME     DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, task_id, channel_id),
  KEY idx_yq_stats_daily_date (stats_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统计预聚合（Doris yq_stats_daily 的 MySQL 兼容镜像，F-009）';

DROP TABLE IF EXISTS yq_stats_dim;
CREATE TABLE yq_stats_dim (
  stats_date     DATE         NOT NULL COMMENT '统计日期',
  dim_type       VARCHAR(20)  NOT NULL COMMENT '维度类型',
  dim_key        VARCHAR(96)  NOT NULL COMMENT '维度取值（ID 或文本）',
  time_grain     VARCHAR(10)  NOT NULL COMMENT '时间粒度',
  task_id        BIGINT       NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT       NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  dim_id         BIGINT       NOT NULL COMMENT '主键',
  dim_label      VARCHAR(200) DEFAULT NULL COMMENT '维度展示名',
  opinion_count  INT          DEFAULT NULL COMMENT '舆情条数',
  positive_count INT          DEFAULT NULL COMMENT '正面条数',
  neutral_count  INT          DEFAULT NULL COMMENT '中性条数',
  negative_count INT          DEFAULT NULL COMMENT '负面条数',
  high_risk_count INT         DEFAULT NULL COMMENT '高风险条数',
  read_sum       BIGINT       DEFAULT NULL COMMENT '阅读量合计',
  comment_sum    BIGINT       DEFAULT NULL COMMENT '评论量合计',
  share_sum      BIGINT       DEFAULT NULL COMMENT '转发量合计',
  like_sum       BIGINT       DEFAULT NULL COMMENT '点赞量合计',
  heat_sum       BIGINT       DEFAULT NULL COMMENT '热度分值合计',
  negative_rate  DECIMAL(5,2) DEFAULT NULL COMMENT '负面占比（%）',
  create_time    DATETIME     DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, dim_type, dim_key, time_grain, task_id, channel_id),
  KEY idx_yq_stats_dim_lookup (stats_date, dim_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维度分布（Doris yq_stats_dim 的 MySQL 兼容镜像，F-009）';

DROP TABLE IF EXISTS yq_stats_hot;
CREATE TABLE yq_stats_hot (
  stats_date     DATE          NOT NULL COMMENT '统计日期',
  rank_by        VARCHAR(20)   NOT NULL COMMENT '排序口径',
  rank_no        INT           NOT NULL COMMENT '名次',
  hot_id         BIGINT        NOT NULL COMMENT '主键',
  opinion_id     BIGINT        DEFAULT NULL COMMENT '舆情ID',
  task_id        BIGINT        NOT NULL DEFAULT 0 COMMENT '任务ID（0=未归属）',
  channel_id     BIGINT        NOT NULL DEFAULT 0 COMMENT '渠道ID（0=未归属）',
  title          VARCHAR(500)  DEFAULT NULL COMMENT '舆情标题',
  channel_name   VARCHAR(50)   DEFAULT NULL COMMENT '渠道名称',
  opinion_url    VARCHAR(1000) DEFAULT NULL COMMENT '原文链接',
  publish_time   DATETIME      DEFAULT NULL COMMENT '发布时间',
  senti_attr     VARCHAR(20)   DEFAULT NULL COMMENT '舆情属性',
  risk_level     VARCHAR(20)   DEFAULT NULL COMMENT '风险等级',
  read_count     BIGINT        DEFAULT NULL COMMENT '阅读量',
  comment_count  BIGINT        DEFAULT NULL COMMENT '评论量',
  share_count    BIGINT        DEFAULT NULL COMMENT '转发量',
  like_count     BIGINT        DEFAULT NULL COMMENT '点赞量',
  heat_score     INT           DEFAULT NULL COMMENT '综合热度分值',
  create_time    DATETIME      DEFAULT NULL COMMENT '聚合时间',
  PRIMARY KEY (stats_date, rank_by, rank_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='热点排行（Doris yq_stats_hot 的 MySQL 兼容镜像，F-009）';

SET FOREIGN_KEY_CHECKS = 1;
`);

file('sql/yq_demo_seed.sql', `-- ============================================================
-- F-004「全网自动采集与调度」演示数据
-- 用途: 导入后即可用 MOCK_DEMO 适配器离线跑通采集全链路（不发起任何外部请求）。
-- 执行顺序: yq_schema.sql -> yq_dict.sql -> yq_menu.sql -> 本脚本
-- 幂等: 先按主键 DELETE 再 INSERT，可重复执行
-- 说明: 演示渠道 DEMO-NEWS-STATIC 使用的是配置里的示例站点，enabled 后需替换为真实站点
-- ============================================================
SET NAMES utf8mb4;

-- 关键词分组
DELETE FROM yq_keyword_group WHERE group_id = 1761400000000008001;
INSERT INTO yq_keyword_group (group_id, group_name, del_flag, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008001, '演示关键词组', '0', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 关键词
DELETE FROM yq_keyword WHERE keyword_id IN (1761400000000008011, 1761400000000008012, 1761400000000008013, 1761400000000008014);
INSERT INTO yq_keyword (keyword_id, group_id, keyword_text, keyword_type, keyword_category, combo_expression, ref_count, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008011, 1761400000000008001, '演示企业', 'precise', 'core', NULL, 1, '0', '0', 'F-004 演示关键词（普通词：只检索不过滤）', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008012, 1761400000000008001, '服务保障', 'fuzzy', 'extended', NULL, 1, '0', '0', 'F-004 演示关键词', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008013, 1761400000000008001, '(辽宁|沈阳|大连)+(药监局|药品监管)', 'combo', 'core', '(辽宁|沈阳|大连)+(药监局|药品监管)', 1, '0', '0', 'F-004 演示组合关键词：地区组 AND 主题组，只以「药监局/药品监管」2 个主题词发起检索，地区在本地校验', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008014, 1761400000000008001, '招聘|广告|代理', 'negative', 'core', NULL, 1, '0', '0', 'F-004 演示任务级排除词（keyword_type=negative，经 yq_task_keyword 关联，避免误杀）', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 采集渠道 1：本地模拟（离线可跑）
DELETE FROM yq_channel WHERE channel_id = 1761400000000008031;
INSERT INTO yq_channel (channel_id, channel_name, channel_category, channel_domain, adapter_class, collector_id, interval_override, request_interval, concurrency_limit, proxy_group_id, ua_pool_id, fail_rate_threshold, last_collect_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008031, '本地模拟渠道', 'other', 'mock.yuqing.local', 'MOCK_DEMO', NULL, NULL, 0, 1, NULL, NULL, 30, NULL, '0', '0', 'F-004 离线自测渠道，不发起外部请求', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 采集渠道 2：静态新闻站（示例适配器，需替换为真实站点后再启用）
DELETE FROM yq_channel WHERE channel_id = 1761400000000008032;
INSERT INTO yq_channel (channel_id, channel_name, channel_category, channel_domain, adapter_class, collector_id, interval_override, request_interval, concurrency_limit, proxy_group_id, ua_pool_id, fail_rate_threshold, last_collect_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008032, '示例新闻网站', 'news', 'news.example.com', 'DEMO_NEWS_STATIC', NULL, NULL, 3000, 2, NULL, NULL, 30, NULL, '1', '0', '示例站点适配器，请替换为真实站点并确认合规边界后再启用', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 监测任务
DELETE FROM yq_task WHERE task_id = 1761400000000008021;
INSERT INTO yq_task (task_id, task_name, task_type, task_source, collect_strategy, collect_interval, level_rule_id, alert_rule_id, push_rule_id, start_time, end_time, last_schedule_time, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)
VALUES (1761400000000008021, '演示舆情监测任务', 'normal', 'pc', 'polling', 180, NULL, NULL, NULL, sysdate(), NULL, NULL, '0', '0', 'F-004 演示任务：180 秒轮询一次', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 任务-关键词关联
DELETE FROM yq_task_keyword WHERE id IN (1761400000000008041, 1761400000000008042, 1761400000000008043, 1761400000000008044);
INSERT INTO yq_task_keyword (id, task_id, keyword_id, match_strategy, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008041, 1761400000000008021, 1761400000000008011, 'fuzzy', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008042, 1761400000000008021, 1761400000000008012, 'fuzzy', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008043, 1761400000000008021, 1761400000000008013, 'strict', 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008044, 1761400000000008021, 1761400000000008014, NULL, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 任务-渠道关联
DELETE FROM yq_task_channel WHERE id IN (1761400000000008051, 1761400000000008052);
INSERT INTO yq_task_channel (id, task_id, channel_id, override_interval, create_dept, create_by, create_time, update_by, update_time)
VALUES
  (1761400000000008051, 1761400000000008021, 1761400000000008031, 60, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL),
  (1761400000000008052, 1761400000000008021, 1761400000000008032, NULL, 1761000000000000103, 1761100000000000001, sysdate(), NULL, NULL);

-- 关键词引用计数
UPDATE yq_keyword SET ref_count = (SELECT COUNT(*) FROM yq_task_keyword tk WHERE tk.keyword_id = yq_keyword.keyword_id)
WHERE keyword_id IN (1761400000000008011, 1761400000000008012, 1761400000000008013, 1761400000000008014);
`);

file('pc/api/yuqing/collect/types.ts', `/**
 * F-004 采集调度 · 运维接口类型
 */

export interface CollectOverview {
  engineEnabled: boolean;
  sinkMode: string;
  dedupMode: string;
  totalFetched: number;
  todayFetched: number;
  todayInserted: number;
  todayDup: number;
  todayFailed: number;
  todayBatches: number;
  enabledTasks: number;
  enabledChannels: number;
  adapterCount: number;
  taskStates: TaskRunState[];
  unhealthyUnits: string[];
  serverTime: string;
}

export interface TaskRunState {
  taskId: string | number;
  taskName: string;
  lastScheduleTime: string;
  lastResultStatus: string;
  consecutiveAbnormal: number;
  abnormal: boolean;
}

export interface CollectUnit {
  taskId: string | number;
  taskName: string;
  channelId: string | number;
  channelName: string;
  adapterCode: string;
  collectStrategy: string;
  intervalSeconds: number;
  batchNo: string;
  watermark: string;
  keywords: string[];
  concurrencyLimit: number;
  requestIntervalMs: number;
  skipReason: string;
}

export interface CollectResult {
  batchNo: string;
  taskId: string | number;
  taskName: string;
  channelId: string | number;
  channelName: string;
  strategy: string;
  fetchedCount: number;
  insertedCount: number;
  dupCount: number;
  rejectedCount: number;
  failedCount: number;
  costMs: number;
  resultStatus: string;
  failReason: string;
  collectTime: string;
}

export interface DispatchSummary {
  batchNo: string;
  engineEnabled: boolean;
  taskCount: number;
  unitCount: number;
  skippedCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  costMs: number;
  message: string;
  details: CollectResult[];
}
`);

file('pc/api/yuqing/collect/index.ts', `// ⚠ F-004 采集调度本身无对外 REST 接口（见 dev-specs/F-004-collect.md）；
// 这里封装的是运维必需的 3 个能力（概览 / 单元预览 / 手动触发），
// 权限复用 F-018 运行监控的 yuqing:monitor:list 与 yuqing:monitor:run。
import type { CollectOverview, CollectUnit, CollectResult, DispatchSummary } from './types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 采集运行概览（累计/当日采集、去重、失败、各任务最近执行状态）
 */
export const getCollectOverview = (): AxiosPromise<CollectOverview> => {
  return request({
    url: '/yuqing/collect/overview',
    method: 'get'
  });
};

/**
 * 预览可下发的采集单元（含跳过原因，便于排查「为什么不采」）
 */
export const listCollectUnits = (taskId?: string | number): AxiosPromise<CollectUnit[]> => {
  return request({
    url: '/yuqing/collect/units',
    method: 'get',
    params: { taskId }
  });
};

/**
 * 手动触发采集调度（taskId 为空则调度全部启用任务）
 */
export const dispatchCollect = (taskId?: string | number): AxiosPromise<DispatchSummary> => {
  return request({
    url: '/yuqing/collect/dispatch',
    method: 'post',
    params: { taskId }
  });
};

/**
 * 立即采集指定任务 × 渠道
 */
export const collectOnce = (taskId: string | number, channelId: string | number): AxiosPromise<CollectResult> => {
  return request({
    url: '/yuqing/collect/dispatch/' + taskId + '/' + channelId,
    method: 'post'
  });
};

/**
 * 采集频率校验：返回不满足渠道限流下限的配置项
 */
export const checkCollectSchedule = (taskId: string | number): AxiosPromise<string[]> => {
  return request({
    url: '/yuqing/collect/schedule-check/' + taskId,
    method: 'get'
  });
};
`);

/* ==========================================================================
 * 14. 离线自测（JUnit 5）
 *     —— F-004 的可执行验收证据：不依赖 Doris / Redis / 外网，全部用桩件驱动。
 * ========================================================================== */

file('test/java/org/dromara/yuqing/collect/YqCollectEngineTest.java', `package org.dromara.yuqing.collect;

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
            detect(detector, 200, "<html><body><div id=\\"app\\"></div><script src=1.js></script></body></html>", null).getType());
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
        String json = "{\\"data\\":{\\"list\\":[{\\"title\\":\\"接口标题\\",\\"url\\":\\"/n/1\\",\\"publishTime\\":\\"2026-09-18 10:00:00\\","
            + "\\"author\\":{\\"name\\":\\"接口作者\\"},\\"stats\\":{\\"like\\":15,\\"comment\\":3,\\"share\\":2,\\"read\\":999},"
            + "\\"region\\":\\"辽宁-大连\\",\\"tags\\":\\"接口,测试\\"}]}}";
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

    private static final String SAMPLE_HTML = "<html><body><div class=\\"result-item\\">"
        + "<h3><a href=\\"/a/1001\\">演示企业服务保障获评优秀</a></h3>"
        + "<span class=\\"time\\">2026-09-18 15:30</span><span class=\\"source\\">北方日报</span>"
        + "<span class=\\"region\\">辽宁-沈阳</span><span class=\\"like\\">1.2万</span>"
        + "<span class=\\"comment\\">3,456</span><span class=\\"share\\">1.3亿</span>"
        + "<span class=\\"read\\">2048</span><span class=\\"tags\\">服务保障,优秀</span>"
        + "<span class=\\"device\\">iPhone 15 Pro</span></div>"
        + "<div class=\\"result-item\\">"
        + "<h3><a href=\\"/a/1002\\">演示企业价格争议说明</a></h3>"
        + "<span class=\\"time\\">2026-09-18 14:00</span><span class=\\"source\\">南方晚报</span>"
        + "<span class=\\"region\\">辽宁-大连</span><span class=\\"like\\">9</span>"
        + "<span class=\\"comment\\">1</span><span class=\\"share\\">0</span>"
        + "<span class=\\"read\\">100</span><span class=\\"tags\\">价格争议</span>"
        + "<span class=\\"device\\">Windows 11</span></div>"
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
`);

/* ==========================================================================
 * 15. 离线自测执行器（无 surefire 时的执行入口）
 * ========================================================================== */

file('test/java/org/dromara/yuqing/collect/OfflineCollectTestRunner.java', `package org.dromara.yuqing.collect;

import java.lang.annotation.Annotation;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * F-004 采集引擎离线自测执行器。
 *
 * <p><b>为什么需要它：</b>本工程父 pom 设了 {@code <maven.test.skip>true</maven.test.skip>}，
 * 且 surefire 的 JUnit Platform provider（{@code surefire-junit-platform}）在离线仓库中
 * 只有 2.22.2 版本，与 Spring Boot 4.1 / JUnit 6 不兼容 —— 直接 {@code mvn test} 会以
 * 「artifact not found」告终。本类用反射直接执行 {@link #TARGETS} 中所有带
 * {@code @Test} 的方法，给出一个不依赖 surefire 的执行入口。</p>
 *
 * <p><b>用法：</b></p>
 * <pre>
 * java -cp "target/test-classes;target/classes;&lt;依赖 jar 列表&gt;" \\
 *      org.dromara.yuqing.collect.OfflineCollectTestRunner
 * </pre>
 *
 * <p>反射按注解全限定名判断而不 import JUnit，因此本类在 JUnit 缺席时同样可编译；
 * 每个用例都新建实例调用，等价于 JUnit 的默认 {@code PER_METHOD} 生命周期。</p>
 *
 * @author ruoyi
 */
public final class OfflineCollectTestRunner {

    /** JUnit 5 测试注解的全限定名（字符串比较，避免硬依赖）。 */
    private static final String TEST_ANNOTATION = "org.junit.jupiter.api.Test";

    /** 纳入离线执行的测试类（本机 surefire 跑不动 JUnit 6，这里显式登记） */
    private static final Class<?>[] TARGETS = {
        YqCollectEngineTest.class,
        YqKeywordPipelineTest.class,
        YqKeywordImportTest.class,
        F006CleanTest.class,
        org.dromara.yuqing.alert.F010AlertPushTest.class,
        org.dromara.yuqing.analytics.F009AnalyticsTest.class,
        org.dromara.yuqing.wecom.F012WecomTest.class,
        org.dromara.yuqing.report.F014ReportTest.class,
        org.dromara.yuqing.ledger.F016LedgerTest.class,
        org.dromara.yuqing.analysis.F007AnalysisTest.class,
    };

    private OfflineCollectTestRunner() {
    }

    public static void main(String[] args) {
        List<String> failures = new ArrayList<>();
        int pass = 0;
        int total = 0;
        System.out.println("======== F-004 采集 / 关键词 / 净化 / 预警推送 / 多维分析 / 企微H5 / 日报生成 / 舆情台账 / 智能研判 离线自测 ========");
        for (Class<?> target : TARGETS) {
            List<Method> methods = testMethods(target);
            total += methods.size();
            System.out.println();
            System.out.println("-- " + target.getSimpleName() + "（" + methods.size() + " 用例）");
            for (Method method : methods) {
                method.setAccessible(true);
                String label = target.getSimpleName() + "." + method.getName();
                try {
                    Object instance = target.getDeclaredConstructor().newInstance();
                    method.invoke(instance);
                    System.out.println("  [PASS] " + label);
                    pass++;
                } catch (InvocationTargetException e) {
                    Throwable cause = e.getCause() == null ? e : e.getCause();
                    String msg = cause.toString();
                    System.out.println("  [FAIL] " + label + "  -> " + msg);
                    for (StackTraceElement el : cause.getStackTrace()) {
                        if (el.getClassName().startsWith("org.dromara.yuqing")) {
                            System.out.println("           at " + el);
                        }
                    }
                    failures.add(label + ": " + msg);
                } catch (ReflectiveOperationException e) {
                    System.out.println("  [FAIL] " + label + "  -> 反射调用失败: " + e);
                    failures.add(label + ": " + e);
                }
            }
        }

        System.out.println();
        System.out.println("================ 结果: 通过 " + pass + " / 失败 " + failures.size()
            + "  （共 " + total + " 用例）=================");
        for (String f : failures) {
            System.out.println("  - " + f);
        }
        if (!failures.isEmpty()) {
            System.exit(1);
        }
    }

    /**
     * 取出带 {@code @Test} 注解的方法（按注解全限定名判断，不 import JUnit）。
     *
     * @param target 测试类
     * @return 方法列表，按名称排序
     */
    private static List<Method> testMethods(Class<?> target) {
        List<Method> methods = new ArrayList<>();
        for (Method method : target.getDeclaredMethods()) {
            for (Annotation annotation : method.getAnnotations()) {
                if (TEST_ANNOTATION.equals(annotation.annotationType().getName())) {
                    methods.add(method);
                    break;
                }
            }
        }
        methods.sort(Comparator.comparing(Method::getName));
        return methods;
    }
}
`);

/* ==========================================================================
 * 16. JSON 门面（脱离 Spring 容器也能用）
 * ========================================================================== */

file('collect/json/CollectJson.java', `package org.dromara.yuqing.collect.json;

import org.dromara.common.json.utils.JsonUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 采集引擎的 JSON 门面。
 *
 * <p><b>为什么不直接用 {@link JsonUtils}：</b>该工具的 {@code JSON_MAPPER} 是
 * {@code SpringUtils.getBean(JsonMapper.class)} 取的容器 Bean，静态字段初始化失败会抛
 * {@code ExceptionInInitializerError} —— 采集引擎需要在 Spring 上下文之外也能跑
 * （离线自测、未来的采集 Worker CLI、Stream Load 单测），因此这里做一层兜底：
 * 容器可用时用全局配置好的 mapper（保证与 Web 层序列化策略一致），
 * 容器不可用时退回自建实例。</p>
 *
 * <p>注意：本工程用的是 <b>Jackson 3</b>（{@code tools.jackson}），
 * 不是 Jackson 2 的 {@code com.fasterxml.jackson}。</p>
 *
 * @author ruoyi
 */
public final class CollectJson {

    /** 容器不可用时的兜底 mapper，双检锁懒加载。 */
    private static volatile JsonMapper fallback;

    private CollectJson() {
    }

    /**
     * 解析 JSON 字符串为树。
     *
     * @param text JSON 文本
     * @return 根节点
     */
    public static JsonNode readTree(String text) {
        return mapper().readTree(text);
    }

    /**
     * 序列化为 JSON 字符串。
     *
     * @param object 待序列化对象
     * @return JSON 文本
     */
    public static String toJsonString(Object object) {
        return mapper().writeValueAsString(object);
    }

    /**
     * 取 JSON 映射器：优先容器 Bean，取不到则用自建实例。
     *
     * @return JsonMapper
     */
    public static JsonMapper mapper() {
        try {
            JsonMapper bean = JsonUtils.getJsonMapper();
            if (bean != null) {
                return bean;
            }
        } catch (Throwable ignore) {
            /* 容器未启动 / 静态初始化失败：走兜底实例，不打扰调用方 */
        }
        JsonMapper local = fallback;
        if (local == null) {
            synchronized (CollectJson.class) {
                local = fallback;
                if (local == null) {
                    local = JsonMapper.builder().build();
                    fallback = local;
                }
            }
        }
        return local;
    }
}
`);

file('collect/keyword/KeywordExpressionException.java', `package ${PKG}.collect.keyword;

import java.io.Serial;

/**
 * 关键词组合表达式语法异常。
 *
 * <p>携带出错列位置（1 基），便于关键词库录入界面直接定位
 * （F-002 验收标准 3：提供语法校验并给出错误位置）。</p>
 *
 * @author ruoyi
 */
public class KeywordExpressionException extends RuntimeException {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 出错列号（1 基）；0 表示整体性错误，无具体列 */
    private final int column;

    public KeywordExpressionException(int column, String message) {
        super(column > 0 ? "第 " + column + " 列：" + message : message);
        this.column = column;
    }

    public int getColumn() {
        return column;
    }
}
`);

file('collect/keyword/KeywordExpression.java', `package ${PKG}.collect.keyword;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 关键词组合表达式：解析 + 校验。
 *
 * <p>语法对齐业务同事现有录入习惯（样例见《网址与关键词-代码匹配核查》）：</p>
 * <pre>
 *   (辽宁|沈阳|大连)+(药监局|药品监管|医疗器械监管)   地区组 AND 主题组
 *   (东北超|辽超)+(药企|医药企业)-(广告|代理)         末尾 - 组为排除词
 *   ((东北|东三省)+(东北超|足球联赛))                 整段被外层括号包住：自动剥离，不报嵌套错
 *   (药监局|药品监管)                                 单组：既检索也匹配
 *   药监局|药品监管                                   不带括号的 OR 组
 * </pre>
 *
 * <p><b>关键约定</b>：最后一个组是「检索词组」，用于填充适配器 {@code {kw}} 占位符发起检索；
 * 所有组同时作为「本地匹配组」，命中才允许入库。这样请求量是「主题词个数 N」，
 * 而不是「地区 × 主题」的笛卡尔积（16 × 6 = 96 → 6）。</p>
 *
 * <p><b>宽容输入</b>：全角括号 / 竖线 / 加号 / 减号，顿号、逗号、分号、空白一律按分隔符识别，
 * 降低录入门槛（业务同事不一定会切英文输入法）。</p>
 *
 * @author ruoyi
 */
public final class KeywordExpression implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 表达式词数上限：防止一次检索把渠道限流打爆 */
    public static final int MAX_WORDS = 200;

    /** 单个词长度上限 */
    public static final int MAX_WORD_LENGTH = 50;

    /** AND 组：每组内部是 OR 关系 */
    private final List<List<String>> groups;

    /** 排除词 */
    private final List<String> excludes;

    /** 归一化后的表达式（便于回显与排错） */
    private final String normalized;

    private KeywordExpression(List<List<String>> groups, List<String> excludes, String normalized) {
        this.groups = groups;
        this.excludes = excludes;
        this.normalized = normalized;
    }

    /* ---------------------------------------------------------------- 访问器 */

    public List<List<String>> getGroups() {
        return groups;
    }

    public List<String> getExcludes() {
        return excludes;
    }

    public String getNormalized() {
        return normalized;
    }

    /**
     * 是否只有排除词、没有检索组。
     *
     * @return true 表示表达式不可用于检索
     */
    public boolean hasNoGroup() {
        return groups.isEmpty();
    }

    /**
     * 全部有效词数量（含排除词）。
     *
     * @return 词数
     */
    public int wordCount() {
        int total = excludes.size();
        for (List<String> group : groups) {
            total += group.size();
        }
        return total;
    }

    /**
     * 检索词组（按约定取最后一组）。
     *
     * @return 检索词；无组时返回空列表
     */
    public List<String> primaryGroup() {
        if (groups.isEmpty()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(groups.get(groups.size() - 1));
    }

    /* ---------------------------------------------------------------- 解析 */

    /**
     * 解析表达式，语法错误抛 {@link KeywordExpressionException}（含列位置）。
     *
     * @param expression 表达式原文
     * @return 解析结果
     */
    public static KeywordExpression parse(String expression) {
        if (expression == null || expression.trim().isEmpty()) {
            throw new KeywordExpressionException(0, "表达式为空");
        }
        String text = unwrapRedundantParens(normalize(expression).trim());
        List<List<String>> groups = new ArrayList<>();
        Set<String> excludes = new LinkedHashSet<>();
        int length = text.length();
        int index = 0;
        boolean negate = false;
        boolean expectTerm = true;
        while (index < length) {
            char ch = text.charAt(index);
            if (Character.isWhitespace(ch)) {
                index++;
                continue;
            }
            if (ch == '+') {
                if (expectTerm) {
                    throw new KeywordExpressionException(index + 1, "连接符 '+' 位置错误：左侧没有词组");
                }
                expectTerm = true;
                index++;
                continue;
            }
            if (ch == '-') {
                if (negate) {
                    throw new KeywordExpressionException(index + 1, "重复的排除符 '-'");
                }
                /* 允许以 - 开头：-(广告|代理) 是「只有排除词」的表达式，
                   解析通过但会被 validate 判定为缺少检索词组 */
                if (expectTerm && !groups.isEmpty()) {
                    throw new KeywordExpressionException(index + 1, "排除符 '-' 位置错误：左侧没有词组");
                }
                negate = true;
                index++;
                continue;
            }
            if (ch == ')') {
                throw new KeywordExpressionException(index + 1, "多余的右括号 ')'");
            }
            int[] cursor = {index};
            List<String> words = readWords(text, cursor);
            index = cursor[0];
            if (words.isEmpty()) {
                throw new KeywordExpressionException(index + 1, "无法识别的内容");
            }
            if (negate) {
                excludes.addAll(words);
                negate = false;
            } else {
                groups.add(words);
            }
            expectTerm = false;
        }
        if (negate) {
            throw new KeywordExpressionException(length, "表达式以排除符 '-' 结尾，缺少排除词");
        }
        if (expectTerm && !groups.isEmpty()) {
            throw new KeywordExpressionException(length, "表达式以连接符 '+' 结尾");
        }
        if (groups.isEmpty() && excludes.isEmpty()) {
            throw new KeywordExpressionException(0, "表达式不含任何有效词");
        }
        int total = excludes.size();
        for (List<String> group : groups) {
            total += group.size();
        }
        if (total > MAX_WORDS) {
            throw new KeywordExpressionException(0, "表达式共 " + total + " 个词，超过上限 " + MAX_WORDS);
        }
        return new KeywordExpression(groups, new ArrayList<>(excludes), text.trim());
    }

    /**
     * 语法校验：返回问题列表，为空即合法。
     *
     * <p>供关键词库录入界面实时提示（F-002 验收标准 3）。</p>
     *
     * @param expression 表达式原文
     * @return 问题列表，每条自带列位置描述
     */
    public static List<String> validate(String expression) {
        List<String> issues = new ArrayList<>();
        if (expression == null || expression.trim().isEmpty()) {
            issues.add("表达式为空");
            return issues;
        }
        try {
            KeywordExpression parsed = parse(expression);
            if (parsed.hasNoGroup()) {
                issues.add("表达式只包含排除词，缺少检索词组");
            }
            return issues;
        } catch (KeywordExpressionException e) {
            issues.add(e.getMessage() == null ? "表达式语法错误" : e.getMessage());
            return issues;
        }
    }

    /**
     * 是否像组合表达式（用于判断走「组合解析」还是「普通单词」）。
     *
     * <p>只认括号与竖线：这类字符几乎不可能出现在普通词里，避免把 {@code C++} 之类误判成表达式。</p>
     *
     * @param text 文本
     * @return true 表示应按组合表达式处理
     */
    public static boolean looksLikeExpression(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        return text.indexOf('(') >= 0 || text.indexOf('（') >= 0
            || text.indexOf('|') >= 0 || text.indexOf('｜') >= 0;
    }

    /* ---------------------------------------------------------------- 内部 */

    /**
     * 读取一个 term（可能是 {@code (...)} 组，也可能是不带括号的 OR 词序列）。
     */
    private static List<String> readWords(String text, int[] cursor) {
        int index = cursor[0];
        int length = text.length();
        boolean inGroup = text.charAt(index) == '(';
        if (inGroup) {
            index++;
        }
        List<String> words = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        int wordStart = index;
        while (true) {
            if (index >= length) {
                if (inGroup) {
                    throw new KeywordExpressionException(length, "缺少配对的右括号 ')'");
                }
                break;
            }
            char ch = text.charAt(index);
            if (inGroup) {
                if (ch == ')') {
                    break;
                }
                if (ch == '(') {
                    throw new KeywordExpressionException(index + 1, "不支持嵌套括号");
                }
            } else {
                if (ch == '(') {
                    throw new KeywordExpressionException(index + 1, "左括号 '(' 缺少配对的右括号");
                }
                if (ch == '+' || ch == '-') {
                    break;
                }
            }
            if (isSeparator(ch)) {
                appendWord(words, current, wordStart);
                current.setLength(0);
                index++;
                wordStart = index;
                continue;
            }
            current.append(ch);
            index++;
        }
        appendWord(words, current, wordStart);
        cursor[0] = inGroup ? index + 1 : index;
        return words;
    }

    private static void appendWord(List<String> words, StringBuilder current, int start) {
        String word = current.toString().trim();
        if (word.isEmpty()) {
            return;
        }
        if (word.length() > MAX_WORD_LENGTH) {
            throw new KeywordExpressionException(start + 1,
                "词过长（" + word.length() + " 字符，上限 " + MAX_WORD_LENGTH + "）：" + cut(word));
        }
        if (!words.contains(word)) {
            words.add(word);
        }
    }

    private static boolean isSeparator(char ch) {
        return ch == '|' || ch == ',' || ch == ';' || Character.isWhitespace(ch);
    }

    /**
     * 全角 / 中文标点归一化为半角，保持字符下标不变（1:1 映射，列号可原样回显）。
     */
    private static String normalize(String text) {
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            switch (ch) {
                case '（' -> sb.append('(');
                case '）' -> sb.append(')');
                case '｜' -> sb.append('|');
                case '＋' -> sb.append('+');
                case '－', '—', '–' -> sb.append('-');
                case '，', '、' -> sb.append(',');
                case '；' -> sb.append(';');
                case '　' -> sb.append(' ');
                default -> sb.append(ch);
            }
        }
        return sb.toString();
    }

    /**
     * 剥离「把整段表达式包起来」的冗余括号。
     *
     * <p>业务同事手写词表时常写成 {@code ((东北|…)+(地区…))} —— 外层括号只是分组习惯，
     * 语义与去括号后完全一致，但会被解析器判为「不支持嵌套括号」。这里在解析前把
     * 最外层成对括号<b>置为空格</b>而不是删除，字符下标 1:1 不变，报错列号仍与原文对齐。</p>
     *
     * <p>只处理「首尾成对且内部无提前闭合」的情况；{@code (A)+(B)} 这种首括号在中途闭合的
     * 表达式不会被误剥。</p>
     *
     * @param text 已归一化的表达式
     * @return 剥离冗余外层括号后的表达式（等长）
     */
    private static String unwrapRedundantParens(String text) {
        char[] chars = text.toCharArray();
        while (true) {
            int start = 0;
            int end = chars.length - 1;
            while (start <= end && Character.isWhitespace(chars[start])) {
                start++;
            }
            while (end >= start && Character.isWhitespace(chars[end])) {
                end--;
            }
            if (start >= end || chars[start] != '(' || chars[end] != ')') {
                return new String(chars);
            }
            /* 校验 start 处的 '(' 是否恰好与 end 处的 ')' 配对 */
            int depth = 0;
            boolean wraps = true;
            for (int i = start; i <= end; i++) {
                char ch = chars[i];
                if (ch == '(') {
                    depth++;
                } else if (ch == ')') {
                    depth--;
                    if (depth < 0 || (depth == 0 && i != end)) {
                        wraps = false;
                        break;
                    }
                }
            }
            if (!wraps || depth != 0) {
                return new String(chars);
            }
            chars[start] = ' ';
            chars[end] = ' ';
        }
    }

    private static String cut(String word) {
        return word.length() > 30 ? word.substring(0, 30) + "..." : word;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        for (List<String> group : groups) {
            if (sb.length() > 0) {
                sb.append('+');
            }
            sb.append('(').append(String.join("|", group)).append(')');
        }
        if (!excludes.isEmpty()) {
            sb.append("-(").append(String.join("|", excludes)).append(')');
        }
        return sb.toString();
    }
}
`);

file('collect/keyword/ExcludeRule.java', `package ${PKG}.collect.keyword;

import java.io.Serial;
import java.io.Serializable;
import java.util.Locale;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * 降噪排除规则：命中即丢弃该条内容。
 *
 * <p>两类来源：</p>
 * <ul>
 *   <li>{@code yq_keyword} 中 {@code keyword_type = negative} 的词，经 {@code yq_task_keyword}
 *       关联到任务 —— <b>天然带任务维度</b>，避免全局降噪误杀（见《网址与关键词-代码匹配核查》）</li>
 *   <li>{@code yq_noise_rule} 的系统内置规则（可选，默认不参与采集，留给 F-006 净化去重）</li>
 * </ul>
 *
 * @author ruoyi
 */
public class ExcludeRule implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 正则规则值长度上限，防超长表达式拖慢匹配 */
    private static final int MAX_REGEX_LENGTH = 200;

    private final String name;

    private final String matchType;

    private final String value;

    private final boolean regex;

    private final Pattern pattern;

    private ExcludeRule(String name, String matchType, String value, boolean regex, Pattern pattern) {
        this.name = name;
        this.matchType = matchType;
        this.value = value;
        this.regex = regex;
        this.pattern = pattern;
    }

    /**
     * 关键词（子串）规则。
     *
     * @param name  规则名
     * @param value 匹配内容
     * @return 规则
     */
    public static ExcludeRule keyword(String name, String value) {
        return new ExcludeRule(name, "keyword", value, false, null);
    }

    /**
     * 正则规则；表达式非法或存在灾难性回溯风险时自动降级为关键词匹配。
     *
     * @param name  规则名
     * @param value 正则表达式
     * @return 规则
     */
    public static ExcludeRule regex(String name, String value) {
        if (value == null || value.isBlank() || value.length() > MAX_REGEX_LENGTH || risky(value)) {
            return keyword(name, value);
        }
        try {
            return new ExcludeRule(name, "regex", value, true, Pattern.compile(value));
        } catch (PatternSyntaxException e) {
            return keyword(name, value);
        }
    }

    /**
     * 是否命中。
     *
     * @param text 待检文本
     * @return true 表示命中（应丢弃）
     */
    public boolean hit(String text) {
        if (text == null || text.isEmpty() || value == null || value.isEmpty()) {
            return false;
        }
        if (regex && pattern != null) {
            return pattern.matcher(text).find();
        }
        return text.toLowerCase(Locale.ROOT).contains(value.toLowerCase(Locale.ROOT));
    }

    public String getName() {
        return name;
    }

    public String getMatchType() {
        return matchType;
    }

    public String getValue() {
        return value;
    }

    public boolean isRegex() {
        return regex;
    }

    @Override
    public String toString() {
        return matchType + ":" + value;
    }

    /**
     * 粗略识别 {@code (a+)+} / {@code (a*)*} 这类灾难性回溯形态（纯字符扫描，不引入新的正则）。
     */
    private static boolean risky(String value) {
        boolean inGroup = false;
        boolean quantifierInGroup = false;
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (ch == '(') {
                inGroup = true;
                quantifierInGroup = false;
            } else if (ch == ')') {
                if (inGroup && quantifierInGroup && i + 1 < value.length()) {
                    char next = value.charAt(i + 1);
                    if (next == '+' || next == '*' || next == '{') {
                        return true;
                    }
                }
                inGroup = false;
            } else if (inGroup && (ch == '+' || ch == '*')) {
                quantifierInGroup = true;
            }
        }
        return false;
    }
}
`);

file('collect/keyword/KeywordSpec.java', `package ${PKG}.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 采集用关键词规格：一个「检索意图」的完整表达。
 *
 * <p>它是关键词库（F-002）与采集引擎（F-004）之间的契约：</p>
 * <ul>
 *   <li>{@link #searchTerms} —— 真正拼进 {@code {kw}} 占位符的词（组合表达式取「检索组」）</li>
 *   <li>{@link #mustGroups} —— 本地匹配组，AND 关系；组内 OR</li>
 *   <li>{@link #excludeTerms} —— 该词自带的排除词</li>
 *   <li>{@link #filterMode} —— 过滤强度</li>
 * </ul>
 *
 * @author ruoyi
 */
@Data
public class KeywordSpec implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 命中词回写上限（对齐 hit_keywords 字段容量的保守值） */
    private static final int MAX_HIT_TEXT = 200;

    /**
     * 本地过滤强度。
     */
    public enum FilterMode {
        /** 不做过滤：检索到什么就采什么（普通单词默认，避免搜索引擎分词扩召回被误杀） */
        OFF,
        /** 至少命中一个组即通过 */
        LOOSE,
        /** 每个组都要命中，且不含排除词（组合表达式默认） */
        STRICT
    }

    /** 关键词ID（yq_keyword.keyword_id） */
    private Long keywordId;

    /** 原始文本 / 表达式 */
    private String raw;

    /** 关键词类型：precise / fuzzy / combo / negative */
    private String keywordType;

    /** 关键词分类 */
    private String keywordCategory;

    /** 生效的匹配策略（任务级覆盖 > 关键词类型） */
    private String matchStrategy;

    /** 检索词（用于 {kw} 填充） */
    private List<String> searchTerms = new ArrayList<>();

    /** 必须命中的词组（AND）；组内 OR */
    private List<List<String>> mustGroups = new ArrayList<>();

    /** 排除词 */
    private List<String> excludeTerms = new ArrayList<>();

    /** 本地过滤强度 */
    private FilterMode filterMode = FilterMode.OFF;

    /** 解析错误；非空表示该关键词不可用（会在调度日志中暴露，避免静默采不到） */
    private String parseError;

    /**
     * 是否可用于发起检索。
     *
     * @return true 表示检索词齐备且无解析错误
     */
    public boolean isUsable() {
        return parseError == null && !searchTerms.isEmpty();
    }

    /**
     * 是否启用本地过滤。
     *
     * @return true 表示需要做组合条件匹配
     */
    public boolean isFilterEnabled() {
        return filterMode != FilterMode.OFF && !mustGroups.isEmpty();
    }

    /**
     * 组合条件匹配：所有组都要命中（STRICT）或至少一组命中（LOOSE），且不含任何排除词。
     *
     * @param text 待检文本（标题 + 正文 + 标签等拼接）
     * @return true 表示通过
     */
    public boolean matches(String text) {
        if (filterMode == FilterMode.OFF || mustGroups.isEmpty()) {
            return true;
        }
        if (text == null || text.isEmpty()) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String exclude : excludeTerms) {
            if (!exclude.isEmpty() && lower.contains(exclude.toLowerCase(Locale.ROOT))) {
                return false;
            }
        }
        int hitGroups = 0;
        for (List<String> group : mustGroups) {
            boolean any = false;
            for (String word : group) {
                if (!word.isEmpty() && lower.contains(word.toLowerCase(Locale.ROOT))) {
                    any = true;
                    break;
                }
            }
            if (any) {
                hitGroups++;
            } else if (filterMode == FilterMode.STRICT) {
                return false;
            }
        }
        return hitGroups > 0;
    }

    /**
     * 命中的词，逗号分隔，用于回写 hit_keywords（说明「为什么抓到这条」）。
     *
     * @param text 待检文本
     * @return 命中词串；无命中返回空串
     */
    public String hits(String text) {
        if (text == null || text.isEmpty() || mustGroups.isEmpty()) {
            return "";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        Set<String> found = new LinkedHashSet<>();
        for (List<String> group : mustGroups) {
            for (String word : group) {
                if (!word.isEmpty() && lower.contains(word.toLowerCase(Locale.ROOT))) {
                    found.add(word);
                }
            }
        }
        if (found.isEmpty()) {
            return "";
        }
        String joined = String.join(",", found);
        return joined.length() > MAX_HIT_TEXT ? joined.substring(0, MAX_HIT_TEXT) : joined;
    }

    /**
     * 普通单词关键词：只检索、不过滤。
     *
     * @param text 词
     * @return 规格
     */
    public static KeywordSpec simple(String text) {
        KeywordSpec spec = new KeywordSpec();
        spec.setRaw(text);
        spec.setKeywordType("fuzzy");
        spec.setFilterMode(FilterMode.OFF);
        spec.setSearchTerms(new ArrayList<>());
        if (text != null && !text.isBlank()) {
            spec.getSearchTerms().add(text.trim());
        }
        return spec;
    }

    /**
     * 由组合表达式构建。
     *
     * @param keywordId       关键词ID
     * @param raw             原始文本
     * @param keywordType     类型
     * @param keywordCategory 分类
     * @param expression      已解析表达式
     * @param searchGroup     检索词组选择：last / first / fewest
     * @return 规格
     */
    public static KeywordSpec fromExpression(Long keywordId, String raw, String keywordType,
                                             String keywordCategory, KeywordExpression expression,
                                             String searchGroup) {
        KeywordSpec spec = new KeywordSpec();
        spec.setKeywordId(keywordId);
        spec.setRaw(raw);
        spec.setKeywordType(keywordType);
        spec.setKeywordCategory(keywordCategory);
        spec.setMustGroups(new ArrayList<>(expression.getGroups()));
        spec.setExcludeTerms(new ArrayList<>(expression.getExcludes()));
        spec.setSearchTerms(pickSearchTerms(expression.getGroups(), searchGroup));
        spec.setFilterMode(FilterMode.STRICT);
        if (spec.getSearchTerms().isEmpty()) {
            spec.setParseError("表达式缺少检索词组，无法发起检索");
        }
        return spec;
    }

    /**
     * 解析失败的占位规格。
     *
     * @param keywordId 关键词ID
     * @param raw       原始文本
     * @param message   失败原因
     * @return 规格
     */
    public static KeywordSpec failed(Long keywordId, String raw, String message) {
        KeywordSpec spec = new KeywordSpec();
        spec.setKeywordId(keywordId);
        spec.setRaw(raw);
        spec.setParseError(message);
        return spec;
    }

    /**
     * 选择检索词组。
     *
     * @param groups 全部组
     * @param mode   last（默认）/ first / fewest
     * @return 检索词
     */
    private static List<String> pickSearchTerms(List<List<String>> groups, String mode) {
        List<String> terms = new ArrayList<>();
        if (groups == null || groups.isEmpty()) {
            return terms;
        }
        int index;
        if ("first".equalsIgnoreCase(mode)) {
            index = 0;
        } else if ("fewest".equalsIgnoreCase(mode)) {
            index = 0;
            for (int i = 1; i < groups.size(); i++) {
                if (groups.get(i).size() < groups.get(index).size()) {
                    index = i;
                }
            }
        } else {
            index = groups.size() - 1;
        }
        terms.addAll(groups.get(index));
        return terms;
    }
}
`);

file('collect/keyword/KeywordMatcher.java', `package ${PKG}.collect.keyword;

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
`);

file('test/java/org/dromara/yuqing/collect/YqKeywordPipelineTest.java', `package org.dromara.yuqing.collect;

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
`);

/* ==== part11a.js ====  本段由 part11a.js 合并而来，请勿直接编辑：改 part11a.js 后重跑 merge_part11.py ==== */
/* ==========================================================================
 * 17. 词表导入（P0-4）：条目 / 结果 / 解析器
 *   业务同事手写词表（示例表达式 + 排除词段）→ 结构化待入库条目
 * ========================================================================== */

file('collect/keyword/KeywordImportItem.java', `package ${PKG}.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 词表导入 —— 单条待入库关键词。
 *
 * @author ruoyi
 */
@Data
public class KeywordImportItem implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 关键词文本（落 yq_keyword.keyword_text，VARCHAR(100)） */
    private String keywordText;

    /** 关键词类型：combo / negative / fuzzy */
    private String keywordType;

    /** 关键词分类：core / related / block */
    private String keywordCategory;

    /** 组合表达式原文（仅 combo 有值） */
    private String comboExpression;

    /** 备注（来源段落 + 结构摘要，落 yq_keyword.remark） */
    private String remark;

    /** 原文行号（1 基，便于操作人回定位） */
    private int lineNo;

    /** 组合表达式 —— 组数 */
    private int groupCount;

    /** 组合表达式 —— 总词数（含内联排除词） */
    private int wordCount;

    /** 组合表达式 —— 检索词组（真正发起检索的词，其余组只在本地校验） */
    private List<String> searchTerms = new ArrayList<>();

    /** 是否来自组合表达式内的 -(a|b) 内联排除段 */
    private boolean inlineExclude;

    /** 是否因重复被跳过（预览阶段标记，入库阶段不会出现） */
    private boolean duplicate;
}
`);

file('collect/keyword/KeywordImportResult.java', `package ${PKG}.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 词表导入 —— 解析 / 入库结果。
 *
 * <p>{@link #errors} 非空即整体不可入库：宁可让操作人改词表，
 * 也不要把半成品写进库导致「采不到东西而且不报错」。</p>
 *
 * @author ruoyi
 */
@Data
public class KeywordImportResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 解析出的条目（不含被跳过的重复项） */
    private List<KeywordImportItem> items = new ArrayList<>();

    /** 致命问题：非空表示整体拒绝 */
    private List<String> errors = new ArrayList<>();

    /** 提醒：不阻断入库 */
    private List<String> warnings = new ArrayList<>();

    /** 被跳过的重复词 */
    private List<String> duplicates = new ArrayList<>();

    /** 原文总行数 */
    private int totalLines;

    /** 组合表达式条数 */
    private int comboCount;

    /** 排除词条数 */
    private int negativeCount;

    /** 普通词条数 */
    private int plainCount;

    /** 重复跳过条数 */
    private int duplicateCount;

    /** 其中来自表达式内联 -(…) 的排除词条数 */
    private int inlineExcludeCount;

    /** 预计检索请求次数（各组合表达式检索词组词数之和） */
    private int searchTermCount;

    /** 新写入 yq_keyword 条数（commit 后才有值） */
    private int insertedKeywords;

    /** 复用已有 yq_keyword 条数 */
    private int reusedKeywords;

    /** 新建 yq_task_keyword 关联条数 */
    private int boundRelations;

    /** 已存在的任务关联（跳过）条数 */
    private int skippedRelations;

    /** 实际落库使用的分组ID */
    private Long groupId;

    /** 是否真正执行了写库 */
    private boolean committed;

    /**
     * @return true 表示无致命错误，可入库
     */
    public boolean isOk() {
        return errors.isEmpty();
    }

    /**
     * @return 组合表达式条目
     */
    public List<KeywordImportItem> combos() {
        return filterByType(KeywordImportParser.TYPE_COMBO);
    }

    /**
     * @return 排除词条目
     */
    public List<KeywordImportItem> negatives() {
        return filterByType(KeywordImportParser.TYPE_NEGATIVE);
    }

    /**
     * @return 普通词条目
     */
    public List<KeywordImportItem> plains() {
        return filterByType(KeywordImportParser.TYPE_PLAIN);
    }

    private List<KeywordImportItem> filterByType(String type) {
        List<KeywordImportItem> list = new ArrayList<>();
        for (KeywordImportItem item : items) {
            if (type.equals(item.getKeywordType())) {
                list.add(item);
            }
        }
        return list;
    }

    /**
     * 一句话摘要，直接回显给操作人。
     *
     * @return 摘要文本
     */
    public String summary() {
        StringBuilder sb = new StringBuilder();
        sb.append("共 ").append(items.size()).append(" 条")
          .append("（组合 ").append(comboCount)
          .append(" / 排除 ").append(negativeCount)
          .append(" / 普通 ").append(plainCount).append("）");
        if (duplicateCount > 0) {
            sb.append("；跳过重复 ").append(duplicateCount).append(" 条");
        }
        if (searchTermCount > 0) {
            sb.append("；预计检索请求 ").append(searchTermCount).append(" 次");
        }
        if (committed) {
            sb.append("。入库：新增关键词 ").append(insertedKeywords)
              .append(" 条、复用 ").append(reusedKeywords)
              .append(" 条、新建任务关联 ").append(boundRelations).append(" 条");
        }
        return sb.toString();
    }

    @Override
    public String toString() {
        return summary();
    }
}
`);

file('collect/keyword/KeywordImportParser.java', `package ${PKG}.collect.keyword;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 词表导入解析器 —— 把业务同事手写的词表文本转成结构化条目。
 *
 * <p><b>支持的输入形态</b>（对齐《关键词样例.txt》的真实写法）：</p>
 * <pre>
 *   样例1：
 *   (辽宁|沈阳|大连)+(药监局|药品|医疗器械)       ← 带序号/冒号的段落标记行
 *   样例2：
 *   ((东北|东三省)+(东北超|足球联赛))              ← 整段被外层括号包住也能解析
 *   药监监测:(辽宁|沈阳)+(药监局|药品)              ← 冒号前是业务自定义标题，自动剥离
 *   排除：
 *   广告|代理|招聘|超厚                            ← 排除词段：竖线或换行分隔
 * </pre>
 *
 * <p><b>段落规则</b>：标记行只认「排除/排除词/负向词/降噪词/屏蔽词/过滤词」与
 * 「样例/示例」，且整行去空白、去数字、去冒号后必须与标记词完全相等，
 * 避免把「例」「排除率」之类的普通词误判成段落标记。</p>
 *
 * <p><b>无标记时的兜底</b>：含 {@code ( ) |} 的行按组合表达式处理，
 * 其余按分隔符（竖线/顿号/逗号/分号/空白/全角同类）拆成普通词。</p>
 *
 * @author ruoyi
 */
public final class KeywordImportParser {

    /** 组合表达式 */
    public static final String TYPE_COMBO = "combo";
    /** 否定 / 排除词 */
    public static final String TYPE_NEGATIVE = "negative";
    /** 普通词 */
    public static final String TYPE_PLAIN = "fuzzy";

    /** 分类：核心监测词 */
    public static final String CATEGORY_CORE = "core";
    /** 分类：关联监测词 */
    public static final String CATEGORY_RELATED = "related";
    /** 分类：屏蔽词 */
    public static final String CATEGORY_BLOCK = "block";

    /** yq_keyword.keyword_text 列宽 */
    public static final int MAX_KEYWORD_TEXT = 100;
    /** yq_keyword.combo_expression 列宽 */
    public static final int MAX_COMBO_EXPRESSION = 500;
    /** yq_keyword.remark 列宽 */
    public static final int MAX_REMARK = 200;

    /** 单次导入行数上限 */
    private static final int MAX_LINES = 20000;
    /** 单次导入条目上限 */
    private static final int MAX_ITEMS = 5000;

    /** 排除词段标记（顺序敏感：「排除词」需先于「排除」比对，这里用完全相等，故无影响） */
    private static final String[] EXCLUDE_MARKERS = {"排除", "排除词", "负向词", "降噪词", "屏蔽词", "过滤词"};
    /** 组合表达式段标记 */
    private static final String[] COMBO_MARKERS = {"样例", "示例", "样例表达式", "示例表达式"};
    /** 标记行长度上限（超过则认为是正文而非标记） */
    private static final int MARKER_MAX_LENGTH = 12;

    private KeywordImportParser() {
    }

    /**
     * 解析词表文本。
     *
     * @param text 词表原文
     * @return 解析结果（含条目、错误、提醒）
     */
    public static KeywordImportResult parse(String text) {
        KeywordImportResult result = new KeywordImportResult();
        if (text == null || text.isBlank()) {
            result.getErrors().add("导入内容为空");
            return result;
        }
        List<String> rawLines = text.lines().toList();
        result.setTotalLines(rawLines.size());
        if (rawLines.size() > MAX_LINES) {
            result.getErrors().add("行数 " + rawLines.size() + " 超过上限 " + MAX_LINES + "，请拆分后再导入");
            return result;
        }

        Set<String> seen = new LinkedHashSet<>();
        boolean excludeSection = false;
        String sectionLabel = null;
        int lineNo = 0;
        for (String raw : rawLines) {
            lineNo++;
            String line = raw == null ? "" : raw.trim();
            if (line.isEmpty() || line.startsWith("#") || line.startsWith("//")) {
                continue;
            }
            String marker = matchMarker(line);
            if (marker != null) {
                excludeSection = isExcludeMarker(marker);
                sectionLabel = marker;
                continue;
            }
            if (excludeSection) {
                addWords(result, splitWords(line), TYPE_NEGATIVE, CATEGORY_BLOCK, lineNo,
                    "词表导入[" + label(sectionLabel, "排除") + "]", false, seen);
                continue;
            }
            String[] labelled = stripLeadingLabel(line);
            if (labelled[1] != null) {
                /* 「药监监测:(辽宁|沈阳)+(药监局|药品)」：冒号前是业务自己写的标题，
                   混进表达式会撞「左括号缺少配对」，这里剥离并当作段落名。 */
                addCombo(result, labelled[1], lineNo,
                    label(labelled[0] != null ? labelled[0] : sectionLabel, "组合表达式"), seen);
            } else if (KeywordExpression.looksLikeExpression(line)) {
                addCombo(result, line, lineNo, label(sectionLabel, "组合表达式"), seen);
            } else {
                addWords(result, splitWords(line), TYPE_PLAIN, CATEGORY_RELATED, lineNo,
                    "词表导入[" + label(sectionLabel, "普通词") + "]", false, seen);
            }
        }

        if (result.getItems().isEmpty() && result.getErrors().isEmpty()) {
            result.getErrors().add("未解析出任何关键词，请检查格式（示例行需含括号或竖线；排除词段以「排除:」开头）");
        }
        if (result.getItems().size() > MAX_ITEMS) {
            result.getErrors().add("解析出 " + result.getItems().size() + " 条，超过单次导入上限 " + MAX_ITEMS);
        }
        return result;
    }

    /* ------------------------------------------------------------ 组合表达式 */

    private static void addCombo(KeywordImportResult result, String line, int lineNo,
                                 String section, Set<String> seen) {
        List<String> issues = KeywordExpression.validate(line);
        if (!issues.isEmpty()) {
            result.getErrors().add("第 " + lineNo + " 行：" + issues.get(0));
            return;
        }
        KeywordExpression expression;
        try {
            expression = KeywordExpression.parse(line);
        } catch (KeywordExpressionException e) {
            result.getErrors().add("第 " + lineNo + " 行：" + e.getMessage());
            return;
        }
        String normalized = expression.getNormalized();
        if (normalized.length() > MAX_KEYWORD_TEXT) {
            result.getErrors().add("第 " + lineNo + " 行：表达式 " + normalized.length()
                + " 字符，超过关键词文本列宽 " + MAX_KEYWORD_TEXT + "（请拆成多个子表达式分别监测）");
            return;
        }
        if (normalized.length() > MAX_COMBO_EXPRESSION) {
            result.getErrors().add("第 " + lineNo + " 行：表达式超过组合表达式列宽 " + MAX_COMBO_EXPRESSION);
            return;
        }
        List<String> searchTerms = expression.primaryGroup();
        KeywordImportItem item = new KeywordImportItem();
        item.setKeywordText(normalized);
        item.setKeywordType(TYPE_COMBO);
        item.setKeywordCategory(CATEGORY_CORE);
        item.setComboExpression(normalized);
        item.setLineNo(lineNo);
        item.setGroupCount(expression.getGroups().size());
        item.setWordCount(expression.wordCount());
        item.setSearchTerms(searchTerms);
        item.setRemark(clip(section + "；" + expression.getGroups().size() + " 组 / "
            + expression.wordCount() + " 词，以 " + searchTerms.size() + " 个检索词发起检索",
            MAX_REMARK));
        if (!register(result, item, seen)) {
            return;
        }
        result.setComboCount(result.getComboCount() + 1);
        result.setSearchTermCount(result.getSearchTermCount() + searchTerms.size());
        if (searchTerms.size() > 8) {
            result.getWarnings().add("第 " + lineNo + " 行：检索词组有 " + searchTerms.size()
                + " 个词，将产生同量级检索请求，注意渠道 request_interval 与并发上限");
        }
        /* 表达式内联排除段 -(a|b) 同时登记为排除词，保证「表达式匹配」与「任务降噪」口径一致 */
        if (!expression.getExcludes().isEmpty()) {
            addWords(result, expression.getExcludes(), TYPE_NEGATIVE, CATEGORY_BLOCK, lineNo,
                "词表导入[表达式内联排除]", true, seen);
        }
    }

    /* ---------------------------------------------------------------- 普通词 */

    private static void addWords(KeywordImportResult result, List<String> words, String type, String category,
                                 int lineNo, String section, boolean inline, Set<String> seen) {
        for (String word : words) {
            if (word.length() > KeywordExpression.MAX_WORD_LENGTH) {
                result.getErrors().add("第 " + lineNo + " 行：词「" + clip(word, 24) + "」长度 "
                    + word.length() + " 超过上限 " + KeywordExpression.MAX_WORD_LENGTH);
                continue;
            }
            if (word.length() > MAX_KEYWORD_TEXT) {
                result.getErrors().add("第 " + lineNo + " 行：词「" + clip(word, 24)
                    + "」超过关键词文本列宽 " + MAX_KEYWORD_TEXT);
                continue;
            }
            KeywordImportItem item = new KeywordImportItem();
            item.setKeywordText(word);
            item.setKeywordType(type);
            item.setKeywordCategory(category);
            item.setRemark(clip(section, MAX_REMARK));
            item.setLineNo(lineNo);
            item.setInlineExclude(inline);
            if (!register(result, item, seen)) {
                continue;
            }
            if (TYPE_NEGATIVE.equals(type)) {
                result.setNegativeCount(result.getNegativeCount() + 1);
                if (inline) {
                    result.setInlineExcludeCount(result.getInlineExcludeCount() + 1);
                }
            } else {
                result.setPlainCount(result.getPlainCount() + 1);
            }
        }
    }

    private static boolean register(KeywordImportResult result, KeywordImportItem item, Set<String> seen) {
        if (!seen.add(item.getKeywordText())) {
            item.setDuplicate(true);
            result.setDuplicateCount(result.getDuplicateCount() + 1);
            result.getDuplicates().add(item.getKeywordText());
            return false;
        }
        result.getItems().add(item);
        return true;
    }

    /* ---------------------------------------------------------------- 工具 */

    /**
     * 按分隔符拆词。使用字符判定而非正则，避免词里出现 {@code \\} {@code $} 等被正则吃掉。
     *
     * @param line 单行文本
     * @return 去重后的词列表
     */
    private static List<String> splitWords(String line) {
        List<String> words = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (isSeparator(ch)) {
                flush(words, current);
                continue;
            }
            if (Character.isISOControl(ch)) {
                continue;
            }
            current.append(ch);
        }
        flush(words, current);
        return words;
    }

    private static void flush(List<String> words, StringBuilder current) {
        String word = current.toString().trim();
        current.setLength(0);
        if (!word.isEmpty()) {
            /* 此处刻意不去重：重复计数统一交给 register()，
               否则同一行内的重复词会被静默吃掉，「跳过重复 N 条」恒为 0。 */
            words.add(word);
        }
    }

    private static boolean isSeparator(char ch) {
        return ch == '|' || ch == '｜' || ch == ',' || ch == '，' || ch == '、'
            || ch == ';' || ch == '；' || ch == '(' || ch == '（' || ch == ')'
            || ch == '）' || ch == '+' || ch == '＋' || ch == '　' || Character.isWhitespace(ch);
    }

    /**
     * 识别段落标记行。
     *
     * @param line 单行原文
     * @return 命中的标记词；不是标记行返回 null
     */
    private static String matchMarker(String line) {
        if (line.length() > MARKER_MAX_LENGTH) {
            return null;
        }
        String core = stripMarkerNoise(line);
        if (core.isEmpty()) {
            return null;
        }
        for (String marker : EXCLUDE_MARKERS) {
            if (core.equals(marker)) {
                return marker;
            }
        }
        for (String marker : COMBO_MARKERS) {
            if (core.equals(marker)) {
                return marker;
            }
        }
        return null;
    }

    private static boolean isExcludeMarker(String marker) {
        for (String m : EXCLUDE_MARKERS) {
            if (m.equals(marker)) {
                return true;
            }
        }
        return false;
    }

    /** 去掉序号、冒号、空白与破折号，便于「样例1：」与「样例」比对 */
    private static String stripMarkerNoise(String line) {
        StringBuilder sb = new StringBuilder(line.length());
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (Character.isWhitespace(ch) || ch == ':' || ch == '：'
                || ch == '-' || ch == '—' || ch == '．' || ch == '.') {
                continue;
            }
            if (ch >= '0' && ch <= '9') {
                continue;
            }
            sb.append(ch);
        }
        return sb.toString();
    }

    /**
     * 剥离表达式前面的业务自定义标题。
     *
     * <p>「药监监测:(辽宁|沈阳)+(药监局|药品)」里的冒号前缀不属于表达式，
     * 直接送去解析会撞「左括号 '(' 缺少配对的右括号」。只有在冒号右侧确实像
     * 表达式（含括号或竖线）时才剥离，避免把 {@code 时间:12:30} 这类普通词切坏。</p>
     *
     * @param line 单行原文
     * @return 二元数组 {@code [标题, 表达式]}；未命中时两项均为 null
     */
    private static String[] stripLeadingLabel(String line) {
        int idx = -1;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '(' || ch == '（' || ch == '|' || ch == '｜') {
                break;
            }
            if (ch == ':' || ch == '：') {
                idx = i;
                break;
            }
        }
        if (idx <= 0) {
            return new String[]{null, null};
        }
        String title = line.substring(0, idx).trim();
        String rest = line.substring(idx + 1).trim();
        if (title.isEmpty() || rest.isEmpty() || !KeywordExpression.looksLikeExpression(rest)) {
            return new String[]{null, null};
        }
        return new String[]{title, rest};
    }

    private static String label(String section, String fallback) {
        return section == null ? fallback : section;
    }

    private static String clip(String text, int max) {
        if (text == null) {
            return null;
        }
        return text.length() <= max ? text : text.substring(0, max - 3) + "...";
    }
}
`);

/* ==== part11b.js ====  本段由 part11b.js 合并而来，请勿直接编辑：改 part11b.js 后重跑 merge_part11.py ==== */
/* ==========================================================================
 * 18. 词表导入（P0-4）：请求体 / Service / Controller
 * ========================================================================== */

file('collect/keyword/KeywordImportRequest.java', `package ${PKG}.collect.keyword;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 词表导入请求体。
 *
 * @author ruoyi
 */
@Data
public class KeywordImportRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 词表原文（PC 端读取 .txt 后原样提交） */
    private String text;

    /** 绑定到的监测任务ID；为空表示只入库到关键词库、不建任务关联 */
    private Long taskId;

    /** 关键词分组ID；为空则按 groupName 查找或新建 */
    private Long groupId;

    /** 分组名称（groupId 为空时生效） */
    private String groupName;

    /** 任务级匹配策略（覆盖全局）：strict / loose / off，可为空 */
    private String matchStrategy;
}
`);

file('service/IYqKeywordImportService.java', `package ${PKG}.service;

import org.dromara.yuqing.collect.keyword.KeywordImportResult;

/**
 * 关键词词表导入 Service接口。
 *
 * <p>对应 F-002「关键词管理」的批量录入能力：把业务同事手写的词表文本
 * 一次转成 {@code yq_keyword} + {@code yq_task_keyword} 记录。</p>
 *
 * @author ruoyi
 */
public interface IYqKeywordImportService {

    /**
     * 解析预览（不写库）。
     *
     * @param text 词表原文
     * @return 解析结果
     */
    KeywordImportResult preview(String text);

    /**
     * 解析并入库（事务）。
     *
     * @param text          词表原文
     * @param taskId        绑定任务ID，可为空
     * @param groupId       关键词分组ID，可为空
     * @param groupName     分组名称，groupId 为空时生效
     * @param matchStrategy 任务级匹配策略，可为空
     * @return 结果（含入库统计）
     */
    KeywordImportResult commit(String text, Long taskId, Long groupId, String groupName, String matchStrategy);
}
`);

file('service/impl/YqKeywordImportServiceImpl.java', `package ${PKG}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.keyword.KeywordImportItem;
import org.dromara.yuqing.collect.keyword.KeywordImportParser;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqKeywordGroupMapper;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.service.IYqKeywordImportService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 关键词词表导入 Service业务层处理。
 *
 * <p><b>幂等</b>：按 {@code keyword_text} 查找已有记录，命中则复用（不重复插入）；
 * 任务关联按 {@code (task_id, keyword_id)} 去重。因此同一份词表重复导入
 * 只会「补齐」不会「翻倍」。</p>
 *
 * <p><b>安全</b>：全部走 LambdaQueryWrapper，无字符串拼 SQL；
 * 入参长度与条目数双重上限，避免一次请求把库打爆。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqKeywordImportServiceImpl implements IYqKeywordImportService {

    /** 未指定分组时使用的默认分组名 */
    private static final String DEFAULT_GROUP_NAME = "词表导入";

    /** 单次导入文本上限（字符）：一份万行词表远小于此值 */
    private static final int MAX_TEXT_LENGTH = 512 * 1024;

    private final YqKeywordMapper keywordMapper;
    private final YqKeywordGroupMapper keywordGroupMapper;
    private final YqTaskKeywordMapper taskKeywordMapper;
    private final YqTaskMapper taskMapper;

    @Override
    public KeywordImportResult preview(String text) {
        ensureLength(text);
        return KeywordImportParser.parse(text);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KeywordImportResult commit(String text, Long taskId, Long groupId,
                                      String groupName, String matchStrategy) {
        ensureLength(text);
        KeywordImportResult result = KeywordImportParser.parse(text);
        if (!result.isOk()) {
            return result;
        }
        if (taskId != null && taskMapper.selectById(taskId) == null) {
            result.getErrors().add("监测任务不存在：" + taskId);
            return result;
        }
        Long resolvedGroupId = resolveGroup(groupId, groupName);
        result.setGroupId(resolvedGroupId);
        result.setCommitted(true);

        List<Long> touchedKeywordIds = new ArrayList<>();
        for (KeywordImportItem item : result.getItems()) {
            YqKeyword existing = findKeyword(item.getKeywordText());
            Long keywordId;
            if (existing == null) {
                YqKeyword entity = new YqKeyword();
                entity.setGroupId(resolvedGroupId);
                entity.setKeywordText(item.getKeywordText());
                entity.setKeywordType(item.getKeywordType());
                entity.setKeywordCategory(item.getKeywordCategory());
                entity.setComboExpression(item.getComboExpression());
                entity.setRefCount(0);
                entity.setStatus("0");
                entity.setRemark(item.getRemark());
                keywordMapper.insert(entity);
                keywordId = entity.getKeywordId();
                result.setInsertedKeywords(result.getInsertedKeywords() + 1);
            } else {
                keywordId = existing.getKeywordId();
                result.setReusedKeywords(result.getReusedKeywords() + 1);
                /* 早期数据可能只填了文本、没填表达式 —— 补齐，否则组合语义在采集侧仍然丢失 */
                if (StringUtils.isNotBlank(item.getComboExpression())
                    && StringUtils.isBlank(existing.getComboExpression())) {
                    YqKeyword patch = new YqKeyword();
                    patch.setKeywordId(keywordId);
                    patch.setComboExpression(item.getComboExpression());
                    keywordMapper.updateById(patch);
                }
            }
            touchedKeywordIds.add(keywordId);
            if (taskId != null) {
                bindTask(result, taskId, keywordId, matchStrategy);
            }
        }
        if (taskId != null && !touchedKeywordIds.isEmpty()) {
            refreshRefCount(touchedKeywordIds);
        }
        log.info("[词表导入] taskId={} groupId={} {}", taskId, resolvedGroupId, result.summary());
        return result;
    }

    /* ---------------------------------------------------------------- 内部 */

    private void ensureLength(String text) {
        if (text != null && text.length() > MAX_TEXT_LENGTH) {
            throw new ServiceException("词表内容 " + text.length()
                + " 字符，超过单次导入上限 " + MAX_TEXT_LENGTH + "，请拆分后再导入");
        }
    }

    private YqKeyword findKeyword(String keywordText) {
        LambdaQueryWrapper<YqKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqKeyword::getKeywordText, keywordText).last("limit 1");
        List<YqKeyword> list = keywordMapper.selectList(lqw);
        return list.isEmpty() ? null : list.get(0);
    }

    private void bindTask(KeywordImportResult result, Long taskId, Long keywordId, String matchStrategy) {
        LambdaQueryWrapper<YqTaskKeyword> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqTaskKeyword::getTaskId, taskId).eq(YqTaskKeyword::getKeywordId, keywordId);
        if (taskKeywordMapper.selectCount(lqw) > 0) {
            result.setSkippedRelations(result.getSkippedRelations() + 1);
            return;
        }
        YqTaskKeyword rel = new YqTaskKeyword();
        rel.setTaskId(taskId);
        rel.setKeywordId(keywordId);
        rel.setMatchStrategy(matchStrategy);
        taskKeywordMapper.insert(rel);
        result.setBoundRelations(result.getBoundRelations() + 1);
    }

    /** 引用次数 = 关联任务数，逐词重算，避免累加漂移 */
    private void refreshRefCount(List<Long> keywordIds) {
        for (Long keywordId : keywordIds) {
            LambdaQueryWrapper<YqTaskKeyword> lqw = new LambdaQueryWrapper<>();
            lqw.eq(YqTaskKeyword::getKeywordId, keywordId);
            long count = taskKeywordMapper.selectCount(lqw);
            YqKeyword patch = new YqKeyword();
            patch.setKeywordId(keywordId);
            patch.setRefCount((int) count);
            keywordMapper.updateById(patch);
        }
    }

    /**
     * 解析落库分组：传 ID 则校验存在；否则按名称查找，找不到就新建。
     */
    private Long resolveGroup(Long groupId, String groupName) {
        if (groupId != null) {
            if (keywordGroupMapper.selectById(groupId) == null) {
                throw new ServiceException("关键词分组不存在：" + groupId);
            }
            return groupId;
        }
        String name = StringUtils.isBlank(groupName) ? DEFAULT_GROUP_NAME : groupName.trim();
        LambdaQueryWrapper<YqKeywordGroup> lqw = new LambdaQueryWrapper<>();
        lqw.eq(YqKeywordGroup::getGroupName, name);
        List<YqKeywordGroup> exists = keywordGroupMapper.selectList(lqw);
        if (!exists.isEmpty()) {
            return exists.get(0).getGroupId();
        }
        YqKeywordGroup group = new YqKeywordGroup();
        group.setGroupName(name);
        try {
            keywordGroupMapper.insert(group);
        } catch (DuplicateKeyException e) {
            /* uk_yq_kwgroup_name 只含 group_name：同名但已被逻辑删除时会撞唯一键 */
            List<YqKeywordGroup> again = keywordGroupMapper.selectList(lqw);
            if (!again.isEmpty()) {
                return again.get(0).getGroupId();
            }
            throw new ServiceException("关键词分组「" + name
                + "」已存在同名记录（可能已被删除），请换一个分组名或先恢复该分组", e);
        }
        return group.getGroupId();
    }
}
`);

file('controller/YqKeywordImportController.java', `package ${PKG}.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.collect.keyword.KeywordImportRequest;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.dromara.yuqing.service.IYqKeywordImportService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 关键词词表导入 Controller。
 *
 * <p>独立于 {@code YqKeywordController}（后者由字段生成器产出），
 * 避免生成器与手写扩展互相覆盖。</p>
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/keyword/import")
public class YqKeywordImportController extends BaseController {

    private final IYqKeywordImportService keywordImportService;

    /**
     * 解析预览：返回条目、错误与统计，不写库。
     */
    @SaCheckPermission("yuqing:keyword:add")
    @PostMapping("/parse")
    public R<KeywordImportResult> parse(@RequestBody(required = false) KeywordImportRequest request) {
        return R.ok(keywordImportService.preview(request == null ? null : request.getText()));
    }

    /**
     * 解析并入库。
     */
    @SaCheckPermission("yuqing:keyword:add")
    @Log(title = "关键词词表导入", businessType = BusinessType.INSERT)
    @PostMapping("/commit")
    public R<KeywordImportResult> commit(@RequestBody(required = false) KeywordImportRequest request) {
        if (request == null || StringUtils.isBlank(request.getText())) {
            return R.fail("导入内容不能为空");
        }
        KeywordImportResult result = keywordImportService.commit(
            request.getText(), request.getTaskId(), request.getGroupId(),
            request.getGroupName(), request.getMatchStrategy());
        if (!result.isOk()) {
            return R.fail(result.getErrors().get(0), result);
        }
        return R.ok(result);
    }
}
`);

/* ==== part11c.js ====  本段由 part11c.js 合并而来，请勿直接编辑：改 part11c.js 后重跑 merge_part11.py ==== */
/* ==========================================================================
 * 19. 词表导入（P0-4）：PC 端接口封装 + 导入对话框
 *   ⚠ 本段 Vue/TS 内容一律不用模板字符串（反引号与 ${），
 *     避免嵌在生成器的模板字符串里被提前求值。
 * ========================================================================== */

file('pc/api/yuqing/keyword/import.ts', `import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/** 单条待导入关键词 */
export interface KeywordImportItem {
  /** 关键词文本 */
  keywordText: string;
  /** 类型：combo / negative / fuzzy */
  keywordType: string;
  /** 分类：core / related / block */
  keywordCategory: string;
  /** 组合表达式原文（仅 combo） */
  comboExpression?: string;
  /** 备注 */
  remark?: string;
  /** 原文行号 */
  lineNo?: number;
  /** 组合表达式组数 */
  groupCount?: number;
  /** 组合表达式总词数 */
  wordCount?: number;
  /** 检索词组（真正发起检索的词） */
  searchTerms?: string[];
  /** 是否来自表达式内联排除 */
  inlineExclude?: boolean;
  /** 是否因重复被跳过 */
  duplicate?: boolean;
}

/** 导入解析 / 入库结果 */
export interface KeywordImportResult {
  items: KeywordImportItem[];
  errors: string[];
  warnings: string[];
  duplicates: string[];
  totalLines: number;
  comboCount: number;
  negativeCount: number;
  plainCount: number;
  duplicateCount: number;
  inlineExcludeCount: number;
  searchTermCount: number;
  insertedKeywords: number;
  reusedKeywords: number;
  boundRelations: number;
  skippedRelations: number;
  groupId?: number;
  committed: boolean;
}

/** 导入请求 */
export interface KeywordImportForm {
  /** 词表原文 */
  text: string;
  /** 绑定监测任务ID，可为空 */
  taskId?: number | null;
  /** 关键词分组ID，可为空 */
  groupId?: number | null;
  /** 分组名称（groupId 为空时生效） */
  groupName?: string | null;
  /** 任务级匹配策略：strict / loose / off */
  matchStrategy?: string | null;
}

/**
 * 解析预览（不入库）
 */
export const parseKeywordImport = (data: KeywordImportForm): AxiosPromise<KeywordImportResult> => {
  return request({
    url: '/yuqing/keyword/import/parse',
    method: 'post',
    data
  });
};

/**
 * 解析并入库
 */
export const commitKeywordImport = (data: KeywordImportForm): AxiosPromise<KeywordImportResult> => {
  return request({
    url: '/yuqing/keyword/import/commit',
    method: 'post',
    data
  });
};

/**
 * 组合表达式语法校验（F-002 验收标准 3）
 * 返回带列位置的错误说明；空数组表示合法。
 */
export const validateKeywordExpression = (expression: string): AxiosPromise<string[]> => {
  return request({
    url: '/yuqing/collect/keyword/validate',
    method: 'get',
    params: { expression }
  });
};
`);

file('pc/views/yuqing/keyword/KeywordImportDialog.vue', `<template>
  <el-dialog title="导入词表" v-model="visible" width="960px" append-to-body @closed="handleClosed">
    <el-alert type="info" :closable="false" show-icon class="mb8">
      <template #title>
        支持词表格式：段落标记行（<b>样例:</b> / <b>排除:</b>）+ 组合表达式行 + 排除词行。组合表达式内以最后
        一组作为检索词，例如 (辽宁|沈阳)+(药监局|药品) 只会用「药监局/药品」两个词发起检索，地区在本地校验。
      </template>
    </el-alert>

    <el-form label-width="100px" class="mb8">
      <el-form-item label="词表文件">
        <el-upload
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
          accept=".txt,.csv,.text"
          style="display: inline-block"
        >
          <el-button icon="Upload">选择 .txt 文件</el-button>
        </el-upload>
        <el-button link type="primary" @click="handleClear">清空</el-button>
        <span v-if="fileName" class="file-name">已读取：{{ fileName }}</span>
      </el-form-item>

      <el-form-item label="词表内容">
        <el-input v-model="form.text" type="textarea" :rows="10" placeholder="也可以直接粘贴词表内容" />
      </el-form-item>

      <el-row :gutter="10">
        <el-col :span="8">
          <el-form-item label="绑定任务" label-width="100px">
            <el-select v-model="form.taskId" placeholder="不绑定则只入库" clearable filterable style="width: 100%">
              <el-option v-for="o in taskOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="关键词分组" label-width="100px">
            <el-select v-model="form.groupId" placeholder="默认「词表导入」" clearable filterable style="width: 100%">
              <el-option v-for="o in groupOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="匹配策略" label-width="100px">
            <el-select v-model="form.matchStrategy" placeholder="沿用默认" clearable style="width: 100%">
              <el-option label="严格（必须命中全部词组）" value="strict" />
              <el-option label="宽松（命中任一词组即可）" value="loose" />
              <el-option label="关闭本地匹配（只检索）" value="off" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <div class="mb8">
      <el-button type="primary" icon="View" :loading="parsing" @click="handleParse">解析预览</el-button>
      <el-button type="success" icon="Check" :loading="committing" :disabled="!canCommit" @click="handleCommit">确认导入</el-button>
    </div>

    <template v-if="result">
      <el-alert :type="result.errors.length ? 'error' : 'success'" :closable="false" show-icon class="mb8">
        <template #title>{{ summaryText }}</template>
      </el-alert>

      <el-alert v-if="result.errors.length" type="error" :closable="false" class="mb8">
        <template #title>需修正的问题（{{ result.errors.length }} 条，修正后才能导入）</template>
        <div v-for="(e, i) in result.errors.slice(0, 30)" :key="'e' + i">{{ e }}</div>
        <div v-if="result.errors.length > 30">…… 其余 {{ result.errors.length - 30 }} 条省略</div>
      </el-alert>

      <el-alert v-if="result.warnings.length" type="warning" :closable="false" class="mb8">
        <template #title>提醒（{{ result.warnings.length }} 条，不阻断导入）</template>
        <div v-for="(w, i) in result.warnings.slice(0, 20)" :key="'w' + i">{{ w }}</div>
      </el-alert>

      <el-table :data="previewRows" height="280" border size="small">
        <el-table-column label="行" prop="lineNo" width="60" align="center" />
        <el-table-column label="关键词文本" prop="keywordText" min-width="220" show-overflow-tooltip />
        <el-table-column label="类型" prop="keywordType" width="90" align="center">
          <template #default="scope">
            <el-tag :type="typeTag(scope.row.keywordType)" size="small">{{ typeLabel(scope.row.keywordType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结构" width="150" align="center">
          <template #default="scope">
            <span v-if="scope.row.keywordType === 'combo'">
              {{ scope.row.groupCount }} 组 / {{ scope.row.wordCount }} 词 / 检索 {{ (scope.row.searchTerms || []).length }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="220" show-overflow-tooltip />
      </el-table>
      <div v-if="result.items.length > previewRows.length" class="table-tip">
        仅展示前 {{ previewRows.length }} 条，共 {{ result.items.length }} 条
      </div>
    </template>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">关 闭</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup name="KeywordImportDialog" lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { parseKeywordImport, commitKeywordImport } from '@/api/yuqing/keyword/import';
import type { KeywordImportForm, KeywordImportItem, KeywordImportResult } from '@/api/yuqing/keyword/import';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqKeywordGroup } from '@/api/yuqing/keywordGroup/index';

const emit = defineEmits(['success']);

const PREVIEW_LIMIT = 200;

const visible = ref(false);
const fileName = ref('');
const parsing = ref(false);
const committing = ref(false);
const result = ref<KeywordImportResult | null>(null);
const taskOptions = ref<Array<{ label: string; value: any }>>([]);
const groupOptions = ref<Array<{ label: string; value: any }>>([]);

const form = reactive<KeywordImportForm>({
  text: '',
  taskId: null,
  groupId: null,
  groupName: null,
  matchStrategy: null
});

const previewRows = computed<KeywordImportItem[]>(() => (result.value ? result.value.items.slice(0, PREVIEW_LIMIT) : []));

const canCommit = computed(() => !!result.value && result.value.errors.length === 0 && result.value.items.length > 0);

const summaryText = computed(() => {
  const r = result.value;
  if (!r) {
    return '';
  }
  if (r.committed) {
    return '导入完成：新增关键词 ' + r.insertedKeywords + ' 条，复用 ' + r.reusedKeywords
      + ' 条，新建任务关联 ' + r.boundRelations + ' 条（已存在跳过 ' + r.skippedRelations + ' 条）。';
  }
  const parts = [
    '解析出 ' + r.items.length + ' 条',
    '组合 ' + r.comboCount,
    '排除 ' + r.negativeCount,
    '普通 ' + r.plainCount
  ];
  if (r.duplicateCount > 0) {
    parts.push('跳过重复 ' + r.duplicateCount);
  }
  if (r.inlineExcludeCount > 0) {
    parts.push('内联排除 ' + r.inlineExcludeCount);
  }
  if (r.searchTermCount > 0) {
    parts.push('预计检索请求 ' + r.searchTermCount + ' 次');
  }
  return parts.join(' · ');
});

function typeLabel(type: string): string {
  if (type === 'combo') {
    return '组合';
  }
  if (type === 'negative') {
    return '排除';
  }
  return '普通';
}

/** el-tag 的 type 只接受这五个字面量，返回 string 会触发 TS2322 */
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger';

function typeTag(type: string): TagType {
  if (type === 'combo') {
    return 'primary';
  }
  if (type === 'negative') {
    return 'danger';
  }
  return 'info';
}

async function handleFileChange(uploadFile: any): Promise<void> {
  const raw = uploadFile && uploadFile.raw;
  if (!raw) {
    return;
  }
  try {
    form.text = await raw.text();
    fileName.value = raw.name;
    result.value = null;
  } catch (e) {
    ElMessage.error('文件读取失败，请改用粘贴方式');
  }
}

function handleClear(): void {
  form.text = '';
  fileName.value = '';
  result.value = null;
}

function buildPayload(): KeywordImportForm {
  return {
    text: form.text,
    taskId: form.taskId ?? null,
    groupId: form.groupId ?? null,
    groupName: form.groupName ?? null,
    matchStrategy: form.matchStrategy ?? null
  };
}

async function handleParse(): Promise<void> {
  if (!form.text || !form.text.trim()) {
    ElMessage.warning('请先选择文件或粘贴词表内容');
    return;
  }
  parsing.value = true;
  try {
    const res = await parseKeywordImport(buildPayload());
    result.value = res.data as KeywordImportResult;
  } finally {
    parsing.value = false;
  }
}

async function handleCommit(): Promise<void> {
  if (!form.text || !form.text.trim()) {
    ElMessage.warning('请先选择文件或粘贴词表内容');
    return;
  }
  committing.value = true;
  try {
    const res = await commitKeywordImport(buildPayload());
    result.value = res.data as KeywordImportResult;
    ElMessage.success('导入完成');
    emit('success');
  } finally {
    committing.value = false;
  }
}

function handleClosed(): void {
  result.value = null;
}

async function loadOptions(): Promise<void> {
  if (taskOptions.value.length === 0) {
    const res = await optionselectYqTask({});
    taskOptions.value = (res.data ?? []).map((i: any) => ({ label: i.taskName, value: i.taskId }));
  }
  if (groupOptions.value.length === 0) {
    const res = await optionselectYqKeywordGroup({});
    groupOptions.value = (res.data ?? []).map((i: any) => ({ label: i.groupName, value: i.groupId }));
  }
}

function open(): void {
  visible.value = true;
  loadOptions();
}

defineExpose({ open });
</script>

<style scoped>
.file-name {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.table-tip {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
}
</style>
`);

/* ==== part11d.js ====  本段由 part11d.js 合并而来，请勿直接编辑：改 part11d.js 后重跑 merge_part11.py ==== */
/* ==========================================================================
 * 20. 词表导入（P0-4）：真实样例词表 SQL 种子 + 解析器单测
 *   数据由《关键词样例.txt》脚本实测生成并已核验：
 *   组合 2 条（16+6 / 5+4）、排除词 188 条原始 → 177 条去重（跳 11）、检索请求 10 次
 * ========================================================================== */

/** 真实样例中的组合表达式（已归一化） */
const SAMPLE_COMBOS = [
  {
    seq: 1,
    label: '样例1',
    text: '(辽宁|沈阳|大连|鞍山|抚顺|本溪|丹东|锦州|营口|阜新|辽阳|盘锦|铁岭|朝阳市|葫芦岛|沈抚)+(药监局|药品|医疗器械|化妆品|服务区|药品监督)',
    groupCount: 2,
    wordCount: 22,
    searchTerms: ["药监局","药品","医疗器械","化妆品","服务区","药品监督"],
    remark: '样例1：2 组 / 22 词，以 6 个检索词发起检索；地区类词组只在本地校验，不放大检索请求'
  },
  {
    seq: 2,
    label: '样例2',
    text: '(东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超)',
    groupCount: 2,
    wordCount: 9,
    searchTerms: ["地区城市足球联赛","东北足球超级联赛","东北区域城市足球联赛","东北超"],
    remark: '样例2：2 组 / 9 词，以 4 个检索词发起检索；地区类词组只在本地校验，不放大检索请求'
  }
];

/** 真实样例中的排除词（已去重） */
const SAMPLE_EXCLUDES = [
  '国事访问',
  '被查',
  '离职',
  '妈妈',
  '超厚',
  '爆款',
  '套餐',
  '超级大串',
  '超实在',
  '湖南',
  '司机',
  '吴石',
  '鲲鹏',
  '亚太经合组织',
  '四川',
  '梅西',
  '日本',
  '新基建',
  '鹤城',
  '艺术',
  '美国',
  '文革',
  '粉条',
  '超市',
  '东北超大卷饼',
  '批发二手车',
  '东北超哥',
  '东北超值',
  '东北超长',
  '东北超赞',
  '东南东北',
  '手工饺子',
  '东北部',
  '云南省城市足球联赛',
  '江苏城市足球联赛',
  '东北超22号楼',
  '东北超自然',
  '东北超过',
  '东北超绝',
  '东北杯',
  '东北超拽',
  '东北超轻',
  '上架天东北超',
  '上架天“东北超”',
  '东北超10',
  '东北面',
  '渝东北三峡库',
  '江苏省城市足球联赛',
  '渝东北',
  '海南省城市足球联赛',
  '东北超力',
  '东北超保暖',
  '省足球联赛育儿',
  '外穿东北超',
  '东北超杀女',
  '东北超大',
  '东北超火',
  '扬州市城市足球联赛',
  '中国职工足球联赛',
  '没法去东北',
  '东北超小众',
  '东北超小',
  '东北超暖',
  '卢浮宫“东北超”',
  '“东北超”值得违法”',
  '超级无敌',
  '东北超姐',
  '超级铁饭碗',
  '东北超体',
  '天鹅新闻',
  '东北超人',
  '东北超米',
  '超级大省',
  '东北超越',
  '东北超jsn',
  '东北超神',
  '东北超低',
  '东北超薄',
  '东北超省心',
  '东北超爷',
  '东北超棒',
  '东北侧',
  '东北超酱',
  '东北超踢',
  '东北超广角',
  '东北安日烧烤',
  '东北超干燥',
  '巴西足球联赛',
  '东北超鲁西南',
  '东北超甜',
  '东北超歌',
  '广西',
  '东北超喜欢',
  '东北大汉',
  '加绒加厚',
  '东北超级冷',
  '东北超出片',
  '超出片',
  '超级邪',
  '超级大西瓜',
  '肖战',
  '东北超冷',
  '东北超远',
  '超乎想象',
  '县长杯',
  '超级恶劣',
  '排骨米饭',
  '超级好品质',
  '超级大',
  '超级像',
  '酱大骨',
  '超级近',
  '超级下饭菜',
  '超级好玩',
  '东华杯',
  '定南',
  '超推荐',
  '更在乎记录这一瞬间的意义',
  '超级老妈',
  '注定无人能懂',
  '超粉',
  '超美景色',
  '英姿',
  '超盖浇饭',
  '孔城中心小学',
  '安徽省青少年',
  '超吨车',
  '东北角',
  '长江大学足球联赛',
  '超爱',
  '超前',
  '东北甜妹',
  '东北师范大学',
  '湘超足球联赛',
  '东北80米',
  '东北超软',
  'w25170055',
  'zhc55555555',
  '超级水区',
  '仔细想想守门带给了我什么',
  '赵昭仪',
  '东北风',
  '苏州卓越高校校友联盟足球联赛',
  '超划算春饼',
  '中国足球联赛',
  '足球联赛的规则',
  '超需要',
  '东北抖音号',
  '校园足球联赛',
  '超级舞蹈',
  '东北菜',
  '学生足球联赛',
  '超强音',
  '超嗷嗷叫',
  '超雄甜美',
  '超级豆人',
  '淮安市城市足球联赛',
  '东北超超',
  '东北姐弟恋',
  '”县区足球联赛宿城队',
  '超音速',
  '青少年足球联赛',
  '超恶',
  '超多门店',
  '超解腻',
  '超级特产',
  '超4万斤',
  '超多景点',
  '超货纳',
  '超好吃',
  '超深桩基工程',
  '东北路小学',
  '超有市井气息',
  '超巨型盖浇饭',
  '超级小町',
  '超难超长句',
  '超美童话小镇'
];

const SAMPLE_GROUP_ID = '1761600000000000000';
const SAMPLE_KW_BASE = 1761600000000000100n;
const SAMPLE_REL_BASE = '1761700000000000000';
const AUDIT_DEPT = '1761000000000000103';
const AUDIT_BY = '1761100000000000001';

{
  const esc = (v) => (v == null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'");
  const rows = [];
  SAMPLE_COMBOS.forEach((c, i) => {
    const id = (SAMPLE_KW_BASE + BigInt(i)).toString();
    rows.push('  (' + id + ', ' + SAMPLE_GROUP_ID + ', ' + esc(c.text) + ', \'combo\', \'core\', '
      + esc(c.text) + ', 0, \'0\', \'0\', ' + esc(c.remark) + ', ' + AUDIT_DEPT + ', ' + AUDIT_BY
      + ', sysdate(), NULL, NULL)');
  });
  SAMPLE_EXCLUDES.forEach((w, i) => {
    const id = (SAMPLE_KW_BASE + BigInt(100 + i)).toString();
    rows.push('  (' + id + ', ' + SAMPLE_GROUP_ID + ', ' + esc(w) + ', \'negative\', \'block\', NULL, '
      + '0, \'0\', \'0\', '
      + esc('样例词表排除词（keyword_type=negative，绑定任务后生效）') + ', '
      + AUDIT_DEPT + ', ' + AUDIT_BY + ', sysdate(), NULL, NULL)');
  });

  const total = SAMPLE_COMBOS.length + SAMPLE_EXCLUDES.length;
  const searchTerms = SAMPLE_COMBOS.reduce((a, c) => a + c.searchTerms.length, 0);
  const sql = [
    '-- ============================================================',
    '-- 关键词样例词表导入（由《关键词样例.txt》脚本实测生成）',
    '--',
    '-- 实测数量（改数字前先重跑校验脚本）：',
    '--   组合表达式   ' + SAMPLE_COMBOS.length + ' 条',
    '--   排除词       ' + SAMPLE_EXCLUDES.length + ' 条（原始 188 条，去重跳过 11 条）',
    '--   预计检索请求 ' + searchTerms + ' 次/轮',
    '--',
    '-- 本脚本只落关键词库 yq_keyword，不建 yq_task_keyword 关联。排除词必须绑定',
    '-- 到具体任务才生效（任务级降噪，避免误杀其他任务的舆情）。绑定请走',
    '-- PC「关键词管理 → 导入词表」勾选任务，或参考文末示例 SQL。',
    '-- ============================================================',
    '',
    '-- 关键词分组',
    'DELETE FROM yq_keyword_group WHERE group_id = ' + SAMPLE_GROUP_ID + ';',
    'INSERT INTO yq_keyword_group (group_id, group_name, del_flag, create_dept, create_by, create_time, update_by, update_time)',
    "VALUES (" + SAMPLE_GROUP_ID + ", '样例词表导入', '0', " + AUDIT_DEPT + ', ' + AUDIT_BY + ', sysdate(), NULL, NULL);',
    '',
    '-- 关键词（组合 ' + SAMPLE_COMBOS.length + ' + 排除 ' + SAMPLE_EXCLUDES.length + ' = ' + total + '）',
    'DELETE FROM yq_keyword WHERE group_id = ' + SAMPLE_GROUP_ID + ';',
    'INSERT INTO yq_keyword (keyword_id, group_id, keyword_text, keyword_type, keyword_category, combo_expression, ref_count, status, del_flag, remark, create_dept, create_by, create_time, update_by, update_time)',
    'VALUES',
    rows.join(',\n') + ';',
    '',
    '-- 引用计数与关键词库保持一致',
    'UPDATE yq_keyword SET ref_count = (SELECT COUNT(*) FROM yq_task_keyword tk WHERE tk.keyword_id = yq_keyword.keyword_id)',
    'WHERE group_id = ' + SAMPLE_GROUP_ID + ';',
    '',
    '-- ============================================================',
    '-- 按需：把本组关键词绑定到任务（把 :task_id 换成真实任务ID后取消注释）',
    '-- ============================================================',
    '-- INSERT INTO yq_task_keyword (id, task_id, keyword_id, match_strategy, create_dept, create_by, create_time, update_by, update_time)',
    '-- SELECT ' + SAMPLE_REL_BASE + ' + ROW_NUMBER() OVER (ORDER BY keyword_id), :task_id, keyword_id, \'strict\', '
      + AUDIT_DEPT + ', ' + AUDIT_BY + ', sysdate(), NULL, NULL',
    '--   FROM yq_keyword WHERE group_id = ' + SAMPLE_GROUP_ID + ';',
    '-- UPDATE yq_keyword SET ref_count = (SELECT COUNT(*) FROM yq_task_keyword tk WHERE tk.keyword_id = yq_keyword.keyword_id)',
    '--  WHERE group_id = ' + SAMPLE_GROUP_ID + ';',
    '',
    '-- ============================================================',
    '-- 校验：期望 combo = ' + SAMPLE_COMBOS.length + '，negative = ' + SAMPLE_EXCLUDES.length + '，合计 ' + total,
    '-- ============================================================',
    '-- SELECT keyword_type, COUNT(*) FROM yq_keyword WHERE group_id = ' + SAMPLE_GROUP_ID + ' GROUP BY keyword_type;',
    ''
  ].join('\n');

  file('sql/yq_keyword_sample_import.sql', sql);
}

file('test/java/org/dromara/yuqing/collect/YqKeywordImportTest.java', `package org.dromara.yuqing.collect;

import org.dromara.yuqing.collect.keyword.KeywordExpression;
import org.dromara.yuqing.collect.keyword.KeywordImportItem;
import org.dromara.yuqing.collect.keyword.KeywordImportParser;
import org.dromara.yuqing.collect.keyword.KeywordImportResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 词表导入解析离线自测（P0-4）。
 *
 * <p>样例原文取自业务同事真实提交的《关键词样例.txt》，数量为脚本实测值：
 * 组合 2 条、排除词原始 188 条 → 去重 177 条（跳过 11 条）、检索请求 10 次。</p>
 *
 * @author ruoyi
 */
@Tag("dev")
@DisplayName("词表导入解析")
class YqKeywordImportTest {

    /** 业务同事真实样例原文 */
    private static final String SAMPLE = """
样例1：
(辽宁|沈阳|大连|鞍山|抚顺|本溪|丹东|锦州|营口|阜新|辽阳|盘锦|铁岭|朝阳市|葫芦岛|沈抚)+(药监局|药品|医疗器械|化妆品|服务区|药品监督)
样例2：
((东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超))

排除：

国事访问|被查|离职|妈妈|超厚|爆款|套餐|超级大串|超实在|湖南|司机|吴石|鲲鹏|亚太经合组织|四川|梅西|日本|新基建|鹤城|艺术|美国|文革|粉条|超市|东北超大卷饼|批发二手车|东北超哥|东北超值|东北超哥|东北超长|东北超赞|东南东北|手工饺子|东北部|云南省城市足球联赛|江苏城市足球联赛|东北超22号楼|东北超自然|东北超过|东北超绝|东北杯|东北超拽|东北超轻|上架天东北超|上架天“东北超”|东北超10|东北面|渝东北三峡库|江苏省城市足球联赛|渝东北|海南省城市足球联赛|东北超力|东北超保暖|省足球联赛育儿|外穿东北超|东北超杀女|东北超大|东北超火|扬州市城市足球联赛|中国职工足球联赛|没法去东北|东北超火|东北超小众|东北超小|东北超暖|卢浮宫“东北超”|东北超火|外穿东北超|“东北超”值得违法”|超级无敌|东北超姐|超级铁饭碗|东北超体|天鹅新闻|东北超人|东北超米|超级大省|东北超越|东北超jsn|东北超神|东北超低|东北超薄|东北超姐|东北超省心|东北超爷|东北超棒|东北侧|东北超酱|东北超踢|东北超广角|东北安日烧烤|东北超干燥|巴西足球联赛|东北超鲁西南|东北超甜|东北超歌|广西|东北超喜欢|东北超人|东北大汉|加绒加厚|东北超级冷|东北超出片|超出片|超级邪|超级大西瓜|肖战|东北超冷|东北超远|东北超冷|超乎想象|县长杯|超级恶劣|排骨米饭|超级恶劣|超级好品质|超级大|超级像|酱大骨|超级近|超级下饭菜|超级好玩|东华杯|定南|超推荐|更在乎记录这一瞬间的意义|超级老妈|注定无人能懂|超粉|超美景色|英姿|超盖浇饭|孔城中心小学|安徽省青少年|超吨车|东北角|长江大学足球联赛|超爱|超前|东北甜妹|东北师范大学|湘超足球联赛|东北80米|东北超软|w25170055|zhc55555555|超级水区|超级水区|仔细想想守门带给了我什么|赵昭仪|东北风|苏州卓越高校校友联盟足球联赛|超划算春饼|中国足球联赛|足球联赛的规则|超需要|东北抖音号|校园足球联赛|超级舞蹈|东北菜|学生足球联赛|超强音|超嗷嗷叫|超雄甜美|超级豆人|淮安市城市足球联赛|东北超超|东北姐弟恋|淮安市城市足球联赛|”县区足球联赛宿城队|超音速|青少年足球联赛|超恶|超多门店|超解腻|超级特产|超4万斤|超多景点|超货纳|超好吃|超级特产|超深桩基工程|东北路小学|超有市井气息|超巨型盖浇饭|超级小町|超难超长句|超美童话小镇
""";

    @Test
    @DisplayName("真实样例：2 条组合 + 177 条排除 + 跳过 11 条重复")
    void parseRealSample() {
        KeywordImportResult result = KeywordImportParser.parse(SAMPLE);
        assertTrue(result.isOk(), () -> "真实样例应无语法错误，实际：" + result.getErrors());
        assertEquals(2, result.getComboCount(), "组合表达式条数");
        assertEquals(177, result.getNegativeCount(), "去重后排除词条数");
        assertEquals(0, result.getPlainCount(), "普通词条数");
        assertEquals(11, result.getDuplicateCount(), "重复跳过条数");
        assertEquals(179, result.getItems().size(), "待入库条目总数");
        assertEquals(10, result.getSearchTermCount(), "检索请求次数（6 + 4）");
    }

    @Test
    @DisplayName("样例2：整段外层括号被自动剥离，不再报「不支持嵌套括号」")
    void redundantOuterParensAreStripped() {
        String raw = "((东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超))";
        assertTrue(raw.startsWith("(("), "原始写法应带多层外层括号");

        List<String> issues = KeywordExpression.validate(raw);
        assertTrue(issues.isEmpty(), () -> "外层括号应被剥离：" + issues);

        KeywordExpression parsed = KeywordExpression.parse(raw);
        assertEquals(2, parsed.getGroups().size(), "组数");
        assertEquals(List.of("东北", "东三省", "辽吉黑内蒙", "东北四省", "东北三省"), parsed.getGroups().get(0));
        assertEquals(List.of("地区城市足球联赛", "东北足球超级联赛", "东北区域城市足球联赛", "东北超"), parsed.primaryGroup());

        /* 归一化结果必须洗干净：既不留外层括号，也不留前后空白（否则 keyword_text 会脏、去重失效） */
        assertEquals("(东北|东三省|辽吉黑内蒙|东北四省|东北三省)+(地区城市足球联赛|东北足球超级联赛|东北区域城市足球联赛|东北超)", parsed.getNormalized());
    }

    @Test
    @DisplayName("非冗余的嵌套括号仍判定为语法错误")
    void nestedParensStillRejected() {
        List<String> issues = KeywordExpression.validate("((A|B)+(C|D))+(E|F)");
        assertFalse(issues.isEmpty(), "首括号中途闭合，不属于「整段外层括号」");
        assertTrue(issues.get(0).contains("嵌套"), issues.get(0));
    }

    @Test
    @DisplayName("只含排除词的表达式被拒绝")
    void excludeOnlyExpressionRejected() {
        List<String> issues = KeywordExpression.validate("-(广告|代理)");
        assertFalse(issues.isEmpty());
        assertTrue(issues.get(0).contains("缺少检索词组"), issues.get(0));
    }

    @Test
    @DisplayName("表达式内联排除段同时登记为排除词条目")
    void inlineExcludesBecomeNegativeItems() {
        KeywordImportResult result = KeywordImportParser.parse("样例:(东北超|辽超)+(足球联赛)-(广告|代理|招聘)");
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(1, result.getComboCount());
        assertEquals(3, result.getNegativeCount());
        assertEquals(3, result.getInlineExcludeCount());
        assertTrue(result.getItems().stream()
            .anyMatch(i -> "广告".equals(i.getKeywordText()) && i.isInlineExclude()));
    }

    @Test
    @DisplayName("排除词段支持换行分隔")
    void excludeSectionSupportsNewlineSeparated() {
        String text = """
排除:
广告
代理
招聘
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(3, result.getNegativeCount());
    }

    @Test
    @DisplayName("与段落标记同形的普通词不会被误吞")
    void markerLookalikeIsNotSwallowed() {
        String text = """
例
排除率
排除:
广告|代理
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(2, result.getPlainCount(), "「例」「排除率」应作为普通词");
        assertEquals(2, result.getNegativeCount(), "「排除:」之后才是排除词段");
    }

    @Test
    @DisplayName("段落标记行只在独占一行时生效，行内标题走剥离逻辑")
    void leadingLabelIsStripped() {
        String text = """
药监监测:(辽宁|沈阳)+(药监局|药品)
时间:12:30
""";
        KeywordImportResult result = KeywordImportParser.parse(text);
        assertTrue(result.isOk(), () -> String.valueOf(result.getErrors()));
        assertEquals(1, result.getComboCount(), "带标题的组合表达式应被识别");
        assertEquals(1, result.getPlainCount(), "含冒号的普通词不应被当成标题");
        assertEquals("时间:12:30", result.plains().get(0).getKeywordText());
        assertTrue(result.combos().get(0).getRemark().contains("药监监测"),
            "标题应写进备注，便于回溯来源：" + result.combos().get(0).getRemark());
    }

    @Test
    @DisplayName("超过 keyword_text 列宽的表达式报错而不是静默截断")
    void tooLongExpressionIsRejected() {
        StringBuilder builder = new StringBuilder("(");
        for (int i = 0; builder.length() < 60; i++) {
            if (i > 0) {
                builder.append('|');
            }
            builder.append("地区").append(i);
        }
        builder.append(")+(");
        for (int i = 0; builder.length() < 130; i++) {
            if (i > 0) {
                builder.append('|');
            }
            builder.append("主题").append(i);
        }
        builder.append(')');
        KeywordImportResult result = KeywordImportParser.parse(builder.toString());
        assertFalse(result.isOk(), "超长表达式应报错");
        assertTrue(result.getErrors().get(0).contains("列宽"), result.getErrors().get(0));
    }

    @Test
    @DisplayName("空内容报错，不返回空成功")
    void blankInputRejected() {
        assertFalse(KeywordImportParser.parse("").isOk());
        assertFalse(KeywordImportParser.parse("   ").isOk());
    }

    @Test
    @DisplayName("组合表达式只以最后一组作为检索词（不放大检索请求）")
    void lastGroupIsSearchGroup() {
        KeywordImportResult result = KeywordImportParser.parse(SAMPLE);
        KeywordImportItem first = result.combos().get(0);
        assertEquals(6, first.getSearchTerms().size(), "样例1 检索词应为 6 个主题词");
        assertEquals(2, first.getGroupCount());
        assertEquals(22, first.getWordCount());
    }
}
`);

/* ==========================================================================
 * 12.5 F-006 数据净化与链接去重
 *   包路径 collect/clean —— 正文标准化 + 七类降噪 + 按天链接去重 + 跨渠道合并，
 *   外加「历史数据按新规则重跑」的服务与接口（验收标准 9）。
 * ========================================================================== */

file('collect/clean/NoiseCategory.java', `package ${PKG}.collect.clean;

import java.util.Locale;

/**
 * 七类低价值数据（F-006 验收标准 1）。
 *
 * <p>取值与字典 {@code yq_noise_category} 严格一致：字典项改了这里也要改，
 * 否则台账里的「剔除原因」下拉会筛不出数据。</p>
 *
 * @author ruoyi
 */
public enum NoiseCategory {

    /** 垃圾内容 */
    SPAM("spam", "垃圾内容"),
    /** 广告营销 */
    ADVERTISEMENT("advertisement", "广告营销"),
    /** 灌水评论 */
    FLOODING("flooding", "灌水评论"),
    /** 无意义短句 */
    MEANINGLESS("meaningless", "无意义短句"),
    /** 机器人内容 */
    BOT("bot", "机器人内容"),
    /** 空白内容 */
    BLANK("blank", "空白内容"),
    /** 违规屏蔽 */
    VIOLATION("violation", "违规屏蔽");

    private final String code;

    private final String label;

    NoiseCategory(String code, String label) {
        this.code = code;
        this.label = label;
    }

    /**
     * 字典取值。
     *
     * @return 与 {@code yq_noise_category.dict_value} 一致的编码
     */
    public String code() {
        return code;
    }

    /**
     * 字典标签。
     *
     * @return 中文名
     */
    public String label() {
        return label;
    }

    /**
     * 按编码解析枚举。
     *
     * @param code 编码（大小写与首尾空格不敏感）
     * @return 对应枚举；无法识别时返回 null
     */
    public static NoiseCategory of(String code) {
        if (code == null || code.isBlank()) {
            return null;
        }
        String v = code.trim().toLowerCase(Locale.ROOT);
        for (NoiseCategory c : values()) {
            if (c.code.equals(v)) {
                return c;
            }
        }
        return null;
    }

    /**
     * 是否为已定义的降噪类别。
     *
     * @param code 编码
     * @return true 表示七类之一
     */
    public static boolean isKnown(String code) {
        return of(code) != null;
    }
}
`);

file('collect/clean/ContentPurifier.java', `package ${PKG}.collect.clean;

import java.util.Locale;

/**
 * 正文标准化（F-006「统一数据格式」）。
 *
 * <p>四步：去脚本/样式块 → 剥 HTML 标签 → 解码常用实体 → 空白与全半角归一。
 * 全程用字符扫描而不是正则：抓取回来的 HTML 脏得没边（缺闭合、嵌套错乱），
 * 正则既慢又容易在畸形输入上回溯爆栈。</p>
 *
 * <p><b>安全基线：</b>本类只产出纯文本，不做「白名单标签放行」——
 * 舆情正文属于不可信内容，一律降级为文本后再入库与展示，从源头消掉 XSS。</p>
 *
 * @author ruoyi
 */
public final class ContentPurifier {

    /** 需要整块抹掉的标签（内容一并丢弃，防脚本文本被当成正文） */
    private static final String[] DROP_BLOCKS = {"script", "style", "iframe", "object", "embed", "noscript"};

    /** 全角 ASCII 区段起点（！ ～），映射到 0x21~0x7E */
    private static final char FULLWIDTH_START = 0xFF01;

    private static final char FULLWIDTH_END = 0xFF5E;

    private ContentPurifier() {
    }

    /**
     * 正文净化：剥标签、解实体、归一空白与全半角、压掉连续空行。
     *
     * @param html 原始正文（可为 null）
     * @return 纯文本；入参为空时返回空串
     */
    public static String purify(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }
        String text = dropBlocks(html);
        text = stripTags(text);
        text = decodeEntities(text);
        return normalize(text);
    }

    /**
     * 标题净化：比正文更激进——标题里不该出现换行，统一压成单空格。
     *
     * @param title 原始标题
     * @return 单行纯文本
     */
    public static String purifyTitle(String title) {
        String text = purify(title);
        StringBuilder sb = new StringBuilder(text.length());
        boolean prevSpace = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == ' ' || c == '\\t' || c == '\\n' || c == '\\r' || c == '\\f' || c == 0x0B) {
                if (!prevSpace) {
                    sb.append(' ');
                    prevSpace = true;
                }
            } else {
                sb.append(c);
                prevSpace = false;
            }
        }
        return sb.toString().trim();
    }

    /**
     * 有效字符数：剔除空白与零宽字符后的长度，用于「无意义短句」判定。
     *
     * <p>用码点扫描，避免把 emoji（代理对）算成 2 个字符而误判长文本为短句。</p>
     *
     * @param text 文本
     * @return 有效字符数
     */
    public static int effectiveLength(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (Character.isWhitespace(cp) || isZeroWidth(cp)) {
                continue;
            }
            n++;
        }
        return n;
    }

    /**
     * 截断到指定字符数（按码点，不切断代理对）。
     *
     * @param text 文本
     * @param max  最大字符数
     * @return 截断后的文本
     */
    public static String truncate(String text, int max) {
        if (text == null || max <= 0) {
            return "";
        }
        if (text.codePointCount(0, text.length()) <= max) {
            return text;
        }
        int end = text.offsetByCodePoints(0, max);
        return text.substring(0, end);
    }

    /**
     * 整块抹掉 script / style 等危险标签及其内容。
     */
    private static String dropBlocks(String html) {
        String lower = html.toLowerCase(Locale.ROOT);
        StringBuilder sb = new StringBuilder(html.length());
        int i = 0;
        while (i < html.length()) {
            int open = lower.indexOf('<', i);
            if (open < 0) {
                sb.append(html, i, html.length());
                break;
            }
            sb.append(html, i, open);
            String name = tagNameAt(lower, open + 1);
            if (isDropBlock(name)) {
                int close = findCloseTag(lower, name, open);
                if (close < 0) {
                    // 缺闭合：丢到末尾，宁可少拿也不要漏出脚本文本
                    break;
                }
                i = close;
                continue;
            }
            sb.append('<');
            i = open + 1;
        }
        return sb.toString();
    }

    /**
     * 剥掉所有 HTML 标签，保留文本节点。
     */
    private static String stripTags(String html) {
        StringBuilder sb = new StringBuilder(html.length());
        boolean inTag = false;
        for (int i = 0; i < html.length(); i++) {
            char c = html.charAt(i);
            if (c == '<') {
                inTag = true;
                continue;
            }
            if (c == '>') {
                inTag = false;
                continue;
            }
            if (!inTag) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * 解码常用 HTML 实体。
     *
     * <p>只处理最常用的几个：抓取侧真正高频的就是 {@code &nbsp;} 与 {@code &amp;}，
     * 引入完整实体表会让包体变大而收益极低。数字实体（{@code &#39;}）单独走一趟。</p>
     */
    private static String decodeEntities(String text) {
        String s = text;
        s = replace(s, "&nbsp;", " ");
        s = replace(s, "&amp;", "&");
        s = replace(s, "&lt;", "<");
        s = replace(s, "&gt;", ">");
        s = replace(s, "&quot;", "\\"");
        s = replace(s, "&apos;", "'");
        s = replace(s, "&#39;", "'");
        s = replace(s, "&#34;", "\\"");
        return s;
    }

    private static String replace(String text, String from, String to) {
        if (!text.contains(from)) {
            return text;
        }
        StringBuilder sb = new StringBuilder(text.length());
        int i = 0;
        while (true) {
            int at = text.indexOf(from, i);
            if (at < 0) {
                sb.append(text, i, text.length());
                break;
            }
            sb.append(text, i, at).append(to);
            i = at + from.length();
        }
        return sb.toString();
    }

    /**
     * 空白归一 + 全半角归一 + 零宽/控制字符清理 + 连续空行压缩。
     */
    private static String normalize(String text) {
        StringBuilder sb = new StringBuilder(text.length());
        int blankLines = 0;
        boolean lineStart = true;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            i += Character.charCount(cp);
            if (isZeroWidth(cp)) {
                continue;
            }
            if (cp == '\\r') {
                continue;
            }
            if (cp == '\\n' || cp == '\\f' || cp == 0x0B) {
                if (blankLines < 2) {
                    sb.append('\\n');
                    blankLines++;
                }
                lineStart = true;
                continue;
            }
            if (cp == '\\t' || cp == 0xA0 || cp == 0x3000 || Character.isSpaceChar(cp)) {
                cp = ' ';
            }
            if (cp >= FULLWIDTH_START && cp <= FULLWIDTH_END) {
                cp = (char) (cp - FULLWIDTH_START + 0x21);
            }
            if (Character.isISOControl(cp)) {
                continue;
            }
            if (cp == ' ' && lineStart && blankLines > 0) {
                continue;
            }
            sb.appendCodePoint(cp);
            if (cp != ' ') {
                lineStart = false;
                blankLines = 0;
            }
        }
        return sb.toString().trim();
    }

    private static boolean isZeroWidth(int cp) {
        return cp == 0x200B || cp == 0x200C || cp == 0x200D || cp == 0xFEFF;
    }

    private static String tagNameAt(String lower, int from) {
        StringBuilder sb = new StringBuilder();
        for (int i = from; i < lower.length() && i < from + 16; i++) {
            char c = lower.charAt(i);
            if (c >= 'a' && c <= 'z') {
                sb.append(c);
            } else {
                break;
            }
        }
        return sb.toString();
    }

    private static boolean isDropBlock(String name) {
        for (String b : DROP_BLOCKS) {
            if (b.equals(name)) {
                return true;
            }
        }
        return false;
    }

    private static int findCloseTag(String lower, String name, int from) {
        int at = lower.indexOf("</" + name, from);
        if (at < 0) {
            return -1;
        }
        int gt = lower.indexOf('>', at);
        // 缺 '>' 时返回 -1：否则会退化成 0，让调用方原地打转
        return gt < 0 ? -1 : gt + 1;
    }
}
`);

file('collect/clean/CompiledNoiseRule.java', `package ${PKG}.collect.clean;

import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.domain.YqNoiseRule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 一条 {@code yq_noise_rule} 的运行时形态（预编译，避免每条正文重复编译正则）。
 *
 * <p><b>正则降级约定：</b>业务在后台填的正则经常写错（未转义的括号、Java 不支持的语法）。
 * 编译失败时【不抛异常、不停链路】，降级为「按字面量包含匹配」并保留错误信息，
 * 保证一条坏规则不会让整批采集静默失败。</p>
 *
 * @author ruoyi
 */
public final class CompiledNoiseRule {

    /** 关键词模式下 match_value 的分隔符（中英文逗号、顿号、分号、竖线） */
    private static final String KEYWORD_DELIMS = ",，、;；|";

    private final Long ruleId;

    private final String ruleName;

    private final NoiseCategory category;

    private final String matchType;

    private final String matchValue;

    private final int priority;

    private final List<String> keywords;

    private final Pattern pattern;

    private final String compileError;

    private CompiledNoiseRule(Long ruleId, String ruleName, NoiseCategory category, String matchType,
                              String matchValue, int priority, List<String> keywords, Pattern pattern, String compileError) {
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.category = category;
        this.matchType = matchType;
        this.matchValue = matchValue;
        this.priority = priority;
        this.keywords = keywords;
        this.pattern = pattern;
        this.compileError = compileError;
    }

    /**
     * 由数据库实体编译。
     *
     * @param rule 降噪规则
     * @return 编译后规则；入参为空或类别无法识别时返回 null（调用方直接跳过）
     */
    public static CompiledNoiseRule from(YqNoiseRule rule) {
        if (rule == null || StringUtils.isBlank(rule.getMatchValue())) {
            return null;
        }
        NoiseCategory category = NoiseCategory.of(rule.getNoiseCategory());
        if (category == null) {
            return null;
        }
        String type = rule.getMatchType() == null ? "keyword" : rule.getMatchType().trim().toLowerCase(Locale.ROOT);
        String value = rule.getMatchValue().trim();
        int priority = rule.getPriority() == null ? 10 : rule.getPriority();
        List<String> keywords = Collections.emptyList();
        Pattern pattern = null;
        String error = null;
        if ("regex".equals(type)) {
            try {
                pattern = Pattern.compile(value, Pattern.CASE_INSENSITIVE);
            } catch (Exception e) {
                // 降级为字面量匹配，并留下证据便于后台定位是哪条规则写错了
                error = "正则编译失败，已降级为字面量匹配: " + e.getMessage();
                keywords = splitKeywords(value);
            }
        } else {
            keywords = splitKeywords(value);
        }
        return new CompiledNoiseRule(rule.getRuleId(), rule.getRuleName(), category, type, value,
            priority, keywords, pattern, error);
    }

    /**
     * 是否命中。
     *
     * @param text 待判定文本（已净化）；为空时恒为 false
     * @return true 表示命中该规则
     */
    public boolean hits(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        if (pattern != null) {
            return pattern.matcher(text).find();
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String kw : keywords) {
            if (!kw.isEmpty() && lower.contains(kw)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 命中证据：关键词模式回关键词，正则模式回实际匹配到的片段（截断到 50 字）。
     *
     * @param text 待判定文本
     * @return 证据串；未命中返回空串
     */
    public String evidence(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        if (pattern != null) {
            java.util.regex.Matcher m = pattern.matcher(text);
            if (m.find()) {
                String s = m.group();
                return s.length() > 50 ? s.substring(0, 50) : s;
            }
            return "";
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (String kw : keywords) {
            if (!kw.isEmpty() && lower.contains(kw)) {
                return kw;
            }
        }
        return "";
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public String getMatchType() {
        return matchType;
    }

    public String getMatchValue() {
        return matchValue;
    }

    public int getPriority() {
        return priority;
    }

    public String getCompileError() {
        return compileError;
    }

    /**
     * 该规则是否降级过（正则写错）。
     *
     * @return true 表示正则编译失败、当前按字面量匹配
     */
    public boolean isDegraded() {
        return compileError != null;
    }

    /**
     * 按中英文分隔符拆分关键词，空片段丢弃、统一小写。
     */
    private static List<String> splitKeywords(String value) {
        List<String> out = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (KEYWORD_DELIMS.indexOf(c) >= 0) {
                addKeyword(out, sb);
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        addKeyword(out, sb);
        return out;
    }

    private static void addKeyword(List<String> out, StringBuilder sb) {
        String s = sb.toString().trim().toLowerCase(Locale.ROOT);
        if (!s.isEmpty()) {
            out.add(s);
        }
    }
}
`);

file('collect/clean/NoiseRuleCompiler.java', `package ${PKG}.collect.clean;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.mapper.YqNoiseRuleMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 降噪规则装载与缓存（F-006 验收标准 2：业务端动态启停、按优先级执行）。
 *
 * <p>规则来自 {@code yq_noise_rule}，每次判定都查库会把数据库打爆，
 * 因此按 {@code yuqing.collect.clean.rule-cache-seconds} 做短缓存；
 * 后台改规则后可调 {@link #refresh()} 立刻生效。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NoiseRuleCompiler {

    /** 单次装载上限（保护性：规则表被误灌几十万行时不至于拖垮判定） */
    private static final int MAX_RULES = 2000;

    private final YqNoiseRuleMapper noiseRuleMapper;

    private final YqCollectProperties props;

    private volatile List<CompiledNoiseRule> cached = Collections.emptyList();

    private volatile long cachedAt = 0L;

    /**
     * 取当前启用的降噪规则（按 priority 升序，数字小的先判定）。
     *
     * @return 已编译规则列表；未配置或查询失败时返回空列表（此时只走内置兜底判定）
     */
    public List<CompiledNoiseRule> activeRules() {
        long ttl = Math.max(0L, props.getClean().getRuleCacheSeconds()) * 1000L;
        List<CompiledNoiseRule> hit = cached;
        if (hit != null && !hit.isEmpty() && System.currentTimeMillis() - cachedAt < ttl) {
            return hit;
        }
        return reload();
    }

    /**
     * 强制刷新缓存（后台保存规则后调用）。
     */
    public void refresh() {
        cached = Collections.emptyList();
        cachedAt = 0L;
    }

    /**
     * 重新装载规则。查询异常时保留旧缓存而不是清空——
     * 数据库抖一下不该让降噪整体失效（那会瞬间灌进大量垃圾数据）。
     *
     * @return 规则列表
     */
    private synchronized List<CompiledNoiseRule> reload() {
        long ttl = Math.max(0L, props.getClean().getRuleCacheSeconds()) * 1000L;
        if (System.currentTimeMillis() - cachedAt < ttl && !cached.isEmpty()) {
            return cached;
        }
        List<CompiledNoiseRule> loaded;
        try {
            LambdaQueryWrapper<YqNoiseRule> qw = new LambdaQueryWrapper<>();
            qw.eq(YqNoiseRule::getStatus, "0")
                .orderByAsc(YqNoiseRule::getPriority)
                .last("limit " + MAX_RULES);
            List<YqNoiseRule> rows = noiseRuleMapper.selectList(qw);
            loaded = new ArrayList<>(rows.size());
            for (YqNoiseRule row : rows) {
                CompiledNoiseRule compiled = CompiledNoiseRule.from(row);
                if (compiled != null) {
                    loaded.add(compiled);
                }
            }
            cached = loaded;
            cachedAt = System.currentTimeMillis();
            log.debug("[净化] 降噪规则装载 {} 条（库表 {} 行）", loaded.size(), rows.size());
        } catch (Exception e) {
            log.warn("[净化] 降噪规则装载失败，沿用上一次缓存: {}", e.getMessage());
            loaded = cached;
        }
        return loaded;
    }
}
`);

file('collect/clean/NoiseHit.java', `package ${PKG}.collect.clean;

/**
 * 一次降噪判定结果（F-006 验收标准 3：记录剔除原因，支持按原因统计剔除量）。
 *
 * @author ruoyi
 */
public final class NoiseHit {

    private final NoiseCategory category;

    private final Long ruleId;

    private final String ruleName;

    private final String reason;

    private NoiseHit(NoiseCategory category, Long ruleId, String ruleName, String reason) {
        this.category = category;
        this.ruleId = ruleId;
        this.ruleName = ruleName;
        this.reason = reason;
    }

    /**
     * 构造一次命中。
     *
     * @param category 降噪类别
     * @param ruleId   命中规则ID（内置判定为 null）
     * @param ruleName 命中规则名
     * @param reason   人类可读原因（会落 yq_opinion.noise_reason）
     * @return 命中记录
     */
    public static NoiseHit of(NoiseCategory category, Long ruleId, String ruleName, String reason) {
        return new NoiseHit(category, ruleId, ruleName, reason);
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getRuleName() {
        return ruleName;
    }

    public String getReason() {
        return reason;
    }

    /**
     * 落库的剔除原因：类别编码 + 具体依据，便于台账按原因下钻。
     *
     * @return 原因串（不超过 200 字符，对齐 yq_opinion.noise_reason 列宽）
     */
    public String persistReason() {
        String base = category.label() + "(" + category.code() + ")";
        if (reason == null || reason.isEmpty()) {
            return base;
        }
        String merged = base + ": " + reason;
        return merged.length() > 200 ? merged.substring(0, 200) : merged;
    }
}
`);

file('collect/clean/CleanVerdict.java', `package ${PKG}.collect.clean;

/**
 * 单条舆情的净化结论（F-006 验收标准 5 的三态）。
 *
 * @author ruoyi
 */
public final class CleanVerdict {

    /** 清洗状态取值，与字典 yq_clean_status 一致 */
    public static final String RAW = "raw";

    public static final String CLEANED = "cleaned";

    public static final String REJECTED = "rejected";

    private final String cleanStatus;

    private final NoiseCategory category;

    private final String noiseReason;

    private final Long ruleId;

    private final String purifiedTitle;

    private final String purifiedContent;

    private CleanVerdict(String cleanStatus, NoiseCategory category, String noiseReason, Long ruleId,
                         String purifiedTitle, String purifiedContent) {
        this.cleanStatus = cleanStatus;
        this.category = category;
        this.noiseReason = noiseReason;
        this.ruleId = ruleId;
        this.purifiedTitle = purifiedTitle;
        this.purifiedContent = purifiedContent;
    }

    /**
     * 通过净化，保留。
     *
     * @param title   净化后标题
     * @param content 净化后正文
     * @return 结论
     */
    public static CleanVerdict accept(String title, String content) {
        return new CleanVerdict(CLEANED, null, null, null, title, content);
    }

    /**
     * 命中降噪，剔除。
     *
     * @param hit     命中记录
     * @param title   净化后标题（保留下来便于人工复核为什么被剔）
     * @param content 净化后正文
     * @return 结论
     */
    public static CleanVerdict reject(NoiseHit hit, String title, String content) {
        return new CleanVerdict(REJECTED, hit.getCategory(), hit.persistReason(), hit.getRuleId(), title, content);
    }

    public String getCleanStatus() {
        return cleanStatus;
    }

    public NoiseCategory getCategory() {
        return category;
    }

    public String getNoiseReason() {
        return noiseReason;
    }

    public Long getRuleId() {
        return ruleId;
    }

    public String getPurifiedTitle() {
        return purifiedTitle;
    }

    public String getPurifiedContent() {
        return purifiedContent;
    }

    /**
     * 是否被剔除。
     *
     * @return true 表示判为低价值数据，不进入研判流程
     */
    public boolean isRejected() {
        return REJECTED.equals(cleanStatus);
    }
}
`);

file('collect/clean/NoiseEngine.java', `package ${PKG}.collect.clean;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * 降噪规则引擎（F-006 验收标准 1 / 2 / 3）。
 *
 * <p>判定顺序：</p>
 * <ol>
 *   <li><b>空白内容</b>——内置兜底，最快，先挡掉空壳记录</li>
 *   <li><b>库表规则</b>——业务自定义，按 {@code priority} 升序，先命中先判定</li>
 *   <li><b>机器人内容</b>——作者 / 设备信息命中内置特征</li>
 *   <li><b>灌水评论</b>——重复字符段</li>
 *   <li><b>无意义短句</b>——有效字符数低于阈值</li>
 * </ol>
 *
 * <p>把库表规则放在内置判定之前，是为了让「业务说这条该留/该杀」优先于通用启发式；
 * 空白先判是纯性能考虑（空文本跑正则没有意义）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NoiseEngine {

    /** 机器人作者特征（小写比较） */
    private static final String[] BOT_AUTHORS = {"机器人", "robot", "bot", "自动生成", "系统自动", "newsbot", "spider"};

    /** 机器人设备特征（小写比较） */
    private static final String[] BOT_DEVICES = {"bot", "spider", "crawler", "headless", "phantomjs"};

    /** 单字符连续重复达到该长度即判灌水 */
    private static final int CHAR_RUN_FLOODING = 20;

    private final NoiseRuleCompiler compiler;

    private final YqCollectProperties props;

    /**
     * 对一条原始舆情做「净化 + 降噪判定」。
     *
     * @param raw 原始舆情
     * @return 净化结论（含净化后的标题/正文与剔除原因）
     */
    public CleanVerdict evaluate(RawOpinion raw) {
        if (raw == null) {
            return CleanVerdict.reject(NoiseHit.of(NoiseCategory.BLANK, null, null, "记录为空"), "", "");
        }
        String title = ContentPurifier.purifyTitle(raw.getTitle());
        String content = ContentPurifier.purify(raw.getContent());
        int max = props.getClean().getMaxContentChars();
        if (max > 0 && content.length() > max) {
            content = ContentPurifier.truncate(content, max);
        }
        String text = title + "\\n" + content;

        if (ContentPurifier.effectiveLength(text) == 0) {
            return CleanVerdict.reject(NoiseHit.of(NoiseCategory.BLANK, null, null, "标题与正文均无有效字符"), title, content);
        }

        NoiseHit hit = matchRules(text);
        if (hit == null) {
            hit = matchBot(raw);
        }
        if (hit == null) {
            hit = matchFlooding(content);
        }
        if (hit == null) {
            hit = matchMeaningless(text);
        }
        if (hit == null) {
            return CleanVerdict.accept(title, content);
        }
        return CleanVerdict.reject(hit, title, content);
    }

    /**
     * 库表规则匹配（按优先级，先命中先判定）。
     *
     * @param text 净化后文本
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchRules(String text) {
        List<CompiledNoiseRule> rules = compiler.activeRules();
        for (CompiledNoiseRule rule : rules) {
            if (!rule.hits(text)) {
                continue;
            }
            String evidence = rule.evidence(text);
            StringBuilder reason = new StringBuilder();
            reason.append(rule.getRuleName() == null ? "规则" + rule.getRuleId() : rule.getRuleName());
            if (!evidence.isEmpty()) {
                reason.append(" 命中[").append(evidence).append("]");
            }
            if (rule.isDegraded()) {
                reason.append("（正则已降级）");
            }
            return NoiseHit.of(rule.getCategory(), rule.getRuleId(), rule.getRuleName(), reason.toString());
        }
        return null;
    }

    /**
     * 机器人内容：作者名或设备信息带爬虫/机器人特征。
     *
     * @param raw 原始舆情
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchBot(RawOpinion raw) {
        String author = raw.getAuthor() == null ? "" : raw.getAuthor().toLowerCase(Locale.ROOT);
        for (String kw : BOT_AUTHORS) {
            if (author.contains(kw)) {
                return NoiseHit.of(NoiseCategory.BOT, null, null, "作者名含机器人特征[" + raw.getAuthor() + "]");
            }
        }
        String device = raw.getDeviceInfo() == null ? "" : raw.getDeviceInfo().toLowerCase(Locale.ROOT);
        for (String kw : BOT_DEVICES) {
            if (device.contains(kw)) {
                return NoiseHit.of(NoiseCategory.BOT, null, null, "设备信息含爬虫特征[" + raw.getDeviceInfo() + "]");
            }
        }
        return null;
    }

    /**
     * 灌水评论：连续重复字符，或同一片段反复出现。
     *
     * @param content 净化后正文
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchFlooding(String content) {
        int run = longestCharRun(content);
        if (run >= CHAR_RUN_FLOODING) {
            return NoiseHit.of(NoiseCategory.FLOODING, null, null, "连续重复字符 " + run + " 个");
        }
        int window = Math.max(4, props.getClean().getFloodingWindow());
        int threshold = Math.max(2, props.getClean().getFloodingRepeat());
        if (content.length() >= window * 2) {
            String probe = content.substring(0, window);
            int times = countOccurrences(content, probe);
            if (times >= threshold) {
                return NoiseHit.of(NoiseCategory.FLOODING, null, null, "片段[" + probe + "]重复 " + times + " 次");
            }
        }
        return null;
    }

    /**
     * 无意义短句：有效字符数低于阈值。
     *
     * @param text 净化后文本（标题 + 正文）
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchMeaningless(String text) {
        int threshold = props.getClean().getMeaninglessChars();
        int len = ContentPurifier.effectiveLength(text);
        if (threshold > 0 && len < threshold) {
            return NoiseHit.of(NoiseCategory.MEANINGLESS, null, null, "有效字符 " + len + " < 阈值 " + threshold);
        }
        return null;
    }

    private static int longestCharRun(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int best = 1;
        int cur = 1;
        for (int i = 1; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isWhitespace(c)) {
                cur = 1;
                continue;
            }
            if (c == text.charAt(i - 1)) {
                cur++;
                if (cur > best) {
                    best = cur;
                }
            } else {
                cur = 1;
            }
        }
        return best;
    }

    private static int countOccurrences(String text, String probe) {
        int count = 0;
        int from = 0;
        while (true) {
            int at = text.indexOf(probe, from);
            if (at < 0) {
                break;
            }
            count++;
            from = at + probe.length();
        }
        return count;
    }

    /**
     * 供后台「规则试跑」用：直接判定一段文本，便于验证新写的正则是否误杀。
     *
     * @param title   标题
     * @param content 正文
     * @return 是否会被剔除
     */
    public boolean wouldReject(String title, String content) {
        if (StringUtils.isBlank(title) && StringUtils.isBlank(content)) {
            return true;
        }
        String text = ContentPurifier.purifyTitle(title) + "\\n" + ContentPurifier.purify(content);
        if (ContentPurifier.effectiveLength(text) == 0) {
            return true;
        }
        return matchRules(text) != null || matchFlooding(text) != null || matchMeaningless(text) != null;
    }
}
`);

file('collect/clean/CrossChannelMerger.java', `package ${PKG}.collect.clean;

import org.dromara.yuqing.collect.model.RawOpinion;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 按天链接去重 + 跨渠道合并（F-006 验收标准 4 / 8）。
 *
 * <p><b>去重粒度取「按天」：</b>主键是 {@code (collect_date, url_hash)}，
 * 跨天不算重复——同一条事件连续多天被转发，本身就是传播态势的一部分，
 * 全局去重会把它压成一条，反而丢掉趋势信息。</p>
 *
 * <p><b>首条保留规则：</b>同一 {@code (采集日, 链接)} 分组内，取采集时间最早的一条；
 * 其余条目的渠道ID补充到首条的 {@code dup_channel_ids} 上，这样台账里
 * 「这条在哪些渠道都出现过」一目了然，而统计口径仍然只算一条。</p>
 *
 * <p><b>边界：</b>本类是纯内存合并，覆盖「同一次调度内多渠道撞车」这一主要场景。
 * 跨批次（间隔数小时）的跨渠道重复由 Redis 去重拦下并计入 {@code dupChannelCount}，
 * 但不会回写首条的渠道列表——攒批写入已落盘，回头改首条要再读一次全量内容，不划算。</p>
 *
 * @author ruoyi
 */
public final class CrossChannelMerger {

    /** 按采集时间升序（无采集时间的排后面），保证「首条」语义稳定可复现 */
    private static final Comparator<RawOpinion> BY_COLLECT_TIME =
        Comparator.comparing(RawOpinion::getCollectTime, Comparator.nullsLast(Comparator.naturalOrder()));

    private CrossChannelMerger() {
    }

    /**
     * 分组键：采集日 + 链接指纹。
     *
     * @param collectDate 采集日
     * @param urlHash     链接指纹
     * @return 分组键
     */
    public static String dayKey(LocalDate collectDate, String urlHash) {
        String d = collectDate == null ? "null" : collectDate.toString();
        return d + "|" + (urlHash == null ? "" : urlHash);
    }

    /**
     * 合并一批待入库记录。
     *
     * @param rows 候选记录（同一批次内）
     * @return 合并结果
     */
    public static MergeOutcome merge(List<RawOpinion> rows) {
        MergeOutcome outcome = new MergeOutcome();
        if (rows == null || rows.isEmpty()) {
            return outcome;
        }
        Map<String, List<RawOpinion>> groups = new LinkedHashMap<>();
        for (RawOpinion row : rows) {
            String key = dayKey(row.getCollectDate(), row.getUrlHash());
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }
        for (List<RawOpinion> group : groups.values()) {
            List<RawOpinion> sorted = new ArrayList<>(group);
            sorted.sort(BY_COLLECT_TIME);
            RawOpinion keeper = sorted.get(0);
            Set<Long> extraChannels = new LinkedHashSet<>();
            String existing = keeper.getDupChannelIds();
            if (existing != null && !existing.isEmpty()) {
                for (String part : existing.split(",")) {
                    String s = part.trim();
                    if (!s.isEmpty()) {
                        extraChannels.add(Long.valueOf(s));
                    }
                }
            }
            for (int i = 1; i < sorted.size(); i++) {
                RawOpinion dup = sorted.get(i);
                outcome.dupCount++;
                if (dup.getChannelId() != null && !dup.getChannelId().equals(keeper.getChannelId())) {
                    extraChannels.add(dup.getChannelId());
                    outcome.dupChannelCount++;
                }
            }
            if (!extraChannels.isEmpty()) {
                keeper.setDupChannelIds(String.join(",", extraChannels.stream().map(String::valueOf).toArray(String[]::new)));
            }
            outcome.keepers.add(keeper);
        }
        return outcome;
    }

    /**
     * 合并结果。
     */
    public static final class MergeOutcome {

        private final List<RawOpinion> keepers = new ArrayList<>();

        private int dupCount;

        private int dupChannelCount;

        /**
         * 保留下来的首条集合。
         *
         * @return 待入库记录
         */
        public List<RawOpinion> getKeepers() {
            return keepers;
        }

        /**
         * 被判重复的条数。
         *
         * @return 重复条数
         */
        public int getDupCount() {
            return dupCount;
        }

        /**
         * 其中属于「不同渠道重复」的条数。
         *
         * @return 跨渠道重复条数
         */
        public int getDupChannelCount() {
            return dupChannelCount;
        }
    }
}
`);

file('collect/clean/CleanBatchScope.java', `package ${PKG}.collect.clean;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * 净化重跑范围（F-006 验收标准 9 的「影响条数预览」入参）。
 *
 * @author ruoyi
 */
@Data
public class CleanBatchScope implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 单次重跑最多跨越的天数（保护性上限，防止误填十年范围把库扫穿） */
    public static final int MAX_SPAN_DAYS = 366;

    /** 批次名称（可空，为空时由服务端生成） */
    private String batchName;

    /** 重跑类型：incremental / condition_replay / full_replay */
    private String batchType = "condition_replay";

    /** 范围-任务ID（为空表示不限任务） */
    private Long scopeTaskId;

    /** 范围-渠道ID（为空表示不限渠道） */
    private Long scopeChannelId;

    /** 范围-起始采集日 */
    private LocalDate scopeStartDate;

    /** 范围-截止采集日 */
    private LocalDate scopeEndDate;

    /** true = 只预览不落库 */
    private boolean previewOnly = true;

    /**
     * 参数校验：范围必须闭合、跨度受限、全量重跑必须显式声明。
     *
     * <p>「不限任务 + 不限渠道 + 不限日期」等价于全表重扫，一律拒绝——
     * 这类操作在百万级事实表上会直接把数据库拖垮。</p>
     */
    public void assertValid() {
        if (scopeStartDate == null || scopeEndDate == null) {
            throw new IllegalArgumentException("必须指定采集日范围（scopeStartDate / scopeEndDate）");
        }
        if (scopeEndDate.isBefore(scopeStartDate)) {
            throw new IllegalArgumentException("截止采集日不能早于起始采集日");
        }
        long span = java.time.temporal.ChronoUnit.DAYS.between(scopeStartDate, scopeEndDate) + 1;
        if (span > MAX_SPAN_DAYS) {
            throw new IllegalArgumentException("采集日跨度不能超过 " + MAX_SPAN_DAYS + " 天，当前 " + span + " 天");
        }
        if (scopeTaskId == null && scopeChannelId == null) {
            throw new IllegalArgumentException("必须至少指定任务ID或渠道ID之一，避免全表重扫");
        }
        if ("full_replay".equals(batchType) && (scopeTaskId != null || scopeChannelId != null)) {
            throw new IllegalArgumentException("全量重跑不应指定任务/渠道范围");
        }
    }
}
`);

file('collect/clean/CleanBatchStats.java', `package ${PKG}.collect.clean;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 一次净化批次的统计结果（F-006 验收标准 7：去重率与降噪剔除率）。
 *
 * @author ruoyi
 */
@Data
public class CleanBatchStats implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 批次ID（执行模式落库后回填） */
    private Long batchId;

    /** 批次名称 */
    private String batchName;

    /** 扫描条数 */
    private int totalCount;

    /** 净化保留条数 */
    private int cleanedCount;

    /** 降噪剔除条数 */
    private int rejectedCount;

    /** 链接去重条数 */
    private int dupCount;

    /** 跨渠道重复条数 */
    private int dupChannelCount;

    /** 按七类降噪类别的剔除量（台账按原因统计的数据源） */
    private final Map<String, Integer> byCategory = new LinkedHashMap<>();

    /** 是否只预览未落库 */
    private boolean previewOnly = true;

    /** 耗时（毫秒） */
    private long costMs;

    /** 失败原因（执行模式才有值） */
    private String failReason;

    public CleanBatchStats() {
        for (NoiseCategory c : NoiseCategory.values()) {
            byCategory.put(c.code(), 0);
        }
    }

    /**
     * 累加一次降噪剔除。
     *
     * @param category 降噪类别；为空时归入 spam
     */
    public void incRejected(NoiseCategory category) {
        String key = category == null ? NoiseCategory.SPAM.code() : category.code();
        byCategory.merge(key, 1, Integer::sum);
        rejectedCount++;
    }

    /**
     * 取某一类别的剔除量。
     *
     * @param category 类别
     * @return 条数
     */
    public int countOf(NoiseCategory category) {
        return byCategory.getOrDefault(category.code(), 0);
    }

    /**
     * 去重率（%）：被判重复的条数占扫描条数的比例。
     *
     * @return 百分比，保留两位；扫描条数为 0 时返回 0
     */
    public BigDecimal dupRate() {
        return rate(dupCount);
    }

    /**
     * 降噪剔除率（%）：剔除条数占扫描条数的比例。
     *
     * @return 百分比，保留两位；扫描条数为 0 时返回 0
     */
    public BigDecimal rejectRate() {
        return rate(rejectedCount);
    }

    private BigDecimal rate(int n) {
        if (totalCount <= 0) {
            return BigDecimal.ZERO.setScale(2);
        }
        return BigDecimal.valueOf(n * 100L)
            .divide(BigDecimal.valueOf(totalCount), 2, RoundingMode.HALF_UP);
    }

    /**
     * 一行摘要，便于写日志与批次备注。
     *
     * @return 摘要串
     */
    public String summary() {
        return "扫描 " + totalCount + " 条：保留 " + cleanedCount + " / 剔除 " + rejectedCount
            + " / 重复 " + dupCount + "（跨渠道 " + dupChannelCount + "）"
            + "，去重率 " + dupRate() + "%、降噪率 " + rejectRate() + "%";
    }
}
`);

file('service/IYqCleanReplayService.java', `package ${PKG}.service;

import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;

/**
 * 历史数据净化重跑（F-006 验收标准 9）。
 *
 * <p>规则改了以后，之前已入库的数据不会自动跟着变——必须能按新规则重扫一遍。
 * preview 只算影响条数不改数据，execute 才真正落库并留一条批次记录。</p>
 *
 * @author ruoyi
 */
public interface IYqCleanReplayService {

    /**
     * 预览：只统计影响条数，不写任何业务数据。
     *
     * @param scope 重跑范围
     * @return 统计结果
     */
    CleanBatchStats preview(CleanBatchScope scope);

    /**
     * 执行：真正改写净化状态，并落一条批次记录。
     *
     * @param scope 重跑范围
     * @return 统计结果（含批次ID）
     */
    CleanBatchStats execute(CleanBatchScope scope);
}
`);

file('service/impl/YqCleanReplayServiceImpl.java', `package ${PKG}.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;
import org.dromara.yuqing.collect.clean.CleanVerdict;
import org.dromara.yuqing.collect.clean.CrossChannelMerger;
import org.dromara.yuqing.collect.clean.NoiseCategory;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCleanBatch;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqCleanBatchMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.service.IYqCleanReplayService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 历史数据净化重跑实现（F-006 验收标准 3 / 6 / 7 / 8 / 9）。
 *
 * <p><b>为什么重跑要单独走一遍而不是改采集：</b>采集侧是「攒批写入 + 只增不改」，
 * 规则变更不可能回头改写历史分区；重跑必须是一等公民能力，而不是运维补丁。</p>
 *
 * <p><b>为什么不加 {@code @Transactional}：</b>{@code yq_opinion} 落在 Doris（另一数据源），
 * 批次台账落在 MySQL，两者无法共享本地事务；改成 XA 收益极低。这里用「逐条更新 + 失败即停」
 * 的显式补偿：中断时批次记录已落库并标记为 failed，重跑一次即可继续，不会出现半截脏数据被当成成功。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqCleanReplayServiceImpl implements IYqCleanReplayService {

    /** 单批最多处理条数兜底（配置缺失时的硬上限） */
    private static final int HARD_MAX_RECORDS = 500000;

    /** 每处理这么多条打一次进度日志 */
    private static final int PROGRESS_STEP = 2000;

    private final YqOpinionMapper opinionMapper;

    private final YqCleanBatchMapper cleanBatchMapper;

    private final NoiseEngine noiseEngine;

    private final YqCollectProperties props;

    @Override
    public CleanBatchStats preview(CleanBatchScope scope) {
        scope.assertValid();
        scope.setPreviewOnly(true);
        return run(scope);
    }

    @Override
    public CleanBatchStats execute(CleanBatchScope scope) {
        scope.assertValid();
        scope.setPreviewOnly(false);
        return run(scope);
    }

    private CleanBatchStats run(CleanBatchScope scope) {
        boolean preview = scope.isPreviewOnly();
        CleanBatchStats stats = new CleanBatchStats();
        stats.setPreviewOnly(preview);
        stats.setBatchName(resolveName(scope));
        long start = System.currentTimeMillis();
        try {
            List<YqOpinion> rows = load(scope);
            stats.setTotalCount(rows.size());
            if (!props.getClean().isEnabled()) {
                stats.setFailReason("净化开关已关闭（yuqing.collect.clean.enabled=false）");
                stats.setCleanedCount(rows.size());
                return finish(stats, scope, start);
            }
            // 按 (采集日, 链接) 分组：同组内保留首条，其余判为重复并合并渠道
            Map<String, List<YqOpinion>> groups = new LinkedHashMap<>();
            for (YqOpinion row : rows) {
                String key = CrossChannelMerger.dayKey(row.getCollectDate(), row.getUrlHash());
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
            }
            List<YqOpinion> dirty = new ArrayList<>();
            int index = 0;
            for (Map.Entry<String, List<YqOpinion>> entry : groups.entrySet()) {
                if (entry.getValue().size() > 1) {
                    int dup = entry.getValue().size() - 1;
                    stats.setDupCount(stats.getDupCount() + dup);
                }
                for (YqOpinion row : entry.getValue()) {
                    index++;
                    if (index % PROGRESS_STEP == 0) {
                        log.info("[净化重跑] 进度 {}/{}，{}", index, rows.size(), stats.summary());
                    }
                    CleanVerdict verdict = noiseEngine.evaluate(toRaw(row));
                    if (verdict.isRejected()) {
                        stats.incRejected(verdict.getCategory());
                    } else {
                        stats.setCleanedCount(stats.getCleanedCount() + 1);
                    }
                    if (apply(row, verdict)) {
                        dirty.add(row);
                    }
                }
            }
            if (!preview) {
                for (YqOpinion row : dirty) {
                    opinionMapper.updateById(row);
                }
                stats.setBatchId(persistBatch(scope, stats));
            }
            log.info("[净化重跑] {} {}", preview ? "预览" : "执行", stats.summary());
        } catch (Exception e) {
            stats.setFailReason(StringUtils.isBlank(e.getMessage()) ? e.getClass().getSimpleName() : e.getMessage());
            log.warn("[净化重跑] 批次异常: {}", e.getMessage());
            if (!preview) {
                stats.setBatchId(persistBatch(scope, stats));
            }
        }
        return finish(stats, scope, start);
    }

    /**
     * 把判定结论写回实体；只有真正发生变化才返回 true（避免无意义的 UPDATE）。
     */
    private boolean apply(YqOpinion row, CleanVerdict verdict) {
        boolean changed = false;
        if (!verdict.getCleanStatus().equals(row.getCleanStatus())) {
            row.setCleanStatus(verdict.getCleanStatus());
            changed = true;
        }
        String reason = verdict.getNoiseReason();
        if (!sameText(reason, row.getNoiseReason())) {
            row.setNoiseReason(reason);
            changed = true;
        }
        if (verdict.getPurifiedTitle() != null && !verdict.getPurifiedTitle().equals(row.getTitle())) {
            row.setTitle(verdict.getPurifiedTitle());
            changed = true;
        }
        if (verdict.getPurifiedContent() != null && !verdict.getPurifiedContent().equals(row.getContent())) {
            row.setContent(verdict.getPurifiedContent());
            changed = true;
        }
        row.setCleanTime(LocalDateTime.now());
        return changed;
    }

    /**
     * 载入范围内的舆情。
     *
     * <p>一律走 LambdaQueryWrapper，禁止拼接 SQL：范围参数全部来自前端请求体。</p>
     */
    private List<YqOpinion> load(CleanBatchScope scope) {
        LambdaQueryWrapper<YqOpinion> qw = new LambdaQueryWrapper<>();
        if (scope.getScopeTaskId() != null) {
            qw.eq(YqOpinion::getTaskId, scope.getScopeTaskId());
        }
        if (scope.getScopeChannelId() != null) {
            qw.eq(YqOpinion::getChannelId, scope.getScopeChannelId());
        }
        if (scope.getScopeStartDate() != null) {
            qw.ge(YqOpinion::getCollectDate, scope.getScopeStartDate());
        }
        if (scope.getScopeEndDate() != null) {
            qw.le(YqOpinion::getCollectDate, scope.getScopeEndDate());
        }
        if (!props.getClean().isReplayIncludeRejected()) {
            qw.ne(YqOpinion::getCleanStatus, CleanVerdict.REJECTED);
        }
        int limit = props.getClean().getMaxReplayRecords() > 0
            ? Math.min(props.getClean().getMaxReplayRecords(), HARD_MAX_RECORDS)
            : HARD_MAX_RECORDS;
        qw.last("limit " + limit);
        return opinionMapper.selectList(qw);
    }

    /**
     * 落一条批次记录（成功或失败都写，验收标准 9 的「执行结果记录」）。
     *
     * @return 批次ID
     */
    private Long persistBatch(CleanBatchScope scope, CleanBatchStats stats) {
        try {
            YqCleanBatch batch = new YqCleanBatch();
            batch.setBatchName(stats.getBatchName());
            batch.setBatchType(scope.getBatchType());
            batch.setScopeTaskId(scope.getScopeTaskId());
            batch.setScopeChannelId(scope.getScopeChannelId());
            batch.setScopeStartDate(scope.getScopeStartDate());
            batch.setScopeEndDate(scope.getScopeEndDate());
            batch.setTotalCount(stats.getTotalCount());
            batch.setCleanedCount(stats.getCleanedCount());
            batch.setRejectedCount(stats.getRejectedCount());
            batch.setDupCount(stats.getDupCount());
            batch.setDupChannelCount(stats.getDupChannelCount());
            batch.setNoiseSpam(stats.countOf(NoiseCategory.SPAM));
            batch.setNoiseAdvertisement(stats.countOf(NoiseCategory.ADVERTISEMENT));
            batch.setNoiseFlooding(stats.countOf(NoiseCategory.FLOODING));
            batch.setNoiseMeaningless(stats.countOf(NoiseCategory.MEANINGLESS));
            batch.setNoiseBot(stats.countOf(NoiseCategory.BOT));
            batch.setNoiseBlank(stats.countOf(NoiseCategory.BLANK));
            batch.setNoiseViolation(stats.countOf(NoiseCategory.VIOLATION));
            batch.setPreviewOnly(stats.isPreviewOnly() ? "1" : "0");
            batch.setStatus(StringUtils.isBlank(stats.getFailReason()) ? "success" : "failed");
            batch.setFailReason(stats.getFailReason());
            batch.setCostMs((int) Math.min(Integer.MAX_VALUE, stats.getCostMs()));
            cleanBatchMapper.insert(batch);
            return batch.getBatchId();
        } catch (Exception e) {
            log.warn("[净化重跑] 批次记录落库失败: {}", e.getMessage());
            return null;
        }
    }

    private CleanBatchStats finish(CleanBatchStats stats, CleanBatchScope scope, long start) {
        stats.setCostMs(System.currentTimeMillis() - start);
        return stats;
    }

    private static String resolveName(CleanBatchScope scope) {
        if (StringUtils.isNotBlank(scope.getBatchName())) {
            return scope.getBatchName();
        }
        LocalDate d = scope.getScopeStartDate();
        return "净化重跑-" + (d == null ? LocalDate.now() : d) + "-" + System.currentTimeMillis() % 100000L;
    }

    private static boolean sameText(String a, String b) {
        if (a == null && b == null) {
            return true;
        }
        return a != null && a.equals(b);
    }

    /**
     * 把已入库实体转成引擎入参。
     *
     * <p>只映射判定需要的字段：净化引擎不关心热度、研判状态等下游结果，
     * 少拷一个字段就少一处「改了但没同步」的隐患。</p>
     */
    private static RawOpinion toRaw(YqOpinion row) {
        RawOpinion raw = new RawOpinion();
        raw.setOpinionId(row.getOpinionId());
        raw.setCollectDate(row.getCollectDate());
        raw.setTaskId(row.getTaskId());
        raw.setChannelId(row.getChannelId());
        raw.setTitle(row.getTitle());
        raw.setContent(row.getContent());
        raw.setOpinionUrl(row.getOpinionUrl());
        raw.setUrlHash(row.getUrlHash());
        raw.setAuthor(row.getAuthor());
        raw.setDeviceInfo(row.getDeviceInfo());
        raw.setCollectTime(row.getCollectTime());
        return raw;
    }
}
`);

file('controller/YqCleanReplayController.java', `package ${PKG}.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.clean.NoiseRuleCompiler;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.service.IYqCleanReplayService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 净化重跑Controller（F-006 验收标准 2 / 9）。
 *
 * <p>写操作一律 {@code @SaCheckPermission}；身份只从 Sa-Token 取，不信请求体里的任何用户标识。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/clean")
public class YqCleanReplayController {

    private final IYqCleanReplayService replayService;

    private final NoiseRuleCompiler ruleCompiler;

    private final NoiseEngine noiseEngine;

    /**
     * 预览影响条数（不落库）
     */
    @SaCheckPermission("yuqing:clean:replay")
    @PostMapping("/preview")
    public R<CleanBatchStats> preview(@RequestBody CleanBatchScope scope) {
        try {
            return R.ok(replayService.preview(scope));
        } catch (IllegalArgumentException e) {
            return R.fail(e.getMessage());
        }
    }

    /**
     * 执行重跑（落库并留批次记录）
     */
    @SaCheckPermission("yuqing:clean:replay")
    @Log(title = "净化重跑", businessType = BusinessType.UPDATE)
    @PostMapping("/execute")
    public R<CleanBatchStats> execute(@RequestBody CleanBatchScope scope) {
        try {
            return R.ok(replayService.execute(scope));
        } catch (IllegalArgumentException e) {
            return R.fail(e.getMessage());
        }
    }

    /**
     * 强制刷新降噪规则缓存（后台改完规则点一下，不等缓存过期）
     */
    @SaCheckPermission("yuqing:clean:list")
    @PostMapping("/rules/refresh")
    public R<Void> refreshRules() {
        ruleCompiler.refresh();
        return R.ok();
    }

    /**
     * 规则试跑：用一段样本文本验证新写的规则会不会误杀。
     *
     * @param title   样本标题
     * @param content 样本正文
     * @return true 表示按当前规则会被剔除
     */
    @SaCheckPermission("yuqing:clean:list")
    @PostMapping("/rules/try")
    public R<Boolean> tryRules(@RequestParam(required = false) String title,
                               @RequestParam(required = false) String content) {
        RawOpinion probe = new RawOpinion();
        probe.setTitle(title == null ? "" : title);
        probe.setContent(content == null ? "" : content);
        return R.ok(noiseEngine.evaluate(probe).isRejected());
    }
}
`);

file('test/java/org/dromara/yuqing/collect/F006CleanTest.java', `package org.dromara.yuqing.collect;

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
        String html = "<div class=\\"a\\"><p>市场监管局通报</p><script>alert(1)</script>"
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
        assertEquals("沈阳 药监局 通报", ContentPurifier.purifyTitle("沈阳\\n药监局\\r\\n  通报"));
    }

    @Test
    @DisplayName("有效字符数忽略零宽字符（emoji 按 1 个字符计）")
    void effectiveLengthIgnoresZeroWidth() {
        assertEquals(4, ContentPurifier.effectiveLength("沈\\u200B阳监管"));
        assertEquals(1, ContentPurifier.effectiveLength("\\uD83D\\uDE00"));
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
`);

file('pc/api/yuqing/clean/replay.ts', `import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 净化重跑范围（F-006 验收标准 9）
 */
export interface CleanBatchScope {
  /** 批次名称；为空时服务端自动生成 */
  batchName?: string;
  /** 重跑类型：incremental / condition_replay / full_replay */
  batchType?: string;
  /** 范围-任务ID；为空表示不限任务 */
  scopeTaskId?: number | string | null;
  /** 范围-渠道ID；为空表示不限渠道 */
  scopeChannelId?: number | string | null;
  /** 范围-起始采集日（YYYY-MM-DD） */
  scopeStartDate?: string;
  /** 范围-截止采集日（YYYY-MM-DD） */
  scopeEndDate?: string;
  /** true = 只预览不落库 */
  previewOnly?: boolean;
}

/**
 * 一次净化批次的统计结果
 */
export interface CleanBatchStats {
  /** 批次ID（执行模式才有值） */
  batchId?: number | string | null;
  batchName?: string;
  /** 扫描条数 */
  totalCount: number;
  /** 净化保留条数 */
  cleanedCount: number;
  /** 降噪剔除条数 */
  rejectedCount: number;
  /** 链接去重条数 */
  dupCount: number;
  /** 跨渠道重复条数 */
  dupChannelCount: number;
  /** 按七类降噪类别的剔除量 */
  byCategory: Record<string, number>;
  /** 是否只预览未落库 */
  previewOnly: boolean;
  /** 耗时（毫秒） */
  costMs: number;
  /** 失败原因 */
  failReason?: string;
}

/**
 * 预览影响条数（不落库）
 */
export const previewCleanReplay = (data: CleanBatchScope): AxiosPromise<CleanBatchStats> => {
  return request({
    url: '/yuqing/clean/preview',
    method: 'post',
    data
  });
};

/**
 * 执行重跑（落库并留批次记录）
 */
export const executeCleanReplay = (data: CleanBatchScope): AxiosPromise<CleanBatchStats> => {
  return request({
    url: '/yuqing/clean/execute',
    method: 'post',
    data
  });
};

/**
 * 强制刷新降噪规则缓存（后台改完规则点一下，不等缓存过期）
 */
export const refreshNoiseRules = (): AxiosPromise<void> => {
  return request({
    url: '/yuqing/clean/rules/refresh',
    method: 'post'
  });
};

/**
 * 规则试跑：用样本文本验证新规则会不会误杀
 */
export const tryNoiseRules = (title: string, content: string): AxiosPromise<boolean> => {
  return request({
    url: '/yuqing/clean/rules/try',
    method: 'post',
    params: { title, content }
  });
};
`);

file('pc/views/yuqing/cleanBatch/CleanReplayDialog.vue', `<template>
  <el-dialog title="净化重跑" v-model="visible" width="780px" append-to-body destroy-on-close @closed="handleClosed">
    <el-alert type="info" :closable="false" show-icon class="mb8">
      <template #title>
        先「预览影响条数」再执行 —— 预览不写任何数据，确认口径无误后才真正改写净化状态。
        去重粒度为【按天】：同一链接跨天不算重复，同一天内被多渠道采到只保留首条并把其余渠道记在首条上。
      </template>
    </el-alert>

    <el-form :model="form" label-width="110px">
      <el-form-item label="采集日范围" required>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="起始采集日"
          end-placeholder="截止采集日"
          style="width: 100%"
        />
      </el-form-item>

      <el-row :gutter="10">
        <el-col :span="12">
          <el-form-item label="任务">
            <el-select v-model="form.scopeTaskId" placeholder="不限任务" clearable filterable style="width: 100%">
              <el-option v-for="o in taskOptions" :key="String(o.value)" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="渠道">
            <el-select v-model="form.scopeChannelId" placeholder="不限渠道" clearable filterable style="width: 100%">
              <el-option v-for="o in channelOptions" :key="String(o.value)" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-alert v-if="!hasScope" type="warning" :closable="false" show-icon class="mb8">
        <template #title>任务与渠道至少要选一个，避免全表重扫</template>
      </el-alert>
    </el-form>

    <div class="mb8">
      <el-button type="primary" icon="View" :loading="previewing" :disabled="!canRun" @click="handlePreview">
        预览影响条数
      </el-button>
      <el-button type="success" icon="Check" :loading="executing" :disabled="!canRun || !stats" @click="handleExecute">
        确认执行
      </el-button>
      <el-button link type="primary" icon="Refresh" @click="handleRefreshRules">刷新降噪规则缓存</el-button>
    </div>

    <el-alert v-if="stats" :type="stats.failReason ? 'error' : 'success'" :closable="false" show-icon class="mb8">
      <template #title>{{ summaryText }}</template>
    </el-alert>

    <el-descriptions v-if="stats" :column="2" border size="small">
      <el-descriptions-item label="扫描条数">{{ stats.totalCount }}</el-descriptions-item>
      <el-descriptions-item label="净化保留">{{ stats.cleanedCount }}</el-descriptions-item>
      <el-descriptions-item label="链接去重">{{ stats.dupCount }}</el-descriptions-item>
      <el-descriptions-item label="跨渠道重复">{{ stats.dupChannelCount }}</el-descriptions-item>
      <el-descriptions-item v-for="row in categoryRows" :key="row.code" :label="row.label">
        {{ row.count }}
      </el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { previewCleanReplay, executeCleanReplay, refreshNoiseRules } from '@/api/yuqing/clean/replay';
import type { CleanBatchScope, CleanBatchStats } from '@/api/yuqing/clean/replay';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqChannel } from '@/api/yuqing/channel/index';

const emit = defineEmits(['success']);

interface Option {
  label: string;
  value: any;
}

const visible = ref(false);
const previewing = ref(false);
const executing = ref(false);
const dateRange = ref<string[]>([]);
const stats = ref<CleanBatchStats | null>(null);
const taskOptions = ref<Option[]>([]);
const channelOptions = ref<Option[]>([]);

const form = reactive<CleanBatchScope>({
  batchName: undefined,
  batchType: 'condition_replay',
  scopeTaskId: null,
  scopeChannelId: null,
  scopeStartDate: undefined,
  scopeEndDate: undefined,
  previewOnly: true
});

/** 范围必须闭合且至少限定任务或渠道之一（后端同样校验，这里只是提前拦住） */
const hasScope = computed(() => !!form.scopeTaskId || !!form.scopeChannelId);

const canRun = computed(() => dateRange.value.length === 2 && !!dateRange.value[0] && !!dateRange.value[1] && hasScope.value);

/** 七类降噪类别的展示行；顺序与字典 yq_noise_category 一致 */
const CATEGORIES: Array<{ code: string; label: string }> = [
  { code: 'spam', label: '垃圾内容' },
  { code: 'advertisement', label: '广告营销' },
  { code: 'flooding', label: '灌水评论' },
  { code: 'meaningless', label: '无意义短句' },
  { code: 'bot', label: '机器人内容' },
  { code: 'blank', label: '空白内容' },
  { code: 'violation', label: '违规屏蔽' }
];

const categoryRows = computed(() =>
  CATEGORIES.map((c) => ({ code: c.code, label: c.label, count: stats.value?.byCategory?.[c.code] ?? 0 }))
);

const summaryText = computed(() => {
  const s = stats.value;
  if (!s) {
    return '';
  }
  if (s.failReason) {
    return '执行失败：' + s.failReason;
  }
  const total = s.totalCount || 1;
  const dupRate = ((s.dupCount * 100) / total).toFixed(2);
  const rejectRate = ((s.rejectedCount * 100) / total).toFixed(2);
  return (s.previewOnly ? '[预览] ' : '[已执行] ') + '扫描 ' + s.totalCount + ' 条：保留 ' + s.cleanedCount
    + ' / 剔除 ' + s.rejectedCount + ' / 重复 ' + s.dupCount + '（跨渠道 ' + s.dupChannelCount + '）'
    + '，去重率 ' + dupRate + '%、降噪率 ' + rejectRate + '%';
});

function buildPayload(previewOnly: boolean): CleanBatchScope {
  return {
    batchName: form.batchName,
    batchType: form.batchType,
    scopeTaskId: form.scopeTaskId ?? null,
    scopeChannelId: form.scopeChannelId ?? null,
    scopeStartDate: dateRange.value[0],
    scopeEndDate: dateRange.value[1],
    previewOnly
  };
}

function handlePreview() {
  previewing.value = true;
  previewCleanReplay(buildPayload(true))
    .then((res) => {
      stats.value = res.data;
    })
    .finally(() => {
      previewing.value = false;
    });
}

function handleExecute() {
  executing.value = true;
  executeCleanReplay(buildPayload(false))
    .then((res) => {
      stats.value = res.data;
      if (!res.data.failReason) {
        ElMessage.success('重跑完成，共处理 ' + res.data.totalCount + ' 条');
        emit('success');
      }
    })
    .finally(() => {
      executing.value = false;
    });
}

function handleRefreshRules() {
  refreshNoiseRules().then(() => {
    ElMessage.success('降噪规则缓存已刷新');
  });
}

function handleClosed() {
  stats.value = null;
  executing.value = false;
  previewing.value = false;
}

function loadOptions() {
  optionselectYqTask().then((res) => {
    taskOptions.value = (res.data ?? []).map((i: any) => ({ label: i.taskName, value: i.taskId }));
  });
  optionselectYqChannel().then((res) => {
    channelOptions.value = (res.data ?? []).map((i: any) => ({ label: i.channelName, value: i.channelId }));
  });
}

function open(): void {
  visible.value = true;
  loadOptions();
}

defineExpose({ open });
</script>

<style scoped>
.file-name {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}
</style>
`);

/* ==========================================================================
 * 13. 输出
 *   ⚠ Java 产物必须落在 yq-code/java/org/dromara/yuqing/ 下，
 *     否则 deploy-yuqing.mjs 的 be_java 映射（from = yq-code/java/org/dromara/yuqing）
 *     不会搬运它们 —— 这里统一补前缀，调用方只写包内相对路径。
 * ========================================================================== */

const JAVA_PREFIX = 'java/org/dromara/yuqing/';
/* 测试源码走 test/java/... 独立前缀，由 deploy-yuqing.mjs 的 be_test 目标搬运，
   不能再套 JAVA_PREFIX，否则会变成 java/org/dromara/yuqing/test/java/... */
const finalRel = (rel) => {
  if (rel.startsWith('test/')) return rel;
  return rel.endsWith('.java') ? JAVA_PREFIX + rel : rel;
};

let written = 0;
for (const f of FILES) {
  const full = path.join(SRC, finalRel(f.rel));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, f.content, 'utf8');
  written++;
}

const byDir = {};
for (const f of FILES) {
  const rel = finalRel(f.rel);
  const dir = rel.split('/').slice(0, 5).join('/');
  byDir[dir] = (byDir[dir] || 0) + 1;
}

console.log('');
console.log('✅ F-004 采集调度代码生成完成');
console.log('   输出根目录: yq-code/');
console.log(`   文件数: ${written}`);
console.log('');
console.log('   分布:');
for (const [dir, n] of Object.entries(byDir).sort()) {
  console.log(`     ${dir.padEnd(40)} ${n}`);
}
console.log('');
console.log('   下一步:');
console.log('     node deploy-yuqing.mjs --dry-run    # 预览落盘范围');
console.log('     node deploy-yuqing.mjs              # 落盘到三端工程');
console.log('');
