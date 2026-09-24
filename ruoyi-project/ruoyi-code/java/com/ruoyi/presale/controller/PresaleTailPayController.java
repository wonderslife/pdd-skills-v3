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
import com.ruoyi.presale.domain.PresaleTailPay;
import com.ruoyi.presale.service.IPresaleTailPayService;

/**
 * 尾款支付Controller
 *
 * @author ruoyi
 */
@RestController
@RequestMapping("/presale/orders/tail-pay")
public class PresaleTailPayController extends BaseController
{
    @Autowired
    private IPresaleTailPayService presaletailpayService;

    /**
     * 查询尾款支付列表
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:list')")
    @GetMapping("/list")
    public TableDataInfo list(PresaleTailPay presaletailpay)
    {
        startPage();
        List<PresaleTailPay> list = presaletailpayService.selectPresaleTailPayList(presaletailpay);
        return getDataTable(list);
    }

    /**
     * 导出尾款支付列表
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:export')")
    @Log(title = "尾款支付", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(HttpServletResponse response, PresaleTailPay presaletailpay)
    {
        List<PresaleTailPay> list = presaletailpayService.selectPresaleTailPayList(presaletailpay);
        ExcelUtil<PresaleTailPay> util = new ExcelUtil<PresaleTailPay>(PresaleTailPay.class);
        util.exportExcel(response, list, "尾款支付");
    }

    /**
     * 获取尾款支付详细信息
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:query')")
    @GetMapping(value = "/{id}")
    public AjaxResult getInfo(@PathVariable("id") Long id)
    {
        return success(presaletailpayService.selectPresaleTailPayById(id));
    }

    /**
     * 新增尾款支付
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:add')")
    @Log(title = "尾款支付", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody PresaleTailPay presaletailpay)
    {
        return toAjax(presaletailpayService.insertPresaleTailPay(presaletailpay));
    }

    /**
     * 修改尾款支付
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:edit')")
    @Log(title = "尾款支付", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody PresaleTailPay presaletailpay)
    {
        return toAjax(presaletailpayService.updatePresaleTailPay(presaletailpay));
    }

    /**
     * 删除尾款支付
     */
    @PreAuthorize("@ss.hasPermi('presale:tail:pay:remove')")
    @Log(title = "尾款支付", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids)
    {
        return toAjax(presaletailpayService.deletePresaleTailPayByIds(ids));
    }
}
