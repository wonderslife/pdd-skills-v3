package org.dromara.yuqing.alert;

import java.time.LocalDateTime;

/**
 * 窗口计数来源
 *
 * <p>抽成接口是为了让突发增量判定可以离线单测——测试注入内存实现，
 * 生产注入基于 {@code yq_opinion} 的 JDBC 实现。</p>
 *
 * @author ruoyi
 */
public interface AlertCountSource {

    /**
     * 统计 [from, to) 区间内的舆情条数
     *
     * @param taskId    任务过滤，为空表示不过滤
     * @param channelId 渠道过滤，为空表示不过滤
     * @param sentiAttr 舆情属性过滤（positive/neutral/negative），为空表示不过滤
     * @param from      起始（含）
     * @param to        结束（不含）
     * @return 条数
     */
    long count(Long taskId, Long channelId, String sentiAttr, LocalDateTime from, LocalDateTime to);
}
