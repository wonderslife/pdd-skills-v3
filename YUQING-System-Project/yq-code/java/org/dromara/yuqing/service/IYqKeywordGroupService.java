package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 关键词分组Service接口
 *
 * @author ruoyi
 */
public interface IYqKeywordGroupService {

    /**
     * 分页查询关键词分组列表
     */
    PageResult<YqKeywordGroup> queryPageList(YqKeywordGroup bo, PageQuery pageQuery);

    /**
     * 查询关键词分组列表（不分页）
     */
    List<YqKeywordGroup> queryList(YqKeywordGroup bo);

    /**
     * 查询关键词分组详情
     */
    YqKeywordGroup queryById(Long groupId);

    /**
     * 新增关键词分组
     */
    Boolean insertByBo(YqKeywordGroup bo);

    /**
     * 修改关键词分组
     */
    Boolean updateByBo(YqKeywordGroup bo);

    /**
     * 批量删除关键词分组
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
