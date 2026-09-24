package com.ruoyi.presale.service;

import java.util.List;
import com.ruoyi.presale.domain.PresaleGoods;

/**
 * presale-goods Service接口
 *
 * @author ruoyi
 */
public interface IPresaleGoodsService
{
    /**
     * 查询presale-goods详情
     *
     * @param id 主键
     * @return presale-goods实体
     */
    public PresaleGoods selectPresaleGoodsById(Long id);

    /**
     * 查询presale-goods列表
     *
     * @param presalegoods presale-goods实体
     * @return presale-goods集合
     */
    public List<PresaleGoods> selectPresaleGoodsList(PresaleGoods presalegoods);

    /**
     * 新增presale-goods
     *
     * @param presalegoods presale-goods实体
     * @return 结果
     */
    public int insertPresaleGoods(PresaleGoods presalegoods);

    /**
     * 修改presale-goods
     *
     * @param presalegoods presale-goods实体
     * @return 结果
     */
    public int updatePresaleGoods(PresaleGoods presalegoods);

    /**
     * 删除presale-goods信息
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleGoodsByIds(Long[] ids);
}
