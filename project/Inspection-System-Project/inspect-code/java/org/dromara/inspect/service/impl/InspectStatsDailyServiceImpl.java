package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectStatsDaily;
import org.dromara.inspect.mapper.InspectStatsDailyMapper;
import org.dromara.inspect.service.IInspectStatsDailyService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 统计预聚合 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectStatsDailyServiceImpl implements IInspectStatsDailyService {

    private final InspectStatsDailyMapper baseMapper;

    @Override
    public PageResult<InspectStatsDaily> queryPageList(InspectStatsDaily bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectStatsDaily> lqw = buildQueryWrapper(bo);
        Page<InspectStatsDaily> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectStatsDaily> queryList(InspectStatsDaily bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectStatsDaily queryById(Long statsId) {
        return baseMapper.selectById(statsId);
    }

    @Override
    public Boolean insertByBo(InspectStatsDaily bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectStatsDaily bo) {
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
    private LambdaQueryWrapper<InspectStatsDaily> buildQueryWrapper(InspectStatsDaily bo) {
        LambdaQueryWrapper<InspectStatsDaily> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getStatsDate()), InspectStatsDaily::getStatsDate, bo.getStatsDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getRoomId()), InspectStatsDaily::getRoomId, bo.getRoomId());
        lqw.eq(ObjectUtil.isNotNull(bo.getPointId()), InspectStatsDaily::getPointId, bo.getPointId());
        lqw.eq(ObjectUtil.isNotNull(bo.getInspectCount()), InspectStatsDaily::getInspectCount, bo.getInspectCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getAbnormalCount()), InspectStatsDaily::getAbnormalCount, bo.getAbnormalCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getOverdueCount()), InspectStatsDaily::getOverdueCount, bo.getOverdueCount());
        lqw.orderByDesc(InspectStatsDaily::getStatsId);
        return lqw;
    }
}
