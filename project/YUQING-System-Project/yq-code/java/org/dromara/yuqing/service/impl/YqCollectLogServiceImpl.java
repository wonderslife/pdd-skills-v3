package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqCollectLog;
import org.dromara.yuqing.mapper.YqCollectLogMapper;
import org.dromara.yuqing.service.IYqCollectLogService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 采集日志 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 采集日志位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqCollectLogServiceImpl implements IYqCollectLogService {

    private final YqCollectLogMapper baseMapper;
    // TODO 关联名称回填：本表在 Doris，按 PRD §6.3 需由 master 数据源的 ExtService 批量补
    //      taskId -> taskName、channelId -> channelName


    @Override
    public PageResult<YqCollectLog> queryPageList(YqCollectLog bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqCollectLog> lqw = buildQueryWrapper(bo);
        Page<YqCollectLog> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqCollectLog> queryList(YqCollectLog bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqCollectLog queryById(Long logId) {
        return baseMapper.selectById(logId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqCollectLog> buildQueryWrapper(YqCollectLog bo) {
        LambdaQueryWrapper<YqCollectLog> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getBatchNo()), YqCollectLog::getBatchNo, bo.getBatchNo());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqCollectLog::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqCollectLog::getChannelId, bo.getChannelId());
        lqw.eq(ObjectUtil.isNotNull(bo.getCollectSource()), YqCollectLog::getCollectSource, bo.getCollectSource());
        lqw.eq(ObjectUtil.isNotNull(bo.getStrategy()), YqCollectLog::getStrategy, bo.getStrategy());
        lqw.eq(ObjectUtil.isNotNull(bo.getFetchedCount()), YqCollectLog::getFetchedCount, bo.getFetchedCount());
        lqw.orderByDesc(YqCollectLog::getLogId);
        return lqw;
    }
}
