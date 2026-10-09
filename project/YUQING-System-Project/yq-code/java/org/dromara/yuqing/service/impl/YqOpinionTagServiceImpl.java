package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.mapper.YqOpinionTagMapper;
import org.dromara.yuqing.service.IYqOpinionTagService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 舆情标签关联 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
/**
 * ⚠ 舆情标签关联位于 Apache Doris 数据源（PRD §6.3 数据源路由约定）。
 * 只读；如需本地无 Doris 环境跑通，先把 @DS("doris") 改为 @DS("master") 或按
 * yq_datasource.yml 给出的从库配置接入。
 */
@DS("doris")
public class YqOpinionTagServiceImpl implements IYqOpinionTagService {

    private final YqOpinionTagMapper baseMapper;
    // TODO 关联名称回填：本表在 Doris，按 PRD §6.3 需由 master 数据源的 ExtService 批量补
    //      tagId -> tagName


    @Override
    public PageResult<YqOpinionTag> queryPageList(YqOpinionTag bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqOpinionTag> lqw = buildQueryWrapper(bo);
        Page<YqOpinionTag> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqOpinionTag> queryList(YqOpinionTag bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqOpinionTag queryById(Long id) {
        return baseMapper.selectById(id);
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqOpinionTag> buildQueryWrapper(YqOpinionTag bo) {
        LambdaQueryWrapper<YqOpinionTag> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqOpinionTag::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTagId()), YqOpinionTag::getTagId, bo.getTagId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTagSource()), YqOpinionTag::getTagSource, bo.getTagSource());
        lqw.orderByDesc(YqOpinionTag::getId);
        return lqw;
    }
}
