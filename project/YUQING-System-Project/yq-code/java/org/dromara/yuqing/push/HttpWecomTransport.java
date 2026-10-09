package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 企业微信应用消息真实通道（F-011）
 *
 * <p>接口：</p>
 * <ul>
 *   <li>{@code POST /cgi-bin/message/send} —— 文本 / markdown / 文件消息</li>
 *   <li>{@code POST /cgi-bin/media/upload} —— 文件上传换取 media_id</li>
 * </ul>
 *
 * <p>token 失效错误码（40014 / 42001）会自动失效并重试一次。</p>
 *
 * @author ruoyi
 */
@Slf4j
@RequiredArgsConstructor
public class HttpWecomTransport implements WecomTransport {

    private static final int HEAD = 40014;
    private static final int HEAD_EXPIRED = 42001;

    private final YqAlertProperties props;
    private final WecomTokenHolder tokenHolder;

    @Override
    public String name() {
        return "wecom-http";
    }

    @Override
    public SendResult sendText(String touser, String content) {
        Map<String, Object> text = new LinkedHashMap<>();
        text.put("content", content == null ? "" : content);
        return send(touser, "text", text);
    }

    @Override
    public SendResult sendMarkdown(String touser, String content) {
        Map<String, Object> md = new LinkedHashMap<>();
        md.put("content", content == null ? "" : content);
        return send(touser, "markdown", md);
    }

    @Override
    public SendResult sendFile(String touser, String fileName, byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return SendResult.fail(-1, "文件内容为空");
        }
        String mediaId;
        try {
            mediaId = uploadMedia(fileName, bytes);
        } catch (IOException e) {
            return SendResult.fail(-1, "文件上传失败: " + e.getMessage());
        }
        Map<String, Object> media = new LinkedHashMap<>();
        media.put("media_id", mediaId);
        return send(touser, "file", media);
    }

    /* ------------------------------------------------------------------ 内部 */

    private SendResult send(String touser, String msgtype, Map<String, Object> body) {
        if (touser == null || touser.isBlank()) {
            return SendResult.fail(-1, "推送目标为空，未发送");
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("touser", touser);
        payload.put("msgtype", msgtype);
        payload.put("agentid", props.getPush().getAgentId());
        payload.put("safe", 0);
        payload.putAll(body);

        String json = JsonUtils.toJsonString(payload);
        SendResult first = post("/cgi-bin/message/send", json);
        if (!first.isOk() && (first.getErrcode() == HEAD || first.getErrcode() == HEAD_EXPIRED)) {
            // token 失效：失效重取后只重试一次，避免与上层重试策略叠加成风暴
            tokenHolder.invalidate();
            log.warn("[企微] token 失效，已刷新并重试一次");
            return post("/cgi-bin/message/send", json);
        }
        return first;
    }

    private SendResult post(String path, String json) {
        YqAlertProperties.Push p = props.getPush();
        try {
            String token = tokenHolder.get();
            String url = p.getApiBase() + path + "?access_token=" + token;
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs()))
                .header("Content-Type", "application/json; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
                .build()
                .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return parse(resp.body());
        } catch (IOException e) {
            return SendResult.fail(-1, "网络异常: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SendResult.fail(-1, "请求被中断");
        }
    }

    private String uploadMedia(String fileName, byte[] bytes) throws IOException {
        YqAlertProperties.Push p = props.getPush();
        String boundary = "----YuqingBoundary" + System.nanoTime();
        byte[] headBytes = ("--" + boundary + "\r\n"
            + "Content-Disposition: form-data; name=\"media\"; filename=\"" + safeName(fileName) + "\"\r\n"
            + "Content-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] tailBytes = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] payload = new byte[headBytes.length + bytes.length + tailBytes.length];
        System.arraycopy(headBytes, 0, payload, 0, headBytes.length);
        System.arraycopy(bytes, 0, payload, headBytes.length, bytes.length);
        System.arraycopy(tailBytes, 0, payload, headBytes.length + bytes.length, tailBytes.length);

        String token = tokenHolder.get();
        // 上传接口要求 multipart，把 type 放在 query 上
        String url = p.getApiBase() + "/cgi-bin/media/upload?access_token=" + token + "&type=file";
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs() * 4L))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                .build();
            HttpResponse<String> resp = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
                .build()
                .send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("media/upload 返回无法解析: " + brief(resp.body()));
            }
            int errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("media/upload 失败 errcode=" + errcode + " errmsg=" + node.path("errmsg").asString(""));
            }
            String mediaId = node.path("media_id").asString("");
            if (mediaId.isEmpty()) {
                throw new IOException("media/upload 未返回 media_id");
            }
            return mediaId;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("文件上传被中断", e);
        }
    }

    private static SendResult parse(String body) {
        JsonNode node = JsonUtils.parseObject(body, JsonNode.class);
        if (node == null) {
            return SendResult.fail(-1, "响应无法解析: " + brief(body));
        }
        int errcode = node.path("errcode").asInt(-1);
        String errmsg = node.path("errmsg").asString("");
        if (errcode == 0) {
            return SendResult.ok(body);
        }
        return SendResult.fail(errcode, errmsg);
    }

    private static String safeName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            return "report.dat";
        }
        return fileName.replace("\"", "").replace("\r", "").replace("\n", "");
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > 300 ? body.substring(0, 300) : body;
    }
}
