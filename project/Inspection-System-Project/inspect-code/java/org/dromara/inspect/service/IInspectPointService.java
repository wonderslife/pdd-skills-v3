package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectPoint;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 点位Service接口
 *
 * @author ruoyi
 */
public interface IInspectPointService {

    /**
     * 分页查询点位列表
     */
    PageResult<InspectPoint> queryPageList(InspectPoint bo, PageQuery pageQuery);

    /**
     * 查询点位列表（不分页）
     */
    List<InspectPoint> queryList(InspectPoint bo);

    /**
     * 查询点位详情
     */
    InspectPoint queryById(Long pointId);

    /**
     * 新增点位
     */
    Boolean insertByBo(InspectPoint bo);

    /**
     * 修改点位
     */
    Boolean updateByBo(InspectPoint bo);

    /**
     * 批量删除点位
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
