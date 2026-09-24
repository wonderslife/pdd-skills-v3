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
import org.dromara.presale.domain.PresaleDeposit;
import org.dromara.presale.service.IPresaleDepositService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 定金支付Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/presale/deposit")
public class PresaleDepositController extends BaseController {

    private final IPresaleDepositService presaledepositService;

    /**
     * 分页查询定金支付列表
     */
    @SaCheckPermission("presale:deposit:list")
    @GetMapping("/list")
    public R<PageResult<PresaleDeposit>> list(PresaleDeposit bo, PageQuery pageQuery) {
        return R.ok(presaledepositService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出定金支付列表
     */
    @SaCheckPermission("presale:deposit:export")
    @Log(title = "定金支付", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(PresaleDeposit bo, HttpServletResponse response) {
        List<PresaleDeposit> list = presaledepositService.queryList(bo);
        ExcelBuilder.of(list, PresaleDeposit.class).sheetName("定金支付").toResponse(response);
    }

    /**
     * 获取定金支付详细信息
     */
    @SaCheckPermission("presale:deposit:query")
    @GetMapping("/{id}")
    public R<PresaleDeposit> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(presaledepositService.queryById(id));
    }

    /**
     * 新增定金支付
     */
    @SaCheckPermission("presale:deposit:add")
    @Log(title = "定金支付", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody PresaleDeposit bo) {
        return toAjax(presaledepositService.insertByBo(bo));
    }

    /**
     * 修改定金支付
     */
    @SaCheckPermission("presale:deposit:edit")
    @Log(title = "定金支付", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody PresaleDeposit bo) {
        return toAjax(presaledepositService.updateByBo(bo));
    }

    /**
     * 删除定金支付
     */
    @SaCheckPermission("presale:deposit:remove")
    @Log(title = "定金支付", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(presaledepositService.deleteWithValidByIds(List.of(ids), true));
    }
}
