package org.dromara.yuqing.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.net.PasswordAuthentication;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 自研代理池（《技术架构说明》§5.6）。
 *
 * <p>能力：分组取用、轮换 / 粘性会话、失败即时摘除。IP 轮换是验收标准 6 的一环。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProxyProvider {

    private final YqCollectProperties props;

    /** 分组缓存：groupKey -> 出口列表 */
    private final Map<String, List<ProxyEndpoint>> groups = new ConcurrentHashMap<>();

    /** 粘性会话：sessionKey -> [endpoint, 过期时间戳] */
    private final Map<String, Object[]> sticky = new ConcurrentHashMap<>();

    /** 已摘除的出口 */
    private final Set<String> evicted = ConcurrentHashMap.newKeySet();

    private final AtomicInteger rotateIndex = new AtomicInteger();

    /**
     * 取一个可用出口。
     *
     * @param groupId    代理池分组ID（对应配置 yuqing.collect.proxy.groups 的 key）
     * @param sessionKey 粘性会话键，通常用 channelId
     * @return 出口；未启用或无可用户口返回 {@link Optional#empty()}
     */
    public Optional<ProxyEndpoint> acquire(Long groupId, String sessionKey) {
        if (!props.getProxy().isEnabled() || groupId == null) {
            return Optional.empty();
        }
        List<ProxyEndpoint> all = group(String.valueOf(groupId));
        if (all.isEmpty()) {
            return Optional.empty();
        }
        List<ProxyEndpoint> usable = new ArrayList<>();
        for (ProxyEndpoint ep : all) {
            if (!evicted.contains(ep.raw())) {
                usable.add(ep);
            }
        }
        if (usable.isEmpty()) {
            log.warn("[采集代理] 分组 {} 出口全部被摘除，本轮直连", groupId);
            return Optional.empty();
        }
        if ("sticky".equalsIgnoreCase(props.getProxy().getStrategy()) && sessionKey != null) {
            long now = System.currentTimeMillis();
            Object[] cached = sticky.get(sessionKey);
            if (cached != null && (long) cached[1] > now) {
                ProxyEndpoint ep = (ProxyEndpoint) cached[0];
                if (!evicted.contains(ep.raw())) {
                    return Optional.of(ep);
                }
            }
            ProxyEndpoint ep = usable.get(Math.floorMod(rotateIndex.getAndIncrement(), usable.size()));
            sticky.put(sessionKey, new Object[]{ep, now + props.getProxy().getStickyTtlSeconds() * 1000L});
            return Optional.of(ep);
        }
        return Optional.of(usable.get(Math.floorMod(rotateIndex.getAndIncrement(), usable.size())));
    }

    /**
     * 上报失败：按配置摘除出口，避免继续踩同一个被拉黑的 IP。
     *
     * @param endpoint 出口
     */
    public void reportFailure(ProxyEndpoint endpoint) {
        if (endpoint == null) {
            return;
        }
        if (props.getProxy().isEvictOnFailure()) {
            evicted.add(endpoint.raw());
        }
    }

    /**
     * 上报成功：清空该出口的失败标记。
     *
     * @param endpoint 出口
     */
    public void reportSuccess(ProxyEndpoint endpoint) {
        if (endpoint != null) {
            evicted.remove(endpoint.raw());
        }
    }

    /**
     * 为 JDK HttpClient 的全局 Authenticator 提供代理凭据。
     *
     * @param host 代理主机
     * @param port 代理端口
     * @return 凭据；无匹配返回 null
     */
    public PasswordAuthentication credentials(String host, int port) {
        if (host == null) {
            return null;
        }
        for (List<ProxyEndpoint> list : groups.values()) {
            for (ProxyEndpoint ep : list) {
                if (ep.needAuth() && ep.getHost().equalsIgnoreCase(host) && ep.getPort() == port) {
                    return new PasswordAuthentication(ep.getUser(), ep.getPass() == null ? new char[0] : ep.getPass().toCharArray());
                }
            }
        }
        return null;
    }

    /**
     * 解析并缓存分组。
     *
     * @param groupKey 分组 key
     * @return 出口列表，可能为空
     */
    private List<ProxyEndpoint> group(String groupKey) {
        return groups.computeIfAbsent(groupKey, k -> {
            String raw = props.getProxy().getGroups().get(k);
            if (raw == null || raw.isBlank()) {
                return Collections.emptyList();
            }
            List<ProxyEndpoint> list = new ArrayList<>();
            for (String part : raw.split(",")) {
                ProxyEndpoint ep = ProxyEndpoint.parse(part);
                if (ep != null) {
                    list.add(ep);
                }
            }
            if (list.isEmpty()) {
                log.warn("[采集代理] 分组 {} 配置无有效出口: {}", k, raw);
            }
            return list;
        });
    }
}
