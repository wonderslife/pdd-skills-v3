package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.mapper.YqOpinionAnalysisMapper;
import org.dromara.yuqing.service.IYqOpinionAnalysisService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 研判结果 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 研判结果位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqOpinionAnalysisServiceImpl implements IYqOpinionAnalysisService {

    private final YqOpinionAnalysisMapper baseMapper;

    @Override
    public PageResult<YqOpinionAnalysis> queryPageList(YqOpinionAnalysis bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqOpinionAnalysis> lqw = buildQueryWrapper(bo);
        Page<YqOpinionAnalysis> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqOpinionAnalysis> queryList(YqOpinionAnalysis bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqOpinionAnalysis queryById(Long analysisId) {
        return baseMapper.selectById(analysisId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqOpinionAnalysis> buildQueryWrapper(YqOpinionAnalysis bo) {
        LambdaQueryWrapper<YqOpinionAnalysis> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTopic()), YqOpinionAnalysis::getTopic, bo.getTopic());
        lqw.like(StringUtils.isNotBlank(bo.getSummary()), YqOpinionAnalysis::getSummary, bo.getSummary());
        lqw.like(StringUtils.isNotBlank(bo.getRiskAttr()), YqOpinionAnalysis::getRiskAttr, bo.getRiskAttr());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqOpinionAnalysis::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getSentiAttr()), YqOpinionAnalysis::getSentiAttr, bo.getSentiAttr());
        lqw.eq(ObjectUtil.isNotNull(bo.getRiskLevel()), YqOpinionAnalysis::getRiskLevel, bo.getRiskLevel());
        lqw.orderByDesc(YqOpinionAnalysis::getAnalysisId);
        return lqw;
    }
}
