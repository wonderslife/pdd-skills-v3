package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqStatsDaily;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 统计预聚合Service接口
 *
 * @author ruoyi
 */
public interface IYqStatsDailyService {

    /**
     * ⚠ 统计预聚合位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询统计预聚合列表
     */
    PageResult<YqStatsDaily> queryPageList(YqStatsDaily bo, PageQuery pageQuery);

    /**
     * 查询统计预聚合列表（不分页）
     */
    List<YqStatsDaily> queryList(YqStatsDaily bo);

    /**
     * 查询统计预聚合详情
     */
    YqStatsDaily queryById(Long statsId);

}
