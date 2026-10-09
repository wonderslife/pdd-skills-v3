package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 任务渠道关联Service接口
 *
 * @author ruoyi
 */
public interface IYqTaskChannelService {

    /**
     * 分页查询任务渠道关联列表
     */
    PageResult<YqTaskChannel> queryPageList(YqTaskChannel bo, PageQuery pageQuery);

    /**
     * 查询任务渠道关联列表（不分页）
     */
    List<YqTaskChannel> queryList(YqTaskChannel bo);

    /**
     * 查询任务渠道关联详情
     */
    YqTaskChannel queryById(Long id);

    /**
     * 新增任务渠道关联
     */
    Boolean insertByBo(YqTaskChannel bo);

    /**
     * 修改任务渠道关联
     */
    Boolean updateByBo(YqTaskChannel bo);

    /**
     * 批量删除任务渠道关联
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
