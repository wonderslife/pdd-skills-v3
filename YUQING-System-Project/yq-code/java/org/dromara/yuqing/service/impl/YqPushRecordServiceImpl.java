package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqPushRecord;
import org.dromara.yuqing.mapper.YqPushRecordMapper;
import org.dromara.yuqing.service.IYqPushRecordService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 推送记录 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqPushRecordServiceImpl implements IYqPushRecordService {

    private final YqPushRecordMapper baseMapper;
    private final YqPushRuleMapper pushRuleMapper;

    @Override
    public PageResult<YqPushRecord> queryPageList(YqPushRecord bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqPushRecord> lqw = buildQueryWrapper(bo);
        Page<YqPushRecord> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqPushRecord> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqPushRecord> queryList(YqPushRecord bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqPushRecord queryById(Long recordId) {
        YqPushRecord e = baseMapper.selectById(recordId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqPushRecord bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqPushRecord bo) {
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
    private void fillRefNames(List<YqPushRecord> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> ruleIdSet = list.stream().map(YqPushRecord::getRuleId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!ruleIdSet.isEmpty()) {
            Map<Long, String> ruleIdNameMap = pushRuleMapper.selectByIds(ruleIdSet).stream()
                .collect(Collectors.toMap(YqPushRule::getRuleId, YqPushRule::getRuleName, (a, b) -> a));
            list.forEach(e -> e.setRuleName(ruleIdNameMap.get(e.getRuleId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqPushRecord> buildQueryWrapper(YqPushRecord bo) {
        LambdaQueryWrapper<YqPushRecord> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getContentSnapshot()), YqPushRecord::getContentSnapshot, bo.getContentSnapshot());
        lqw.like(StringUtils.isNotBlank(bo.getTargetIds()), YqPushRecord::getTargetIds, bo.getTargetIds());
        lqw.like(StringUtils.isNotBlank(bo.getOpinionIds()), YqPushRecord::getOpinionIds, bo.getOpinionIds());
        lqw.eq(ObjectUtil.isNotNull(bo.getRuleId()), YqPushRecord::getRuleId, bo.getRuleId());
        lqw.eq(ObjectUtil.isNotNull(bo.getPushScene()), YqPushRecord::getPushScene, bo.getPushScene());
        lqw.eq(ObjectUtil.isNotNull(bo.getPushLevel()), YqPushRecord::getPushLevel, bo.getPushLevel());
        lqw.orderByDesc(YqPushRecord::getRecordId);
        return lqw;
    }
}
