package com.ruoyi.presale.service;

import java.util.List;
import com.ruoyi.presale.domain.PresaleTailPay;

/**
 * presale-tail-pay Service接口
 *
 * @author ruoyi
 */
public interface IPresaleTailPayService
{
    /**
     * 查询presale-tail-pay详情
     *
     * @param id 主键
     * @return presale-tail-pay实体
     */
    public PresaleTailPay selectPresaleTailPayById(Long id);

    /**
     * 查询presale-tail-pay列表
     *
     * @param presaletailpay presale-tail-pay实体
     * @return presale-tail-pay集合
     */
    public List<PresaleTailPay> selectPresaleTailPayList(PresaleTailPay presaletailpay);

    /**
     * 新增presale-tail-pay
     *
     * @param presaletailpay presale-tail-pay实体
     * @return 结果
     */
    public int insertPresaleTailPay(PresaleTailPay presaletailpay);

    /**
     * 修改presale-tail-pay
     *
     * @param presaletailpay presale-tail-pay实体
     * @return 结果
     */
    public int updatePresaleTailPay(PresaleTailPay presaletailpay);

    /**
     * 删除presale-tail-pay信息
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleTailPayByIds(Long[] ids);
}
