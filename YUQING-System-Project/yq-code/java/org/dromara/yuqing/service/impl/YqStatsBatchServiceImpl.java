package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.mapper.YqStatsBatchMapper;
import org.dromara.yuqing.service.IYqStatsBatchService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 聚合批次 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqStatsBatchServiceImpl implements IYqStatsBatchService {

    private final YqStatsBatchMapper baseMapper;

    @Override
    public PageResult<YqStatsBatch> queryPageList(YqStatsBatch bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqStatsBatch> lqw = buildQueryWrapper(bo);
        Page<YqStatsBatch> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqStatsBatch> queryList(YqStatsBatch bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqStatsBatch queryById(Long batchId) {
        return baseMapper.selectById(batchId);
    }

    @Override
    public Boolean insertByBo(YqStatsBatch bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqStatsBatch bo) {
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
    private LambdaQueryWrapper<YqStatsBatch> buildQueryWrapper(YqStatsBatch bo) {
        LambdaQueryWrapper<YqStatsBatch> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getBatchNo()), YqStatsBatch::getBatchNo, bo.getBatchNo());
        lqw.eq(ObjectUtil.isNotNull(bo.getBeginDate()), YqStatsBatch::getBeginDate, bo.getBeginDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getEndDate()), YqStatsBatch::getEndDate, bo.getEndDate());
        lqw.eq(ObjectUtil.isNotNull(bo.getTriggerType()), YqStatsBatch::getTriggerType, bo.getTriggerType());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), YqStatsBatch::getStatus, bo.getStatus());
        lqw.eq(ObjectUtil.isNotNull(bo.getSourceCount()), YqStatsBatch::getSourceCount, bo.getSourceCount());
        lqw.orderByDesc(YqStatsBatch::getBatchId);
        return lqw;
    }
}
