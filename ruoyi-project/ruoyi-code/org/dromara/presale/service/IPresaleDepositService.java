package org.dromara.presale.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.presale.domain.PresaleDeposit;

import java.util.Collection;
import java.util.List;

/**
 * presale-deposit Service接口
 *
 * @author ruoyi
 */
public interface IPresaleDepositService {

    /**
     * 分页查询presale-deposit列表
     */
    PageResult<PresaleDeposit> queryPageList(PresaleDeposit bo, PageQuery pageQuery);

    /**
     * 查询presale-deposit列表（不分页）
     */
    List<PresaleDeposit> queryList(PresaleDeposit bo);

    /**
     * 查询presale-deposit详情
     */
    PresaleDeposit queryById(Long id);

    /**
     * 新增presale-deposit
     */
    Boolean insertByBo(PresaleDeposit bo);

    /**
     * 修改presale-deposit
     */
    Boolean updateByBo(PresaleDeposit bo);

    /**
     * 批量删除presale-deposit
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
