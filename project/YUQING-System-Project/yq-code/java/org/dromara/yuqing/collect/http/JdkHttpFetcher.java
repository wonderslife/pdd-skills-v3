package org.dromara.yuqing.collect.http;

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
