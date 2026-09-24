package org.dromara.presale.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleOrder;
import org.dromara.presale.mapper.PresaleOrderMapper;
import org.dromara.presale.service.IPresaleOrderService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * presale-order Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class PresaleOrderServiceImpl implements IPresaleOrderService {

    private final PresaleOrderMapper baseMapper;

    @Override
    public PageResult<PresaleOrder> queryPageList(PresaleOrder bo, PageQuery pageQuery) {
        LambdaQueryWrapper<PresaleOrder> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleOrder::getOrderNo, bo.getOrderNo());
        lqw.eq(StringUtils.isNotBlank(bo.getGoodsTitle()), PresaleOrder::getGoodsTitle, bo.getGoodsTitle());
        lqw.eq(StringUtils.isNotBlank(bo.getShippingNo()), PresaleOrder::getShippingNo, bo.getShippingNo());
        Page<PresaleOrder> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<PresaleOrder> queryList(PresaleOrder bo) {
        LambdaQueryWrapper<PresaleOrder> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), PresaleOrder::getOrderNo, bo.getOrderNo());
        lqw.eq(StringUtils.isNotBlank(bo.getGoodsTitle()), PresaleOrder::getGoodsTitle, bo.getGoodsTitle());
        lqw.eq(StringUtils.isNotBlank(bo.getShippingNo()), PresaleOrder::getShippingNo, bo.getShippingNo());
        return baseMapper.selectList(lqw);
    }

    @Override
    public PresaleOrder queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(PresaleOrder bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(PresaleOrder bo) {
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
