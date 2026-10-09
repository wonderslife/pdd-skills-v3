package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectPhoto;
import org.dromara.inspect.mapper.InspectPhotoMapper;
import org.dromara.inspect.service.IInspectPhotoService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 巡检照片 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectPhotoServiceImpl implements IInspectPhotoService {

    private final InspectPhotoMapper baseMapper;

    @Override
    public PageResult<InspectPhoto> queryPageList(InspectPhoto bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectPhoto> lqw = buildQueryWrapper(bo);
        Page<InspectPhoto> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectPhoto> queryList(InspectPhoto bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectPhoto queryById(Long photoId) {
        return baseMapper.selectById(photoId);
    }

    @Override
    public Boolean insertByBo(InspectPhoto bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectPhoto bo) {
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
    private LambdaQueryWrapper<InspectPhoto> buildQueryWrapper(InspectPhoto bo) {
        LambdaQueryWrapper<InspectPhoto> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getRecordId()), InspectPhoto::getRecordId, bo.getRecordId());
        lqw.eq(ObjectUtil.isNotNull(bo.getRecordItemId()), InspectPhoto::getRecordItemId, bo.getRecordItemId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOriginalSize()), InspectPhoto::getOriginalSize, bo.getOriginalSize());
        lqw.eq(ObjectUtil.isNotNull(bo.getCompressedSize()), InspectPhoto::getCompressedSize, bo.getCompressedSize());
        lqw.orderByDesc(InspectPhoto::getPhotoId);
        return lqw;
    }
}
