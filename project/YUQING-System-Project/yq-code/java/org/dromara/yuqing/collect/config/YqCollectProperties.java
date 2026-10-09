package org.dromara.yuqing.collect.config;

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
