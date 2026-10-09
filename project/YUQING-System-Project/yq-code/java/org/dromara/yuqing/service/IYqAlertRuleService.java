package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 预警规则Service接口
 *
 * @author ruoyi
 */
public interface IYqAlertRuleService {

    /**
     * 分页查询预警规则列表
     */
    PageResult<YqAlertRule> queryPageList(YqAlertRule bo, PageQuery pageQuery);

    /**
     * 查询预警规则列表（不分页）
     */
    List<YqAlertRule> queryList(YqAlertRule bo);

    /**
     * 查询预警规则详情
     */
    YqAlertRule queryById(Long ruleId);

    /**
     * 新增预警规则
     */
    Boolean insertByBo(YqAlertRule bo);

    /**
     * 修改预警规则
     */
    Boolean updateByBo(YqAlertRule bo);

    /**
     * 批量删除预警规则
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
