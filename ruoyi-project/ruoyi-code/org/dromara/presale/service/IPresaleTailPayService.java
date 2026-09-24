package org.dromara.presale.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleTailPay;

import java.util.Collection;
import java.util.List;

/**
 * presale-tail-pay Service接口
 *
 * @author ruoyi
 */
public interface IPresaleTailPayService {

    /**
     * 分页查询presale-tail-pay列表
     */
    PageResult<PresaleTailPay> queryPageList(PresaleTailPay bo, PageQuery pageQuery);

    /**
     * 查询presale-tail-pay列表（不分页）
     */
    List<PresaleTailPay> queryList(PresaleTailPay bo);

    /**
     * 查询presale-tail-pay详情
     */
    PresaleTailPay queryById(Long id);

    /**
     * 新增presale-tail-pay
     */
    Boolean insertByBo(PresaleTailPay bo);

    /**
     * 修改presale-tail-pay
     */
    Boolean updateByBo(PresaleTailPay bo);

    /**
     * 批量删除presale-tail-pay
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
