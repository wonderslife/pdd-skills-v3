package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectItemTemplateDetail;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 模板明细Service接口
 *
 * @author ruoyi
 */
public interface IInspectItemTemplateDetailService {

    /**
     * 分页查询模板明细列表
     */
    PageResult<InspectItemTemplateDetail> queryPageList(InspectItemTemplateDetail bo, PageQuery pageQuery);

    /**
     * 查询模板明细列表（不分页）
     */
    List<InspectItemTemplateDetail> queryList(InspectItemTemplateDetail bo);

    /**
     * 查询模板明细详情
     */
    InspectItemTemplateDetail queryById(Long detailId);

    /**
     * 新增模板明细
     */
    Boolean insertByBo(InspectItemTemplateDetail bo);

    /**
     * 修改模板明细
     */
    Boolean updateByBo(InspectItemTemplateDetail bo);

    /**
     * 批量删除模板明细
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
