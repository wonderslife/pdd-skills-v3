package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.mapper.YqOpinionClusterMapper;
import org.dromara.yuqing.service.IYqOpinionClusterService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 事件聚合 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 事件聚合位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqOpinionClusterServiceImpl implements IYqOpinionClusterService {

    private final YqOpinionClusterMapper baseMapper;

    @Override
    public PageResult<YqOpinionCluster> queryPageList(YqOpinionCluster bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqOpinionCluster> lqw = buildQueryWrapper(bo);
        Page<YqOpinionCluster> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqOpinionCluster> queryList(YqOpinionCluster bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqOpinionCluster queryById(Long clusterId) {
        return baseMapper.selectById(clusterId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqOpinionCluster> buildQueryWrapper(YqOpinionCluster bo) {
        LambdaQueryWrapper<YqOpinionCluster> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getClusterTitle()), YqOpinionCluster::getClusterTitle, bo.getClusterTitle());
        lqw.like(StringUtils.isNotBlank(bo.getClusterTopic()), YqOpinionCluster::getClusterTopic, bo.getClusterTopic());
        lqw.like(StringUtils.isNotBlank(bo.getSpreadPath()), YqOpinionCluster::getSpreadPath, bo.getSpreadPath());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionCount()), YqOpinionCluster::getOpinionCount, bo.getOpinionCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getFirstTime()), YqOpinionCluster::getFirstTime, bo.getFirstTime());
        lqw.eq(ObjectUtil.isNotNull(bo.getLastTime()), YqOpinionCluster::getLastTime, bo.getLastTime());
        lqw.orderByDesc(YqOpinionCluster::getClusterId);
        return lqw;
    }
}
