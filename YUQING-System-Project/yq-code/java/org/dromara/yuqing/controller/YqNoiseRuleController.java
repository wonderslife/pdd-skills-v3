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
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.service.IYqNoiseRuleService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 降噪规则Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/noiseRule")
public class YqNoiseRuleController extends BaseController {

    private final IYqNoiseRuleService noiseRuleService;

    /**
     * 查询降噪规则列表
     */
    @SaCheckPermission("yuqing:noiseRule:list")
    @GetMapping("/list")
    public R<PageResult<YqNoiseRule>> list(YqNoiseRule bo, PageQuery pageQuery) {
        return R.ok(noiseRuleService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出降噪规则列表
     */
    @SaCheckPermission("yuqing:noiseRule:export")
    @Log(title = "降噪规则", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqNoiseRule bo, HttpServletResponse response) {
        List<YqNoiseRule> list = noiseRuleService.queryList(bo);
        ExcelBuilder.of(list, YqNoiseRule.class).sheetName("降噪规则").toResponse(response);
    }

    /**
     * 查询降噪规则下拉选项（PRD §4.5；必须声明在 /{ruleId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:noiseRule:list")
    @GetMapping("/optionselect")
    public R<List<YqNoiseRule>> optionselect(YqNoiseRule bo) {
        return R.ok(noiseRuleService.queryList(bo));
    }

    /**
     * 获取降噪规则详细信息
     */
    @SaCheckPermission("yuqing:noiseRule:query")
    @GetMapping("/{ruleId}")
    public R<YqNoiseRule> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long ruleId) {
        return R.ok(noiseRuleService.queryById(ruleId));
    }

    /**
     * 新增降噪规则
     */
    @SaCheckPermission("yuqing:noiseRule:add")
    @Log(title = "降噪规则", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqNoiseRule bo) {
        return toAjax(noiseRuleService.insertByBo(bo));
    }

    /**
     * 修改降噪规则
     */
    @SaCheckPermission("yuqing:noiseRule:edit")
    @Log(title = "降噪规则", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqNoiseRule bo) {
        return toAjax(noiseRuleService.updateByBo(bo));
    }

    /**
     * 删除降噪规则
     */
    @SaCheckPermission("yuqing:noiseRule:remove")
    @Log(title = "降噪规则", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ruleIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ruleIds) {
        return toAjax(noiseRuleService.deleteWithValidByIds(List.of(ruleIds), true));
    }
}
