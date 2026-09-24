package com.ruoyi.presale.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.presale.mapper.PresaleOrderMapper;
import com.ruoyi.presale.domain.PresaleOrder;
import com.ruoyi.presale.service.IPresaleOrderService;

/**
 * presale-order Service业务层处理
 *
 * @author ruoyi
 */
@Service
public class PresaleOrderServiceImpl implements IPresaleOrderService
{
    @Autowired
    private PresaleOrderMapper presaleorderMapper;

    @Override
    public PresaleOrder selectPresaleOrderById(Long id)
    {
        return presaleorderMapper.selectById(id);
    }

    @Override
    public List<PresaleOrder> selectPresaleOrderList(PresaleOrder presaleorder)
    {
        return presaleorderMapper.selectPresaleOrderList(presaleorder);
    }

    @Override
    public int insertPresaleOrder(PresaleOrder presaleorder)
    {
        return presaleorderMapper.insert(presaleorder);
    }

    @Override
    public int updatePresaleOrder(PresaleOrder presaleorder)
    {
        return presaleorderMapper.updateById(presaleorder);
    }

    @Override
    public int deletePresaleOrderByIds(Long[] ids)
    {
        return presaleorderMapper.deletePresaleOrderByIds(ids);
    }
}
