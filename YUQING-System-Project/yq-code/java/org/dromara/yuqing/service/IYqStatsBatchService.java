package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 聚合批次Service接口
 *
 * @author ruoyi
 */
public interface IYqStatsBatchService {

    /**
     * 分页查询聚合批次列表
     */
    PageResult<YqStatsBatch> queryPageList(YqStatsBatch bo, PageQuery pageQuery);

    /**
     * 查询聚合批次列表（不分页）
     */
    List<YqStatsBatch> queryList(YqStatsBatch bo);

    /**
     * 查询聚合批次详情
     */
    YqStatsBatch queryById(Long batchId);

    /**
     * 新增聚合批次
     */
    Boolean insertByBo(YqStatsBatch bo);

    /**
     * 修改聚合批次
     */
    Boolean updateByBo(YqStatsBatch bo);

    /**
     * 批量删除聚合批次
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
