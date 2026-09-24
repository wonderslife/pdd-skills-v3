package com.ruoyi.presale.service;

import java.util.List;
import com.ruoyi.presale.domain.PresaleDeposit;

/**
 * presale-deposit Service接口
 *
 * @author ruoyi
 */
public interface IPresaleDepositService
{
    /**
     * 查询presale-deposit详情
     *
     * @param id 主键
     * @return presale-deposit实体
     */
    public PresaleDeposit selectPresaleDepositById(Long id);

    /**
     * 查询presale-deposit列表
     *
     * @param presaledeposit presale-deposit实体
     * @return presale-deposit集合
     */
    public List<PresaleDeposit> selectPresaleDepositList(PresaleDeposit presaledeposit);

    /**
     * 新增presale-deposit
     *
     * @param presaledeposit presale-deposit实体
     * @return 结果
     */
    public int insertPresaleDeposit(PresaleDeposit presaledeposit);

    /**
     * 修改presale-deposit
     *
     * @param presaledeposit presale-deposit实体
     * @return 结果
     */
    public int updatePresaleDeposit(PresaleDeposit presaledeposit);

    /**
     * 删除presale-deposit信息
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleDepositByIds(Long[] ids);
}
