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
import com.ruoyi.presale.domain.PresaleOrder;
import com.ruoyi.presale.service.IPresaleOrderService;

/**
 * 预售订单管理Controller
 *
 * @author ruoyi
 */
@RestController
@RequestMapping("/presale/orders/list")
public class PresaleOrderController extends BaseController
{
    @Autowired
    private IPresaleOrderService presaleorderService;

    /**
     * 查询预售订单管理列表
     */
    @PreAuthorize("@ss.hasPermi('presale:order:list')")
    @GetMapping("/list")
    public TableDataInfo list(PresaleOrder presaleorder)
    {
        startPage();
        List<PresaleOrder> list = presaleorderService.selectPresaleOrderList(presaleorder);
        return getDataTable(list);
    }

    /**
     * 导出预售订单管理列表
     */
    @PreAuthorize("@ss.hasPermi('presale:order:export')")
    @Log(title = "预售订单管理", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(HttpServletResponse response, PresaleOrder presaleorder)
    {
        List<PresaleOrder> list = presaleorderService.selectPresaleOrderList(presaleorder);
        ExcelUtil<PresaleOrder> util = new ExcelUtil<PresaleOrder>(PresaleOrder.class);
        util.exportExcel(response, list, "预售订单管理");
    }

    /**
     * 获取预售订单管理详细信息
     */
    @PreAuthorize("@ss.hasPermi('presale:order:query')")
    @GetMapping(value = "/{id}")
    public AjaxResult getInfo(@PathVariable("id") Long id)
    {
        return success(presaleorderService.selectPresaleOrderById(id));
    }

    /**
     * 新增预售订单管理
     */
    @PreAuthorize("@ss.hasPermi('presale:order:add')")
    @Log(title = "预售订单管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody PresaleOrder presaleorder)
    {
        return toAjax(presaleorderService.insertPresaleOrder(presaleorder));
    }

    /**
     * 修改预售订单管理
     */
    @PreAuthorize("@ss.hasPermi('presale:order:edit')")
    @Log(title = "预售订单管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody PresaleOrder presaleorder)
    {
        return toAjax(presaleorderService.updatePresaleOrder(presaleorder));
    }

    /**
     * 删除预售订单管理
     */
    @PreAuthorize("@ss.hasPermi('presale:order:remove')")
    @Log(title = "预售订单管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids)
    {
        return toAjax(presaleorderService.deletePresaleOrderByIds(ids));
    }
}
