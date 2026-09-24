package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqReportOpinion;
import org.dromara.yuqing.mapper.YqReportOpinionMapper;
import org.dromara.yuqing.service.IYqReportOpinionService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 报告舆情关联 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqReportOpinionServiceImpl implements IYqReportOpinionService {

    private final YqReportOpinionMapper baseMapper;

    @Override
    public PageResult<YqReportOpinion> queryPageList(YqReportOpinion bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqReportOpinion> lqw = buildQueryWrapper(bo);
        Page<YqReportOpinion> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqReportOpinion> queryList(YqReportOpinion bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqReportOpinion queryById(Long id) {
        return baseMapper.selectById(id);
    }

    @Override
    public Boolean insertByBo(YqReportOpinion bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqReportOpinion bo) {
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
    private LambdaQueryWrapper<YqReportOpinion> buildQueryWrapper(YqReportOpinion bo) {
        LambdaQueryWrapper<YqReportOpinion> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getReportId()), YqReportOpinion::getReportId, bo.getReportId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOpinionId()), YqReportOpinion::getOpinionId, bo.getOpinionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getIncludeSource()), YqReportOpinion::getIncludeSource, bo.getIncludeSource());
        lqw.eq(ObjectUtil.isNotNull(bo.getOperateBy()), YqReportOpinion::getOperateBy, bo.getOperateBy());
        lqw.orderByDesc(YqReportOpinion::getId);
        return lqw;
    }
}
