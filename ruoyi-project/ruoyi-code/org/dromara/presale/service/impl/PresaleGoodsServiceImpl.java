package org.dromara.presale.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleGoods;
import org.dromara.presale.mapper.PresaleGoodsMapper;
import org.dromara.presale.service.IPresaleGoodsService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * presale-goods Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class PresaleGoodsServiceImpl implements IPresaleGoodsService {

    private final PresaleGoodsMapper baseMapper;

    @Override
    public PageResult<PresaleGoods> queryPageList(PresaleGoods bo, PageQuery pageQuery) {
        LambdaQueryWrapper<PresaleGoods> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getTitle()), PresaleGoods::getTitle, bo.getTitle());
        Page<PresaleGoods> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<PresaleGoods> queryList(PresaleGoods bo) {
        LambdaQueryWrapper<PresaleGoods> lqw = new LambdaQueryWrapper<>();
        lqw.eq(StringUtils.isNotBlank(bo.getTitle()), PresaleGoods::getTitle, bo.getTitle());
        return baseMapper.selectList(lqw);
    }

    @Override
    public PresaleGoods queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(PresaleGoods bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(PresaleGoods bo) {
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
