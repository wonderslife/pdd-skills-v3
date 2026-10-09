package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqStatsDaily;
import org.dromara.yuqing.mapper.YqStatsDailyMapper;
import org.dromara.yuqing.service.IYqStatsDailyService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 统计预聚合 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 统计预聚合位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqStatsDailyServiceImpl implements IYqStatsDailyService {

    private final YqStatsDailyMapper baseMapper;
    // TODO 关联名称回填：本表在 Doris，按 PRD §6.3 需由 master 数据源的 ExtService 批量补
    //      taskId -> taskName、channelId -> channelName


    @Override
    public PageResult<YqStatsDaily> queryPageList(YqStatsDaily bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqStatsDaily> lqw = buildQueryWrapper(bo);
        Page<YqStatsDaily> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqStatsDaily> queryList(YqStatsDaily bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqStatsDaily queryById(Long statsId) {
        return baseMapper.selectById(statsId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqStatsDaily> buildQueryWrapper(YqStatsDaily bo) {
        LambdaQueryWrapper<YqStatsDaily> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getStatsDate()), YqStatsDaily::getStatsDate, bo.getStatsDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqStatsDaily::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqStatsDaily::getChannelId, bo.getChannelId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTotalCount()), YqStatsDaily::getTotalCount, bo.getTotalCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getPositiveCount()), YqStatsDaily::getPositiveCount, bo.getPositiveCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getNeutralCount()), YqStatsDaily::getNeutralCount, bo.getNeutralCount());
        lqw.orderByDesc(YqStatsDaily::getStatsId);
        return lqw;
    }
}
