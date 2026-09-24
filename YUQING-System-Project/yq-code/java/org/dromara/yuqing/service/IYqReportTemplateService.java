package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqReportTemplate;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 报告模板Service接口
 *
 * @author ruoyi
 */
public interface IYqReportTemplateService {

    /**
     * 分页查询报告模板列表
     */
    PageResult<YqReportTemplate> queryPageList(YqReportTemplate bo, PageQuery pageQuery);

    /**
     * 查询报告模板列表（不分页）
     */
    List<YqReportTemplate> queryList(YqReportTemplate bo);

    /**
     * 查询报告模板详情
     */
    YqReportTemplate queryById(Long templateId);

    /**
     * 新增报告模板
     */
    Boolean insertByBo(YqReportTemplate bo);

    /**
     * 修改报告模板
     */
    Boolean updateByBo(YqReportTemplate bo);

    /**
     * 批量删除报告模板
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
