package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 台账导出记录Service接口
 *
 * @author ruoyi
 */
public interface IYqLedgerExportLogService {

    /**
     * 分页查询台账导出记录列表
     */
    PageResult<YqLedgerExportLog> queryPageList(YqLedgerExportLog bo, PageQuery pageQuery);

    /**
     * 查询台账导出记录列表（不分页）
     */
    List<YqLedgerExportLog> queryList(YqLedgerExportLog bo);

    /**
     * 查询台账导出记录详情
     */
    YqLedgerExportLog queryById(Long exportId);

    /**
     * 新增台账导出记录
     */
    Boolean insertByBo(YqLedgerExportLog bo);

    /**
     * 修改台账导出记录
     */
    Boolean updateByBo(YqLedgerExportLog bo);

    /**
     * 批量删除台账导出记录
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
