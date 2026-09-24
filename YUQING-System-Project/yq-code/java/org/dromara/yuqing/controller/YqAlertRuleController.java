package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.service.IYqAlertRuleService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 预警规则Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/alertRule")
public class YqAlertRuleController extends BaseController {

    private final IYqAlertRuleService alertRuleService;

    /**
     * 查询预警规则列表
     */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/list")
    public R<PageResult<YqAlertRule>> list(YqAlertRule bo, PageQuery pageQuery) {
        return R.ok(alertRuleService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出预警规则列表
     */
    @SaCheckPermission("yuqing:alert:export")
    @Log(title = "预警规则", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqAlertRule bo, HttpServletResponse response) {
        List<YqAlertRule> list = alertRuleService.queryList(bo);
        ExcelBuilder.of(list, YqAlertRule.class).sheetName("预警规则").toResponse(response);
    }

    /**
     * 查询预警规则下拉选项（PRD §4.5；必须声明在 /{ruleId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/optionselect")
    public R<List<YqAlertRule>> optionselect(YqAlertRule bo) {
        return R.ok(alertRuleService.queryList(bo));
    }

    /**
     * 获取预警规则详细信息
     */
    @SaCheckPermission("yuqing:alert:query")
    @GetMapping("/{ruleId}")
    public R<YqAlertRule> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ruleId) {
        return R.ok(alertRuleService.queryById(ruleId));
    }

    /**
     * 新增预警规则
     */
    @SaCheckPermission("yuqing:alert:add")
    @Log(title = "预警规则", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqAlertRule bo) {
        return toAjax(alertRuleService.insertByBo(bo));
    }

    /**
     * 修改预警规则
     */
    @SaCheckPermission("yuqing:alert:edit")
    @Log(title = "预警规则", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqAlertRule bo) {
        return toAjax(alertRuleService.updateByBo(bo));
    }

    /**
     * 删除预警规则
     */
    @SaCheckPermission("yuqing:alert:remove")
    @Log(title = "预警规则", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ruleIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ruleIds) {
        return toAjax(alertRuleService.deleteWithValidByIds(List.of(ruleIds), true));
    }
}
