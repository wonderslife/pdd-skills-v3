package com.ruoyi.presale.mapper;

import java.util.List;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ruoyi.presale.domain.PresaleGoods;

/**
 * presale-goods Mapper接口
 *
 * @author ruoyi
 */
public interface PresaleGoodsMapper extends BaseMapper<PresaleGoods>
{
    /**
     * 查询presale-goods列表
     *
     * @param presalegoods presale-goods实体
     * @return presale-goods集合
     */
    public List<PresaleGoods> selectPresaleGoodsList(PresaleGoods presalegoods);

    /**
     * 批量删除presale-goods
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleGoodsByIds(Long[] ids);
}
