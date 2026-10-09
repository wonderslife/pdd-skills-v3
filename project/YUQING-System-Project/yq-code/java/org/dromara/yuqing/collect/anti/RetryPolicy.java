package org.dromara.yuqing.collect.anti;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

/**
 * 退避重试策略（F-004 验收标准 5）。
 *
 * <p>指数退避 + 抖动。抖动用于避免同批任务在同一时刻集中重试，形成对目标站点的脉冲式压力。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RetryPolicy {

    private final YqCollectProperties props;

    /**
     * 最大尝试次数（含首次）。
     *
     * @return 至少为 1
     */
    public int maxAttempts() {
        return Math.max(1, props.getRetry().getMaxAttempts());
    }

    /**
     * 计算第 N 次失败后的退避时长。
     *
     * @param attempt 已失败次数，从 1 开始
     * @return 退避毫秒，含抖动
     */
    public long backoffMillis(int attempt) {
        YqCollectProperties.Retry cfg = props.getRetry();
        double base = cfg.getInitialBackoffMs() * Math.pow(Math.max(1.0D, cfg.getMultiplier()), Math.max(0, attempt - 1));
        long capped = (long) Math.min(base, cfg.getMaxBackoffMs());
        double jitterRatio = Math.max(0.0D, Math.min(1.0D, cfg.getJitterRatio()));
        if (jitterRatio <= 0) {
            return capped;
        }
        long jitter = (long) (capped * jitterRatio);
        return Math.max(1L, capped + ThreadLocalRandom.current().nextLong(-jitter, jitter + 1));
    }

    /**
     * 按退避时长休眠。
     *
     * @param millis 毫秒
     */
    public void sleep(long millis) {
        if (millis <= 0) {
            return;
        }
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[采集重试] 退避休眠被中断");
        }
    }

    /**
     * 生成适配器要求的随机请求延时（反爬：频率算法对抗，请求间隔随机化）。
     *
     * @param minMs 下限
     * @param maxMs 上限
     * @return 毫秒；参数非法返回 0
     */
    public long randomDelayMillis(Integer minMs, Integer maxMs) {
        int lo = minMs == null ? 0 : Math.max(0, minMs);
        int hi = maxMs == null ? lo : Math.max(lo, maxMs);
        if (hi <= 0) {
            return 0L;
        }
        return lo == hi ? lo : ThreadLocalRandom.current().nextLong(lo, hi + 1L);
    }
}
