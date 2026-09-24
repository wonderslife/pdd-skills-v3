package org.dromara.presale.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleOrder;

import java.util.Collection;
import java.util.List;

/**
 * presale-order Service接口
 *
 * @author ruoyi
 */
public interface IPresaleOrderService {

    /**
     * 分页查询presale-order列表
     */
    PageResult<PresaleOrder> queryPageList(PresaleOrder bo, PageQuery pageQuery);

    /**
     * 查询presale-order列表（不分页）
     */
    List<PresaleOrder> queryList(PresaleOrder bo);

    /**
     * 查询presale-order详情
     */
    PresaleOrder queryById(Long id);

    /**
     * 新增presale-order
     */
    Boolean insertByBo(PresaleOrder bo);

    /**
     * 修改presale-order
     */
    Boolean updateByBo(PresaleOrder bo);

    /**
     * 批量删除presale-order
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
