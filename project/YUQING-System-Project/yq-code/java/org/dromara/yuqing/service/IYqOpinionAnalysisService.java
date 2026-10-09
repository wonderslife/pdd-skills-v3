package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 研判结果Service接口
 *
 * @author ruoyi
 */
public interface IYqOpinionAnalysisService {

    /**
     * ⚠ 研判结果位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询研判结果列表
     */
    PageResult<YqOpinionAnalysis> queryPageList(YqOpinionAnalysis bo, PageQuery pageQuery);

    /**
     * 查询研判结果列表（不分页）
     */
    List<YqOpinionAnalysis> queryList(YqOpinionAnalysis bo);

    /**
     * 查询研判结果详情
     */
    YqOpinionAnalysis queryById(Long analysisId);

}
