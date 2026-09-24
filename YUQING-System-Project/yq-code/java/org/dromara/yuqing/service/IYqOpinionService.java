package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 舆情明细Service接口
 *
 * @author ruoyi
 */
public interface IYqOpinionService {

    /**
     * ⚠ 舆情明细位于 Apache Doris，本接口只提供只读查询；
     * 写入由采集/研判 Worker 经 Stream Load 完成（见《技术架构说明》§4.6）。
     */

    /**
     * 分页查询舆情明细列表
     */
    PageResult<YqOpinion> queryPageList(YqOpinion bo, PageQuery pageQuery);

    /**
     * 查询舆情明细列表（不分页）
     */
    List<YqOpinion> queryList(YqOpinion bo);

    /**
     * 查询舆情明细详情
     */
    YqOpinion queryById(Long opinionId);

}
