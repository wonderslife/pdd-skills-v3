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
import org.dromara.presale.domain.PresaleTailPay;
import org.dromara.presale.service.IPresaleTailPayService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 尾款支付Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/presale/tail/pay")
public class PresaleTailPayController extends BaseController {

    private final IPresaleTailPayService presaletailpayService;

    /**
     * 分页查询尾款支付列表
     */
    @SaCheckPermission("presale:tail:pay:list")
    @GetMapping("/list")
    public R<PageResult<PresaleTailPay>> list(PresaleTailPay bo, PageQuery pageQuery) {
        return R.ok(presaletailpayService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出尾款支付列表
     */
    @SaCheckPermission("presale:tail:pay:export")
    @Log(title = "尾款支付", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(PresaleTailPay bo, HttpServletResponse response) {
        List<PresaleTailPay> list = presaletailpayService.queryList(bo);
        ExcelBuilder.of(list, PresaleTailPay.class).sheetName("尾款支付").toResponse(response);
    }

    /**
     * 获取尾款支付详细信息
     */
    @SaCheckPermission("presale:tail:pay:query")
    @GetMapping("/{id}")
    public R<PresaleTailPay> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(presaletailpayService.queryById(id));
    }

    /**
     * 新增尾款支付
     */
    @SaCheckPermission("presale:tail:pay:add")
    @Log(title = "尾款支付", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody PresaleTailPay bo) {
        return toAjax(presaletailpayService.insertByBo(bo));
    }

    /**
     * 修改尾款支付
     */
    @SaCheckPermission("presale:tail:pay:edit")
    @Log(title = "尾款支付", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody PresaleTailPay bo) {
        return toAjax(presaletailpayService.updateByBo(bo));
    }

    /**
     * 删除尾款支付
     */
    @SaCheckPermission("presale:tail:pay:remove")
    @Log(title = "尾款支付", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(presaletailpayService.deleteWithValidByIds(List.of(ids), true));
    }
}
