package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectAbnormal;
import org.dromara.inspect.mapper.InspectAbnormalMapper;
import org.dromara.inspect.service.IInspectAbnormalService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 异常项 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectAbnormalServiceImpl implements IInspectAbnormalService {

    private final InspectAbnormalMapper baseMapper;

    @Override
    public PageResult<InspectAbnormal> queryPageList(InspectAbnormal bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectAbnormal> lqw = buildQueryWrapper(bo);
        Page<InspectAbnormal> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectAbnormal> queryList(InspectAbnormal bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectAbnormal queryById(Long abnormalId) {
        return baseMapper.selectById(abnormalId);
    }

    @Override
    public Boolean insertByBo(InspectAbnormal bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectAbnormal bo) {
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
    private LambdaQueryWrapper<InspectAbnormal> buildQueryWrapper(InspectAbnormal bo) {
        LambdaQueryWrapper<InspectAbnormal> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getProcessRemark()), InspectAbnormal::getProcessRemark, bo.getProcessRemark());
        lqw.eq(ObjectUtil.isNotNull(bo.getRecordId()), InspectAbnormal::getRecordId, bo.getRecordId());
        lqw.eq(ObjectUtil.isNotNull(bo.getRecordItemId()), InspectAbnormal::getRecordItemId, bo.getRecordItemId());
        lqw.eq(ObjectUtil.isNotNull(bo.getPointId()), InspectAbnormal::getPointId, bo.getPointId());
        lqw.eq(ObjectUtil.isNotNull(bo.getRoomId()), InspectAbnormal::getRoomId, bo.getRoomId());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), InspectAbnormal::getStatus, bo.getStatus());
        lqw.orderByDesc(InspectAbnormal::getAbnormalId);
        return lqw;
    }
}
