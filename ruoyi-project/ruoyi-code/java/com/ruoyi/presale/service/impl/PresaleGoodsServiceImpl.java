package com.ruoyi.presale.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.presale.mapper.PresaleGoodsMapper;
import com.ruoyi.presale.domain.PresaleGoods;
import com.ruoyi.presale.service.IPresaleGoodsService;

/**
 * presale-goods Service业务层处理
 *
 * @author ruoyi
 */
@Service
public class PresaleGoodsServiceImpl implements IPresaleGoodsService
{
    @Autowired
    private PresaleGoodsMapper presalegoodsMapper;

    @Override
    public PresaleGoods selectPresaleGoodsById(Long id)
    {
        return presalegoodsMapper.selectById(id);
    }

    @Override
    public List<PresaleGoods> selectPresaleGoodsList(PresaleGoods presalegoods)
    {
        return presalegoodsMapper.selectPresaleGoodsList(presalegoods);
    }

    @Override
    public int insertPresaleGoods(PresaleGoods presalegoods)
    {
        return presalegoodsMapper.insert(presalegoods);
    }

    @Override
    public int updatePresaleGoods(PresaleGoods presalegoods)
    {
        return presalegoodsMapper.updateById(presalegoods);
    }

    @Override
    public int deletePresaleGoodsByIds(Long[] ids)
    {
        return presalegoodsMapper.deletePresaleGoodsByIds(ids);
    }
}
