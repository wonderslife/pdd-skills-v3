package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectRoom;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 机房Service接口
 *
 * @author ruoyi
 */
public interface IInspectRoomService {

    /**
     * 分页查询机房列表
     */
    PageResult<InspectRoom> queryPageList(InspectRoom bo, PageQuery pageQuery);

    /**
     * 查询机房列表（不分页）
     */
    List<InspectRoom> queryList(InspectRoom bo);

    /**
     * 查询机房详情
     */
    InspectRoom queryById(Long roomId);

    /**
     * 新增机房
     */
    Boolean insertByBo(InspectRoom bo);

    /**
     * 修改机房
     */
    Boolean updateByBo(InspectRoom bo);

    /**
     * 批量删除机房
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
