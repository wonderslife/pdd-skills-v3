package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 任务关键词关联Service接口
 *
 * @author ruoyi
 */
public interface IYqTaskKeywordService {

    /**
     * 分页查询任务关键词关联列表
     */
    PageResult<YqTaskKeyword> queryPageList(YqTaskKeyword bo, PageQuery pageQuery);

    /**
     * 查询任务关键词关联列表（不分页）
     */
    List<YqTaskKeyword> queryList(YqTaskKeyword bo);

    /**
     * 查询任务关键词关联详情
     */
    YqTaskKeyword queryById(Long id);

    /**
     * 新增任务关键词关联
     */
    Boolean insertByBo(YqTaskKeyword bo);

    /**
     * 修改任务关键词关联
     */
    Boolean updateByBo(YqTaskKeyword bo);

    /**
     * 批量删除任务关键词关联
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
