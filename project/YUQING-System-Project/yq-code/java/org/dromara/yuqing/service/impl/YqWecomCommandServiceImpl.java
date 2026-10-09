package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqWecomCommand;
import org.dromara.yuqing.mapper.YqWecomCommandMapper;
import org.dromara.yuqing.service.IYqWecomCommandService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 企业微信指令 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqWecomCommandServiceImpl implements IYqWecomCommandService {

    private final YqWecomCommandMapper baseMapper;

    @Override
    public PageResult<YqWecomCommand> queryPageList(YqWecomCommand bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqWecomCommand> lqw = buildQueryWrapper(bo);
        Page<YqWecomCommand> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqWecomCommand> queryList(YqWecomCommand bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqWecomCommand queryById(Long commandId) {
        return baseMapper.selectById(commandId);
    }

    @Override
    public Boolean insertByBo(YqWecomCommand bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqWecomCommand bo) {
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
    private LambdaQueryWrapper<YqWecomCommand> buildQueryWrapper(YqWecomCommand bo) {
        LambdaQueryWrapper<YqWecomCommand> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getWecomUserId()), YqWecomCommand::getWecomUserId, bo.getWecomUserId());
        lqw.like(StringUtils.isNotBlank(bo.getParsedParams()), YqWecomCommand::getParsedParams, bo.getParsedParams());
        lqw.eq(ObjectUtil.isNotNull(bo.getUserId()), YqWecomCommand::getUserId, bo.getUserId());
        lqw.eq(ObjectUtil.isNotNull(bo.getCommandType()), YqWecomCommand::getCommandType, bo.getCommandType());
        lqw.eq(ObjectUtil.isNotNull(bo.getRefTaskId()), YqWecomCommand::getRefTaskId, bo.getRefTaskId());
        lqw.eq(ObjectUtil.isNotNull(bo.getRefReportId()), YqWecomCommand::getRefReportId, bo.getRefReportId());
        lqw.orderByDesc(YqWecomCommand::getCommandId);
        return lqw;
    }
}
