package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 关键词Service接口
 *
 * @author ruoyi
 */
public interface IYqKeywordService {

    /**
     * 分页查询关键词列表
     */
    PageResult<YqKeyword> queryPageList(YqKeyword bo, PageQuery pageQuery);

    /**
     * 查询关键词列表（不分页）
     */
    List<YqKeyword> queryList(YqKeyword bo);

    /**
     * 查询关键词详情
     */
    YqKeyword queryById(Long keywordId);

    /**
     * 新增关键词
     */
    Boolean insertByBo(YqKeyword bo);

    /**
     * 修改关键词
     */
    Boolean updateByBo(YqKeyword bo);

    /**
     * 批量删除关键词
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
