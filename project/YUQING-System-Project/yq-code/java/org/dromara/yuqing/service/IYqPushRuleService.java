package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 推送规则Service接口
 *
 * @author ruoyi
 */
public interface IYqPushRuleService {

    /**
     * 分页查询推送规则列表
     */
    PageResult<YqPushRule> queryPageList(YqPushRule bo, PageQuery pageQuery);

    /**
     * 查询推送规则列表（不分页）
     */
    List<YqPushRule> queryList(YqPushRule bo);

    /**
     * 查询推送规则详情
     */
    YqPushRule queryById(Long ruleId);

    /**
     * 新增推送规则
     */
    Boolean insertByBo(YqPushRule bo);

    /**
     * 修改推送规则
     */
    Boolean updateByBo(YqPushRule bo);

    /**
     * 批量删除推送规则
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
