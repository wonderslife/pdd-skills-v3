package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqPushRecord;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 推送记录Service接口
 *
 * @author ruoyi
 */
public interface IYqPushRecordService {

    /**
     * 分页查询推送记录列表
     */
    PageResult<YqPushRecord> queryPageList(YqPushRecord bo, PageQuery pageQuery);

    /**
     * 查询推送记录列表（不分页）
     */
    List<YqPushRecord> queryList(YqPushRecord bo);

    /**
     * 查询推送记录详情
     */
    YqPushRecord queryById(Long recordId);

    /**
     * 新增推送记录
     */
    Boolean insertByBo(YqPushRecord bo);

    /**
     * 修改推送记录
     */
    Boolean updateByBo(YqPushRecord bo);

    /**
     * 批量删除推送记录
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
