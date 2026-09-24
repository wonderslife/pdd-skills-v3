package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqTrainSample;
import org.dromara.yuqing.mapper.YqTrainSampleMapper;
import org.dromara.yuqing.service.IYqTrainSampleService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqKnowledge;
import org.dromara.yuqing.mapper.YqKnowledgeMapper;
import org.dromara.yuqing.domain.YqModelVersion;
import org.dromara.yuqing.mapper.YqModelVersionMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 训练样本 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqTrainSampleServiceImpl implements IYqTrainSampleService {

    private final YqTrainSampleMapper baseMapper;
    private final YqKnowledgeMapper knowledgeMapper;
    private final YqModelVersionMapper modelVersionMapper;

    @Override
    public PageResult<YqTrainSample> queryPageList(YqTrainSample bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqTrainSample> lqw = buildQueryWrapper(bo);
        Page<YqTrainSample> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqTrainSample> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqTrainSample> queryList(YqTrainSample bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqTrainSample queryById(Long sampleId) {
        YqTrainSample e = baseMapper.selectById(sampleId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqTrainSample bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqTrainSample bo) {
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
    private void fillRefNames(List<YqTrainSample> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> knowledgeIdSet = list.stream().map(YqTrainSample::getKnowledgeId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!knowledgeIdSet.isEmpty()) {
            Map<Long, String> knowledgeIdNameMap = knowledgeMapper.selectByIds(knowledgeIdSet).stream()
                .collect(Collectors.toMap(YqKnowledge::getKnowledgeId, YqKnowledge::getCaseTitle, (a, b) -> a));
            list.forEach(e -> e.setCaseTitle(knowledgeIdNameMap.get(e.getKnowledgeId())));
        }
        Set<Long> modelVersionIdSet = list.stream().map(YqTrainSample::getModelVersionId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!modelVersionIdSet.isEmpty()) {
            Map<Long, String> modelVersionIdNameMap = modelVersionMapper.selectByIds(modelVersionIdSet).stream()
                .collect(Collectors.toMap(YqModelVersion::getModelVersionId, YqModelVersion::getVersionName, (a, b) -> a));
            list.forEach(e -> e.setVersionName(modelVersionIdNameMap.get(e.getModelVersionId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqTrainSample> buildQueryWrapper(YqTrainSample bo) {
        LambdaQueryWrapper<YqTrainSample> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getLabelContent()), YqTrainSample::getLabelContent, bo.getLabelContent());
        lqw.eq(ObjectUtil.isNotNull(bo.getKnowledgeId()), YqTrainSample::getKnowledgeId, bo.getKnowledgeId());
        lqw.eq(ObjectUtil.isNotNull(bo.getModelVersionId()), YqTrainSample::getModelVersionId, bo.getModelVersionId());
        lqw.eq(ObjectUtil.isNotNull(bo.getSampleStatus()), YqTrainSample::getSampleStatus, bo.getSampleStatus());
        lqw.eq(ObjectUtil.isNotNull(bo.getLabeledBy()), YqTrainSample::getLabeledBy, bo.getLabeledBy());
        lqw.eq(ObjectUtil.isNotNull(bo.getLabeledTime()), YqTrainSample::getLabeledTime, bo.getLabeledTime());
        lqw.orderByDesc(YqTrainSample::getSampleId);
        return lqw;
    }
}
