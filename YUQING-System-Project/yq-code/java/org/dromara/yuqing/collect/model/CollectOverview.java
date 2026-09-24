package org.dromara.yuqing.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 采集运行概览（F-004 验收标准 8）。
 *
 * @author ruoyi
 */
@Data
public class CollectOverview implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 引擎是否开启 */
    private boolean engineEnabled;

    /** 落库模式 */
    private String sinkMode;

    /** 去重模式 */
    private String dedupMode;

    /** 累计采集条数 */
    private long totalFetched;

    /** 当日采集条数 */
    private long todayFetched;

    /** 当日入库条数 */
    private long todayInserted;

    /** 当日去重剔除条数 */
    private long todayDup;

    /** 当日失败条数 */
    private long todayFailed;

    /** 当日批次总数 */
    private long todayBatches;

    /** 启用中的任务数 */
    private long enabledTasks;

    /** 启用中的渠道数 */
    private long enabledChannels;

    /** 已配置的站点适配器数 */
    private int adapterCount;

    /** 各任务最近执行状态 */
    private List<TaskRunState> taskStates = new ArrayList<>();

    /** 连续异常（零采集 / 全失败达到阈值）的采集单元 */
    private List<String> unhealthyUnits = new ArrayList<>();

    /** 服务端时间 */
    private LocalDateTime serverTime;

    /**
     * 单任务最近执行状态。
     */
    @Data
    public static class TaskRunState implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private Long taskId;

        private String taskName;

        /** 最近一次调度时间 */
        private LocalDateTime lastScheduleTime;

        /** 最近执行结果 */
        private String lastResultStatus;

        /** 连续异常次数 */
        private int consecutiveAbnormal;

        /** 是否异常 */
        private boolean abnormal;
    }
}
