package org.dromara.inspect.service;

import org.dromara.inspect.domain.vo.StatsPointRankVo;
import org.dromara.inspect.domain.vo.StatsTrendVo;

import java.util.List;

/**
 * 统计报表服务（PRD 模块 11）
 * <p>
 * 说明：这里直接对 insp_record 实时聚合，保证功能先可用；
 * insp_stats_daily 预聚合表由定时任务 StatsAggregateTask 写入，
 * 数据量上升后可把本实现切换到读预聚合表。
 *
 * @author ruoyi
 */
public interface IInspectStatsExtService {

    /**
     * 时间趋势（按日/周/月）
     *
     * @param granularity day/week/month
     * @param beginDate   yyyy-MM-dd
     * @param endDate     yyyy-MM-dd
     * @param roomId      机房ID，可空
     */
    List<StatsTrendVo> trend(String granularity, String beginDate, String endDate, Long roomId);

    /**
     * 点位维度排名（按巡检次数倒序，取前 limit 条）
     */
    List<StatsPointRankVo> pointRank(String beginDate, String endDate, Long roomId, Integer limit);

    /**
     * 未处理异常数（H5/PC 登录弹窗用）
     */
    Long unprocessedAbnormalCount(Long roomId);

}
