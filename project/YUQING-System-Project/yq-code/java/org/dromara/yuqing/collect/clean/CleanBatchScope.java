package org.dromara.yuqing.collect.clean;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDate;

/**
 * 净化重跑范围（F-006 验收标准 9 的「影响条数预览」入参）。
 *
 * @author ruoyi
 */
@Data
public class CleanBatchScope implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 单次重跑最多跨越的天数（保护性上限，防止误填十年范围把库扫穿） */
    public static final int MAX_SPAN_DAYS = 366;

    /** 批次名称（可空，为空时由服务端生成） */
    private String batchName;

    /** 重跑类型：incremental / condition_replay / full_replay */
    private String batchType = "condition_replay";

    /** 范围-任务ID（为空表示不限任务） */
    private Long scopeTaskId;

    /** 范围-渠道ID（为空表示不限渠道） */
    private Long scopeChannelId;

    /** 范围-起始采集日 */
    private LocalDate scopeStartDate;

    /** 范围-截止采集日 */
    private LocalDate scopeEndDate;

    /** true = 只预览不落库 */
    private boolean previewOnly = true;

    /**
     * 参数校验：范围必须闭合、跨度受限、全量重跑必须显式声明。
     *
     * <p>「不限任务 + 不限渠道 + 不限日期」等价于全表重扫，一律拒绝——
     * 这类操作在百万级事实表上会直接把数据库拖垮。</p>
     */
    public void assertValid() {
        if (scopeStartDate == null || scopeEndDate == null) {
            throw new IllegalArgumentException("必须指定采集日范围（scopeStartDate / scopeEndDate）");
        }
        if (scopeEndDate.isBefore(scopeStartDate)) {
            throw new IllegalArgumentException("截止采集日不能早于起始采集日");
        }
        long span = java.time.temporal.ChronoUnit.DAYS.between(scopeStartDate, scopeEndDate) + 1;
        if (span > MAX_SPAN_DAYS) {
            throw new IllegalArgumentException("采集日跨度不能超过 " + MAX_SPAN_DAYS + " 天，当前 " + span + " 天");
        }
        if (scopeTaskId == null && scopeChannelId == null) {
            throw new IllegalArgumentException("必须至少指定任务ID或渠道ID之一，避免全表重扫");
        }
        if ("full_replay".equals(batchType) && (scopeTaskId != null || scopeChannelId != null)) {
            throw new IllegalArgumentException("全量重跑不应指定任务/渠道范围");
        }
    }
}
