package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqWecomCommand;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 企业微信指令Service接口
 *
 * @author ruoyi
 */
public interface IYqWecomCommandService {

    /**
     * 分页查询企业微信指令列表
     */
    PageResult<YqWecomCommand> queryPageList(YqWecomCommand bo, PageQuery pageQuery);

    /**
     * 查询企业微信指令列表（不分页）
     */
    List<YqWecomCommand> queryList(YqWecomCommand bo);

    /**
     * 查询企业微信指令详情
     */
    YqWecomCommand queryById(Long commandId);

    /**
     * 新增企业微信指令
     */
    Boolean insertByBo(YqWecomCommand bo);

    /**
     * 修改企业微信指令
     */
    Boolean updateByBo(YqWecomCommand bo);

    /**
     * 批量删除企业微信指令
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
