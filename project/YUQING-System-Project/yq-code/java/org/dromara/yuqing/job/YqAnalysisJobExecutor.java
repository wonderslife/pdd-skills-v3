package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analysis.config.YqAnalysisProperties;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.service.IYqAnalysisService;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 智能研判定时批量任务（SnailJob，F-007 验收标准 1、10）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingAnalysisBatch}。建议 Cron 每 5~10 分钟一次
 * （采集链路写入的新舆情状态是 {@code pending}，研判要尽快跟上，
 * 否则预警与日报拿不到分级）。作业ID 填到 {@code yuqing.analysis.analyze-job-id}。</p>
 *
 * <p><b>为什么用系统入口而不是人工入口：</b>定时任务线程没有登录上下文，
 * {@code currentScope()} 会保守地返回「可见 0 条」。若复用人工批量入口，
 * 任务会「每次成功执行、零处理」，日志里看不出异常 —— 这是最难发现的故障。
 * 因此调用 {@code analyzeBatchAsSystem}，显式使用全量范围。</p>
 *
 * <p><b>部分失败不算作业失败：</b>引擎已保证单条失败不阻塞其它条（验收标准 6）。
 * 若这里因「有几条失败」就返回 failure，调度中心会整批重跑，
 * 把已经成功的记录再研判一遍，白白消耗模型额度并产生重复结论版本。
 * 因此只在<b>批次级</b>异常（如数据库不可用）时才返回 failure。</p>
 *
 * <p><b>总开关：</b>{@code yuqing.analysis.enabled=false} 时直接成功返回并说明原因 ——
 * 刻意不返回失败，否则控制台会持续告警一个「本来就被关掉的功能」。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingAnalysisBatch")
public class YqAnalysisJobExecutor {

    private final IYqAnalysisService analysisService;

    private final YqAnalysisProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("智能研判已关闭（yuqing.analysis.enabled=false），本次跳过");
        }
        try {
            AnalysisBatchResult r = analysisService.analyzeBatchAsSystem(resolveLimit(jobArgs));
            SnailJobLog.LOCAL.info(
                "[智能研判] 批次 {} 结束：命中 {} / 认领 {} / 成功 {} / 失败 {} / 跳过 {} / 事件新建 {} / 事件并入 {} / 降级 {}",
                r.getBatchNo(), r.getTotal(), r.getClaimed(), r.getSucceeded(), r.getFailed(),
                r.getSkipped(), r.getClusterCreated(), r.getClusterJoined(), r.getRuleUsed());
            if (r.getFailed() > 0) {
                SnailJobLog.LOCAL.warn("[智能研判] 本批有 {} 条失败，可在研判中心使用「重试失败项」处理",
                    r.getFailed());
            }
            return ExecuteResult.success("批次 " + r.getBatchNo()
                + "：成功 " + r.getSucceeded() + " / 失败 " + r.getFailed()
                + " / 跳过 " + r.getSkipped() + "，剩余待研判 " + r.getRemaining());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[智能研判] 批次执行异常", e);
            return ExecuteResult.failure("智能研判异常: " + e.getMessage());
        }
    }

    /**
     * 取作业参数里的 {@code limit}（可选）。
     *
     * <p>允许在控制台临时把单批条数调大或调小，用于压测与故障期降速，
     * 不必改配置重启。参数缺失或非法时返回 null，由 Service 用配置值兜底 ——
     * 参数写错不该让任务失败。</p>
     */
    private Integer resolveLimit(JobArgs jobArgs) {
        if (jobArgs == null) {
            return null;
        }
        Object params = jobArgs.getJobParams();
        Object raw = params;
        if (params instanceof Map<?, ?> map) {
            raw = map.get("limit");
            if (raw == null) {
                raw = map.get("batchSize");
            }
        }
        if (raw == null) {
            return null;
        }
        try {
            int v = Integer.parseInt(String.valueOf(raw).trim());
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            SnailJobLog.LOCAL.warn("[智能研判] limit 参数非法，改用配置值: {}", raw);
            return null;
        }
    }
}
