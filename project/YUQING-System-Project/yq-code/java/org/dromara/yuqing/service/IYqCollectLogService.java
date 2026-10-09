package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqCollectLog;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 采集日志Service接口
 *
 * @author ruoyi
 */
public interface IYqCollectLogService {

    /**
     * ⚠ 采集日志位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询采集日志列表
     */
    PageResult<YqCollectLog> queryPageList(YqCollectLog bo, PageQuery pageQuery);

    /**
     * 查询采集日志列表（不分页）
     */
    List<YqCollectLog> queryList(YqCollectLog bo);

    /**
     * 查询采集日志详情
     */
    YqCollectLog queryById(Long logId);

}
