package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectItemTemplate;
import org.dromara.inspect.domain.InspectItemTemplateDetail;
import org.dromara.inspect.mapper.InspectItemTemplateMapper;
import org.dromara.inspect.mapper.InspectItemTemplateDetailMapper;
import org.dromara.inspect.service.IInspectItemTemplateService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 巡检项模板 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectItemTemplateServiceImpl implements IInspectItemTemplateService {

    private final InspectItemTemplateMapper baseMapper;
    private final InspectItemTemplateDetailMapper itemTemplateDetailMapper;

    @Override
    public PageResult<InspectItemTemplate> queryPageList(InspectItemTemplate bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectItemTemplate> lqw = buildQueryWrapper(bo);
        Page<InspectItemTemplate> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<InspectItemTemplate> records = page.getRecords();
        fillDetailList(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<InspectItemTemplate> queryList(InspectItemTemplate bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectItemTemplate queryById(Long templateId) {
        InspectItemTemplate e = baseMapper.selectById(templateId);
        if (e != null) {
            e.setDetailList(selectDetailList(templateId));
        }
        return e;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean insertByBo(InspectItemTemplate bo) {
        boolean flag = baseMapper.insert(bo) > 0;
        if (flag) {
            saveDetailList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean updateByBo(InspectItemTemplate bo) {
        boolean flag = baseMapper.updateById(bo) > 0;
        if (flag) {
            // 明细整体覆盖：先清后插，否则前端删掉的行会残留在库里
            itemTemplateDetailMapper.delete(new LambdaQueryWrapper<InspectItemTemplateDetail>()
                .eq(InspectItemTemplateDetail::getTemplateId, bo.getTemplateId()));
            saveDetailList(bo);
        }
        return flag;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
        // TODO: 删除前业务校验（存在关联数据时拒绝删除）
        }
        boolean flag = baseMapper.deleteByIds(ids) > 0;
        if (flag) {
            itemTemplateDetailMapper.delete(new LambdaQueryWrapper<InspectItemTemplateDetail>()
                .in(InspectItemTemplateDetail::getTemplateId, ids));
        }
        return flag;
    }

    /**
     * 批量回填「模板明细」（列表页展示明细数量；一次 in 查询，避免 N+1）
     */
    private void fillDetailList(List<InspectItemTemplate> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        List<Long> ids = list.stream().map(InspectItemTemplate::getTemplateId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, List<InspectItemTemplateDetail>> detailMap = itemTemplateDetailMapper.selectList(new LambdaQueryWrapper<InspectItemTemplateDetail>()
            .in(InspectItemTemplateDetail::getTemplateId, ids)
            .orderByAsc(InspectItemTemplateDetail::getOrderNum))
            .stream().collect(Collectors.groupingBy(InspectItemTemplateDetail::getTemplateId));
        list.forEach(e -> e.setDetailList(detailMap.getOrDefault(e.getTemplateId(), List.of())));
    }

    /**
     * 查询「模板明细」明细
     */
    private List<InspectItemTemplateDetail> selectDetailList(Long templateId) {
        return itemTemplateDetailMapper.selectList(new LambdaQueryWrapper<InspectItemTemplateDetail>()
            .eq(InspectItemTemplateDetail::getTemplateId, templateId)
            .orderByAsc(InspectItemTemplateDetail::getOrderNum));
    }

    /**
     * 保存「模板明细」明细（覆盖式写入）
     */
    private void saveDetailList(InspectItemTemplate bo) {
        List<InspectItemTemplateDetail> detailList = bo.getDetailList();
        if (detailList == null || detailList.isEmpty()) {
            return;
        }
        int order = 0;
        for (InspectItemTemplateDetail d : detailList) {
            // 主键置空：交给雪花 ID 重新分配，避免前端「删掉再新增」的行按旧主键插入而冲突
            d.setDetailId(null);
            d.setTemplateId(bo.getTemplateId());
            if (d.getOrderNum() == null) {
                d.setOrderNum(order);
            }
            order++;
            itemTemplateDetailMapper.insert(d);
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectItemTemplate> buildQueryWrapper(InspectItemTemplate bo) {
        LambdaQueryWrapper<InspectItemTemplate> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTemplateName()), InspectItemTemplate::getTemplateName, bo.getTemplateName());
        lqw.orderByDesc(InspectItemTemplate::getTemplateId);
        return lqw;
    }
}
