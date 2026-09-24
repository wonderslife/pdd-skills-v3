package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectRecordItem;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 巡检项结果Service接口
 *
 * @author ruoyi
 */
public interface IInspectRecordItemService {

    /**
     * 分页查询巡检项结果列表
     */
    PageResult<InspectRecordItem> queryPageList(InspectRecordItem bo, PageQuery pageQuery);

    /**
     * 查询巡检项结果列表（不分页）
     */
    List<InspectRecordItem> queryList(InspectRecordItem bo);

    /**
     * 查询巡检项结果详情
     */
    InspectRecordItem queryById(Long recordItemId);

    /**
     * 新增巡检项结果
     */
    Boolean insertByBo(InspectRecordItem bo);

    /**
     * 修改巡检项结果
     */
    Boolean updateByBo(InspectRecordItem bo);

    /**
     * 批量删除巡检项结果
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
