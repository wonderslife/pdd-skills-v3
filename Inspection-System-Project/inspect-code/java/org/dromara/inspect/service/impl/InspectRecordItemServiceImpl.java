package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectRecordItem;
import org.dromara.inspect.mapper.InspectRecordItemMapper;
import org.dromara.inspect.service.IInspectRecordItemService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 巡检项结果 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectRecordItemServiceImpl implements IInspectRecordItemService {

    private final InspectRecordItemMapper baseMapper;

    @Override
    public PageResult<InspectRecordItem> queryPageList(InspectRecordItem bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectRecordItem> lqw = buildQueryWrapper(bo);
        Page<InspectRecordItem> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectRecordItem> queryList(InspectRecordItem bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectRecordItem queryById(Long recordItemId) {
        return baseMapper.selectById(recordItemId);
    }

    @Override
    public Boolean insertByBo(InspectRecordItem bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectRecordItem bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
        }
        return baseMapper.deleteByIds(ids) > 0;
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectRecordItem> buildQueryWrapper(InspectRecordItem bo) {
        LambdaQueryWrapper<InspectRecordItem> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getItemName()), InspectRecordItem::getItemName, bo.getItemName());
        lqw.like(StringUtils.isNotBlank(bo.getValue()), InspectRecordItem::getValue, bo.getValue());
        lqw.eq(ObjectUtil.isNotNull(bo.getRecordId()), InspectRecordItem::getRecordId, bo.getRecordId());
        lqw.eq(ObjectUtil.isNotNull(bo.getItemId()), InspectRecordItem::getItemId, bo.getItemId());
        lqw.eq(ObjectUtil.isNotNull(bo.getResult()), InspectRecordItem::getResult, bo.getResult());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), InspectRecordItem::getOrderNum, bo.getOrderNum());
        lqw.orderByDesc(InspectRecordItem::getRecordItemId);
        return lqw;
    }
}
