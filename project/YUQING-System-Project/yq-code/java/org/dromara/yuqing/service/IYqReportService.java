package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqReport;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 舆情报告Service接口
 *
 * @author ruoyi
 */
public interface IYqReportService {

    /**
     * 分页查询舆情报告列表
     */
    PageResult<YqReport> queryPageList(YqReport bo, PageQuery pageQuery);

    /**
     * 查询舆情报告列表（不分页）
     */
    List<YqReport> queryList(YqReport bo);

    /**
     * 查询舆情报告详情
     */
    YqReport queryById(Long reportId);

    /**
     * 新增舆情报告
     */
    Boolean insertByBo(YqReport bo);

    /**
     * 修改舆情报告
     */
    Boolean updateByBo(YqReport bo);

    /**
     * 批量删除舆情报告
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
