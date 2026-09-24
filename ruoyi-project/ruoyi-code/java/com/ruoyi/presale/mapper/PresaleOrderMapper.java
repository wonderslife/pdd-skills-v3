package com.ruoyi.presale.mapper;

import java.util.List;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ruoyi.presale.domain.PresaleOrder;

/**
 * presale-order Mapper接口
 *
 * @author ruoyi
 */
public interface PresaleOrderMapper extends BaseMapper<PresaleOrder>
{
    /**
     * 查询presale-order列表
     *
     * @param presaleorder presale-order实体
     * @return presale-order集合
     */
    public List<PresaleOrder> selectPresaleOrderList(PresaleOrder presaleorder);

    /**
     * 批量删除presale-order
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleOrderByIds(Long[] ids);
}
