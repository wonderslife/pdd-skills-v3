package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqReport;
import org.dromara.yuqing.mapper.YqReportMapper;
import org.dromara.yuqing.service.IYqReportService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqReportTemplate;
import org.dromara.yuqing.mapper.YqReportTemplateMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 舆情报告 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqReportServiceImpl implements IYqReportService {

    private final YqReportMapper baseMapper;
    private final YqReportTemplateMapper reportTemplateMapper;

    @Override
    public PageResult<YqReport> queryPageList(YqReport bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqReport> lqw = buildQueryWrapper(bo);
        Page<YqReport> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqReport> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqReport> queryList(YqReport bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqReport queryById(Long reportId) {
        YqReport e = baseMapper.selectById(reportId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqReport bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqReport bo) {
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
     * 回填关联名称（列表只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<YqReport> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> templateIdSet = list.stream().map(YqReport::getTemplateId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!templateIdSet.isEmpty()) {
            Map<Long, String> templateIdNameMap = reportTemplateMapper.selectByIds(templateIdSet).stream()
                .collect(Collectors.toMap(YqReportTemplate::getTemplateId, YqReportTemplate::getTemplateName, (a, b) -> a));
            list.forEach(e -> e.setTemplateName(templateIdNameMap.get(e.getTemplateId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqReport> buildQueryWrapper(YqReport bo) {
        LambdaQueryWrapper<YqReport> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getReportName()), YqReport::getReportName, bo.getReportName());
        lqw.eq(ObjectUtil.isNotNull(bo.getReportType()), YqReport::getReportType, bo.getReportType());
        lqw.eq(ObjectUtil.isNotNull(bo.getReportDate()), YqReport::getReportDate, bo.getReportDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getTemplateId()), YqReport::getTemplateId, bo.getTemplateId());
        lqw.eq(ObjectUtil.isNotNull(bo.getTriggerType()), YqReport::getTriggerType, bo.getTriggerType());
        lqw.eq(ObjectUtil.isNotNull(bo.getFileFormat()), YqReport::getFileFormat, bo.getFileFormat());
        lqw.orderByDesc(YqReport::getReportId);
        return lqw;
    }
}
