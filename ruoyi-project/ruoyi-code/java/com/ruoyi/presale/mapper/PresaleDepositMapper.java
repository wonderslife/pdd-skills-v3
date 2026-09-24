package com.ruoyi.presale.mapper;

import java.util.List;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ruoyi.presale.domain.PresaleDeposit;

/**
 * presale-deposit Mapper接口
 *
 * @author ruoyi
 */
public interface PresaleDepositMapper extends BaseMapper<PresaleDeposit>
{
    /**
     * 查询presale-deposit列表
     *
     * @param presaledeposit presale-deposit实体
     * @return presale-deposit集合
     */
    public List<PresaleDeposit> selectPresaleDepositList(PresaleDeposit presaledeposit);

    /**
     * 批量删除presale-deposit
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleDepositByIds(Long[] ids);
}
