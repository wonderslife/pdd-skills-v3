package org.dromara.inspect.controller;

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
import org.dromara.inspect.domain.InspectItemTemplate;
import org.dromara.inspect.service.IInspectItemTemplateService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 巡检项模板Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/itemTemplate")
public class InspectItemTemplateController extends BaseController {

    private final IInspectItemTemplateService itemTemplateService;

    /**
     * 查询巡检项模板列表
     */
    @SaCheckPermission("inspect:itemTemplate:list")
    @GetMapping("/list")
    public R<PageResult<InspectItemTemplate>> list(InspectItemTemplate bo, PageQuery pageQuery) {
        return R.ok(itemTemplateService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出巡检项模板列表
     */
    @SaCheckPermission("inspect:itemTemplate:export")
    @Log(title = "巡检项模板", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectItemTemplate bo, HttpServletResponse response) {
        List<InspectItemTemplate> list = itemTemplateService.queryList(bo);
        ExcelBuilder.of(list, InspectItemTemplate.class).sheetName("巡检项模板").toResponse(response);
    }

    /**
     * 查询巡检项模板下拉选项（PRD 4.5；必须声明在 /{templateId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("inspect:itemTemplate:list")
    @GetMapping("/optionselect")
    public R<List<InspectItemTemplate>> optionselect(InspectItemTemplate bo) {
        return R.ok(itemTemplateService.queryList(bo));
    }

    /**
     * 获取巡检项模板详细信息
     */
    @SaCheckPermission("inspect:itemTemplate:query")
    @GetMapping("/{templateId}")
    public R<InspectItemTemplate> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long templateId) {
        return R.ok(itemTemplateService.queryById(templateId));
    }

    /**
     * 新增巡检项模板
     */
    @SaCheckPermission("inspect:itemTemplate:add")
    @Log(title = "巡检项模板", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody InspectItemTemplate bo) {
        return toAjax(itemTemplateService.insertByBo(bo));
    }

    /**
     * 修改巡检项模板
     */
    @SaCheckPermission("inspect:itemTemplate:edit")
    @Log(title = "巡检项模板", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody InspectItemTemplate bo) {
        return toAjax(itemTemplateService.updateByBo(bo));
    }

    /**
     * 删除巡检项模板
     */
    @SaCheckPermission("inspect:itemTemplate:remove")
    @Log(title = "巡检项模板", businessType = BusinessType.DELETE)
    @DeleteMapping("/{templateIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] templateIds) {
        return toAjax(itemTemplateService.deleteWithValidByIds(List.of(templateIds), true));
    }
}
