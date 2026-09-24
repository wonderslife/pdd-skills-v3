package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqReportSection;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 报告模板章节Service接口
 *
 * @author ruoyi
 */
public interface IYqReportSectionService {

    /**
     * 分页查询报告模板章节列表
     */
    PageResult<YqReportSection> queryPageList(YqReportSection bo, PageQuery pageQuery);

    /**
     * 查询报告模板章节列表（不分页）
     */
    List<YqReportSection> queryList(YqReportSection bo);

    /**
     * 查询报告模板章节详情
     */
    YqReportSection queryById(Long sectionId);

    /**
     * 新增报告模板章节
     */
    Boolean insertByBo(YqReportSection bo);

    /**
     * 修改报告模板章节
     */
    Boolean updateByBo(YqReportSection bo);

    /**
     * 批量删除报告模板章节
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
