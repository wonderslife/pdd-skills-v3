package org.dromara.inspect.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectRoom;
import org.dromara.inspect.mapper.InspectRoomMapper;
import org.dromara.inspect.service.IInspectRoomService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

/**
 * 机房 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class InspectRoomServiceImpl implements IInspectRoomService {

    private final InspectRoomMapper baseMapper;

    @Override
    public PageResult<InspectRoom> queryPageList(InspectRoom bo, PageQuery pageQuery) {
        LambdaQueryWrapper<InspectRoom> lqw = buildQueryWrapper(bo);
        Page<InspectRoom> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<InspectRoom> queryList(InspectRoom bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public InspectRoom queryById(Long roomId) {
        return baseMapper.selectById(roomId);
    }

    @Override
    public Boolean insertByBo(InspectRoom bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(InspectRoom bo) {
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
     * 构造查询条件
     */
    private LambdaQueryWrapper<InspectRoom> buildQueryWrapper(InspectRoom bo) {
        LambdaQueryWrapper<InspectRoom> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getRoomName()), InspectRoom::getRoomName, bo.getRoomName());
        lqw.like(StringUtils.isNotBlank(bo.getRoomCode()), InspectRoom::getRoomCode, bo.getRoomCode());
        lqw.like(StringUtils.isNotBlank(bo.getManagerName()), InspectRoom::getManagerName, bo.getManagerName());
        lqw.like(StringUtils.isNotBlank(bo.getManagerPhone()), InspectRoom::getManagerPhone, bo.getManagerPhone());
        lqw.eq(ObjectUtil.isNotNull(bo.getStatus()), InspectRoom::getStatus, bo.getStatus());
        lqw.orderByDesc(InspectRoom::getRoomId);
        return lqw;
    }
}
