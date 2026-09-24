package com.ruoyi.presale.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.presale.mapper.PresaleTailPayMapper;
import com.ruoyi.presale.domain.PresaleTailPay;
import com.ruoyi.presale.service.IPresaleTailPayService;

/**
 * presale-tail-pay Service业务层处理
 *
 * @author ruoyi
 */
@Service
public class PresaleTailPayServiceImpl implements IPresaleTailPayService
{
    @Autowired
    private PresaleTailPayMapper presaletailpayMapper;

    @Override
    public PresaleTailPay selectPresaleTailPayById(Long id)
    {
        return presaletailpayMapper.selectById(id);
    }

    @Override
    public List<PresaleTailPay> selectPresaleTailPayList(PresaleTailPay presaletailpay)
    {
        return presaletailpayMapper.selectPresaleTailPayList(presaletailpay);
    }

    @Override
    public int insertPresaleTailPay(PresaleTailPay presaletailpay)
    {
        return presaletailpayMapper.insert(presaletailpay);
    }

    @Override
    public int updatePresaleTailPay(PresaleTailPay presaletailpay)
    {
        return presaletailpayMapper.updateById(presaletailpay);
    }

    @Override
    public int deletePresaleTailPayByIds(Long[] ids)
    {
        return presaletailpayMapper.deletePresaleTailPayByIds(ids);
    }
}
