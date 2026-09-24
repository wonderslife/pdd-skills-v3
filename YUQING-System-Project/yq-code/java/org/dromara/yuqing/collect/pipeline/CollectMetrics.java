package org.dromara.yuqing.collect.pipeline;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.redis.utils.RedisUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.CollectResult;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 采集运行计数器（F-004 验收标准 8、9）。
 *
 * <p>累计 / 当日 / 去重 / 失败计数走 Redis 原子计数（多实例共享）；异常连续次数按采集单元计数。
 * Redis 不可用时降级为进程内计数，采集主链路不受影响。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CollectMetrics {

    private static final String NS = "yq:collect:metric:";

    private static final String ABNORMAL_PREFIX = "yq:collect:abnormal:";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyyMMdd");

    private final Map<String, AtomicLong> localCounters = new ConcurrentHashMap<>();

    /**
     * 记录一个批次的计数。
     *
     * @param result 批次结果
     */
    public void record(CollectResult result) {
        if (result == null) {
            return;
        }
        incr(NS + "total:fetched", result.getFetchedCount());
        incr(NS + "total:inserted", result.getInsertedCount());
        incr(NS + "total:dup", result.getDupCount());
        incr(NS + "total:failed", result.getFailedCount());
        incr(NS + "total:batches", 1L);
        String day = LocalDate.now().format(DAY);
        incr(NS + day + ":fetched", result.getFetchedCount());
        incr(NS + day + ":inserted", result.getInsertedCount());
        incr(NS + day + ":dup", result.getDupCount());
        incr(NS + day + ":failed", result.getFailedCount());
        incr(NS + day + ":batches", 1L);
    }

    /**
     * 累计采集条数。
     *
     * @return 条数
     */
    public long totalFetched() {
        return read(NS + "total:fetched");
    }

    /**
     * 当日计数快照。
     *
     * @return fetched / inserted / dup / failed / batches
     */
    public Map<String, Long> today() {
        String day = LocalDate.now().format(DAY);
        Map<String, Long> map = new LinkedHashMap<>();
        map.put("fetched", read(NS + day + ":fetched"));
        map.put("inserted", read(NS + day + ":inserted"));
        map.put("dup", read(NS + day + ":dup"));
        map.put("failed", read(NS + day + ":failed"));
        map.put("batches", read(NS + day + ":batches"));
        return map;
    }

    /**
     * 更新某采集单元的连续异常次数。
     *
     * @param unitKey   单元键 taskId:channelId
     * @param abnormal  本批次是否异常
     * @return 更新后的连续异常次数（正常返回 0）
     */
    public int bumpAbnormal(String unitKey, boolean abnormal) {
        if (unitKey == null || unitKey.isBlank()) {
            return 0;
        }
        String key = ABNORMAL_PREFIX + unitKey;
        if (abnormal) {
            incr(key, 1L);
            return (int) read(key);
        }
        clear(key);
        return 0;
    }

    /**
     * 连续异常次数。
     *
     * @param unitKey 单元键
     * @return 次数
     */
    public int abnormalCount(String unitKey) {
        return unitKey == null || unitKey.isBlank() ? 0 : (int) read(ABNORMAL_PREFIX + unitKey);
    }

    /**
     * 达到阈值的异常单元列表（F-004 验收标准 9）。
     *
     * @param threshold 阈值
     * @return 单元键 -> 连续异常次数
     */
    public Map<String, Integer> abnormalUnits(int threshold) {
        Map<String, Integer> result = new LinkedHashMap<>();
        try {
            Collection<String> keys = RedisUtils.keys(ABNORMAL_PREFIX + "*");
            for (String key : keys) {
                long count = RedisUtils.getAtomicValue(key);
                if (count >= threshold) {
                    result.put(key.substring(ABNORMAL_PREFIX.length()), (int) count);
                }
            }
        } catch (Throwable e) {
            log.debug("[采集指标] Redis 异常单元扫描不可用，回退进程内计数: {}", e.getMessage());
            localCounters.forEach((k, v) -> {
                if (k.startsWith(ABNORMAL_PREFIX) && v.get() >= threshold) {
                    result.put(k.substring(ABNORMAL_PREFIX.length()), (int) v.get());
                }
            });
        }
        return result;
    }

    private void incr(String key, long delta) {
        if (delta == 0) {
            return;
        }
        try {
            long v = RedisUtils.incrAtomicValue(key);
            if (v == delta) {
                RedisUtils.expire(key, Duration.ofDays(40));
            }
        } catch (Throwable e) {
            local(key).addAndGet(delta);
        }
    }

    private long read(String key) {
        try {
            return RedisUtils.getAtomicValue(key);
        } catch (Throwable e) {
            AtomicLong value = localCounters.get(key);
            return value == null ? 0L : value.get();
        }
    }

    private void clear(String key) {
        try {
            RedisUtils.deleteObject(key);
        } catch (Throwable e) {
            localCounters.remove(key);
        }
        localCounters.remove(key);
    }

    private AtomicLong local(String key) {
        return localCounters.computeIfAbsent(key, k -> new AtomicLong());
    }
}
