package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.mapper.YqNoiseRuleMapper;
import org.dromara.yuqing.service.IYqNoiseRuleService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 降噪规则 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqNoiseRuleServiceImpl implements IYqNoiseRuleService {

    private final YqNoiseRuleMapper baseMapper;

    @Override
    public PageResult<YqNoiseRule> queryPageList(YqNoiseRule bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqNoiseRule> lqw = buildQueryWrapper(bo);
        Page<YqNoiseRule> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqNoiseRule> queryList(YqNoiseRule bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqNoiseRule queryById(Long ruleId) {
        return baseMapper.selectById(ruleId);
    }

    @Override
    public Boolean insertByBo(YqNoiseRule bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqNoiseRule bo) {
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
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqNoiseRule> buildQueryWrapper(YqNoiseRule bo) {
        LambdaQueryWrapper<YqNoiseRule> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRuleName()), YqNoiseRule::getRuleName, bo.getRuleName());
        lqw.like(StringUtils.isNotBlank(bo.getMatchValue()), YqNoiseRule::getMatchValue, bo.getMatchValue());
        lqw.eq(ObjectUtil.isNotNull(bo.getRuleType()), YqNoiseRule::getRuleType, bo.getRuleType());
        lqw.eq(ObjectUtil.isNotNull(bo.getNoiseCategory()), YqNoiseRule::getNoiseCategory, bo.getNoiseCategory());
        lqw.eq(ObjectUtil.isNotNull(bo.getMatchType()), YqNoiseRule::getMatchType, bo.getMatchType());
        lqw.eq(ObjectUtil.isNotNull(bo.getPriority()), YqNoiseRule::getPriority, bo.getPriority());
        lqw.orderByDesc(YqNoiseRule::getRuleId);
        return lqw;
    }
}
