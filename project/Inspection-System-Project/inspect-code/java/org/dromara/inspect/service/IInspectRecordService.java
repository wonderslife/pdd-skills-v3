package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectRecord;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 巡检记录Service接口
 *
 * @author ruoyi
 */
public interface IInspectRecordService {

    /**
     * 分页查询巡检记录列表
     */
    PageResult<InspectRecord> queryPageList(InspectRecord bo, PageQuery pageQuery);

    /**
     * 查询巡检记录列表（不分页）
     */
    List<InspectRecord> queryList(InspectRecord bo);

    /**
     * 查询巡检记录详情
     */
    InspectRecord queryById(Long recordId);

    /**
     * 新增巡检记录
     */
    Boolean insertByBo(InspectRecord bo);

    /**
     * 修改巡检记录
     */
    Boolean updateByBo(InspectRecord bo);

    /**
     * 批量删除巡检记录
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
