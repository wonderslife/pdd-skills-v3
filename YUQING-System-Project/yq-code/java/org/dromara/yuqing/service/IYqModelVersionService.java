package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqModelVersion;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 模型版本Service接口
 *
 * @author ruoyi
 */
public interface IYqModelVersionService {

    /**
     * 分页查询模型版本列表
     */
    PageResult<YqModelVersion> queryPageList(YqModelVersion bo, PageQuery pageQuery);

    /**
     * 查询模型版本列表（不分页）
     */
    List<YqModelVersion> queryList(YqModelVersion bo);

    /**
     * 查询模型版本详情
     */
    YqModelVersion queryById(Long modelVersionId);

    /**
     * 新增模型版本
     */
    Boolean insertByBo(YqModelVersion bo);

    /**
     * 修改模型版本
     */
    Boolean updateByBo(YqModelVersion bo);

    /**
     * 批量删除模型版本
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
