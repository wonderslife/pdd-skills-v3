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
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.service.IInspectRoomService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 机房Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/room")
public class InspectRoomController extends BaseController {

    private final IInspectRoomService roomService;

    /**
     * 查询机房列表
     */
    @SaCheckPermission("inspect:room:list")
    @GetMapping("/list")
    public R<PageResult<InspectRoom>> list(InspectRoom bo, PageQuery pageQuery) {
        return R.ok(roomService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出机房列表
     */
    @SaCheckPermission("inspect:room:export")
    @Log(title = "机房", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectRoom bo, HttpServletResponse response) {
        List<InspectRoom> list = roomService.queryList(bo);
        ExcelBuilder.of(list, InspectRoom.class).sheetName("机房").toResponse(response);
    }

    /**
     * 查询机房下拉选项（PRD 4.5；必须声明在 /{roomId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("inspect:room:list")
    @GetMapping("/optionselect")
    public R<List<InspectRoom>> optionselect(InspectRoom bo) {
        return R.ok(roomService.queryList(bo));
    }

    /**
     * 获取机房详细信息
     */
    @SaCheckPermission("inspect:room:query")
    @GetMapping("/{roomId}")
    public R<InspectRoom> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long roomId) {
        return R.ok(roomService.queryById(roomId));
    }

    /**
     * 新增机房
     */
    @SaCheckPermission("inspect:room:add")
    @Log(title = "机房", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody InspectRoom bo) {
        return toAjax(roomService.insertByBo(bo));
    }

    /**
     * 修改机房
     */
    @SaCheckPermission("inspect:room:edit")
    @Log(title = "机房", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody InspectRoom bo) {
        return toAjax(roomService.updateByBo(bo));
    }

    /**
     * 删除机房
     */
    @SaCheckPermission("inspect:room:remove")
    @Log(title = "机房", businessType = BusinessType.DELETE)
    @DeleteMapping("/{roomIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] roomIds) {
        return toAjax(roomService.deleteWithValidByIds(List.of(roomIds), true));
    }
}
