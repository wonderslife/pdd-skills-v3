package org.dromara.yuqing.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 一次调度下发的汇总结果。
 *
 * @author ruoyi
 */
@Data
public class DispatchSummary implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 调度批次号 */
    private String batchNo;

    /** 引擎是否开启 */
    private boolean engineEnabled;

    /** 扫描到的任务数 */
    private int taskCount;

    /** 下发的采集单元数 */
    private int unitCount;

    /** 因参数/配置问题未实际发起采集的单元数（原因见各单元日志） */
    private int skippedCount;

    private int successCount;

    private int partialCount;

    private int failedCount;

    /** 耗时毫秒 */
    private long costMs;

    private LocalDateTime startedAt;

    private LocalDateTime finishedAt;

    /** 可读说明 */
    private String message;

    /** 逐单元明细 */
    private List<CollectResult> details = new ArrayList<>();
}
