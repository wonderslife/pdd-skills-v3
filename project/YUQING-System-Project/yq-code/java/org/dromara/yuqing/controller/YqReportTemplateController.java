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
import org.dromara.yuqing.domain.YqReportTemplate;
import org.dromara.yuqing.service.IYqReportTemplateService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 报告模板Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/reportTemplate")
public class YqReportTemplateController extends BaseController {

    private final IYqReportTemplateService reportTemplateService;

    /**
     * 查询报告模板列表
     */
    @SaCheckPermission("yuqing:reportTemplate:list")
    @GetMapping("/list")
    public R<PageResult<YqReportTemplate>> list(YqReportTemplate bo, PageQuery pageQuery) {
        return R.ok(reportTemplateService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出报告模板列表
     */
    @SaCheckPermission("yuqing:reportTemplate:export")
    @Log(title = "报告模板", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqReportTemplate bo, HttpServletResponse response) {
        List<YqReportTemplate> list = reportTemplateService.queryList(bo);
        ExcelBuilder.of(list, YqReportTemplate.class).sheetName("报告模板").toResponse(response);
    }

    /**
     * 查询报告模板下拉选项（PRD §4.5；必须声明在 /{templateId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:reportTemplate:list")
    @GetMapping("/optionselect")
    public R<List<YqReportTemplate>> optionselect(YqReportTemplate bo) {
        return R.ok(reportTemplateService.queryList(bo));
    }

    /**
     * 获取报告模板详细信息
     */
    @SaCheckPermission("yuqing:reportTemplate:query")
    @GetMapping("/{templateId}")
    public R<YqReportTemplate> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long templateId) {
        return R.ok(reportTemplateService.queryById(templateId));
    }

    /**
     * 新增报告模板
     */
    @SaCheckPermission("yuqing:reportTemplate:add")
    @Log(title = "报告模板", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqReportTemplate bo) {
        return toAjax(reportTemplateService.insertByBo(bo));
    }

    /**
     * 修改报告模板
     */
    @SaCheckPermission("yuqing:reportTemplate:edit")
    @Log(title = "报告模板", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqReportTemplate bo) {
        return toAjax(reportTemplateService.updateByBo(bo));
    }

    /**
     * 删除报告模板
     */
    @SaCheckPermission("yuqing:reportTemplate:remove")
    @Log(title = "报告模板", businessType = BusinessType.DELETE)
    @DeleteMapping("/{templateIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] templateIds) {
        return toAjax(reportTemplateService.deleteWithValidByIds(List.of(templateIds), true));
    }
}
