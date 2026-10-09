package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqKnowledge;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 知识库案例Service接口
 *
 * @author ruoyi
 */
public interface IYqKnowledgeService {

    /**
     * 分页查询知识库案例列表
     */
    PageResult<YqKnowledge> queryPageList(YqKnowledge bo, PageQuery pageQuery);

    /**
     * 查询知识库案例列表（不分页）
     */
    List<YqKnowledge> queryList(YqKnowledge bo);

    /**
     * 查询知识库案例详情
     */
    YqKnowledge queryById(Long knowledgeId);

    /**
     * 新增知识库案例
     */
    Boolean insertByBo(YqKnowledge bo);

    /**
     * 修改知识库案例
     */
    Boolean updateByBo(YqKnowledge bo);

    /**
     * 批量删除知识库案例
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
