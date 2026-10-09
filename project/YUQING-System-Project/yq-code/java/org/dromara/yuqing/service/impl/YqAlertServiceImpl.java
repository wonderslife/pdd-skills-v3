package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.mapper.YqAlertMapper;
import org.dromara.yuqing.service.IYqAlertService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.mapper.YqAlertRuleMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 预警记录 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqAlertServiceImpl implements IYqAlertService {

    private final YqAlertMapper baseMapper;
    private final YqAlertRuleMapper alertRuleMapper;

    @Override
    public PageResult<YqAlert> queryPageList(YqAlert bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqAlert> lqw = buildQueryWrapper(bo);
        Page<YqAlert> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqAlert> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqAlert> queryList(YqAlert bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqAlert queryById(Long alertId) {
        YqAlert e = baseMapper.selectById(alertId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqAlert bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqAlert bo) {
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
    private void fillRefNames(List<YqAlert> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> ruleIdSet = list.stream().map(YqAlert::getRuleId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!ruleIdSet.isEmpty()) {
            Map<Long, String> ruleIdNameMap = alertRuleMapper.selectByIds(ruleIdSet).stream()
                .collect(Collectors.toMap(YqAlertRule::getRuleId, YqAlertRule::getRuleName, (a, b) -> a));
            list.forEach(e -> e.setRuleName(ruleIdNameMap.get(e.getRuleId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqAlert> buildQueryWrapper(YqAlert bo) {
        LambdaQueryWrapper<YqAlert> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getAlertTitle()), YqAlert::getAlertTitle, bo.getAlertTitle());
        lqw.eq(ObjectUtil.isNotNull(bo.getRuleId()), YqAlert::getRuleId, bo.getRuleId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqAlert::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getClusterId()), YqAlert::getClusterId, bo.getClusterId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTriggerScene()), YqAlert::getTriggerScene, bo.getTriggerScene());
        lqw.eq(ObjectUtil.isNotNull(bo.getAlertLevel()), YqAlert::getAlertLevel, bo.getAlertLevel());
        lqw.orderByDesc(YqAlert::getAlertId);
        return lqw;
    }
}
