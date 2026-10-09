package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqStatsDim;
import org.dromara.yuqing.mapper.YqStatsDimMapper;
import org.dromara.yuqing.service.IYqStatsDimService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 维度分布 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 维度分布位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqStatsDimServiceImpl implements IYqStatsDimService {

    private final YqStatsDimMapper baseMapper;

    @Override
    public PageResult<YqStatsDim> queryPageList(YqStatsDim bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqStatsDim> lqw = buildQueryWrapper(bo);
        Page<YqStatsDim> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqStatsDim> queryList(YqStatsDim bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqStatsDim queryById(Long dimId) {
        return baseMapper.selectById(dimId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqStatsDim> buildQueryWrapper(YqStatsDim bo) {
        LambdaQueryWrapper<YqStatsDim> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getDimType()), YqStatsDim::getDimType, bo.getDimType());
        lqw.like(StringUtils.isNotBlank(bo.getDimKey()), YqStatsDim::getDimKey, bo.getDimKey());
        lqw.like(StringUtils.isNotBlank(bo.getTimeGrain()), YqStatsDim::getTimeGrain, bo.getTimeGrain());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatsDate()), YqStatsDim::getStatsDate, bo.getStatsDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqStatsDim::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqStatsDim::getChannelId, bo.getChannelId());
        lqw.orderByDesc(YqStatsDim::getDimId);
        return lqw;
    }
}
