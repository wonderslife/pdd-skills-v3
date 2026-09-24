package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.service.IYqChannelService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 采集渠道 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqChannelServiceImpl implements IYqChannelService {

    private final YqChannelMapper baseMapper;

    @Override
    public PageResult<YqChannel> queryPageList(YqChannel bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqChannel> lqw = buildQueryWrapper(bo);
        Page<YqChannel> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqChannel> queryList(YqChannel bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqChannel queryById(Long channelId) {
        return baseMapper.selectById(channelId);
    }

    @Override
    public Boolean insertByBo(YqChannel bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqChannel bo) {
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
    private LambdaQueryWrapper<YqChannel> buildQueryWrapper(YqChannel bo) {
        LambdaQueryWrapper<YqChannel> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getChannelName()), YqChannel::getChannelName, bo.getChannelName());
        lqw.like(StringUtils.isNotBlank(bo.getChannelDomain()), YqChannel::getChannelDomain, bo.getChannelDomain());
        lqw.like(StringUtils.isNotBlank(bo.getAdapterClass()), YqChannel::getAdapterClass, bo.getAdapterClass());
        lqw.eq(ObjectUtil.isNotNull(bo.getChannelCategory()), YqChannel::getChannelCategory, bo.getChannelCategory());
        lqw.eq(ObjectUtil.isNotNull(bo.getCollectorId()), YqChannel::getCollectorId, bo.getCollectorId());
        lqw.eq(ObjectUtil.isNotNull(bo.getIntervalOverride()), YqChannel::getIntervalOverride, bo.getIntervalOverride());
        lqw.orderByDesc(YqChannel::getChannelId);
        return lqw;
    }
}
