package org.dromara.yuqing.analysis.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 智能研判配置（F-007）
 *
 * <p>前缀 {@code yuqing.analysis}。所有上限默认保守，且都可在 yml 覆盖。</p>
 *
 * <p><b>为什么「大模型未配置」必须是可运行的合法状态：</b>
 * 验收标准 6 要求大模型失败时「不阻塞其他舆情研判」，验收标准 1 要求
 * 自动输出四类结构化结果。若把「必须有可用大模型」当成前置条件，
 * 那么任何一次额度耗尽 / 网络抖动都会让整条研判链路停摆，
 * 进而 F-010 的预警、F-013/F-014 的报告、F-018 的监控全部拿不到数据。
 * 因此本开关默认 {@code llm.enabled = false}，此时走
 * {@code RuleJudger} 规则兜底（可解释、可单测、不依赖外部服务），
 * 结构化落库与状态机行为完全一致，只是结论来源标记为 rule。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.analysis")
public class YqAnalysisProperties {

    /** 研判引擎总开关；关闭后批量研判直接返回「已关闭」，不查库 */
    private boolean enabled = true;

    /** 单次批量研判的舆情条数上限（防一次点出十万条把线程池占满） */
    private int batchSize = 20;

    /** 失败自动重试上限（超过后不再重扫，等人工介入） */
    private int maxRetry = 3;

    /** 送入大模型的原文截断长度（字符）。舆情正文动辄上万字，必须截断 */
    private int maxContentLength = 3000;

    /** 是否自动为舆情打标签（验收标准 7） */
    private boolean autoTagEnabled = true;

    /** 单条舆情最多落库的标签数（模型可能返回一长串，必须钳制） */
    private int maxTagsPerOpinion = 8;

    /** 标签名最大长度；超长直接丢弃（防止模型输出把 VARCHAR(50) 撑爆） */
    private int maxTagNameLength = 20;

    /** 大模型不可用时是否启用规则兜底（默认开；关掉则研判会大量失败） */
    private boolean ruleFallbackEnabled = true;

    /** 相似度阈值（0~1）。越大越严格：0.62 相当于「标题高度重合才聚合」 */
    private double similarityThreshold = 0.62;

    /** 聚合的时间窗（小时）：只把窗口内的相似舆情归入同一事件 */
    private int clusterWindowHours = 72;

    /** 单个事件最多纳入的舆情条数（超出的不再并入，只更新计数） */
    private int clusterMaxOpinions = 500;

    /** 每个事件传播时间轴的最大节点数 */
    private int timelineNodeLimit = 200;

    /** 人工修正后是否自动登记为待标注训练样本（验收标准 9） */
    private boolean sampleOnCorrect = true;

    /**
     * 具备「全量数据可见」的角色键列表。
     *
     * <p>与 F-016 台账同一口径：默认空 = 只有超级管理员看全量，
     * 漏配的后果是「少看」而不是「多看」。F-007 的可见范围实际由
     * {@code IYqLedgerService.currentScope()} 推导，本项是它读取的配置；
     * 在此重复声明只是为了让本功能的配置文件自解释。</p>
     */
    private java.util.List<String> allDataRoleKeys = new java.util.ArrayList<>();

    /** 批量研判的 SnailJob 作业ID；为空则退化为进程内线程池执行 */
    private Long analyzeJobId;

    /** 异步研判线程池并发度（仅在未配置 analyzeJobId 时生效） */
    private int analyzePoolSize = 2;

    /** 大模型通道配置 */
    private Llm llm = new Llm();

    /**
     * OpenAI 兼容通道配置。
     *
     * <p><b>为什么是「OpenAI 兼容」而不是绑定某一家：</b>
     * DeepSeek / 通义千问 / 智谱 / 内网 vLLM 都提供
     * {@code POST {baseUrl}/v1/chat/completions} 形态的接口，
     * 请求体与响应体结构一致。把这三件事做成配置
     * （baseUrl / apiKey / model），换供应商只改 yml 不改代码。</p>
     */
    @Data
    public static class Llm {

        /** 通道开关。默认关：未配置 apiKey 的环境走规则兜底而不是天天失败 */
        private boolean enabled = false;

        /** 服务地址（不含路径），如 https://api.deepseek.com */
        private String baseUrl = "https://api.deepseek.com";

        /** 对话补全路径 */
        private String chatPath = "/v1/chat/completions";

        /**
         * 密钥。生产环境禁止写进仓库，请用环境变量注入：
         * {@code api-key: ${YQ_LLM_API_KEY:}}
         */
        private String apiKey;

        /** 模型名（同时作为研判结论里落库的 model_version） */
        private String model = "deepseek-chat";

        /** 采样温度。研判要可复现，默认取低温 */
        private double temperature = 0.2;

        /** 单次回复最大 token 数 */
        private Integer maxTokens = 1024;

        /** 提示词版本号（验收标准 11：提示词可追溯、效果可比对） */
        private String promptVersion = "v1";

        /** 建连超时（毫秒） */
        private int connectTimeoutMs = 5000;

        /** 读超时（毫秒）。大模型首 token 可能较慢，默认给足 60 秒 */
        private int readTimeoutMs = 60000;
    }
}
