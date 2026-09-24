package com.ruoyi.presale.service;

import java.util.List;
import com.ruoyi.presale.domain.PresaleOrder;

/**
 * presale-order Service接口
 *
 * @author ruoyi
 */
public interface IPresaleOrderService
{
    /**
     * 查询presale-order详情
     *
     * @param id 主键
     * @return presale-order实体
     */
    public PresaleOrder selectPresaleOrderById(Long id);

    /**
     * 查询presale-order列表
     *
     * @param presaleorder presale-order实体
     * @return presale-order集合
     */
    public List<PresaleOrder> selectPresaleOrderList(PresaleOrder presaleorder);

    /**
     * 新增presale-order
     *
     * @param presaleorder presale-order实体
     * @return 结果
     */
    public int insertPresaleOrder(PresaleOrder presaleorder);

    /**
     * 修改presale-order
     *
     * @param presaleorder presale-order实体
     * @return 结果
     */
    public int updatePresaleOrder(PresaleOrder presaleorder);

    /**
     * 删除presale-order信息
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleOrderByIds(Long[] ids);
}
