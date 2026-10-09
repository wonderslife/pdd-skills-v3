package org.dromara.yuqing.push;

/**
 * 推送失败重试策略（F-011 验收标准 8）
 *
 * <p>指数退避：第 n 次重试等待 {@code backoff * 2^(n-1)} 毫秒。
 * 重试上限耗尽的失败会把最终原因写入 {@code yq_push_record.fail_reason}，
 * 记录保持 {@code failed} 状态由前端标红，<b>不自动删除、不静默置成功</b>。</p>
 *
 * @author ruoyi
 */
public final class PushRetryPolicy {

    private PushRetryPolicy() {
    }

    /** 归一化重试上限：负数=显式禁用重试（0 次），0=未配置回落 fallback，硬上限 10 防止把企微接口打爆 */
    public static int normalizeMaxRetry(int configured, int fallback) {
        if (configured < 0) {
            return 0;
        }
        int v = configured > 0 ? configured : (fallback > 0 ? fallback : 0);
        return Math.min(v, 10);
    }

    /** 第 attempt 次重试（attempt 从 1 开始）的等待毫秒数 */
    public static long backoffMs(long base, int attempt) {
        if (base <= 0 || attempt <= 0) {
            return 0L;
        }
        int shift = Math.min(attempt - 1, 10);
        return base * (1L << shift);
    }

    /** 是否还有重试额度 */
    public static boolean canRetry(int retryCount, int maxRetry) {
        return retryCount < maxRetry;
    }
}
