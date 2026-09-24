package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.dromara.yuqing.service.IYqTaskChannelService;
import org.springframework.stereotype.Service;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.mapper.YqChannelMapper;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 任务渠道关联 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqTaskChannelServiceImpl implements IYqTaskChannelService {

    private final YqTaskChannelMapper baseMapper;
    private final YqChannelMapper channelMapper;

    @Override
    public PageResult<YqTaskChannel> queryPageList(YqTaskChannel bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqTaskChannel> lqw = buildQueryWrapper(bo);
        Page<YqTaskChannel> page = baseMapper.selectPage(pageQuery.build(), lqw);
        List<YqTaskChannel> records = page.getRecords();
        fillRefNames(records);
        return PageResult.build(records, page.getTotal());
    }

    @Override
    public List<YqTaskChannel> queryList(YqTaskChannel bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqTaskChannel queryById(Long id) {
        YqTaskChannel e = baseMapper.selectById(id);
        if (e != null) {
            fillRefNames(List.of(e));
        }
        return e;
    }

    @Override
    public Boolean insertByBo(YqTaskChannel bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqTaskChannel bo) {
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
    private void fillRefNames(List<YqTaskChannel> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        Set<Long> channelIdSet = list.stream().map(YqTaskChannel::getChannelId).filter(Objects::nonNull).collect(Collectors.toSet());
        if (!channelIdSet.isEmpty()) {
            Map<Long, String> channelIdNameMap = channelMapper.selectByIds(channelIdSet).stream()
                .collect(Collectors.toMap(YqChannel::getChannelId, YqChannel::getChannelName, (a, b) -> a));
            list.forEach(e -> e.setChannelName(channelIdNameMap.get(e.getChannelId())));
        }
    }

    /**
     * 构造查询条件
     */
    private LambdaQueryWrapper<YqTaskChannel> buildQueryWrapper(YqTaskChannel bo) {
        LambdaQueryWrapper<YqTaskChannel> lqw = new LambdaQueryWrapper<>();
        lqw.eq(ObjectUtil.isNotNull(bo.getTaskId()), YqTaskChannel::getTaskId, bo.getTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelId()), YqTaskChannel::getChannelId, bo.getChannelId());
        lqw.eq(ObjectUtil.isNotNull(bo.getOverrideInterval()), YqTaskChannel::getOverrideInterval, bo.getOverrideInterval());
        lqw.orderByDesc(YqTaskChannel::getId);
        return lqw;
    }
}
