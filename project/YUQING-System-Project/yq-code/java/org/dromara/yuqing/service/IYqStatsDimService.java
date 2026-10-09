package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqStatsDim;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 维度分布Service接口
 *
 * @author ruoyi
 */
public interface IYqStatsDimService {

    /**
     * ⚠ 维度分布位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询维度分布列表
     */
    PageResult<YqStatsDim> queryPageList(YqStatsDim bo, PageQuery pageQuery);

    /**
     * 查询维度分布列表（不分页）
     */
    List<YqStatsDim> queryList(YqStatsDim bo);

    /**
     * 查询维度分布详情
     */
    YqStatsDim queryById(Long dimId);

}
