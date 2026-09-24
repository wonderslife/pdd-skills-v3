package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqAlertDispatchService;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 预警扫描定时任务（SnailJob）
 *
 * <p>在 SnailJob 控制台创建执行器名 {@code yuqingAlertScan}，建议调度周期 5 分钟。
 * 与采集任务解耦的原因：突发增量必须跨采集批次看窗口，挂在采集管线尾部就只看得到当前批次，
 * 而且采集失败不应连累预警。</p>
 *
 * <p>同一任务里顺带刷出免打扰顺延的定时批量推送（验收标准 1 / 3）。</p>
 *
 * <p>⚠ 本任务不经 HTTP 暴露。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingAlertScan")
public class YqAlertScanJobExecutor {

    private final IYqAlertDispatchService alertDispatchService;
    private final IYqPushDispatchService pushDispatchService;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        try {
            AlertScanRequest req = new AlertScanRequest();
            req.setPushAfterCreate(true);
            AlertScanStats stats = alertDispatchService.scan(req);
            SnailJobLog.LOCAL.info("[预警扫描] {}", stats.getMessage());

            int pushed = 0;
            if (!stats.getAlertIds().isEmpty()) {
                PushStats ps = pushDispatchService.pushAlerts(stats.getAlertIds());
                pushed = ps.getSent();
                SnailJobLog.LOCAL.info("[预警扫描] 推送 成功{} 失败{} 顺延{}",
                    ps.getSent(), ps.getFailed(), ps.getDeferred());
            }
            int flushed = pushDispatchService.flushScheduled();
            SnailJobLog.LOCAL.info("[预警扫描] 顺延批量刷出 {}", flushed);

            List<Long> ids = stats.getAlertIds();
            return ExecuteResult.success("命中 " + stats.getDecisionCount() + " 条，落库 "
                + stats.getCreated() + " 条，推送成功 " + pushed + " 条，顺延刷出 " + flushed
                + " 条" + (ids.isEmpty() ? "" : "，预警ID " + ids));
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[预警扫描] 执行失败", e);
            return ExecuteResult.failure("预警扫描失败: " + e.getMessage());
        }
    }
}
