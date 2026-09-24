package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectPointItem;
import org.dromara.inspect.mapper.InspectPointItemMapper;
import org.dromara.inspect.service.IInspectPointItemService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 点位巡检项 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectPointItemServiceImpl implements IInspectPointItemService {

    private final InspectPointItemMapper baseMapper;

    @Override
    public PageResult<InspectPointItem> queryPageList(InspectPointItem bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectPointItem> lqw = buildQueryWrapper(bo);
        Page<InspectPointItem> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectPointItem> queryList(InspectPointItem bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectPointItem queryById(Long itemId) {
        return baseMapper.selectById(itemId);
    }

    @Override
    public Boolean insertByBo(InspectPointItem bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectPointItem bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
        // TODO: 删除前业务校验（存在关联数据时拒绝删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectPointItem> buildQueryWrapper(InspectPointItem bo) {
        LambdaQueryWrapper<InspectPointItem> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getItemName()), InspectPointItem::getItemName, bo.getItemName());
        lqw.like(StringUtils.isNotBlank(bo.getRequired()), InspectPointItem::getRequired, bo.getRequired());
        lqw.eq(ObjectUtil.isNotNull(bo.getPointId()), InspectPointItem::getPointId, bo.getPointId());
        lqw.eq(ObjectUtil.isNotNull(bo.getItemType()), InspectPointItem::getItemType, bo.getItemType());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), InspectPointItem::getOrderNum, bo.getOrderNum());
        lqw.eq(ObjectUtil.isNotNull(bo.getTemplateId()), InspectPointItem::getTemplateId, bo.getTemplateId());
        lqw.orderByDesc(InspectPointItem::getItemId);
        return lqw;
    }
}
