package org.dromara.presale.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleDeposit;
import org.dromara.presale.mapper.PresaleDepositMapper;
import org.dromara.presale.service.IPresaleDepositService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * presale-deposit Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class PresaleDepositServiceImpl implements IPresaleDepositService {

    private final PresaleDepositMapper baseMapper;

    @Override
    public PageResult<PresaleDeposit> queryPageList(PresaleDeposit bo, PageQuery pageQuery) {
        LambdaQueryWrapper<PresaleDeposit> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleDeposit::getOrderNo, bo.getOrderNo());
        Page<PresaleDeposit> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<PresaleDeposit> queryList(PresaleDeposit bo) {
        LambdaQueryWrapper<PresaleDeposit> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleDeposit::getOrderNo, bo.getOrderNo());
        return baseMapper.selectList(lqw);
    }

    @Override
    public PresaleDeposit queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(PresaleDeposit bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(PresaleDeposit bo) {
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
