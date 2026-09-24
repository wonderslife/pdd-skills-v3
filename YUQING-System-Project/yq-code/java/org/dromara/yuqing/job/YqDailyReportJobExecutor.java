package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.report.build.ReportScopeResolver;
import org.dromara.yuqing.report.config.YqReportProperties;
import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.service.IYqReportExtService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 舆情日报 / 月报自动生成定时任务（SnailJob，F-014 验收标准 1）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingDailyReport}。建议日报每日 07:30 执行
 * （早于上班，报送员到岗即有初稿可校对），月报每月 1 日 07:40 执行。</p>
 *
 * <p><b>为什么默认生成「昨天」：</b>舆情数据的采集有迟到（补采、跨天发布），
 * 07:30 生成当天的报告必然缺数据。生成昨天的报告，配合 02:10 的多维分析预聚合，
 * 正文里的统计口径是完整闭合的。</p>
 *
 * <p><b>幂等性：</b>{@code YqReportExtServiceImpl.generate} 内部按
 * {@code (reportType, reportDate)} 判重，已存在且非 failed 的记录不会重复生成。
 * 因此本任务重复执行是安全的 —— SnailJob 的补偿重试不会产出两份日报。</p>
 *
 * <p><b>失败隔离：</b>与采集 / 研判 / 预警完全解耦。生成失败只体现为一条
 * status=failed 的报告记录与返回的失败结果，不影响主流程。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingDailyReport")
public class YqDailyReportJobExecutor {

    private final IYqReportExtService reportExtService;

    private final YqReportProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("报告生成引擎已关闭，跳过");
        }
        if (!props.isAutoGenerate()) {
            return ExecuteResult.success("定时自动生成未启用（yuqing.report.auto-generate=false），跳过");
        }
        String type = props.getAutoType() == null ? "daily" : props.getAutoType();
        LocalDate date = "monthly".equalsIgnoreCase(type)
            ? LocalDate.now().withDayOfMonth(1).minusDays(1)
            : ReportScopeResolver.defaultDate();
        try {
            ReportGenerateBo bo = new ReportGenerateBo();
            bo.setReportType(type);
            bo.setReportDate(date);
            bo.setTemplateId(props.getDefaultTemplateId());
            bo.setTriggerType("auto");
            bo.setOverwrite(Boolean.FALSE);
            bo.setPushAfter(props.isPushAfterGenerate());

            ReportGenerateResult r = reportExtService.generate(bo, null);
            SnailJobLog.LOCAL.info("[报告] {}", r.summary());
            if ("failed".equals(r.getStatus())) {
                return ExecuteResult.failure("报告生成失败：" + r.getFailReason());
            }
            return ExecuteResult.success(r.summary());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[报告] 执行异常", e);
            return ExecuteResult.failure("报告生成异常: " + e.getMessage());
        }
    }
}
