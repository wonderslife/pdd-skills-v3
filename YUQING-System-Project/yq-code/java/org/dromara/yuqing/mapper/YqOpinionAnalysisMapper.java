package org.dromara.yuqing.mapper;

import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.yuqing.domain.YqOpinionAnalysis;

/**
 * ⚠ 本表位于 Apache Doris 数据源，查询经 @DS("doris") 路由。
 * 未接入 Doris 前如需本地跑通，请把 yq_datasource.yml 里的 doris 源指向主库，
 * 或在 ServiceImpl 上临时改为 @DS("master")。
 */
/**
 * 研判结果Mapper接口
 *
 * @author ruoyi
 */
public interface YqOpinionAnalysisMapper extends BaseMapperPlus<YqOpinionAnalysis, YqOpinionAnalysis> {
}
