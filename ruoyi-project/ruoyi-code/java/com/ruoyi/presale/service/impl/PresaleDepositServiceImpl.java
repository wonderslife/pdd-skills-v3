package com.ruoyi.presale.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ruoyi.presale.mapper.PresaleDepositMapper;
import com.ruoyi.presale.domain.PresaleDeposit;
import com.ruoyi.presale.service.IPresaleDepositService;

/**
 * presale-deposit Service业务层处理
 *
 * @author ruoyi
 */
@Service
public class PresaleDepositServiceImpl implements IPresaleDepositService
{
    @Autowired
    private PresaleDepositMapper presaledepositMapper;

    @Override
    public PresaleDeposit selectPresaleDepositById(Long id)
    {
        return presaledepositMapper.selectById(id);
    }

    @Override
    public List<PresaleDeposit> selectPresaleDepositList(PresaleDeposit presaledeposit)
    {
        return presaledepositMapper.selectPresaleDepositList(presaledeposit);
    }

    @Override
    public int insertPresaleDeposit(PresaleDeposit presaledeposit)
    {
        return presaledepositMapper.insert(presaledeposit);
    }

    @Override
    public int updatePresaleDeposit(PresaleDeposit presaledeposit)
    {
        return presaledepositMapper.updateById(presaledeposit);
    }

    @Override
    public int deletePresaleDepositByIds(Long[] ids)
    {
        return presaledepositMapper.deletePresaleDepositByIds(ids);
    }
}
