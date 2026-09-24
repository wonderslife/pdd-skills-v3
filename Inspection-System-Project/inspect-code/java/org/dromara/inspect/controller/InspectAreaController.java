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
import org.dromara.inspect.domain.InspectArea;
import org.dromara.inspect.service.IInspectAreaService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 区域Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/area")
public class InspectAreaController extends BaseController {

    private final IInspectAreaService areaService;

    /**
     * 查询区域列表
     */
    @SaCheckPermission("inspect:area:list")
    @GetMapping("/list")
    public R<PageResult<InspectArea>> list(InspectArea bo, PageQuery pageQuery) {
        return R.ok(areaService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出区域列表
     */
    @SaCheckPermission("inspect:area:export")
    @Log(title = "区域", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectArea bo, HttpServletResponse response) {
        List<InspectArea> list = areaService.queryList(bo);
        ExcelBuilder.of(list, InspectArea.class).sheetName("区域").toResponse(response);
    }

    /**
     * 查询区域下拉选项（PRD 4.5；必须声明在 /{areaId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("inspect:area:list")
    @GetMapping("/optionselect")
    public R<List<InspectArea>> optionselect(InspectArea bo) {
        return R.ok(areaService.queryList(bo));
    }

    /**
     * 获取区域详细信息
     */
    @SaCheckPermission("inspect:area:query")
    @GetMapping("/{areaId}")
    public R<InspectArea> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long areaId) {
        return R.ok(areaService.queryById(areaId));
    }

    /**
     * 新增区域
     */
    @SaCheckPermission("inspect:area:add")
    @Log(title = "区域", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody InspectArea bo) {
        return toAjax(areaService.insertByBo(bo));
    }

    /**
     * 修改区域
     */
    @SaCheckPermission("inspect:area:edit")
    @Log(title = "区域", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody InspectArea bo) {
        return toAjax(areaService.updateByBo(bo));
    }

    /**
     * 删除区域
     */
    @SaCheckPermission("inspect:area:remove")
    @Log(title = "区域", businessType = BusinessType.DELETE)
    @DeleteMapping("/{areaIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] areaIds) {
        return toAjax(areaService.deleteWithValidByIds(List.of(areaIds), true));
    }
}
