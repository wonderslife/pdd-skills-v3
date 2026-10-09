package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.service.IYqCollectService;
import org.springframework.stereotype.Component;

/**
 * 采集调度定时任务（SnailJob）。
 *
 * <p>在 SnailJob 控制台创建任务，执行器名填 {@code yuqingCollectDispatch}，
 * 建议调度周期 1 分钟（真正的频率控制由任务的 collect_interval 与渠道限流下限决定，
 * 调度周期只是「检查是否到期」的节拍）。</p>
 *
 * <p>⚠ 本任务不经 HTTP 暴露（dev-specs/F-004-collect.md）。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingCollectDispatch")
public class YqCollectJobExecutor {

    private final IYqCollectService collectService;

    /**
     * 执行一次采集下发。
     *
     * @param jobArgs 任务参数
     * @return 执行结果
     */
    public ExecuteResult jobExecute(JobArgs jobArgs) {
        try {
            DispatchSummary summary = collectService.dispatch();
            SnailJobLog.LOCAL.info("[采集调度] {}", summary.getMessage());
            return ExecuteResult.success(summary.getMessage());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[采集调度] 执行失败", e);
            return ExecuteResult.failure("采集调度失败: " + e.getMessage());
        }
    }
}
