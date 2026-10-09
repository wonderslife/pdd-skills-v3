package org.dromara.inspect.service;

import org.dromara.inspect.domain.InspectPhoto;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 巡检照片Service接口
 *
 * @author ruoyi
 */
public interface IInspectPhotoService {

    /**
     * 分页查询巡检照片列表
     */
    PageResult<InspectPhoto> queryPageList(InspectPhoto bo, PageQuery pageQuery);

    /**
     * 查询巡检照片列表（不分页）
     */
    List<InspectPhoto> queryList(InspectPhoto bo);

    /**
     * 查询巡检照片详情
     */
    InspectPhoto queryById(Long photoId);

    /**
     * 新增巡检照片
     */
    Boolean insertByBo(InspectPhoto bo);

    /**
     * 修改巡检照片
     */
    Boolean updateByBo(InspectPhoto bo);

    /**
     * 批量删除巡检照片
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
