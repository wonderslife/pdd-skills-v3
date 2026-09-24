package org.dromara.yuqing.wecom;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.push.WecomTokenHolder;
import org.dromara.yuqing.wecom.config.YqWecomProperties;
import tools.jackson.databind.JsonNode;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * 企业微信 API 客户端（F-012）
 *
 * <p><b>复用 F-011 的 token 持有者：</b>access_token 通过 {@link WecomTokenHolder} 获取，
 * 该持有者已实现提前 300 秒过期与 synchronized 双检，避免并发刷新打爆企微限频。</p>
 *
 * <p><b>安全：</b>所有请求参数均做 URL 编码；corpSecret 只出现在 gettoken 的内部请求里，
 * 不记录进日志（token 持有者已在日志中做了脱敏处理）。</p>
 *
 * <p><b>装配说明：</b>本类不是 {@code @Component} —— 因为它依赖 {@link WecomTokenHolder}，
 * 而该持有者在本项目里是手工 {@code new} 出来的（见 {@code YqAlertConfig}），
 * 由 {@code YqWecomConfig} 统一装配，避免出现两个 token 持有者互相顶掉 token。</p>
 *
 * @author ruoyi
 */
@Slf4j
public class WecomApiClient {

    private final YqWecomProperties props;
    private final WecomTokenHolder tokenHolder;
    private final HttpClient http;

    public WecomApiClient(YqWecomProperties props, WecomTokenHolder tokenHolder) {
        this.props = props;
        this.tokenHolder = tokenHolder;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    /**
     * 用网页授权 code 换取成员身份（企微文档：获取访问用户身份）。
     *
     * @param code 企业微信回调带回的 code（一次性，5 分钟有效）
     * @return 成员信息；调用失败抛 IOException
     */
    public WecomMemberInfo getUserInfoByCode(String code) throws IOException {
        if (code == null || code.isBlank()) {
            throw new IOException("企业微信授权 code 为空");
        }
        String token = tokenHolder.get();
        String url = props.getApiBase() + "/cgi-bin/auth/getuserinfo"
            + "?access_token=" + enc(token)
            + "&code=" + enc(code);
        JsonNode node = getJson(url, "getuserinfo");

        int errcode = node.path("errcode").asInt(-1);
        if (errcode != 0) {
            // 40029 code 无效 / 42001 token 过期，刷新后重试一次
            tokenHolder.invalidate();
            String retryToken = tokenHolder.get();
            String retryUrl = props.getApiBase() + "/cgi-bin/auth/getuserinfo"
                + "?access_token=" + enc(retryToken)
                + "&code=" + enc(code);
            node = getJson(retryUrl, "getuserinfo(retry)");
            errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("企业微信 getuserinfo 失败 errcode=" + errcode
                    + " errmsg=" + node.path("errmsg").asString(""));
            }
        }
        return new WecomMemberInfo(
            textOrNull(node, "userid"),
            textOrNull(node, "openid"),
            textOrNull(node, "user_ticket"),
            textOrNull(node, "deviceid"));
    }

    /**
     * 查询成员详情（需 snsapi_privateinfo 授权拿到 user_ticket）。
     *
     * @param userTicket 授权时返回的 user_ticket
     * @return 成员详情 JSON；未配置或失败返回 null（调用方按「信息缺失」处理，不阻塞免登）
     */
    public JsonNode getUserDetail(String userTicket) {
        if (userTicket == null || userTicket.isBlank()) {
            return null;
        }
        try {
            String token = tokenHolder.get();
            String url = props.getApiBase() + "/cgi-bin/auth/getuserdetail?access_token=" + enc(token);
            String body = "{\"user_ticket\":\"" + jsonEscape(userTicket) + "\"}";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null || node.path("errcode").asInt(-1) != 0) {
                log.warn("[企微] getuserdetail 未取到详情，按信息缺失处理");
                return null;
            }
            return node;
        } catch (IOException e) {
            log.warn("[企微] getuserdetail 调用异常，按信息缺失处理: {}", e.getMessage());
            return null;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    /** 是否已配置可用凭据（corpId + corpSecret 均非空） */
    public boolean configured() {
        return props.getCorpId() != null && !props.getCorpId().isBlank()
            && props.getCorpSecret() != null && !props.getCorpSecret().isBlank();
    }

    private JsonNode getJson(String url, String scene) throws IOException {
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .GET()
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("企业微信 " + scene + " 返回无法解析: " + brief(resp.body()));
            }
            return node;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("企业微信 " + scene + " 被中断", e);
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        String v = node.path(field).asString("");
        return v.isBlank() ? null : v;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String jsonEscape(String v) {
        return v.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
    }
}
