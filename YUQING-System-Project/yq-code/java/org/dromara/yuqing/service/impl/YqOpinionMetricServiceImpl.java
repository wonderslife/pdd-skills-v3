package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinionMetric;
import org.dromara.yuqing.mapper.YqOpinionMetricMapper;
import org.dromara.yuqing.service.IYqOpinionMetricService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 互动数据快照 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 互动数据快照位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqOpinionMetricServiceImpl implements IYqOpinionMetricService {

    private final YqOpinionMetricMapper baseMapper;

    @Override
    public PageResult<YqOpinionMetric> queryPageList(YqOpinionMetric bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqOpinionMetric> lqw = buildQueryWrapper(bo);
        Page<YqOpinionMetric> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqOpinionMetric> queryList(YqOpinionMetric bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqOpinionMetric queryById(Long metricId) {
        return baseMapper.selectById(metricId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqOpinionMetric> buildQueryWrapper(YqOpinionMetric bo) {
        LambdaQueryWrapper<YqOpinionMetric> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqOpinionMetric::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getSnapshotDate()), YqOpinionMetric::getSnapshotDate, bo.getSnapshotDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getLikeCount()), YqOpinionMetric::getLikeCount, bo.getLikeCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getCommentCount()), YqOpinionMetric::getCommentCount, bo.getCommentCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getShareCount()), YqOpinionMetric::getShareCount, bo.getShareCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getReadCount()), YqOpinionMetric::getReadCount, bo.getReadCount());
        lqw.orderByDesc(YqOpinionMetric::getMetricId);
        return lqw;
    }
}
