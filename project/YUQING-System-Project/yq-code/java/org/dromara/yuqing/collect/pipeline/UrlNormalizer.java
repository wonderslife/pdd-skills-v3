package org.dromara.yuqing.collect.pipeline;

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
