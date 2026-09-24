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
import org.dromara.presale.domain.PresaleGoods;
import org.dromara.presale.service.IPresaleGoodsService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 预售商品管理Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/presale/goods")
public class PresaleGoodsController extends BaseController {

    private final IPresaleGoodsService presalegoodsService;

    /**
     * 分页查询预售商品管理列表
     */
    @SaCheckPermission("presale:goods:list")
    @GetMapping("/list")
    public R<PageResult<PresaleGoods>> list(PresaleGoods bo, PageQuery pageQuery) {
        return R.ok(presalegoodsService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出预售商品管理列表
     */
    @SaCheckPermission("presale:goods:export")
    @Log(title = "预售商品管理", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(PresaleGoods bo, HttpServletResponse response) {
        List<PresaleGoods> list = presalegoodsService.queryList(bo);
        ExcelBuilder.of(list, PresaleGoods.class).sheetName("预售商品管理").toResponse(response);
    }

    /**
     * 获取预售商品管理详细信息
     */
    @SaCheckPermission("presale:goods:query")
    @GetMapping("/{id}")
    public R<PresaleGoods> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(presalegoodsService.queryById(id));
    }

    /**
     * 新增预售商品管理
     */
    @SaCheckPermission("presale:goods:add")
    @Log(title = "预售商品管理", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody PresaleGoods bo) {
        return toAjax(presalegoodsService.insertByBo(bo));
    }

    /**
     * 修改预售商品管理
     */
    @SaCheckPermission("presale:goods:edit")
    @Log(title = "预售商品管理", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody PresaleGoods bo) {
        return toAjax(presalegoodsService.updateByBo(bo));
    }

    /**
     * 删除预售商品管理
     */
    @SaCheckPermission("presale:goods:remove")
    @Log(title = "预售商品管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(presalegoodsService.deleteWithValidByIds(List.of(ids), true));
    }
}
