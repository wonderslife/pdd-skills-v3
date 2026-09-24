package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqReportOpinion;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 报告舆情关联Service接口
 *
 * @author ruoyi
 */
public interface IYqReportOpinionService {

    /**
     * 分页查询报告舆情关联列表
     */
    PageResult<YqReportOpinion> queryPageList(YqReportOpinion bo, PageQuery pageQuery);

    /**
     * 查询报告舆情关联列表（不分页）
     */
    List<YqReportOpinion> queryList(YqReportOpinion bo);

    /**
     * 查询报告舆情关联详情
     */
    YqReportOpinion queryById(Long id);

    /**
     * 新增报告舆情关联
     */
    Boolean insertByBo(YqReportOpinion bo);

    /**
     * 修改报告舆情关联
     */
    Boolean updateByBo(YqReportOpinion bo);

    /**
     * 批量删除报告舆情关联
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
