package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.config.YqAnalyticsProperties;
import org.dromara.yuqing.service.IYqAnalyticsService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 多维分析预聚合定时任务（SnailJob，F-009 验收标准 8 / 9）
 *
 * <p>在 SnailJob 控制台创建执行器名 {@code yuqingStatsAggregate}，建议每日 02:10 执行。</p>
 *
 * <p><b>回看窗口：</b>默认重算最近 {@code yuqing.analytics.job-lookback-days} 天（默认 2 天），
 * 而不是只算昨天。原因是舆情数据存在迟到（采集慢、补采、跨天发布），只算昨天会让今天的看板缺一块；
 * 而 Doris Unique Key 覆盖写让「多算一天」的成本仅为一点点 CPU，收益是不出现空洞。
 * 需要补算任意历史区间时走 PC 看板的「重算」按钮（{@code POST /yuqing/analytics/aggregate}），
 * 那才是 ad-hoc 范围的正确入口 —— 定时任务保持无参，避免有人往任务参数里塞乱七八糟的东西。</p>
 *
 * <p><b>失败隔离（验收标准 9）：</b>本任务与采集、研判、预警完全解耦 ——
 * 它失败只体现为看板上的一个降级提示与数据截止时间，主流程照常。
 * 因此异常在这里被捕获成失败的 {@code ExecuteResult}，不往外抛。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingStatsAggregate")
public class YqStatsAggregateJobExecutor {

    private final IYqAnalyticsService analyticsService;

    private final YqAnalyticsProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("多维分析引擎已关闭，跳过");
        }
        try {
            LocalDate today = LocalDate.now();
            int lookback = Math.max(1, Math.min(props.getJobLookbackDays(), 31));
            AggregateRequest req = new AggregateRequest();
            req.setDateFrom(today.minusDays(lookback - 1L));
            req.setDateTo(today);
            req.setTriggerType("auto");
            AggregateSummary summary = analyticsService.aggregate(req);
            SnailJobLog.LOCAL.info("[多维分析] {}", summary.message());
            if ("failed".equals(summary.getStatus())) {
                return ExecuteResult.failure("聚合失败：" + summary.getFailReason());
            }
            return ExecuteResult.success(summary.message());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[多维分析] 执行异常", e);
            return ExecuteResult.failure("聚合异常: " + e.getMessage());
        }
    }
}
