package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqReportSection;
import org.dromara.yuqing.mapper.YqReportSectionMapper;
import org.dromara.yuqing.service.IYqReportSectionService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 报告模板章节 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqReportSectionServiceImpl implements IYqReportSectionService {

    private final YqReportSectionMapper baseMapper;

    @Override
    public PageResult<YqReportSection> queryPageList(YqReportSection bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqReportSection> lqw = buildQueryWrapper(bo);
        Page<YqReportSection> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqReportSection> queryList(YqReportSection bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqReportSection queryById(Long sectionId) {
        return baseMapper.selectById(sectionId);
    }

    @Override
    public Boolean insertByBo(YqReportSection bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqReportSection bo) {
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
    private LambdaQueryWrapper<YqReportSection> buildQueryWrapper(YqReportSection bo) {
        LambdaQueryWrapper<YqReportSection> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getSectionCode()), YqReportSection::getSectionCode, bo.getSectionCode());
        lqw.like(StringUtils.isNotBlank(bo.getSectionName()), YqReportSection::getSectionName, bo.getSectionName());
        lqw.like(StringUtils.isNotBlank(bo.getRequired()), YqReportSection::getRequired, bo.getRequired());
        lqw.eq(ObjectUtil.isNotNull(bo.getTemplateId()), YqReportSection::getTemplateId, bo.getTemplateId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), YqReportSection::getOrderNum, bo.getOrderNum());
        lqw.orderByDesc(YqReportSection::getSectionId);
        return lqw;
    }
}
