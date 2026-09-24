package org.dromara.yuqing.service;

import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;

/**
 * 历史数据净化重跑（F-006 验收标准 9）。
 *
 * <p>规则改了以后，之前已入库的数据不会自动跟着变——必须能按新规则重扫一遍。
 * preview 只算影响条数不改数据，execute 才真正落库并留一条批次记录。</p>
 *
 * @author ruoyi
 */
public interface IYqCleanReplayService {

    /**
     * 预览：只统计影响条数，不写任何业务数据。
     *
     * @param scope 重跑范围
     * @return 统计结果
     */
    CleanBatchStats preview(CleanBatchScope scope);

    /**
     * 执行：真正改写净化状态，并落一条批次记录。
     *
     * @param scope 重跑范围
     * @return 统计结果（含批次ID）
     */
    CleanBatchStats execute(CleanBatchScope scope);
}
