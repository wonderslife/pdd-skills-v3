package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.utils.StringUtils;
import cn.hutool.core.util.ObjectUtil;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.mapper.YqLedgerExportLogMapper;
import org.dromara.yuqing.service.IYqLedgerExportLogService;
import org.springframework.stereotype.Service;
import java.util.Collection;
import java.util.List;

/**
 * 台账导出记录 Service业务层处理
 *
 * @author ruoyi
 */
@Service
@RequiredArgsConstructor
public class YqLedgerExportLogServiceImpl implements IYqLedgerExportLogService {

    private final YqLedgerExportLogMapper baseMapper;

    @Override
    public PageResult<YqLedgerExportLog> queryPageList(YqLedgerExportLog bo, PageQuery pageQuery) {
        LambdaQueryWrapper<YqLedgerExportLog> lqw = buildQueryWrapper(bo);
        Page<YqLedgerExportLog> page = baseMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    @Override
    public List<YqLedgerExportLog> queryList(YqLedgerExportLog bo) {
        return baseMapper.selectList(buildQueryWrapper(bo));
    }

    @Override
    public YqLedgerExportLog queryById(Long exportId) {
        return baseMapper.selectById(exportId);
    }

    @Override
    public Boolean insertByBo(YqLedgerExportLog bo) {
        return baseMapper.insert(bo) > 0;
    }

    @Override
    public Boolean updateByBo(YqLedgerExportLog bo) {
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
    private LambdaQueryWrapper<YqLedgerExportLog> buildQueryWrapper(YqLedgerExportLog bo) {
        LambdaQueryWrapper<YqLedgerExportLog> lqw = new LambdaQueryWrapper<>();
        lqw.like(StringUtils.isNotBlank(bo.getExportScope()), YqLedgerExportLog::getExportScope, bo.getExportScope());
        lqw.like(StringUtils.isNotBlank(bo.getQuerySummary()), YqLedgerExportLog::getQuerySummary, bo.getQuerySummary());
        lqw.like(StringUtils.isNotBlank(bo.getQueryJson()), YqLedgerExportLog::getQueryJson, bo.getQueryJson());
        lqw.like(StringUtils.isNotBlank(bo.getColumnsJson()), YqLedgerExportLog::getColumnsJson, bo.getColumnsJson());
        lqw.eq(ObjectUtil.isNotNull(bo.getRowCount()), YqLedgerExportLog::getRowCount, bo.getRowCount());
        lqw.eq(ObjectUtil.isNotNull(bo.getColumnCount()), YqLedgerExportLog::getColumnCount, bo.getColumnCount());
        lqw.orderByDesc(YqLedgerExportLog::getExportId);
        return lqw;
    }
}
