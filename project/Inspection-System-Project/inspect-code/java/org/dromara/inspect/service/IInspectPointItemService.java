package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectPointItem;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 点位巡检项Service接口
 *
 * @author ruoyi
 */
public interface IInspectPointItemService {

    /**
     * 分页查询点位巡检项列表
     */
    PageResult<InspectPointItem> queryPageList(InspectPointItem bo, PageQuery pageQuery);

    /**
     * 查询点位巡检项列表（不分页）
     */
    List<InspectPointItem> queryList(InspectPointItem bo);

    /**
     * 查询点位巡检项详情
     */
    InspectPointItem queryById(Long itemId);

    /**
     * 新增点位巡检项
     */
    Boolean insertByBo(InspectPointItem bo);

    /**
     * 修改点位巡检项
     */
    Boolean updateByBo(InspectPointItem bo);

    /**
     * 批量删除点位巡检项
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
