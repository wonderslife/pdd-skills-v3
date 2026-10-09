package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqStatsHot;
import org.dromara.yuqing.mapper.YqStatsHotMapper;
import org.dromara.yuqing.service.IYqStatsHotService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 热点排行 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 热点排行位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqStatsHotServiceImpl implements IYqStatsHotService {

    private final YqStatsHotMapper baseMapper;

    @Override
    public PageResult<YqStatsHot> queryPageList(YqStatsHot bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqStatsHot> lqw = buildQueryWrapper(bo);
        Page<YqStatsHot> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqStatsHot> queryList(YqStatsHot bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqStatsHot queryById(Long hotId) {
        return baseMapper.selectById(hotId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqStatsHot> buildQueryWrapper(YqStatsHot bo) {
        LambdaQueryWrapper<YqStatsHot> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRankBy()), YqStatsHot::getRankBy, bo.getRankBy());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatsDate()), YqStatsHot::getStatsDate, bo.getStatsDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getRankNo()), YqStatsHot::getRankNo, bo.getRankNo());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqStatsHot::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqStatsHot::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqStatsHot::getChannelId, bo.getChannelId());
        lqw.orderByDesc(YqStatsHot::getHotId);
        return lqw;
    }
}
