package com.ruoyi.presale.mapper;

import java.util.List;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ruoyi.presale.domain.PresaleTailPay;

/**
 * presale-tail-pay Mapper接口
 *
 * @author ruoyi
 */
public interface PresaleTailPayMapper extends BaseMapper<PresaleTailPay>
{
    /**
     * 查询presale-tail-pay列表
     *
     * @param presaletailpay presale-tail-pay实体
     * @return presale-tail-pay集合
     */
    public List<PresaleTailPay> selectPresaleTailPayList(PresaleTailPay presaletailpay);

    /**
     * 批量删除presale-tail-pay
     *
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int deletePresaleTailPayByIds(Long[] ids);
}
