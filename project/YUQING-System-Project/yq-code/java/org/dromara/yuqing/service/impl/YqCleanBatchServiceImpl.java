package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqCleanBatch;
import org.dromara.yuqing.mapper.YqCleanBatchMapper;
import org.dromara.yuqing.service.IYqCleanBatchService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.mapper.YqChannelMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 净化批次 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqCleanBatchServiceImpl implements IYqCleanBatchService {

    private final YqCleanBatchMapper baseMapper;
    private final YqTaskMapper taskMapper;
    private final YqChannelMapper channelMapper;

    @Override
    public PageResult<YqCleanBatch> queryPageList(YqCleanBatch bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqCleanBatch> lqw = buildQueryWrapper(bo);
        Page<YqCleanBatch> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqCleanBatch> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqCleanBatch> queryList(YqCleanBatch bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqCleanBatch queryById(Long batchId) {
        YqCleanBatch e = baseMapper.selectById(batchId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqCleanBatch bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqCleanBatch bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（存在关联数据时应拒绝删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }
    /**
     * 回填关联名称（列表只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<YqCleanBatch> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> scopeTaskIdSet = list.stream().map(YqCleanBatch::getScopeTaskId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!scopeTaskIdSet.isEmpty()) {
            Map<Long, String> scopeTaskIdNameMap = taskMapper.selectByIds(scopeTaskIdSet).stream()
                .collect(Collectors.toMap(YqTask::getTaskId, YqTask::getTaskName, (a, b) -> a));
            list.forEach(e -> e.setTaskName(scopeTaskIdNameMap.get(e.getScopeTaskId())));
        }
        Set<Long> scopeChannelIdSet = list.stream().map(YqCleanBatch::getScopeChannelId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!scopeChannelIdSet.isEmpty()) {
            Map<Long, String> scopeChannelIdNameMap = channelMapper.selectByIds(scopeChannelIdSet).stream()
                .collect(Collectors.toMap(YqChannel::getChannelId, YqChannel::getChannelName, (a, b) -> a));
            list.forEach(e -> e.setChannelName(scopeChannelIdNameMap.get(e.getScopeChannelId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqCleanBatch> buildQueryWrapper(YqCleanBatch bo) {
        LambdaQueryWrapper<YqCleanBatch> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getBatchName()), YqCleanBatch::getBatchName, bo.getBatchName());
        lqw.eq(ObjectUtil.isNotNull(bo.getBatchType()), YqCleanBatch::getBatchType, bo.getBatchType());
        lqw.eq(ObjectUtil.isNotNull(bo.getScopeTaskId()), YqCleanBatch::getScopeTaskId, bo.getScopeTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getScopeChannelId()), YqCleanBatch::getScopeChannelId, bo.getScopeChannelId());
        lqw.eq(ObjectUtil.isNotNull(bo.getScopeStartDate()), YqCleanBatch::getScopeStartDate, bo.getScopeStartDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getScopeEndDate()), YqCleanBatch::getScopeEndDate, bo.getScopeEndDate());
        lqw.orderByDesc(YqCleanBatch::getBatchId);
        return lqw;
    }
}
