package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqChannel;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 采集渠道Service接口
 *
 * @author ruoyi
 */
public interface IYqChannelService {

    /**
     * 分页查询采集渠道列表
     */
    PageResult<YqChannel> queryPageList(YqChannel bo, PageQuery pageQuery);

    /**
     * 查询采集渠道列表（不分页）
     */
    List<YqChannel> queryList(YqChannel bo);

    /**
     * 查询采集渠道详情
     */
    YqChannel queryById(Long channelId);

    /**
     * 新增采集渠道
     */
    Boolean insertByBo(YqChannel bo);

    /**
     * 修改采集渠道
     */
    Boolean updateByBo(YqChannel bo);

    /**
     * 批量删除采集渠道
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
