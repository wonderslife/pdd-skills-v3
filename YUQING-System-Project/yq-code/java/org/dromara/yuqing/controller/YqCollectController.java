package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.service.IYqCollectService;
import org.dromara.yuqing.service.IYqTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 采集调度运维接口。
 *
 * <p>⚠ 范围说明：F-004 本身「无对外 REST 接口」（dev-specs/F-004-collect.md），
 * 采集日志查询 / 导出归 F-018 运营监控。这里仅暴露 3 个**运维必需**的能力
 * （概览、单元预览、手动触发），并直接复用 F-018 运行监控的按钮权限
 * {@code yuqing:monitor:list} / {@code yuqing:monitor:run}，不新增菜单与权限点。</p>
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/collect")
public class YqCollectController extends BaseController {

    private final IYqCollectService collectService;

    private final IYqTaskService taskService;

    /**
     * 采集运行概览（验收标准 8）。
     */
    @SaCheckPermission("yuqing:monitor:list")
    @GetMapping("/overview")
    public R<CollectOverview> overview() {
        return R.ok(collectService.overview());
    }

    /**
     * 预览可下发的采集单元（含跳过原因，便于排查「为什么不采」）。
     */
    @SaCheckPermission("yuqing:monitor:list")
    @GetMapping("/units")
    public R<List<CollectUnit>> units(@RequestParam(required = false) Long taskId) {
        return R.ok(collectService.planUnits(taskId));
    }

    /**
     * 手动触发采集调度。
     *
     * @param taskId 任务ID；为空时调度全部启用任务
     */
    @SaCheckPermission("yuqing:monitor:run")
    @Log(title = "采集调度", businessType = BusinessType.OTHER)
    @PostMapping("/dispatch")
    public R<DispatchSummary> dispatch(@RequestParam(required = false) Long taskId) {
        return R.ok(taskId == null ? collectService.dispatch() : collectService.dispatchTask(taskId));
    }

    /**
     * 立即采集指定任务 × 渠道（用于验证站点适配器是否可用）。
     */
    @SaCheckPermission("yuqing:monitor:run")
    @Log(title = "采集调度", businessType = BusinessType.OTHER)
    @PostMapping("/dispatch/{taskId}/{channelId}")
    public R<CollectResult> collectOnce(@PathVariable Long taskId, @PathVariable Long channelId) {
        return R.ok(collectService.collectOnce(taskId, channelId));
    }

    /**
     * 采集频率校验（验收标准 2）：返回不满足渠道限流下限的配置项。
     */
    @SaCheckPermission("yuqing:task:query")
    @GetMapping("/schedule-check/{taskId}")
    public R<List<String>> scheduleCheck(@PathVariable Long taskId) {
        YqTask task = taskService.queryById(taskId);
        return R.ok(collectService.validateSchedule(task));
    }

    /**
     * 关键词组合表达式语法校验（F-002 验收标准 3）：返回带列位置的错误说明，空列表表示合法。
     *
     * <p>关键词库录入界面在保存前调用，避免把 {@code (辽宁|沈阳)+(药监局|药品监管)} 这类
     * 表达式录错后「采集成功、入库 0 条」而无人察觉。</p>
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/keyword/validate")
    public R<List<String>> validateKeyword(@RequestParam String expression) {
        return R.ok(collectService.validateKeywordExpression(expression));
    }
}
