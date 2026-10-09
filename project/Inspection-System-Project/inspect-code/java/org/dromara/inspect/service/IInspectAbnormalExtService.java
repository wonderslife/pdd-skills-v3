package org.dromara.inspect.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.inspect.domain.InspectAbnormal;

import java.util.List;

/**
 * 异常项服务（PRD 模块 12）
 *
 * @author ruoyi
 */
public interface IInspectAbnormalExtService {

    /**
     * 异常项列表（含点位/机房/巡检项名称与说明，支持按状态筛选）
     */
    PageResult<InspectAbnormal> queryPageListWithNames(InspectAbnormal bo, PageQuery pageQuery);

    /**
     * 异常项详情（含关联记录与现场照片 URL）
     */
    InspectAbnormal queryDetail(Long abnormalId);

    /**
     * 标记已处理（PRD：标记已处理 + 处理说明）
     */
    Boolean process(Long abnormalId, String processRemark);

    /**
     * 导出列表
     */
    List<InspectAbnormal> queryExportList(InspectAbnormal bo);

}
