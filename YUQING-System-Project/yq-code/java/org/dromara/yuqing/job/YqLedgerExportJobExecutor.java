package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.ledger.config.YqLedgerProperties;
import org.dromara.yuqing.ledger.export.LedgerExportRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 台账异步导出定时任务（SnailJob，F-016 验收标准 6 / 决策 ②A）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingLedgerExport}。
 * 触发方式选「手动触发 / API 触发」，因为每次导出都由用户操作驱动，
 * 不需要 Cron。作业ID 填到 {@code yuqing.ledger.export-job-id}，
 * 服务端才能通过 OpenAPI 触发它。</p>
 *
 * <p><b>为什么必须能在控制台被触发：</b>验收标准 6 要求「完成后推送下载链接」——
 * 若导出跑在 Web 进程的临时线程里，应用重启就丢了，且无法观测与重试。
 * 交给调度中心后，任务有执行记录、可人工补偿、可重跑。</p>
 *
 * <p><b>幂等性：</b>{@code LedgerExportRunner.runAsync} 开头检查
 * 记录状态为 {@code success} 时直接跳过 —— 调度中心的补偿重试
 * 不会重复生成与重复推送。</p>
 *
 * <p><b>参数来源：</b>服务端提交时用 {@code addArgsStr("exportId", id)} 传参，
 * 这里从 {@code jobArgs.getJobParams()} 取回（为 {@code Map} 形态）。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingLedgerExport")
public class YqLedgerExportJobExecutor {

    private final LedgerExportRunner runner;

    private final YqLedgerProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        Long exportId = resolveExportId(jobArgs);
        if (exportId == null) {
            /* 无 exportId 说明作业被误配成 Cron 定时跑 —— 直接失败并说清原因，
             * 而不是「什么都不做地成功」，否则问题会一直藏着。 */
            return ExecuteResult.failure(
                "缺少参数 exportId：本作业需由台账导出接口触发（yuqing.ledger.export-job-id="
                    + props.getExportJobId() + "），不应配置为定时执行");
        }
        try {
            runner.runAsync(exportId);
            SnailJobLog.LOCAL.info("[台账导出] #{} 执行结束", exportId);
            return ExecuteResult.success("台账导出 #" + exportId + " 执行结束");
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[台账导出] #" + exportId + " 执行异常", e);
            return ExecuteResult.failure("台账导出异常: " + e.getMessage());
        }
    }

    /** 从作业参数中取出 exportId（兼容 String / 数字 / Map 三种承载形态） */
    private Long resolveExportId(JobArgs jobArgs) {
        if (jobArgs == null) {
            return null;
        }
        Object params = jobArgs.getJobParams();
        Object raw = params;
        if (params instanceof Map<?, ?> map) {
            raw = map.get("exportId");
            if (raw == null) {
                raw = map.get("export_id");
            }
        }
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            SnailJobLog.LOCAL.warn("[台账导出] exportId 参数非法: {}", raw);
            return null;
        }
    }
}
