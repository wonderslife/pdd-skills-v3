package org.dromara.yuqing.collect.schedule;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 采集单元执行线程池。
 *
 * <p>池大小由 {@code yuqing.collect.unit-concurrency} 控制；线程为守护线程，不阻塞进程退出。
 * 真正的「单渠道并发上限」由 {@code ChannelRateLimiter} 的分布式信号量保证，
 * 本池只决定 Worker 的整体吞吐。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class CollectExecutor {

    private final YqCollectProperties props;

    private final AtomicInteger seq = new AtomicInteger();

    private volatile ExecutorService pool;

    public CollectExecutor(YqCollectProperties props) {
        this.props = props;
    }

    /**
     * 获取线程池（懒创建）。
     *
     * @return 线程池
     */
    public ExecutorService pool() {
        ExecutorService current = pool;
        if (current == null) {
            synchronized (this) {
                current = pool;
                if (current == null) {
                    int size = Math.max(1, props.getUnitConcurrency());
                    ThreadFactory factory = r -> {
                        Thread t = new Thread(r, "yq-collect-unit-" + seq.incrementAndGet());
                        t.setDaemon(true);
                        return t;
                    };
                    current = Executors.newFixedThreadPool(size, factory);
                    pool = current;
                    log.info("[采集调度] 单元线程池已创建，并发度 {}", size);
                }
            }
        }
        return current;
    }

    @PreDestroy
    public void shutdown() {
        ExecutorService current = pool;
        if (current != null) {
            current.shutdownNow();
        }
    }
}
