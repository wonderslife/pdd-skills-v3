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
import org.dromara.yuqing.domain.YqLevelRule;
import org.dromara.yuqing.service.IYqLevelRuleService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 研判分级规则Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/levelRule")
public class YqLevelRuleController extends BaseController {

    private final IYqLevelRuleService levelRuleService;

    /**
     * 查询研判分级规则列表
     */
    @SaCheckPermission("yuqing:levelRule:list")
    @GetMapping("/list")
    public R<PageResult<YqLevelRule>> list(YqLevelRule bo, PageQuery pageQuery) {
        return R.ok(levelRuleService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出研判分级规则列表
     */
    @SaCheckPermission("yuqing:levelRule:export")
    @Log(title = "研判分级规则", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqLevelRule bo, HttpServletResponse response) {
        List<YqLevelRule> list = levelRuleService.queryList(bo);
        ExcelBuilder.of(list, YqLevelRule.class).sheetName("研判分级规则").toResponse(response);
    }

    /**
     * 查询研判分级规则下拉选项（PRD §4.5；必须声明在 /{ruleId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:levelRule:list")
    @GetMapping("/optionselect")
    public R<List<YqLevelRule>> optionselect(YqLevelRule bo) {
        return R.ok(levelRuleService.queryList(bo));
    }

    /**
     * 获取研判分级规则详细信息
     */
    @SaCheckPermission("yuqing:levelRule:query")
    @GetMapping("/{ruleId}")
    public R<YqLevelRule> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ruleId) {
        return R.ok(levelRuleService.queryById(ruleId));
    }

    /**
     * 新增研判分级规则
     */
    @SaCheckPermission("yuqing:levelRule:add")
    @Log(title = "研判分级规则", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqLevelRule bo) {
        return toAjax(levelRuleService.insertByBo(bo));
    }

    /**
     * 修改研判分级规则
     */
    @SaCheckPermission("yuqing:levelRule:edit")
    @Log(title = "研判分级规则", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqLevelRule bo) {
        return toAjax(levelRuleService.updateByBo(bo));
    }

    /**
     * 删除研判分级规则
     */
    @SaCheckPermission("yuqing:levelRule:remove")
    @Log(title = "研判分级规则", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ruleIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ruleIds) {
        return toAjax(levelRuleService.deleteWithValidByIds(List.of(ruleIds), true));
    }
}
