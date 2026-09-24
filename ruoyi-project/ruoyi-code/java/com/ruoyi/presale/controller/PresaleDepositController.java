package com.ruoyi.presale.controller;

import java.util.List;
import javax.servlet.http.HttpServletResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.common.utils.poi.ExcelUtil;
import com.ruoyi.presale.domain.PresaleDeposit;
import com.ruoyi.presale.service.IPresaleDepositService;

/**
 * 定金支付Controller
 *
 * @author ruoyi
 */
@RestController
@RequestMapping("/presale/orders/deposit")
public class PresaleDepositController extends BaseController
{
    @Autowired
    private IPresaleDepositService presaledepositService;

    /**
     * 查询定金支付列表
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:list')")
    @GetMapping("/list")
    public TableDataInfo list(PresaleDeposit presaledeposit)
    {
        startPage();
        List<PresaleDeposit> list = presaledepositService.selectPresaleDepositList(presaledeposit);
        return getDataTable(list);
    }

    /**
     * 导出定金支付列表
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:export')")
    @Log(title = "定金支付", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(HttpServletResponse response, PresaleDeposit presaledeposit)
    {
        List<PresaleDeposit> list = presaledepositService.selectPresaleDepositList(presaledeposit);
        ExcelUtil<PresaleDeposit> util = new ExcelUtil<PresaleDeposit>(PresaleDeposit.class);
        util.exportExcel(response, list, "定金支付");
    }

    /**
     * 获取定金支付详细信息
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:query')")
    @GetMapping(value = "/{id}")
    public AjaxResult getInfo(@PathVariable("id") Long id)
    {
        return success(presaledepositService.selectPresaleDepositById(id));
    }

    /**
     * 新增定金支付
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:add')")
    @Log(title = "定金支付", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody PresaleDeposit presaledeposit)
    {
        return toAjax(presaledepositService.insertPresaleDeposit(presaledeposit));
    }

    /**
     * 修改定金支付
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:edit')")
    @Log(title = "定金支付", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody PresaleDeposit presaledeposit)
    {
        return toAjax(presaledepositService.updatePresaleDeposit(presaledeposit));
    }

    /**
     * 删除定金支付
     */
    @PreAuthorize("@ss.hasPermi('presale:deposit:remove')")
    @Log(title = "定金支付", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids)
    {
        return toAjax(presaledepositService.deletePresaleDepositByIds(ids));
    }
}
