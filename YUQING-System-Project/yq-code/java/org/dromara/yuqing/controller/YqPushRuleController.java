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
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.service.IYqPushRuleService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 推送规则Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/pushRule")
public class YqPushRuleController extends BaseController {

    private final IYqPushRuleService pushRuleService;

    /**
     * 查询推送规则列表
     */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/list")
    public R<PageResult<YqPushRule>> list(YqPushRule bo, PageQuery pageQuery) {
        return R.ok(pushRuleService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出推送规则列表
     */
    @SaCheckPermission("yuqing:push:export")
    @Log(title = "推送规则", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqPushRule bo, HttpServletResponse response) {
        List<YqPushRule> list = pushRuleService.queryList(bo);
        ExcelBuilder.of(list, YqPushRule.class).sheetName("推送规则").toResponse(response);
    }

    /**
     * 查询推送规则下拉选项（PRD §4.5；必须声明在 /{ruleId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/optionselect")
    public R<List<YqPushRule>> optionselect(YqPushRule bo) {
        return R.ok(pushRuleService.queryList(bo));
    }

    /**
     * 获取推送规则详细信息
     */
    @SaCheckPermission("yuqing:push:query")
    @GetMapping("/{ruleId}")
    public R<YqPushRule> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ruleId) {
        return R.ok(pushRuleService.queryById(ruleId));
    }

    /**
     * 新增推送规则
     */
    @SaCheckPermission("yuqing:push:add")
    @Log(title = "推送规则", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqPushRule bo) {
        return toAjax(pushRuleService.insertByBo(bo));
    }

    /**
     * 修改推送规则
     */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送规则", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqPushRule bo) {
        return toAjax(pushRuleService.updateByBo(bo));
    }

    /**
     * 删除推送规则
     */
    @SaCheckPermission("yuqing:push:remove")
    @Log(title = "推送规则", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ruleIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ruleIds) {
        return toAjax(pushRuleService.deleteWithValidByIds(List.of(ruleIds), true));
    }
}
