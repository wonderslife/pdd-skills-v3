package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqTask;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 监测任务Service接口
 *
 * @author ruoyi
 */
public interface IYqTaskService {

    /**
     * 分页查询监测任务列表
     */
    PageResult<YqTask> queryPageList(YqTask bo, PageQuery pageQuery);

    /**
     * 查询监测任务列表（不分页）
     */
    List<YqTask> queryList(YqTask bo);

    /**
     * 查询监测任务详情
     */
    YqTask queryById(Long taskId);

    /**
     * 新增监测任务
     */
    Boolean insertByBo(YqTask bo);

    /**
     * 修改监测任务
     */
    Boolean updateByBo(YqTask bo);

    /**
     * 批量删除监测任务
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
