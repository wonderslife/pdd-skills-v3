package org.dromara.yuqing.push;

import lombok.extern.slf4j.Slf4j;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.alert.config.YqAlertProperties;
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
 * 企业微信 access_token 持有者
 *
 * <p>token 有效期 7200 秒，这里提前 300 秒过期以避开边界；
 * 刷新失败不抛给业务方之外的线程（加锁双检，避免并发风暴刷爆企微接口限频）。</p>
 *
 * @author ruoyi
 */
@Slf4j
public class WecomTokenHolder {

    private static final long EARLY_EXPIRE_MS = 300_000L;

    private final YqAlertProperties props;
    private final HttpClient http;

    private volatile String token;
    private volatile long expireAtMs;

    public WecomTokenHolder(YqAlertProperties props) {
        this.props = props;
        YqAlertProperties.Push p = props.getPush();
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(p.getConnectTimeoutMs()))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    /** 取有效 token，必要时刷新 */
    public synchronized String get() throws IOException {
        long now = System.currentTimeMillis();
        if (token != null && now < expireAtMs) {
            return token;
        }
        YqAlertProperties.Push p = props.getPush();
        String url = p.getApiBase() + "/cgi-bin/gettoken?corpid="
            + enc(p.getCorpId()) + "&corpsecret=" + enc(p.getCorpSecret());
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofMillis(p.getReadTimeoutMs()))
                .GET()
                .build();
            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            JsonNode node = JsonUtils.parseObject(resp.body(), JsonNode.class);
            if (node == null) {
                throw new IOException("企业微信 gettoken 返回无法解析: " + brief(resp.body()));
            }
            int errcode = node.path("errcode").asInt(-1);
            if (errcode != 0) {
                throw new IOException("企业微信 gettoken 失败 errcode=" + errcode
                    + " errmsg=" + node.path("errmsg").asString(""));
            }
            String t = node.path("access_token").asString("");
            int expires = node.path("expires_in").asInt(7200);
            if (t.isEmpty()) {
                throw new IOException("企业微信 gettoken 未返回 access_token");
            }
            this.token = t;
            this.expireAtMs = System.currentTimeMillis() + Math.max(60, expires) * 1000L - EARLY_EXPIRE_MS;
            log.info("[企微] access_token 已刷新，{} 秒后过期", expires);
            return t;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("企业微信 gettoken 被中断", e);
        }
    }

    /** 强制失效（收到 42001 / 40014 时调用） */
    public synchronized void invalidate() {
        this.token = null;
        this.expireAtMs = 0L;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8);
    }

    private static String brief(String body) {
        if (body == null) {
            return "null";
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
    }
}
