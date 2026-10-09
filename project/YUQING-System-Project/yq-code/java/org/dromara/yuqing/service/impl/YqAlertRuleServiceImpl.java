package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.mapper.YqAlertRuleMapper;
import org.dromara.yuqing.service.IYqAlertRuleService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 预警规则 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqAlertRuleServiceImpl implements IYqAlertRuleService {

    private final YqAlertRuleMapper baseMapper;

    @Override
    public PageResult<YqAlertRule> queryPageList(YqAlertRule bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqAlertRule> lqw = buildQueryWrapper(bo);
        Page<YqAlertRule> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqAlertRule> queryList(YqAlertRule bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqAlertRule queryById(Long ruleId) {
        return baseMapper.selectById(ruleId);
    }

    @Override
    public Boolean insertByBo(YqAlertRule bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqAlertRule bo) {
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
    private LambdaQueryWrapper<YqAlertRule> buildQueryWrapper(YqAlertRule bo) {
        LambdaQueryWrapper<YqAlertRule> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRuleName()), YqAlertRule::getRuleName, bo.getRuleName());
        lqw.like(StringUtils.isNotBlank(bo.getTriggerScenes()), YqAlertRule::getTriggerScenes, bo.getTriggerScenes());
        lqw.eq(ObjectUtil.isNotNull(bo.getWindowMinutes()), YqAlertRule::getWindowMinutes, bo.getWindowMinutes());
        lqw.eq(ObjectUtil.isNotNull(bo.getCountThreshold()), YqAlertRule::getCountThreshold, bo.getCountThreshold());
        lqw.eq(ObjectUtil.isNotNull(bo.getHeatThreshold()), YqAlertRule::getHeatThreshold, bo.getHeatThreshold());
        lqw.eq(ObjectUtil.isNotNull(bo.getRiskLevelThreshold()), YqAlertRule::getRiskLevelThreshold, bo.getRiskLevelThreshold());
        lqw.orderByDesc(YqAlertRule::getRuleId);
        return lqw;
    }
}
