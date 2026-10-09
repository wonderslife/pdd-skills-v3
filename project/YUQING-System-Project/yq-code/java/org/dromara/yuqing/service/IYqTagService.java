package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqTag;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 标签Service接口
 *
 * @author ruoyi
 */
public interface IYqTagService {

    /**
     * 分页查询标签列表
     */
    PageResult<YqTag> queryPageList(YqTag bo, PageQuery pageQuery);

    /**
     * 查询标签列表（不分页）
     */
    List<YqTag> queryList(YqTag bo);

    /**
     * 查询标签详情
     */
    YqTag queryById(Long tagId);

    /**
     * 新增标签
     */
    Boolean insertByBo(YqTag bo);

    /**
     * 修改标签
     */
    Boolean updateByBo(YqTag bo);

    /**
     * 批量删除标签
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
