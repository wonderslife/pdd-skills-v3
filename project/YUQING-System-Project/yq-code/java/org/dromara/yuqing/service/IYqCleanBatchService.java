package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqCleanBatch;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 净化批次Service接口
 *
 * @author ruoyi
 */
public interface IYqCleanBatchService {

    /**
     * 分页查询净化批次列表
     */
    PageResult<YqCleanBatch> queryPageList(YqCleanBatch bo, PageQuery pageQuery);

    /**
     * 查询净化批次列表（不分页）
     */
    List<YqCleanBatch> queryList(YqCleanBatch bo);

    /**
     * 查询净化批次详情
     */
    YqCleanBatch queryById(Long batchId);

    /**
     * 新增净化批次
     */
    Boolean insertByBo(YqCleanBatch bo);

    /**
     * 修改净化批次
     */
    Boolean updateByBo(YqCleanBatch bo);

    /**
     * 批量删除净化批次
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
