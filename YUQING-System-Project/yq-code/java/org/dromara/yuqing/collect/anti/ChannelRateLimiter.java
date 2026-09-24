package org.dromara.yuqing.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.SpringUtils;
import org.redisson.api.RRateLimiter;
import org.redisson.api.RSemaphore;
import org.redisson.api.RateType;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * 渠道限流闸门（F-004 验收标准 6）。
 *
 * <p>双重闸门：</p>
 * <ol>
 *   <li><b>令牌桶</b>：按渠道 QPS 限速，速率由「请求间隔（毫秒）」换算，Redisson 实现跨实例共享；</li>
 *   <li><b>并发闸门</b>：按渠道并发上限放行，Redisson {@code RSemaphore} 实现跨实例共享。</li>
 * </ol>
 *
 * <p>Redis 不可用时自动降级为进程内信号量，保证采集链路不因限流组件故障而中断。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ChannelRateLimiter {

    /** 排队等待上限：超过则放行并记降级告警，避免整批任务被单渠道卡死 */
    private static final long ACQUIRE_WAIT_MS = 30000L;

    private final Map<Long, Semaphore> localGates = new ConcurrentHashMap<>();

    private volatile RedissonClient redisClient;

    private volatile boolean redisResolved = false;

    /**
     * 申请一次抓取许可。
     *
     * @param channelId         渠道ID
     * @param requestIntervalMs 渠道请求间隔（毫秒）
     * @param concurrencyLimit  渠道并发上限
     * @return 许可句柄，务必在 finally / try-with-resources 中释放
     */
    public Permit acquire(Long channelId, Integer requestIntervalMs, Integer concurrencyLimit) {
        int limit = concurrencyLimit == null || concurrencyLimit <= 0 ? 1 : concurrencyLimit;
        int intervalMs = requestIntervalMs == null || requestIntervalMs <= 0 ? 1000 : requestIntervalMs;
        long key = channelId == null ? 0L : channelId;
        RedissonClient client = redis();
        if (client != null) {
            try {
                RSemaphore semaphore = client.getSemaphore("yq:collect:gate:" + key);
                semaphore.trySetPermits(limit);
                boolean got = semaphore.tryAcquire(ACQUIRE_WAIT_MS, TimeUnit.MILLISECONDS);
                if (!got) {
                    log.warn("[采集限流] 渠道 {} 并发闸门排队超时，本请求直放", channelId);
                    return Permit.noop();
                }
                RRateLimiter rateLimiter = client.getRateLimiter("yq:collect:rate:" + key);
                rateLimiter.trySetRate(RateType.OVERALL, Math.max(1L, 1000L / intervalMs), Duration.ofSeconds(1));
                rateLimiter.tryAcquire(Math.max(intervalMs * 2L, 1000L), TimeUnit.MILLISECONDS);
                return new Permit(semaphore, null, true, false);
            } catch (Throwable e) {
                log.warn("[采集限流] Redis 闸门不可用，降级为进程内限流: {}", e.getMessage());
            }
        }
        Semaphore local = localGates.computeIfAbsent(key, k -> new Semaphore(limit));
        boolean acquired = false;
        try {
            acquired = local.tryAcquire(ACQUIRE_WAIT_MS, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return new Permit(null, local, false, acquired);
    }

    private RedissonClient redis() {
        if (redisResolved) {
            return redisClient;
        }
        synchronized (this) {
            if (!redisResolved) {
                try {
                    redisClient = SpringUtils.getBean(RedissonClient.class);
                } catch (Throwable ignored) {
                    redisClient = null;
                }
                redisResolved = true;
            }
        }
        return redisClient;
    }

    /**
     * 限流许可句柄。
     */
    public static final class Permit implements AutoCloseable {

        private final RSemaphore redisSemaphore;

        private final Semaphore localSemaphore;

        private final boolean redisAcquired;

        private final boolean localAcquired;

        private Permit(RSemaphore redisSemaphore, Semaphore localSemaphore, boolean redisAcquired, boolean localAcquired) {
            this.redisSemaphore = redisSemaphore;
            this.localSemaphore = localSemaphore;
            this.redisAcquired = redisAcquired;
            this.localAcquired = localAcquired;
        }

        static Permit noop() {
            return new Permit(null, null, false, false);
        }

        @Override
        public void close() {
            if (redisAcquired && redisSemaphore != null) {
                redisSemaphore.release();
            }
            if (localAcquired && localSemaphore != null) {
                localSemaphore.release();
            }
        }
    }
}
