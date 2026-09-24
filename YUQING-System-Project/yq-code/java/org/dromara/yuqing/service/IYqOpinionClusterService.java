package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 事件聚合Service接口
 *
 * @author ruoyi
 */
public interface IYqOpinionClusterService {

    /**
     * ⚠ 事件聚合位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询事件聚合列表
     */
    PageResult<YqOpinionCluster> queryPageList(YqOpinionCluster bo, PageQuery pageQuery);

    /**
     * 查询事件聚合列表（不分页）
     */
    List<YqOpinionCluster> queryList(YqOpinionCluster bo);

    /**
     * 查询事件聚合详情
     */
    YqOpinionCluster queryById(Long clusterId);

}
