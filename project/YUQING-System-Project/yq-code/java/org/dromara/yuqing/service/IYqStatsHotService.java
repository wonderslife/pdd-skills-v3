package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqStatsHot;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 热点排行Service接口
 *
 * @author ruoyi
 */
public interface IYqStatsHotService {

    /**
     * ⚠ 热点排行位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询热点排行列表
     */
    PageResult<YqStatsHot> queryPageList(YqStatsHot bo, PageQuery pageQuery);

    /**
     * 查询热点排行列表（不分页）
     */
    List<YqStatsHot> queryList(YqStatsHot bo);

    /**
     * 查询热点排行详情
     */
    YqStatsHot queryById(Long hotId);

}
