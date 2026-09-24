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
import com.ruoyi.presale.domain.PresaleGoods;
import com.ruoyi.presale.service.IPresaleGoodsService;

/**
 * 预售商品管理Controller
 *
 * @author ruoyi
 */
@RestController
@RequestMapping("/presale/goods/list")
public class PresaleGoodsController extends BaseController
{
    @Autowired
    private IPresaleGoodsService presalegoodsService;

    /**
     * 查询预售商品管理列表
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:list')")
    @GetMapping("/list")
    public TableDataInfo list(PresaleGoods presalegoods)
    {
        startPage();
        List<PresaleGoods> list = presalegoodsService.selectPresaleGoodsList(presalegoods);
        return getDataTable(list);
    }

    /**
     * 导出预售商品管理列表
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:export')")
    @Log(title = "预售商品管理", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(HttpServletResponse response, PresaleGoods presalegoods)
    {
        List<PresaleGoods> list = presalegoodsService.selectPresaleGoodsList(presalegoods);
        ExcelUtil<PresaleGoods> util = new ExcelUtil<PresaleGoods>(PresaleGoods.class);
        util.exportExcel(response, list, "预售商品管理");
    }

    /**
     * 获取预售商品管理详细信息
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:query')")
    @GetMapping(value = "/{id}")
    public AjaxResult getInfo(@PathVariable("id") Long id)
    {
        return success(presalegoodsService.selectPresaleGoodsById(id));
    }

    /**
     * 新增预售商品管理
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:add')")
    @Log(title = "预售商品管理", businessType = BusinessType.INSERT)
    @PostMapping
    public AjaxResult add(@RequestBody PresaleGoods presalegoods)
    {
        return toAjax(presalegoodsService.insertPresaleGoods(presalegoods));
    }

    /**
     * 修改预售商品管理
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:edit')")
    @Log(title = "预售商品管理", businessType = BusinessType.UPDATE)
    @PutMapping
    public AjaxResult edit(@RequestBody PresaleGoods presalegoods)
    {
        return toAjax(presalegoodsService.updatePresaleGoods(presalegoods));
    }

    /**
     * 删除预售商品管理
     */
    @PreAuthorize("@ss.hasPermi('presale:goods:remove')")
    @Log(title = "预售商品管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public AjaxResult remove(@PathVariable Long[] ids)
    {
        return toAjax(presalegoodsService.deletePresaleGoodsByIds(ids));
    }
}
