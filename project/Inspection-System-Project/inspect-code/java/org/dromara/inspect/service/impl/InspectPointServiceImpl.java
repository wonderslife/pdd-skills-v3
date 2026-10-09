package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.mapper.InspectPointMapper;
import org.dromara.inspect.service.IInspectPointService;
import org.springframework.stereotype.Service;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.domain.InspectArea;
import org.dromara.inspect.mapper.InspectAreaMapper;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 点位 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectPointServiceImpl implements IInspectPointService {

    private final InspectPointMapper baseMapper;
    private final InspectRoomMapper roomMapper;
    private final InspectAreaMapper areaMapper;

    @Override
    public PageResult<InspectPoint> queryPageList(InspectPoint bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectPoint> lqw = buildQueryWrapper(bo);
        Page<InspectPoint> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<InspectPoint> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<InspectPoint> queryList(InspectPoint bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectPoint queryById(Long pointId) {
        InspectPoint e = baseMapper.selectById(pointId);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(InspectPoint bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectPoint bo) {
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
    private void fillRefNames(List<InspectPoint> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> roomIdSet = list.stream().map(InspectPoint::getRoomId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!roomIdSet.isEmpty()) {
            Map<Long, String> roomIdNameMap = roomMapper.selectByIds(roomIdSet).stream()
                .collect(Collectors.toMap(InspectRoom::getRoomId, InspectRoom::getRoomName, (a, b) -> a));
            list.forEach(e -> e.setRoomName(roomIdNameMap.get(e.getRoomId())));
        }
        Set<Long> areaIdSet = list.stream().map(InspectPoint::getAreaId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!areaIdSet.isEmpty()) {
            Map<Long, String> areaIdNameMap = areaMapper.selectByIds(areaIdSet).stream()
                .collect(Collectors.toMap(InspectArea::getAreaId, InspectArea::getAreaName, (a, b) -> a));
            list.forEach(e -> e.setAreaName(areaIdNameMap.get(e.getAreaId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectPoint> buildQueryWrapper(InspectPoint bo) {
        LambdaQueryWrapper<InspectPoint> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getPointName()), InspectPoint::getPointName, bo.getPointName());
        lqw.like(StringUtils.isNotBlank(bo.getPointCode()), InspectPoint::getPointCode, bo.getPointCode());
        lqw.like(StringUtils.isNotBlank(bo.getLocation()), InspectPoint::getLocation, bo.getLocation());
        lqw.eq(ObjectUtil.isNotNull(bo.getRoomId()), InspectPoint::getRoomId, bo.getRoomId());
        lqw.eq(ObjectUtil.isNotNull(bo.getAreaId()), InspectPoint::getAreaId, bo.getAreaId());
        lqw.eq(ObjectUtil.isNotNull(bo.getCycleType()), InspectPoint::getCycleType, bo.getCycleType());
        lqw.orderByDesc(InspectPoint::getPointId);
        return lqw;
    }
}
