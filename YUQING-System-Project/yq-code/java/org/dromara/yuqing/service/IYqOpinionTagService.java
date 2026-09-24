package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 舆情标签关联Service接口
 *
 * @author ruoyi
 */
public interface IYqOpinionTagService {

    /**
     * ⚠ 舆情标签关联位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询舆情标签关联列表
     */
    PageResult<YqOpinionTag> queryPageList(YqOpinionTag bo, PageQuery pageQuery);

    /**
     * 查询舆情标签关联列表（不分页）
     */
    List<YqOpinionTag> queryList(YqOpinionTag bo);

    /**
     * 查询舆情标签关联详情
     */
    YqOpinionTag queryById(Long id);

}
