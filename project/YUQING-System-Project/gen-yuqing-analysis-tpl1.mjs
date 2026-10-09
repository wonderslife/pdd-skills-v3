/**
 * F-007 智能研判 · 模板 1：配置属性 + JSON 门面 + 大模型客户端 + 领域传输对象
 *
 * 产物（rel 为包内相对路径，由 gen-yuqing-analysis.mjs 补 java/org/dromara/yuqing/ 前缀）：
 *   analysis/config/YqAnalysisProperties.java
 *   analysis/parse/AnalysisJson.java
 *   analysis/llm/ILlmClient.java
 *   analysis/llm/LlmRequest.java
 *   analysis/llm/LlmResponse.java
 *   analysis/llm/LlmException.java
 *   analysis/llm/OpenAiCompatibleLlmClient.java
 *   analysis/domain/AnalysisQuery.java
 *   analysis/domain/AnalysisRow.java
 *   analysis/domain/AnalysisDetailView.java
 *   analysis/domain/AnalysisCorrectBo.java
 *
 * 转义约定（本项目三层转义铁律）：
 *   - 模板串内不得出现裸反引号（gen-yuqing-analysis.mjs 会硬拦截）；
 *   - Java 产物一律用文本块或字符串拼接，不用 \n / \t 转义序列；
 *   - Vue / TS 产物不用反引号与 \${ 插值。
 */
export const ANALYSIS_TPL1 = [

  /* ============================================================ 配置 */
  {
    rel: 'analysis/config/YqAnalysisProperties.java',
    content: `package org.dromara.yuqing.analysis.config;

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
         * {@code api-key: \${YQ_LLM_API_KEY:}}
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
`,
  },

  /* ==================================================== JSON 门面（离线可用） */
  {
    rel: 'analysis/parse/AnalysisJson.java',
    content: `package org.dromara.yuqing.analysis.parse;

import org.dromara.common.json.utils.JsonUtils;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * 研判引擎的 JSON 门面。
 *
 * <p><b>为什么不直接用 {@link JsonUtils}：</b>该工具的 {@code JSON_MAPPER} 是
 * 静态 final 字段（{@code SpringUtils.getBean(JsonMapper.class)}），
 * 容器未启动时类初始化即抛 {@code ExceptionInInitializerError}。
 * 研判引擎的纯函数（提示词构建 / 结果解析 / 相似度）必须在 Spring 之外
 * 也能跑 —— 离线自测、以及将来可能的大模型评测 CLI —— 因此这里做一层兜底。</p>
 *
 * <p><b>为什么不复用 {@code collect.json.CollectJson}：</b>两者成因相同、
 * 实现几乎一致，但那个门面位于采集包内。研判引擎依赖采集包会把
 * 「采什么」与「怎么判」两个独立关注点绑在一起，因此各自持有一份
 * 三十行的门面，代价小于语义耦合。</p>
 *
 * <p>注意：本工程用的是 <b>Jackson 3</b>（{@code tools.jackson}），
 * 不是 Jackson 2 的 {@code com.fasterxml.jackson}。</p>
 *
 * @author ruoyi
 */
public final class AnalysisJson {

    /** 容器不可用时的兜底 mapper，双检锁懒加载。 */
    private static volatile JsonMapper fallback;

    private AnalysisJson() {
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
            synchronized (AnalysisJson.class) {
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
`,
  },

  /* ============================================================ 大模型通道 */
  {
    rel: 'analysis/llm/ILlmClient.java',
    content: `package org.dromara.yuqing.analysis.llm;

/**
 * 大模型对话通道（F-007）
 *
 * <p><b>为什么抽一层接口：</b>研判引擎的核心难点不是「怎么发 HTTP」，
 * 而是「拿到一段不可信文本后怎么变成结构化结论」。把传输层隔离掉，
 * 提示词 / 解析 / 融合这三块就能脱离网络单独测试，
 * 也让「内网模型」「批量推理服务」等其它形态可以后续接入而不动业务代码。</p>
 *
 * <p><b>实现约定：</b>任何网络或协议层异常都不得向上抛裸异常，
 * 一律包成 {@link LlmResponse} 的失败态携带可读原因 ——
 * 界面上要能直接看到「为什么这条研判失败了」。</p>
 *
 * @author ruoyi
 */
public interface ILlmClient {

    /** 通道标识，用于日志与失败原因描述 */
    String name();

    /** 通道是否可用（未配置即不可用，调用方据此决定是否走规则兜底） */
    boolean isEnabled();

    /** 当前模型名（落库到研判结论的 model_version） */
    String modelName();

    /**
     * 发起一次对话补全。
     *
     * @param request 提示词与采样参数，不得为 null
     * @return 成功态携带正文；失败态携带 reason，永不返回 null
     */
    LlmResponse chat(LlmRequest request);
}
`,
  },
  {
    rel: 'analysis/llm/LlmRequest.java',
    content: `package org.dromara.yuqing.analysis.llm;

import lombok.Data;

/**
 * 一次对话补全请求（F-007）
 *
 * <p>刻意只保留「系统提示 + 用户提示」双段结构：研判的输入是
 * 「固定的判定规范」+「不固定的舆情原文」，把两者分成两个角色
 * 是提示词注入防护的第一步（原文永远落在 user 段，且被定界符包裹）。</p>
 *
 * @author ruoyi
 */
@Data
public class LlmRequest {

    /** 系统提示（判定规范，由提示词构建器生成） */
    private String systemPrompt;

    /** 用户提示（舆情原文，已做定界与净化） */
    private String userPrompt;

    /** 模型名；为空时用通道默认值 */
    private String model;

    /** 采样温度 */
    private Double temperature;

    /** 最大回复 token 数 */
    private Integer maxTokens;
}
`,
  },
  {
    rel: 'analysis/llm/LlmResponse.java',
    content: `package org.dromara.yuqing.analysis.llm;

import lombok.Data;

/**
 * 一次对话补全结果（F-007）
 *
 * <p>失败态不抛异常而是返回值：批量研判里单条失败必须只影响这一条，
 * 调用方需要拿到「原因文本」写进 {@code yq_opinion_analysis.fail_reason}
 * 和 {@code yq_opinion.analyze_status = failed}，而不是让整个批次中断。</p>
 *
 * @author ruoyi
 */
@Data
public class LlmResponse {

    /** 是否成功（HTTP 2xx 且响应体含可用的 message.content） */
    private boolean success;

    /** 回复正文（模型原始输出，可能是 JSON、围栏 JSON 或夹带废话） */
    private String content;

    /** 实际使用的模型名 */
    private String model;

    /** 失败原因（可读，直接落库/展示） */
    private String reason;

    /** 原始响应体（截断后保存，便于排查；不进数据库） */
    private String rawBody;

    /** 消耗的输入 token（服务端未返回时为 null） */
    private Integer promptTokens;

    /** 消耗的输出 token（服务端未返回时为 null） */
    private Integer completionTokens;

    public static LlmResponse ok(String content, String model) {
        LlmResponse r = new LlmResponse();
        r.success = true;
        r.content = content;
        r.model = model;
        return r;
    }

    public static LlmResponse fail(String reason) {
        LlmResponse r = new LlmResponse();
        r.success = false;
        r.reason = reason;
        return r;
    }

    public LlmResponse raw(String body) {
        this.rawBody = body;
        return this;
    }

    public LlmResponse usage(Integer prompt, Integer completion) {
        this.promptTokens = prompt;
        this.completionTokens = completion;
        return this;
    }

    public static LlmResponse failed(String reason) {
        return fail(reason);
    }
}
`,
  },
  {
    rel: 'analysis/llm/LlmException.java',
    content: `package org.dromara.yuqing.analysis.llm;

/**
 * 大模型通道异常（F-007）
 *
 * <p>只在「配置错误」这类不该被静默吞掉的场景抛出（例如启用了通道却没配 apiKey）。
 * 网络抖动、限流、返回体不合法等运行期问题一律走
 * {@link LlmResponse#fail(String)} 返回值，由上层决定重试策略。</p>
 *
 * @author ruoyi
 */
public class LlmException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public LlmException(String message) {
        super(message);
    }

    public LlmException(String message, Throwable cause) {
        super(message, cause);
    }
}
`,
  },
  {
    rel: 'analysis/llm/OpenAiCompatibleLlmClient.java',
    content: `package org.dromara.yuqing.analysis.llm;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analysis.config.YqAnalysisProperties;
import org.dromara.yuqing.analysis.parse.AnalysisJson;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenAI 兼容对话通道（F-007）
 *
 * <p>请求 {@code POST {baseUrl}{chatPath}}，请求体形如
 * {@code {"model":..., "messages":[{"role":"system","content":...},...],
 * "temperature":0.2, "stream":false}}，响应体取
 * {@code choices[0].message.content}。</p>
 *
 * <p><b>与 F-011 企微通道同构：</b>都用 JDK 自带的
 * {@link java.net.http.HttpClient}，不引入额外 HTTP 客户端依赖，
 * 也因此不会与框架里已有的 WebClient / RestTemplate 争线程池配置。</p>
 *
 * <p><b>安全：</b>apiKey 只从配置读取，绝不落日志；错误信息里对
 * 响应体做截断，避免把可能的敏感回显整段打到日志。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OpenAiCompatibleLlmClient implements ILlmClient {

    /** 日志里响应体的最大回显长度 */
    private static final int BRIEF = 300;

    private final YqAnalysisProperties props;

    @Override
    public String name() {
        return "openai-compatible";
    }

    @Override
    public boolean isEnabled() {
        YqAnalysisProperties.Llm llm = props.getLlm();
        return llm != null && llm.isEnabled()
            && llm.getApiKey() != null && !llm.getApiKey().isBlank();
    }

    @Override
    public String modelName() {
        String m = props.getLlm() == null ? null : props.getLlm().getModel();
        return (m == null || m.isBlank()) ? "unknown" : m;
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        YqAnalysisProperties.Llm llm = props.getLlm();
        if (!isEnabled()) {
            return LlmResponse.fail("大模型通道未启用或未配置 apiKey");
        }
        if (request == null) {
            return LlmResponse.fail("请求体为空");
        }

        String model = (request.getModel() == null || request.getModel().isBlank())
            ? modelName() : request.getModel();
        double temperature = request.getTemperature() == null
            ? llm.getTemperature() : request.getTemperature();
        Integer maxTokens = request.getMaxTokens() == null
            ? llm.getMaxTokens() : request.getMaxTokens();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", temperature);
        body.put("stream", false);
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(message("system", request.getSystemPrompt()));
        messages.add(message("user", request.getUserPrompt()));
        body.put("messages", messages);
        if (maxTokens != null && maxTokens > 0) {
            body.put("max_tokens", maxTokens);
        }

        String payload = AnalysisJson.toJsonString(body);
        return post(llm, payload, model);
    }

    /* ------------------------------------------------------------------ 内部 */

    private static Map<String, String> message(String role, String content) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content == null ? "" : content);
        return m;
    }

    private LlmResponse post(YqAnalysisProperties.Llm llm, String payload, String model) {
        String url = trimEnd(llm.getBaseUrl()) + llm.getChatPath();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(llm.getReadTimeoutMs()))
                .header("Content-Type", "application/json; charset=UTF-8")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + llm.getApiKey())
                .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(llm.getConnectTimeoutMs()))
                .build()
                .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return parse(resp.statusCode(), resp.body(), model);
        } catch (IOException e) {
            return LlmResponse.fail("网络异常: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return LlmResponse.fail("请求被中断");
        } catch (IllegalArgumentException e) {
            /* URI.create 对非法 baseUrl 抛的就是它 —— 配置错误要能被看见 */
            return LlmResponse.fail("服务地址非法: " + e.getMessage());
        }
    }

    private LlmResponse parse(int status, String respBody, String model) {
        String brief = brief(respBody);
        if (respBody == null || respBody.isBlank()) {
            return LlmResponse.fail("响应体为空 (HTTP " + status + ")").raw(brief);
        }
        JsonNode root;
        try {
            root = AnalysisJson.readTree(respBody);
        } catch (RuntimeException e) {
            return LlmResponse.fail("响应体不是合法 JSON (HTTP " + status + "): " + brief).raw(brief);
        }
        if (status < 200 || status >= 300) {
            return LlmResponse.fail("HTTP " + status + ": " + errorMessage(root, brief)).raw(brief);
        }
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.size() == 0) {
            return LlmResponse.fail("响应缺少 choices: " + errorMessage(root, brief)).raw(brief);
        }
        JsonNode first = choices.get(0);
        String content = first == null ? "" : first.path("message").path("content").asString("");
        if (content == null || content.isBlank()) {
            return LlmResponse.fail("模型回复为空").raw(brief);
        }
        JsonNode usage = root.path("usage");
        return LlmResponse.ok(content, model)
            .raw(brief)
            .usage(
                usage.isMissingNode() ? null : usage.path("prompt_tokens").asInt(0),
                usage.isMissingNode() ? null : usage.path("completion_tokens").asInt(0));
    }

    private static String errorMessage(JsonNode root, String brief) {
        JsonNode err = root.path("error");
        if (err.isMissingNode() || err.isNull()) {
            return brief;
        }
        String msg = err.path("message").asString("");
        return msg == null || msg.isBlank() ? brief : msg;
    }

    private static String trimEnd(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim();
        while (t.endsWith("/")) {
            t = t.substring(0, t.length() - 1);
        }
        return t;
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > BRIEF ? body.substring(0, BRIEF) : body;
    }
}
`,
  },

  /* ============================================================ 领域对象 */
  {
    rel: 'analysis/domain/AnalysisQuery.java',
    content: `package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 研判中心筛选条件（F-007）
 *
 * <p>维度与 F-016 台账保持一致（同一批字段、同一套字典），
 * 但语义偏向「作业态」：台账看的是舆情本身，研判中心看的是
 * 「这批舆情判完了没、判得对不对」，因此多了研判状态、修正标记、
 * 失败重试相关的条件。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisQuery implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 时间 ---------------- */

    /** 采集开始时间（字符串，容错解析；非法值忽略而不是 400） */
    private String collectBeginTime;

    /** 采集结束时间 */
    private String collectEndTime;

    /* ---------------- 归属 ---------------- */

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 事件聚合ID */
    private Long clusterId;

    /* ---------------- 舆情属性 ---------------- */

    /** 舆情属性（positive / neutral / negative） */
    private String sentiAttr;

    /** 风险等级（general / moderate / severe） */
    private String riskLevel;

    /** 舆情分级（normal / attention / warning / urgent） */
    private String opinionLevel;

    /** 传播量级（low / medium / high / viral） */
    private String spreadLevel;

    /** 标签ID集合（任一命中即可） */
    private List<Long> tagIds;

    /* ---------------- 作业态 ---------------- */

    /** 研判状态（pending / processing / completed / failed） */
    private String analyzeStatus;

    /** 是否仅看人工修正过的（null 不限；"1" 是） */
    private String correctedFlag;

    /** 是否仅看已预警 */
    private String alertFlag;

    /** 是否仅看失败项（便于「只看失败」一键重试） */
    private Boolean onlyFailed;

    /** 是否仅看可重试的失败项（重试次数未超上限） */
    private Boolean retryableOnly;

    /* ---------------- 关键词 ---------------- */

    /** 关键词 */
    private String keyword;

    /** 关键词检索范围 title / content / both，为空按 both */
    private String keywordScope;

    /* ---------------- 排序与条数 ---------------- */

    /** 排序字段（白名单，非白名单值一律忽略） */
    private String orderBy;

    /** 是否倒序 */
    private Boolean orderDesc;

    /** 仅取前 N 条（批量研判用），null 用配置上限 */
    private Integer limit;

    /** 关键词检索范围归一：非法值一律回落 both */
    public String normalizedKeywordScope() {
        if ("title".equalsIgnoreCase(keywordScope) || "content".equalsIgnoreCase(keywordScope)) {
            return keywordScope.toLowerCase();
        }
        return "both";
    }

    /** 是否构成关键词条件（空白串不算条件） */
    public boolean hasKeyword() {
        return keyword != null && !keyword.isBlank();
    }

    /** 是否只看失败项 */
    public boolean failedOnly() {
        return Boolean.TRUE.equals(onlyFailed) || "failed".equalsIgnoreCase(analyzeStatus);
    }
}
`,
  },
  {
    rel: 'analysis/domain/AnalysisRow.java',
    content: `package org.dromara.yuqing.analysis.domain;

import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 研判中心列表行（F-007）
 *
 * <p>一行 = 一条舆情 + 它的研判结论（可能尚无结论，此时 analyzeStatus=pending）。
 * 刻意把「舆情侧字段」与「结论侧字段」都摊平在一行，因为研判员的工作方式是
 * 「扫一屏、挑几条改」——如果不把原文摘要和结论放一起，就要不停点开详情。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisRow implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 舆情侧 ---------------- */

    private Long opinionId;
    private Long taskId;
    private String taskName;
    private Long channelId;
    private String channelName;
    private String title;
    /** 原文截断预览（列表不返回全文，避免大字段拖慢分页） */
    private String contentBrief;
    private String opinionUrl;
    private LocalDateTime publishTime;
    private String author;
    private Integer heatScore;
    private Long clusterId;
    private String clusterTitle;
    private String alertFlag;

    /* ---------------- 结论侧 ---------------- */

    /** 研判状态（pending / processing / completed / failed） */
    private String analyzeStatus;
    private LocalDateTime analyzeTime;

    /** 主题识别结果 */
    private String topic;

    /** 情感倾向 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 舆情分级 */
    private String opinionLevel;

    /** 传播量级 */
    private String spreadLevel;

    /** 置信度（%） */
    private BigDecimal confidence;

    /** 模型版本 */
    private String modelVersion;

    /** 提示词版本 */
    private String promptVersion;

    /** 研判版本号（每次研判/修正递增） */
    private Integer analyzeVersion;

    /** 是否人工修正过（0否 1是） */
    private String correctedFlag;

    /** 失败原因（analyzeStatus=failed 时有值） */
    private String failReason;

    /** 标签名列表（已按来源展开，供列表直接展示） */
    private List<String> tags = new ArrayList<>();
}
`,
  },
  {
    rel: 'analysis/domain/AnalysisDetailView.java',
    content: `package org.dromara.yuqing.analysis.domain;

import lombok.Data;
import org.dromara.yuqing.ledger.domain.LedgerDetail;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 单条舆情研判详情（F-007 验收标准 7）
 *
 * <p><b>刻意「组合」而不是「摊平」：</b>验收标准 7 要求结论包含
 * 「舆情内容、来源、热度、风险等级、研判分析与处置建议」六要素，
 * 而 F-016 台账详情（{@link LedgerDetail}）已经把原文、互动数据、
 * 完整溯源字段、研判结论（含历史）、预警记录、推送记录全部组装好了，
 * 并且<b>自带数据权限校验</b>。把它的四十个字段在本类里再抄一遍，
 * 会带来两个确定的坏处：字段改名时两处不同步、越权校验出现第二份实现。</p>
 *
 * <p>因此本类只承载「研判特有、台账详情里没有」的四样东西：
 * 变体命中明细、模型标签与人工标签的分离、修正人姓名、结论来源标识。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisDetailView implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 台账详情（F-016 提供）。
     *
     * <p>前端渲染约定：其中的 content / title / analysis.summary /
     * analysis.suggestion / analysis.matchEvidence 全部来自外部输入
     * （采集原文 + 大模型输出），<b>一律纯文本渲染，禁止 v-html</b>。</p>
     */
    private LedgerDetail opinion;

    /**
     * 变体命中明细（验收标准 3 的「命中依据」）。
     *
     * <p>由 {@code matchEvidence} 的文本描述解析而来，便于前端按条目罗列；
     * 文本原文仍保留在 {@code opinion.analysis.matchEvidence} 里，
     * 解析失败时本列表为空而不影响展示。</p>
     */
    private List<String> variantHits = new ArrayList<>();

    /** 模型/规则打的标签名（tag_source = model） */
    private List<String> modelTagNames = new ArrayList<>();

    /** 人工修正加的标签名（tag_source = manual） */
    private List<String> manualTagNames = new ArrayList<>();

    /** 修正人姓名（corrected_by 的用户昵称） */
    private String correctedByName;

    /**
     * 结论来源：llm / rule / manual。
     *
     * <p>数据库里没有独立的「来源」列，本字段由
     * {@code corrected_flag} 与 {@code model_version} 推导：
     * 修正过 → manual；未修正且 model_version 为 rule → rule；否则 llm。
     * 这样在不新增列的前提下，界面仍能一眼区分三类结论。</p>
     */
    private String conclusionSource;
}
`,
  },
  {
    rel: 'analysis/domain/AnalysisCorrectBo.java',
    content: `package org.dromara.yuqing.analysis.domain;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 人工修正研判结论入参（F-007 验收标准 8）
 *
 * <p><b>只允许改三样：情感倾向、风险等级、标签。</b>
 * 这是验收标准明确列举的范围，也是模型最容易判错、人工最容易纠正的三项。
 * 主题 / 摘要 / 建议属模型生成的自然语言，人工改它们会让「模型效果比对」
 * 失去基线，因此本期不开放。</p>
 *
 * <p><b>为什么必须传 opinionId 而不是 analysisId：</b>
 * 研判结论是「按舆情」的，一条舆情可能经历多次研判（重试 / 换模型版本）。
 * 用 opinionId 作为入口可以保证改的永远是「当前生效的那一份」，
 * 前端不需要知道 analysisId 是哪个版本，也就不会出现
 * 「改完了但改的是历史版本」这种隐蔽错误。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisCorrectBo implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID（必填，入口键） */
    @NotNull(message = "舆情ID不能为空")
    private Long opinionId;

    /** 修正后的情感倾向（positive / neutral / negative）；为 null 表示不改这项 */
    private String sentiAttr;

    /** 修正后的风险等级（general / moderate / severe）；为 null 表示不改这项 */
    private String riskLevel;

    /** 修正后的舆情分级（normal / attention / warning / urgent）；为 null 表示不改这项 */
    private String opinionLevel;

    /**
     * 修正后的标签名集合。
     *
     * <p>语义是「覆盖」，不是「追加」：为 null 表示不动标签；
     * 传空数组表示「把人工标签全删掉」。这个区分很关键 ——
     * 如果空数组被当成「不改」，研判员就永远删不掉模型打错的标签。</p>
     */
    private List<String> tags;

    /** 修正说明（为什么改）。留痕用，建议必填 */
    private String remark;

    /** 是否同步登记训练样本（null 时取配置 sampleOnCorrect） */
    private Boolean createSample;
}
`,
  },

];
