package org.dromara.presale.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleGoods;

import java.util.Collection;
import java.util.List;

/**
 * presale-goods Service接口
 *
 * @author ruoyi
 */
public interface IPresaleGoodsService {

    /**
     * 分页查询presale-goods列表
     */
    PageResult<PresaleGoods> queryPageList(PresaleGoods bo, PageQuery pageQuery);

    /**
     * 查询presale-goods列表（不分页）
     */
    List<PresaleGoods> queryList(PresaleGoods bo);

    /**
     * 查询presale-goods详情
     */
    PresaleGoods queryById(Long id);

    /**
     * 新增presale-goods
     */
    Boolean insertByBo(PresaleGoods bo);

    /**
     * 修改presale-goods
     */
    Boolean updateByBo(PresaleGoods bo);

    /**
     * 批量删除presale-goods
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
