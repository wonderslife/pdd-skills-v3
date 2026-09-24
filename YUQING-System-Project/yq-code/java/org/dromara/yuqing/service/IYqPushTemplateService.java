package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqPushTemplate;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 推送模板Service接口
 *
 * @author ruoyi
 */
public interface IYqPushTemplateService {

    /**
     * 分页查询推送模板列表
     */
    PageResult<YqPushTemplate> queryPageList(YqPushTemplate bo, PageQuery pageQuery);

    /**
     * 查询推送模板列表（不分页）
     */
    List<YqPushTemplate> queryList(YqPushTemplate bo);

    /**
     * 查询推送模板详情
     */
    YqPushTemplate queryById(Long templateId);

    /**
     * 新增推送模板
     */
    Boolean insertByBo(YqPushTemplate bo);

    /**
     * 修改推送模板
     */
    Boolean updateByBo(YqPushTemplate bo);

    /**
     * 批量删除推送模板
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
