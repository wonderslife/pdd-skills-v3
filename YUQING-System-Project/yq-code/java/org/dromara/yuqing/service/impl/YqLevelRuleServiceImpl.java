package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqLevelRule;
import org.dromara.yuqing.mapper.YqLevelRuleMapper;
import org.dromara.yuqing.service.IYqLevelRuleService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 研判分级规则 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqLevelRuleServiceImpl implements IYqLevelRuleService {

    private final YqLevelRuleMapper baseMapper;

    @Override
    public PageResult<YqLevelRule> queryPageList(YqLevelRule bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqLevelRule> lqw = buildQueryWrapper(bo);
        Page<YqLevelRule> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqLevelRule> queryList(YqLevelRule bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqLevelRule queryById(Long ruleId) {
        return baseMapper.selectById(ruleId);
    }

    @Override
    public Boolean insertByBo(YqLevelRule bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqLevelRule bo) {
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
    private LambdaQueryWrapper<YqLevelRule> buildQueryWrapper(YqLevelRule bo) {
        LambdaQueryWrapper<YqLevelRule> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRuleName()), YqLevelRule::getRuleName, bo.getRuleName());
        lqw.like(StringUtils.isNotBlank(bo.getIsDefault()), YqLevelRule::getIsDefault, bo.getIsDefault());
        lqw.like(StringUtils.isNotBlank(bo.getLevelRanges()), YqLevelRule::getLevelRanges, bo.getLevelRanges());
        lqw.like(StringUtils.isNotBlank(bo.getRiskMapping()), YqLevelRule::getRiskMapping, bo.getRiskMapping());
        lqw.eq(ObjectUtil.isNotNull(bo.getScoreMetric()), YqLevelRule::getScoreMetric, bo.getScoreMetric());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), YqLevelRule::getStatus, bo.getStatus());
        lqw.orderByDesc(YqLevelRule::getRuleId);
        return lqw;
    }
}
