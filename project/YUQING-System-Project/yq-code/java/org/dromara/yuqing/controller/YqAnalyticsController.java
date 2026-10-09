package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.analytics.AggregateRequest;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.AggregateSummary;
import org.dromara.yuqing.analytics.DashboardView;
import org.dromara.yuqing.analytics.DimType;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.analytics.RankBy;
import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.analytics.StatsExportRow;
import org.dromara.yuqing.analytics.StatsGrain;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.service.IYqAnalyticsService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 多维分析看板控制器（F-009）
 *
 * <p><b>权限：</b>读接口统一 {@code yuqing:dashboard:list}（菜单已配该权限）；
 * 重算接口 {@code yuqing:dashboard:aggregate}；导出接口 {@code yuqing:dashboard:export}。</p>
 *
 * <p><b>安全：</b>身份与数据范围一律来自 Sa-Token 上下文，请求参数只参与查询条件构造；
 * 不存在「前端传 taskId 就绕过权限」的路径 —— 本模块不做数据行级鉴权（按需求，舆情台账
 * 对所有有权限的角色可见），因此这里不引入越权面。</p>
 *
 * @author ruoyi
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/analytics")
public class YqAnalyticsController extends BaseController {

    private final IYqAnalyticsService analyticsService;

    /**
     * 看板数据
     *
     * @param dateFrom 起始统计日 yyyy-MM-dd
     * @param dateTo   截止统计日 yyyy-MM-dd
     * @param taskId   任务ID
     * @param channelId 渠道ID
     * @param sentiAttr 舆情属性
     * @param riskLevel 风险等级
     * @param opinionLevel 舆情分级
     * @param spreadLevel 传播量级
     * @param grain    时间粒度 hour / day / week
     * @param rankBy   热点排序口径 read / share / comment / heat
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/dashboard")
    public R<DashboardView> dashboard(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        return R.ok(analyticsService.dashboard(scope, grain, rankBy));
    }

    /**
     * 下钻明细（F-009 验收标准 6）
     *
     * @param dimType  维度类型，见 {@link DimType}
     * @param dimKey   维度取值
     * @param dimLabel 展示名
     * @param grain    当前粒度（趋势行下钻用）
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/drilldown")
    public R<DrilldownResult> drilldown(
        @RequestParam String dimType,
        @RequestParam(required = false) String dimKey,
        @RequestParam(required = false) String dimLabel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) Long opinionId,
        @RequestParam(required = false, defaultValue = "1") Integer pageNum,
        @RequestParam(required = false, defaultValue = "20") Integer pageSize,
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel) {
        DimType type = DimType.of(dimType);
        if (type == null) {
            return R.fail("不支持的维度类型：" + dimType);
        }
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        DrilldownQuery q = DrilldownQuery.of(scope, type, dimKey, dimLabel, StatsGrain.of(grain));
        if (q == null) {
            return R.fail("维度取值无法解析，请刷新看板后重试");
        }
        if (opinionId != null) {
            q.setOpinionId(opinionId);
        }
        q.setPageNum(pageNum == null ? 1 : pageNum);
        q.setPageSize(pageSize == null ? 20 : pageSize);
        return R.ok(analyticsService.drilldown(q));
    }

    /**
     * 报告章节交接包（F-009 验收标准 7）
     *
     * <p>返回的是「自描述数据包」，F-014 报告生成直接消费，不用反向调用本模块。</p>
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/handoff")
    public R<ReportSection> handoff(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        return R.ok(analyticsService.handoff(scope, grain, rankBy));
    }

    /**
     * 手动重算 / 补算历史（F-009 验收标准 8 / 9）
     */
    @SaCheckPermission("yuqing:dashboard:aggregate")
    @PostMapping("/aggregate")
    public R<AggregateSummary> aggregate(@RequestBody(required = false) AggregateRequest request) {
        return R.ok(analyticsService.aggregate(request));
    }

    /**
     * 聚合批次台账
     */
    @SaCheckPermission("yuqing:dashboard:list")
    @GetMapping("/batches")
    public R<List<YqStatsBatch>> batches(@RequestParam(required = false, defaultValue = "20") Integer limit) {
        return R.ok(analyticsService.recentBatches(limit == null ? 20 : limit));
    }

    /**
     * 导出 Excel（F-009 验收标准 10）
     *
     * <p>长表结构（指标区块 / 维度 / 取值 / 数值 / 占比 / 说明），
     * 七类指标齐在一张 sheet 里，下游做透视比多 sheet 更顺手。</p>
     */
    @SaCheckPermission("yuqing:dashboard:export")
    @PostMapping("/export")
    public void export(
        @RequestParam(required = false) String dateFrom,
        @RequestParam(required = false) String dateTo,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String grain,
        @RequestParam(required = false) String rankBy,
        HttpServletResponse response) {
        AggregateScope scope = buildScope(dateFrom, dateTo, taskId, channelId,
            sentiAttr, riskLevel, opinionLevel, spreadLevel);
        List<StatsExportRow> rows = analyticsService.exportRows(scope, grain, rankBy);
        ExcelBuilder.of(rows, StatsExportRow.class)
            .sheetName("多维分析")
            .toResponse(response);
    }

    /**
     * 组装范围条件
     *
     * <p>日期解析失败一律忽略该条件（回落默认范围），不抛 500：
     * 看板裸 URL 打开也要能用。</p>
     */
    private AggregateScope buildScope(String dateFrom, String dateTo, Long taskId, Long channelId,
                                     String sentiAttr, String riskLevel,
                                     String opinionLevel, String spreadLevel) {
        AggregateScope scope = new AggregateScope();
        scope.setDateFrom(parseDate(dateFrom));
        scope.setDateTo(parseDate(dateTo));
        scope.setTaskId(taskId);
        scope.setChannelId(channelId);
        scope.setSentiAttr(sentiAttr);
        scope.setRiskLevel(riskLevel);
        scope.setOpinionLevel(opinionLevel);
        scope.setSpreadLevel(spreadLevel);
        return scope;
    }

    private java.time.LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return java.time.LocalDate.parse(v.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
