package org.dromara.presale.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleTailPay;
import org.dromara.presale.mapper.PresaleTailPayMapper;
import org.dromara.presale.service.IPresaleTailPayService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * presale-tail-pay Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class PresaleTailPayServiceImpl implements IPresaleTailPayService {

    private final PresaleTailPayMapper baseMapper;

    @Override
    public PageResult<PresaleTailPay> queryPageList(PresaleTailPay bo, PageQuery pageQuery) {
        LambdaQueryWrapper<PresaleTailPay> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleTailPay::getOrderNo, bo.getOrderNo());
        Page<PresaleTailPay> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<PresaleTailPay> queryList(PresaleTailPay bo) {
        LambdaQueryWrapper<PresaleTailPay> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleTailPay::getOrderNo, bo.getOrderNo());
        return baseMapper.selectList(lqw);
    }

    @Override
    public PresaleTailPay queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(PresaleTailPay bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(PresaleTailPay bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（如订单有关联记录时禁止删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }
}
