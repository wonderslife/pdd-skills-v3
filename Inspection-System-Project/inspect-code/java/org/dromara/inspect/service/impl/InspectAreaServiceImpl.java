package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectArea;
import org.dromara.inspect.mapper.InspectAreaMapper;
import org.dromara.inspect.service.IInspectAreaService;
import org.springframework.stereotype.Service;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.mapper.InspectRoomMapper;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 区域 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectAreaServiceImpl implements IInspectAreaService {

    private final InspectAreaMapper baseMapper;
    private final InspectRoomMapper roomMapper;

    @Override
    public PageResult<InspectArea> queryPageList(InspectArea bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectArea> lqw = buildQueryWrapper(bo);
        Page<InspectArea> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<InspectArea> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<InspectArea> queryList(InspectArea bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectArea queryById(Long areaId) {
        InspectArea e = baseMapper.selectById(areaId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(InspectArea bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectArea bo) {
        return baseMapper.updateById(bo) > 0;
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (Boolean.TRUE.equals(isValid)) {
        // TODO: 删除前业务校验（存在关联数据时拒绝删除）
        }
        return baseMapper.deleteByIds(ids) > 0;
    }

    /**
     * 回填关联名称（列表/详情只返回 ID 会导致前端「所属XX」列空白）
     */
    private void fillRefNames(List<InspectArea> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> roomIdSet = list.stream().map(InspectArea::getRoomId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!roomIdSet.isEmpty()) {
            Map<Long, String> roomIdNameMap = roomMapper.selectByIds(roomIdSet).stream()
                .collect(Collectors.toMap(InspectRoom::getRoomId, InspectRoom::getRoomName, (a, b) -> a));
            list.forEach(e -> e.setRoomName(roomIdNameMap.get(e.getRoomId())));
        }
        Set<Long> parentIdSet = list.stream().map(InspectArea::getParentId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!parentIdSet.isEmpty()) {
            Map<Long, String> parentIdNameMap = baseMapper.selectByIds(parentIdSet).stream()
                .collect(Collectors.toMap(InspectArea::getAreaId, InspectArea::getAreaName, (a, b) -> a));
            list.forEach(e -> {
                Long refId = e.getParentId();
                e.setParentName(refId != null && refId == 0L ? "顶级" : parentIdNameMap.get(refId));
            });
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectArea> buildQueryWrapper(InspectArea bo) {
        LambdaQueryWrapper<InspectArea> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getAreaName()), InspectArea::getAreaName, bo.getAreaName());
        lqw.eq(ObjectUtil.isNotNull(bo.getRoomId()), InspectArea::getRoomId, bo.getRoomId());
        lqw.eq(ObjectUtil.isNotNull(bo.getParentId()), InspectArea::getParentId, bo.getParentId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOrderNum()), InspectArea::getOrderNum, bo.getOrderNum());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), InspectArea::getStatus, bo.getStatus());
        lqw.orderByDesc(InspectArea::getAreaId);
        return lqw;
    }
}
