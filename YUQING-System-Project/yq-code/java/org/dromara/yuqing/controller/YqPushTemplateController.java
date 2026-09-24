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
import org.dromara.yuqing.domain.YqPushTemplate;
import org.dromara.yuqing.service.IYqPushTemplateService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 推送模板Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/pushTemplate")
public class YqPushTemplateController extends BaseController {

    private final IYqPushTemplateService pushTemplateService;

    /**
     * 查询推送模板列表
     */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/list")
    public R<PageResult<YqPushTemplate>> list(YqPushTemplate bo, PageQuery pageQuery) {
        return R.ok(pushTemplateService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出推送模板列表
     */
    @SaCheckPermission("yuqing:push:export")
    @Log(title = "推送模板", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqPushTemplate bo, HttpServletResponse response) {
        List<YqPushTemplate> list = pushTemplateService.queryList(bo);
        ExcelBuilder.of(list, YqPushTemplate.class).sheetName("推送模板").toResponse(response);
    }

    /**
     * 查询推送模板下拉选项（PRD §4.5；必须声明在 /{templateId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/optionselect")
    public R<List<YqPushTemplate>> optionselect(YqPushTemplate bo) {
        return R.ok(pushTemplateService.queryList(bo));
    }

    /**
     * 获取推送模板详细信息
     */
    @SaCheckPermission("yuqing:push:query")
    @GetMapping("/{templateId}")
    public R<YqPushTemplate> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long templateId) {
        return R.ok(pushTemplateService.queryById(templateId));
    }

    /**
     * 新增推送模板
     */
    @SaCheckPermission("yuqing:push:add")
    @Log(title = "推送模板", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqPushTemplate bo) {
        return toAjax(pushTemplateService.insertByBo(bo));
    }

    /**
     * 修改推送模板
     */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送模板", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqPushTemplate bo) {
        return toAjax(pushTemplateService.updateByBo(bo));
    }

    /**
     * 删除推送模板
     */
    @SaCheckPermission("yuqing:push:remove")
    @Log(title = "推送模板", businessType = BusinessType.DELETE)
    @DeleteMapping("/{templateIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] templateIds) {
        return toAjax(pushTemplateService.deleteWithValidByIds(List.of(templateIds), true));
    }
}
