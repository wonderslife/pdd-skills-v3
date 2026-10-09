package org.dromara.yuqing.service;

import org.dromara.yuqing.domain.YqTrainSample;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.core.domain.PageResult;

import java.util.Collection;
import java.util.List;

/**
 * 训练样本Service接口
 *
 * @author ruoyi
 */
public interface IYqTrainSampleService {

    /**
     * 分页查询训练样本列表
     */
    PageResult<YqTrainSample> queryPageList(YqTrainSample bo, PageQuery pageQuery);

    /**
     * 查询训练样本列表（不分页）
     */
    List<YqTrainSample> queryList(YqTrainSample bo);

    /**
     * 查询训练样本详情
     */
    YqTrainSample queryById(Long sampleId);

    /**
     * 新增训练样本
     */
    Boolean insertByBo(YqTrainSample bo);

    /**
     * 修改训练样本
     */
    Boolean updateByBo(YqTrainSample bo);

    /**
     * 批量删除训练样本
     */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
