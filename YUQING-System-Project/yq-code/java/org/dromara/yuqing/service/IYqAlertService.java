package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqAlert;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 预警记录Service接口
 *
 * @author ruoyi
 */
public interface IYqAlertService {

    /**
     * 分页查询预警记录列表
     */
    PageResult<YqAlert> queryPageList(YqAlert bo, PageQuery pageQuery);

    /**
     * 查询预警记录列表（不分页）
     */
    List<YqAlert> queryList(YqAlert bo);

    /**
     * 查询预警记录详情
     */
    YqAlert queryById(Long alertId);

    /**
     * 新增预警记录
     */
    Boolean insertByBo(YqAlert bo);

    /**
     * 修改预警记录
     */
    Boolean updateByBo(YqAlert bo);

    /**
     * 批量删除预警记录
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
