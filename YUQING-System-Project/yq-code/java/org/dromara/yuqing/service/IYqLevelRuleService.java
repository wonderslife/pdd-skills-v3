package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqLevelRule;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 研判分级规则Service接口
 *
 * @author ruoyi
 */
public interface IYqLevelRuleService {

    /**
     * 分页查询研判分级规则列表
     */
    PageResult<YqLevelRule> queryPageList(YqLevelRule bo, PageQuery pageQuery);

    /**
     * 查询研判分级规则列表（不分页）
     */
    List<YqLevelRule> queryList(YqLevelRule bo);

    /**
     * 查询研判分级规则详情
     */
    YqLevelRule queryById(Long ruleId);

    /**
     * 新增研判分级规则
     */
    Boolean insertByBo(YqLevelRule bo);

    /**
     * 修改研判分级规则
     */
    Boolean updateByBo(YqLevelRule bo);

    /**
     * 批量删除研判分级规则
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
