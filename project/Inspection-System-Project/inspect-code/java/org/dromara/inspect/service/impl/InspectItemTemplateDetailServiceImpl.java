package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectItemTemplateDetail;
import org.dromara.inspect.mapper.InspectItemTemplateDetailMapper;
import org.dromara.inspect.service.IInspectItemTemplateDetailService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 模板明细 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectItemTemplateDetailServiceImpl implements IInspectItemTemplateDetailService {

    private final InspectItemTemplateDetailMapper baseMapper;

    @Override
    public PageResult<InspectItemTemplateDetail> queryPageList(InspectItemTemplateDetail bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectItemTemplateDetail> lqw = buildQueryWrapper(bo);
        Page<InspectItemTemplateDetail> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectItemTemplateDetail> queryList(InspectItemTemplateDetail bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectItemTemplateDetail queryById(Long detailId) {
        return baseMapper.selectById(detailId);
    }

    @Override
    public Boolean insertByBo(InspectItemTemplateDetail bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectItemTemplateDetail bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
        }
        return baseMapper.deleteByIds(ids) > 0;
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectItemTemplateDetail> buildQueryWrapper(InspectItemTemplateDetail bo) {
        LambdaQueryWrapper<InspectItemTemplateDetail> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getItemName()), InspectItemTemplateDetail::getItemName, bo.getItemName());
        lqw.like(StringUtils.isNotBlank(bo.getRequired()), InspectItemTemplateDetail::getRequired, bo.getRequired());
        lqw.eq(ObjectUtil.isNotNull(bo.getTemplateId()), InspectItemTemplateDetail::getTemplateId, bo.getTemplateId());
        lqw.eq(ObjectUtil.isNotNull(bo.getItemType()), InspectItemTemplateDetail::getItemType, bo.getItemType());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), InspectItemTemplateDetail::getOrderNum, bo.getOrderNum());
        lqw.orderByDesc(InspectItemTemplateDetail::getDetailId);
        return lqw;
    }
}
