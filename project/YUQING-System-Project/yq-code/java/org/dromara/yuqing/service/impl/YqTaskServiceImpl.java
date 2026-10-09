package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.service.IYqTaskService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.dromara.yuqing.domain.YqLevelRule;
import org.dromara.yuqing.mapper.YqLevelRuleMapper;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.mapper.YqAlertRuleMapper;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 监测任务 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqTaskServiceImpl implements IYqTaskService {

    private final YqTaskMapper baseMapper;
    private final YqLevelRuleMapper levelRuleMapper;
    private final YqAlertRuleMapper alertRuleMapper;
    private final YqPushRuleMapper pushRuleMapper;
    private final YqTaskKeywordMapper taskKeywordMapper;
    private final YqTaskChannelMapper taskChannelMapper;

    @Override
    public PageResult<YqTask> queryPageList(YqTask bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqTask> lqw = buildQueryWrapper(bo);
        Page<YqTask> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqTask> records = page.getRecords();
        fillRefNames(records);
        fillKeywordList(records);
        fillChannelList(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqTask> queryList(YqTask bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqTask queryById(Long taskId) {
        YqTask e = baseMapper.selectById(taskId);
        if (e != null) {
            fillRefNames(List.of(e));
            e.setKeywordList(selectKeywordList(taskId));
            e.setChannelList(selectChannelList(taskId));
        }
        return e;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean insertByBo(YqTask bo) {
        boolean flag = baseMapper.insert(bo) > 0;
        if (flag) {
            saveKeywordList(bo);
            saveChannelList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateByBo(YqTask bo) {
        boolean flag = baseMapper.updateById(bo) > 0;
        if (flag) {
            // 任务关键词关联整体覆盖：先清后插，否则前端删掉的行会残留在库里
            taskKeywordMapper.delete(new LambdaQueryWrapper<YqTaskKeyword>()
                .eq(YqTaskKeyword::getTaskId, bo.getTaskId()));
            saveKeywordList(bo);
            // 任务渠道关联整体覆盖：先清后插，否则前端删掉的行会残留在库里
            taskChannelMapper.delete(new LambdaQueryWrapper<YqTaskChannel>()
                .eq(YqTaskChannel::getTaskId, bo.getTaskId()));
            saveChannelList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（存在关联数据时应拒绝删除）
        }
        boolean flag = baseMapper.deleteByIds(ids) > 0;
        if (flag) {
            taskKeywordMapper.delete(new LambdaQueryWrapper<YqTaskKeyword>()
                .in(YqTaskKeyword::getTaskId, ids));
            taskChannelMapper.delete(new LambdaQueryWrapper<YqTaskChannel>()
                .in(YqTaskChannel::getTaskId, ids));
        }
        return flag;
    }
    /**
     * 批量回填「任务关键词关联」（一次 in 查询，避免 N+1）
     */
    private void fillKeywordList(List<YqTask> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(YqTask::getTaskId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<YqTaskKeyword>> detailMap = taskKeywordMapper.selectList(new LambdaQueryWrapper<YqTaskKeyword>()
            .in(YqTaskKeyword::getTaskId, ids))
            .stream().collect(Collectors.groupingBy(YqTaskKeyword::getTaskId));
        list.forEach(e -> e.setKeywordList(detailMap.getOrDefault(e.getTaskId(), List.of())));
    }

    /**
     * 查询「任务关键词关联」明细
     */
    private List<YqTaskKeyword> selectKeywordList(Long taskId) {
        return taskKeywordMapper.selectList(new LambdaQueryWrapper<YqTaskKeyword>()
            .eq(YqTaskKeyword::getTaskId, taskId));
    }

    /**
     * 保存「任务关键词关联」明细（覆盖式写入）
     */
    private void saveKeywordList(YqTask bo) {
        List<YqTaskKeyword> detailList = bo.getKeywordList();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (YqTaskKeyword d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.setId(null);
            d.setTaskId(bo.getTaskId());
            order++;
            taskKeywordMapper.insert(d);
        }
    }

    /**
     * 批量回填「任务渠道关联」（一次 in 查询，避免 N+1）
     */
    private void fillChannelList(List<YqTask> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(YqTask::getTaskId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<YqTaskChannel>> detailMap = taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .in(YqTaskChannel::getTaskId, ids))
            .stream().collect(Collectors.groupingBy(YqTaskChannel::getTaskId));
        list.forEach(e -> e.setChannelList(detailMap.getOrDefault(e.getTaskId(), List.of())));
    }

    /**
     * 查询「任务渠道关联」明细
     */
    private List<YqTaskChannel> selectChannelList(Long taskId) {
        return taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, taskId));
    }

    /**
     * 保存「任务渠道关联」明细（覆盖式写入）
     */
    private void saveChannelList(YqTask bo) {
        List<YqTaskChannel> detailList = bo.getChannelList();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (YqTaskChannel d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.setId(null);
            d.setTaskId(bo.getTaskId());
            order++;
            taskChannelMapper.insert(d);
        }
    }

    /**
     * 回填关联名称（列表只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<YqTask> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> levelRuleIdSet = list.stream().map(YqTask::getLevelRuleId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!levelRuleIdSet.isEmpty()) {
            Map<Long, String> levelRuleIdNameMap = levelRuleMapper.selectByIds(levelRuleIdSet).stream()
                .collect(Collectors.toMap(YqLevelRule::getRuleId, YqLevelRule::getRuleName, (a, b) -> a));
            list.forEach(e -> e.setLevelRuleName(levelRuleIdNameMap.get(e.getLevelRuleId())));
        }
        Set<Long> alertRuleIdSet = list.stream().map(YqTask::getAlertRuleId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!alertRuleIdSet.isEmpty()) {
            Map<Long, String> alertRuleIdNameMap = alertRuleMapper.selectByIds(alertRuleIdSet).stream()
                .collect(Collectors.toMap(YqAlertRule::getRuleId, YqAlertRule::getRuleName, (a, b) -> a));
            list.forEach(e -> e.setAlertRuleName(alertRuleIdNameMap.get(e.getAlertRuleId())));
        }
        Set<Long> pushRuleIdSet = list.stream().map(YqTask::getPushRuleId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!pushRuleIdSet.isEmpty()) {
            Map<Long, String> pushRuleIdNameMap = pushRuleMapper.selectByIds(pushRuleIdSet).stream()
                .collect(Collectors.toMap(YqPushRule::getRuleId, YqPushRule::getRuleName, (a, b) -> a));
            list.forEach(e -> e.setPushRuleName(pushRuleIdNameMap.get(e.getPushRuleId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqTask> buildQueryWrapper(YqTask bo) {
        LambdaQueryWrapper<YqTask> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTaskName()), YqTask::getTaskName, bo.getTaskName());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskType()), YqTask::getTaskType, bo.getTaskType());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskSource()), YqTask::getTaskSource, bo.getTaskSource());
        lqw.eq(ObjectUtil.isNotNull(bo.getCollectStrategy()), YqTask::getCollectStrategy, bo.getCollectStrategy());
        lqw.eq(ObjectUtil.isNotNull(bo.getCollectInterval()), YqTask::getCollectInterval, bo.getCollectInterval());
        lqw.eq(ObjectUtil.isNotNull(bo.getLevelRuleId()), YqTask::getLevelRuleId, bo.getLevelRuleId());
        lqw.orderByDesc(YqTask::getTaskId);
        return lqw;
    }
}
