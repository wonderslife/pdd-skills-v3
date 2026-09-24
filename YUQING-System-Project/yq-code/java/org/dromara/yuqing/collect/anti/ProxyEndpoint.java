package org.dromara.yuqing.collect.anti;

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
