package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqTag;
import org.dromara.yuqing.mapper.YqTagMapper;
import org.dromara.yuqing.service.IYqTagService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 标签 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqTagServiceImpl implements IYqTagService {

    private final YqTagMapper baseMapper;

    @Override
    public PageResult<YqTag> queryPageList(YqTag bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqTag> lqw = buildQueryWrapper(bo);
        Page<YqTag> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqTag> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqTag> queryList(YqTag bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqTag queryById(Long tagId) {
        YqTag e = baseMapper.selectById(tagId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqTag bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqTag bo) {
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
    private void fillRefNames(List<YqTag> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> parentIdSet = list.stream().map(YqTag::getParentId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!parentIdSet.isEmpty()) {
            Map<Long, String> parentIdNameMap = baseMapper.selectByIds(parentIdSet).stream()
                .collect(Collectors.toMap(YqTag::getTagId, YqTag::getTagName, (a, b) -> a));
            list.forEach(e -> {
                Long refId = e.getParentId();
                e.setParentName(refId != null && refId == 0L ? "顶级" : parentIdNameMap.get(refId));
            });
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqTag> buildQueryWrapper(YqTag bo) {
        LambdaQueryWrapper<YqTag> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getTagName()), YqTag::getTagName, bo.getTagName());
        lqw.eq(ObjectUtil.isNotNull(bo.getParentId()), YqTag::getParentId, bo.getParentId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), YqTag::getOrderNum, bo.getOrderNum());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), YqTag::getStatus, bo.getStatus());
        lqw.orderByDesc(YqTag::getTagId);
        return lqw;
    }
}
