package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectAbnormal;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 异常项Service接口
 *
 * @author ruoyi
 */
public interface IInspectAbnormalService {

    /**
     * 分页查询异常项列表
     */
    PageResult<InspectAbnormal> queryPageList(InspectAbnormal bo, PageQuery pageQuery);

    /**
     * 查询异常项列表（不分页）
     */
    List<InspectAbnormal> queryList(InspectAbnormal bo);

    /**
     * 查询异常项详情
     */
    InspectAbnormal queryById(Long abnormalId);

    /**
     * 新增异常项
     */
    Boolean insertByBo(InspectAbnormal bo);

    /**
     * 修改异常项
     */
    Boolean updateByBo(InspectAbnormal bo);

    /**
     * 批量删除异常项
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
