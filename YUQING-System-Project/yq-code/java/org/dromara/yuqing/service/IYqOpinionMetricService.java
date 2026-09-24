package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqOpinionMetric;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 互动数据快照Service接口
 *
 * @author ruoyi
 */
public interface IYqOpinionMetricService {

    /**
     * ⚠ 互动数据快照位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询互动数据快照列表
     */
    PageResult<YqOpinionMetric> queryPageList(YqOpinionMetric bo, PageQuery pageQuery);

    /**
     * 查询互动数据快照列表（不分页）
     */
    List<YqOpinionMetric> queryList(YqOpinionMetric bo);

    /**
     * 查询互动数据快照详情
     */
    YqOpinionMetric queryById(Long metricId);

}
