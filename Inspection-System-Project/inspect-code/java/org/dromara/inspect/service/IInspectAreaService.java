package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectArea;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 区域Service接口
 *
 * @author ruoyi
 */
public interface IInspectAreaService {

    /**
     * 分页查询区域列表
     */
    PageResult<InspectArea> queryPageList(InspectArea bo, PageQuery pageQuery);

    /**
     * 查询区域列表（不分页）
     */
    List<InspectArea> queryList(InspectArea bo);

    /**
     * 查询区域详情
     */
    InspectArea queryById(Long areaId);

    /**
     * 新增区域
     */
    Boolean insertByBo(InspectArea bo);

    /**
     * 修改区域
     */
    Boolean updateByBo(InspectArea bo);

    /**
     * 批量删除区域
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
