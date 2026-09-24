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
import org.dromara.yuqing.domain.YqModelVersion;
import org.dromara.yuqing.service.IYqModelVersionService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 模型版本Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/modelVersion")
public class YqModelVersionController extends BaseController {

    private final IYqModelVersionService modelVersionService;

    /**
     * 查询模型版本列表
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/list")
    public R<PageResult<YqModelVersion>> list(YqModelVersion bo, PageQuery pageQuery) {
        return R.ok(modelVersionService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出模型版本列表
     */
    @SaCheckPermission("yuqing:knowledge:export")
    @Log(title = "模型版本", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqModelVersion bo, HttpServletResponse response) {
        List<YqModelVersion> list = modelVersionService.queryList(bo);
        ExcelBuilder.of(list, YqModelVersion.class).sheetName("模型版本").toResponse(response);
    }

    /**
     * 查询模型版本下拉选项（PRD §4.5；必须声明在 /{modelVersionId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/optionselect")
    public R<List<YqModelVersion>> optionselect(YqModelVersion bo) {
        return R.ok(modelVersionService.queryList(bo));
    }

    /**
     * 获取模型版本详细信息
     */
    @SaCheckPermission("yuqing:knowledge:query")
    @GetMapping("/{modelVersionId}")
    public R<YqModelVersion> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long modelVersionId) {
        return R.ok(modelVersionService.queryById(modelVersionId));
    }

    /**
     * 新增模型版本
     */
    @SaCheckPermission("yuqing:knowledge:add")
    @Log(title = "模型版本", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqModelVersion bo) {
        return toAjax(modelVersionService.insertByBo(bo));
    }

    /**
     * 修改模型版本
     */
    @SaCheckPermission("yuqing:knowledge:edit")
    @Log(title = "模型版本", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqModelVersion bo) {
        return toAjax(modelVersionService.updateByBo(bo));
    }

    /**
     * 删除模型版本
     */
    @SaCheckPermission("yuqing:knowledge:remove")
    @Log(title = "模型版本", businessType = BusinessType.DELETE)
    @DeleteMapping("/{modelVersionIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] modelVersionIds) {
        return toAjax(modelVersionService.deleteWithValidByIds(List.of(modelVersionIds), true));
    }
}
