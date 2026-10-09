package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import org.dromara.yuqing.service.IYqPushRuleService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqPushTemplate;
import org.dromara.yuqing.mapper.YqPushTemplateMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 推送规则 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqPushRuleServiceImpl implements IYqPushRuleService {

    private final YqPushRuleMapper baseMapper;
    private final YqPushTemplateMapper pushTemplateMapper;

    @Override
    public PageResult<YqPushRule> queryPageList(YqPushRule bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqPushRule> lqw = buildQueryWrapper(bo);
        Page<YqPushRule> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqPushRule> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqPushRule> queryList(YqPushRule bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqPushRule queryById(Long ruleId) {
        YqPushRule e = baseMapper.selectById(ruleId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqPushRule bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqPushRule bo) {
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
    private void fillRefNames(List<YqPushRule> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> pushTemplateIdSet = list.stream().map(YqPushRule::getPushTemplateId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!pushTemplateIdSet.isEmpty()) {
            Map<Long, String> pushTemplateIdNameMap = pushTemplateMapper.selectByIds(pushTemplateIdSet).stream()
                .collect(Collectors.toMap(YqPushTemplate::getTemplateId, YqPushTemplate::getTemplateName, (a, b) -> a));
            list.forEach(e -> e.setTemplateName(pushTemplateIdNameMap.get(e.getPushTemplateId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqPushRule> buildQueryWrapper(YqPushRule bo) {
        LambdaQueryWrapper<YqPushRule> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRuleName()), YqPushRule::getRuleName, bo.getRuleName());
        lqw.like(StringUtils.isNotBlank(bo.getPushScenes()), YqPushRule::getPushScenes, bo.getPushScenes());
        lqw.like(StringUtils.isNotBlank(bo.getScheduleCron()), YqPushRule::getScheduleCron, bo.getScheduleCron());
        lqw.eq(ObjectUtil.isNotNull(bo.getPushLevel()), YqPushRule::getPushLevel, bo.getPushLevel());
        lqw.eq(ObjectUtil.isNotNull(bo.getPushTemplateId()), YqPushRule::getPushTemplateId, bo.getPushTemplateId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTargetType()), YqPushRule::getTargetType, bo.getTargetType());
        lqw.orderByDesc(YqPushRule::getRuleId);
        return lqw;
    }
}
