package org.dromara.presale.controller;

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
import org.dromara.presale.domain.PresaleOrder;
import org.dromara.presale.service.IPresaleOrderService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 预售订单管理Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/presale/order")
public class PresaleOrderController extends BaseController {

    private final IPresaleOrderService presaleorderService;

    /**
     * 分页查询预售订单管理列表
     */
    @SaCheckPermission("presale:order:list")
    @GetMapping("/list")
    public R<PageResult<PresaleOrder>> list(PresaleOrder bo, PageQuery pageQuery) {
        return R.ok(presaleorderService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出预售订单管理列表
     */
    @SaCheckPermission("presale:order:export")
    @Log(title = "预售订单管理", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(PresaleOrder bo, HttpServletResponse response) {
        List<PresaleOrder> list = presaleorderService.queryList(bo);
        ExcelBuilder.of(list, PresaleOrder.class).sheetName("预售订单管理").toResponse(response);
    }

    /**
     * 获取预售订单管理详细信息
     */
    @SaCheckPermission("presale:order:query")
    @GetMapping("/{id}")
    public R<PresaleOrder> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(presaleorderService.queryById(id));
    }

    /**
     * 新增预售订单管理
     */
    @SaCheckPermission("presale:order:add")
    @Log(title = "预售订单管理", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody PresaleOrder bo) {
        return toAjax(presaleorderService.insertByBo(bo));
    }

    /**
     * 修改预售订单管理
     */
    @SaCheckPermission("presale:order:edit")
    @Log(title = "预售订单管理", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody PresaleOrder bo) {
        return toAjax(presaleorderService.updateByBo(bo));
    }

    /**
     * 删除预售订单管理
     */
    @SaCheckPermission("presale:order:remove")
    @Log(title = "预售订单管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(presaleorderService.deleteWithValidByIds(List.of(ids), true));
    }
}
