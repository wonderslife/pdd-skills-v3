package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqReportTemplate;
import org.dromara.yuqing.domain.YqReportSection;
import org.dromara.yuqing.mapper.YqReportSectionMapper;
import org.dromara.yuqing.mapper.YqReportTemplateMapper;
import org.dromara.yuqing.service.IYqReportTemplateService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 报告模板 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqReportTemplateServiceImpl implements IYqReportTemplateService {

    private final YqReportTemplateMapper baseMapper;
    private final YqReportSectionMapper reportSectionMapper;

    @Override
    public PageResult<YqReportTemplate> queryPageList(YqReportTemplate bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqReportTemplate> lqw = buildQueryWrapper(bo);
        Page<YqReportTemplate> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqReportTemplate> records = page.getRecords();
        fillSectionList(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqReportTemplate> queryList(YqReportTemplate bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqReportTemplate queryById(Long templateId) {
        YqReportTemplate e = baseMapper.selectById(templateId);
        if (e != null) {
            e.setSectionList(selectSectionList(templateId));
        }
        return e;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean insertByBo(YqReportTemplate bo) {
        boolean flag = baseMapper.insert(bo) > 0;
        if (flag) {
            saveSectionList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateByBo(YqReportTemplate bo) {
        boolean flag = baseMapper.updateById(bo) > 0;
        if (flag) {
            // 报告模板章节整体覆盖：先清后插，否则前端删掉的行会残留在库里
            reportSectionMapper.delete(new LambdaQueryWrapper<YqReportSection>()
                .eq(YqReportSection::getTemplateId, bo.getTemplateId()));
            saveSectionList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
            // TODO: 删除前业务校验（存在关联数据时应拒绝删除）
        }
        boolean flag = baseMapper.deleteByIds(ids) > 0;
        if (flag) {
            reportSectionMapper.delete(new LambdaQueryWrapper<YqReportSection>()
                .in(YqReportSection::getTemplateId, ids));
        }
        return flag;
    }
    /**
     * 批量回填「报告模板章节」（一次 in 查询，避免 N+1）
     */
    private void fillSectionList(List<YqReportTemplate> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(YqReportTemplate::getTemplateId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<YqReportSection>> detailMap = reportSectionMapper.selectList(new LambdaQueryWrapper<YqReportSection>()
            .in(YqReportSection::getTemplateId, ids)
            .orderByAsc(YqReportSection::getOrderNum))
            .stream().collect(Collectors.groupingBy(YqReportSection::getTemplateId));
        list.forEach(e -> e.setSectionList(detailMap.getOrDefault(e.getTemplateId(), List.of())));
    }

    /**
     * 查询「报告模板章节」明细
     */
    private List<YqReportSection> selectSectionList(Long templateId) {
        return reportSectionMapper.selectList(new LambdaQueryWrapper<YqReportSection>()
            .eq(YqReportSection::getTemplateId, templateId)
            .orderByAsc(YqReportSection::getOrderNum));
    }

    /**
     * 保存「报告模板章节」明细（覆盖式写入）
     */
    private void saveSectionList(YqReportTemplate bo) {
        List<YqReportSection> detailList = bo.getSectionList();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (YqReportSection d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.setSectionId(null);
            d.setTemplateId(bo.getTemplateId());
            if (d.getOrderNum() == null) {
                d.setOrderNum(order);
            }
            order++;
            reportSectionMapper.insert(d);
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqReportTemplate> buildQueryWrapper(YqReportTemplate bo) {
        LambdaQueryWrapper<YqReportTemplate> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTemplateName()), YqReportTemplate::getTemplateName, bo.getTemplateName());
        lqw.like(StringUtils.isNotBlank(bo.getIsDefault()), YqReportTemplate::getIsDefault, bo.getIsDefault());
        lqw.like(StringUtils.isNotBlank(bo.getCoverFields()), YqReportTemplate::getCoverFields, bo.getCoverFields());
        lqw.like(StringUtils.isNotBlank(bo.getFontFamily()), YqReportTemplate::getFontFamily, bo.getFontFamily());
        lqw.eq(ObjectUtil.isNotNull(bo.getReportType()), YqReportTemplate::getReportType, bo.getReportType());
        lqw.eq(ObjectUtil.isNotNull(bo.getHeadingNumberRule()), YqReportTemplate::getHeadingNumberRule, bo.getHeadingNumberRule());
        lqw.orderByDesc(YqReportTemplate::getTemplateId);
        return lqw;
    }
}
