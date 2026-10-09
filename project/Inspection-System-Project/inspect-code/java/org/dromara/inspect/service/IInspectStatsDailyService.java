package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectStatsDaily;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 统计预聚合Service接口
 *
 * @author ruoyi
 */
public interface IInspectStatsDailyService {

    /**
     * 分页查询统计预聚合列表
     */
    PageResult<InspectStatsDaily> queryPageList(InspectStatsDaily bo, PageQuery pageQuery);

    /**
     * 查询统计预聚合列表（不分页）
     */
    List<InspectStatsDaily> queryList(InspectStatsDaily bo);

    /**
     * 查询统计预聚合详情
     */
    InspectStatsDaily queryById(Long statsId);

    /**
     * 新增统计预聚合
     */
    Boolean insertByBo(InspectStatsDaily bo);

    /**
     * 修改统计预聚合
     */
    Boolean updateByBo(InspectStatsDaily bo);

    /**
     * 批量删除统计预聚合
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
