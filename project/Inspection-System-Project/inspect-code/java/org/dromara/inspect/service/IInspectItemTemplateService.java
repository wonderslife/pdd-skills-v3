package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectItemTemplate;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 巡检项模板Service接口
 *
 * @author ruoyi
 */
public interface IInspectItemTemplateService {

    /**
     * 分页查询巡检项模板列表
     */
    PageResult<InspectItemTemplate> queryPageList(InspectItemTemplate bo, PageQuery pageQuery);

    /**
     * 查询巡检项模板列表（不分页）
     */
    List<InspectItemTemplate> queryList(InspectItemTemplate bo);

    /**
     * 查询巡检项模板详情
     */
    InspectItemTemplate queryById(Long templateId);

    /**
     * 新增巡检项模板
     */
    Boolean insertByBo(InspectItemTemplate bo);

    /**
     * 修改巡检项模板
     */
    Boolean updateByBo(InspectItemTemplate bo);

    /**
     * 批量删除巡检项模板
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
