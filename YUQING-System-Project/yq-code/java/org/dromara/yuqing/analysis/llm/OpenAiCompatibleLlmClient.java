package org.dromara.yuqing.analysis.llm;

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
