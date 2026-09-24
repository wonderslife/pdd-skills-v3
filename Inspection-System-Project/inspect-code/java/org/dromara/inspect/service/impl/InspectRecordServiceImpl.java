package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectRecord;
import org.dromara.inspect.mapper.InspectRecordMapper;
import org.dromara.inspect.service.IInspectRecordService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 巡检记录 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectRecordServiceImpl implements IInspectRecordService {

    private final InspectRecordMapper baseMapper;

    @Override
    public PageResult<InspectRecord> queryPageList(InspectRecord bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectRecord> lqw = buildQueryWrapper(bo);
        Page<InspectRecord> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectRecord> queryList(InspectRecord bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectRecord queryById(Long recordId) {
        return baseMapper.selectById(recordId);
    }

    @Override
    public Boolean insertByBo(InspectRecord bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectRecord bo) {
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
    private LambdaQueryWrapper<InspectRecord> buildQueryWrapper(InspectRecord bo) {
        LambdaQueryWrapper<InspectRecord> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getPointId()), InspectRecord::getPointId, bo.getPointId());
        lqw.eq(ObjectUtil.isNotNull(bo.getRoomId()), InspectRecord::getRoomId, bo.getRoomId());
        lqw.eq(ObjectUtil.isNotNull(bo.getInspectorId()), InspectRecord::getInspectorId, bo.getInspectorId());
        lqw.eq(ObjectUtil.isNotNull(bo.getInspectTime()), InspectRecord::getInspectTime, bo.getInspectTime());
        lqw.eq(ObjectUtil.isNotNull(bo.getDuration()), InspectRecord::getDuration, bo.getDuration());
        lqw.eq(ObjectUtil.isNotNull(bo.getResult()), InspectRecord::getResult, bo.getResult());
        lqw.orderByDesc(InspectRecord::getRecordId);
        return lqw;
    }
}
