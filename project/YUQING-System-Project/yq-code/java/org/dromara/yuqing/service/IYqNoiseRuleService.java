package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 降噪规则Service接口
 *
 * @author ruoyi
 */
public interface IYqNoiseRuleService {

    /**
     * 分页查询降噪规则列表
     */
    PageResult<YqNoiseRule> queryPageList(YqNoiseRule bo, PageQuery pageQuery);

    /**
     * 查询降噪规则列表（不分页）
     */
    List<YqNoiseRule> queryList(YqNoiseRule bo);

    /**
     * 查询降噪规则详情
     */
    YqNoiseRule queryById(Long ruleId);

    /**
     * 新增降噪规则
     */
    Boolean insertByBo(YqNoiseRule bo);

    /**
     * 修改降噪规则
     */
    Boolean updateByBo(YqNoiseRule bo);

    /**
     * 批量删除降噪规则
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
