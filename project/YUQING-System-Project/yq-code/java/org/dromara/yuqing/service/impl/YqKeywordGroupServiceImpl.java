package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.yuqing.mapper.YqKeywordGroupMapper;
import org.dromara.yuqing.service.IYqKeywordGroupService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 关键词分组 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqKeywordGroupServiceImpl implements IYqKeywordGroupService {

    private final YqKeywordGroupMapper baseMapper;

    @Override
    public PageResult<YqKeywordGroup> queryPageList(YqKeywordGroup bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqKeywordGroup> lqw = buildQueryWrapper(bo);
        Page<YqKeywordGroup> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqKeywordGroup> queryList(YqKeywordGroup bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqKeywordGroup queryById(Long groupId) {
        return baseMapper.selectById(groupId);
    }

    @Override
    public Boolean insertByBo(YqKeywordGroup bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqKeywordGroup bo) {
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
    private LambdaQueryWrapper<YqKeywordGroup> buildQueryWrapper(YqKeywordGroup bo) {
        LambdaQueryWrapper<YqKeywordGroup> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getGroupName()), YqKeywordGroup::getGroupName, bo.getGroupName());
        lqw.orderByDesc(YqKeywordGroup::getGroupId);
        return lqw;
    }
}
