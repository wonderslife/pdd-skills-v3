package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqModelVersion;
import org.dromara.yuqing.mapper.YqModelVersionMapper;
import org.dromara.yuqing.service.IYqModelVersionService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 模型版本 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqModelVersionServiceImpl implements IYqModelVersionService {

    private final YqModelVersionMapper baseMapper;

    @Override
    public PageResult<YqModelVersion> queryPageList(YqModelVersion bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqModelVersion> lqw = buildQueryWrapper(bo);
        Page<YqModelVersion> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqModelVersion> queryList(YqModelVersion bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqModelVersion queryById(Long modelVersionId) {
        return baseMapper.selectById(modelVersionId);
    }

    @Override
    public Boolean insertByBo(YqModelVersion bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqModelVersion bo) {
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
    private LambdaQueryWrapper<YqModelVersion> buildQueryWrapper(YqModelVersion bo) {
        LambdaQueryWrapper<YqModelVersion> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getVersionName()), YqModelVersion::getVersionName, bo.getVersionName());
        lqw.like(StringUtils.isNotBlank(bo.getProvider()), YqModelVersion::getProvider, bo.getProvider());
        lqw.like(StringUtils.isNotBlank(bo.getIsActive()), YqModelVersion::getIsActive, bo.getIsActive());
        lqw.eq(ObjectUtil.isNotNull(bo.getModelType()), YqModelVersion::getModelType, bo.getModelType());
        lqw.eq(ObjectUtil.isNotNull(bo.getSampleCount()), YqModelVersion::getSampleCount, bo.getSampleCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getTrainTime()), YqModelVersion::getTrainTime, bo.getTrainTime());
        lqw.orderByDesc(YqModelVersion::getModelVersionId);
        return lqw;
    }
}
