package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.service.IYqOpinionService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 舆情明细 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 舆情明细位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqOpinionServiceImpl implements IYqOpinionService {

    private final YqOpinionMapper baseMapper;
    // TODO 关联名称回填：本表在 Doris，按 PRD §6.3 需由 master 数据源的 ExtService 批量补
    //      taskId -> taskName、channelId -> channelName


    @Override
    public PageResult<YqOpinion> queryPageList(YqOpinion bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqOpinion> lqw = buildQueryWrapper(bo);
        Page<YqOpinion> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqOpinion> queryList(YqOpinion bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqOpinion queryById(Long opinionId) {
        return baseMapper.selectById(opinionId);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqOpinion> buildQueryWrapper(YqOpinion bo) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTitle()), YqOpinion::getTitle, bo.getTitle());
        lqw.like(StringUtils.isNotBlank(bo.getUrlHash()), YqOpinion::getUrlHash, bo.getUrlHash());
        lqw.eq(ObjectUtil.isNotNull(bo.getCollectDate()), YqOpinion::getCollectDate, bo.getCollectDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqOpinion::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqOpinion::getChannelId, bo.getChannelId());
        lqw.eq(ObjectUtil.isNotNull(bo.getPublishTime()), YqOpinion::getPublishTime, bo.getPublishTime());
        lqw.orderByDesc(YqOpinion::getOpinionId);
        return lqw;
    }
}
