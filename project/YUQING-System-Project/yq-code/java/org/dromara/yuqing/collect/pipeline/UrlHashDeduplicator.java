package org.dromara.yuqing.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 链接去重前置（F-004 验收标准 7）。
 *
 * <p>三层防线：</p>
 * <ol>
 *   <li><b>批次内</b>：管道内的 HashSet（见 {@code CollectPipeline}）</li>
 *   <li><b>跨批次</b>：本类 —— Redis {@code SETNX} 带 TTL，快速拦截近期重复链接，并给出准确的去重计数</li>
 *   <li><b>最终一致</b>：Doris {@code Unique Key}，即使前两层漏判也会被吸收，不会重复入库</li>
 * </ol>
 *
 * <p>Redis 不可用时降级为进程内近似去重，链路不中断。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UrlHashDeduplicator {

    private static final String KEY_PREFIX = "yq:collect:dedup:";

    private final YqCollectProperties props;

    private final Map<String, Long> localCache = new ConcurrentHashMap<>();

    private final Deque<String> localOrder = new ConcurrentLinkedDeque<>();

    /**
     * 是否为首次出现。
     *
     * @param urlHash 链接指纹
     * @return true 表示首次出现（可进入后续环节）
     */
    public boolean firstSeen(String urlHash) {
        if (urlHash == null || urlHash.isBlank()) {
            return false;
        }
        if (props.getDedup().isRedisEnabled()) {
            try {
                return RedisUtils.setObjectIfAbsent(KEY_PREFIX + urlHash, "1",
                    Duration.ofSeconds(props.getDedup().getTtlSeconds()));
            } catch (Throwable e) {
                log.debug("[采集去重] Redis 不可用，降级为进程内去重: {}", e.getMessage());
            }
        }
        return localFirstSeen(urlHash);
    }

    /**
     * 回滚一次标记（写入失败时使用，避免「标记了却没入库」导致后续永久漏采）。
     *
     * @param urlHash 链接指纹
     */
    public void rollback(String urlHash) {
        if (urlHash == null || urlHash.isBlank()) {
            return;
        }
        if (props.getDedup().isRedisEnabled()) {
            try {
                RedisUtils.deleteObject(KEY_PREFIX + urlHash);
                return;
            } catch (Throwable ignored) {
                // 回落内存
            }
        }
        localCache.remove(urlHash);
    }

    private boolean localFirstSeen(String urlHash) {
        if (localCache.putIfAbsent(urlHash, System.currentTimeMillis()) != null) {
            return false;
        }
        localOrder.addLast(urlHash);
        int limit = Math.max(1000, props.getDedup().getLocalCacheSize());
        while (localCache.size() > limit) {
            String oldest = localOrder.pollFirst();
            if (oldest == null) {
                break;
            }
            localCache.remove(oldest);
        }
        return true;
    }
}
