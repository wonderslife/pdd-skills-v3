package org.dromara.yuqing.analytics;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 聚合执行摘要（返回给触发方，也是定时任务日志的内容）
 *
 * @author ruoyi
 */
@Data
public class AggregateSummary {

    /** 批次号 */
    private String batchNo;

    /** 执行状态 running / success / failed */
    private String status;

    /** 统计范围 */
    private String scopeText;

    /** 读取明细条数 */
    private int sourceCount;

    /** 写入行数 */
    private int dailyRows;

    /** 写入维度行数 */
    private int dimRows;

    /** 写入热点行数 */
    private int hotRows;

    /** 耗时（毫秒） */
    private long costMs;

    /** 数据截止时间 */
    private String dataUntil;

    /** 结论来源 */
    private String conclusionMode;

    /** 非致命提示 */
    private List<String> notices = new ArrayList<>();

    /** 失败原因（失败时才有值） */
    private String failReason;

    /** 一句话总结（写日志用） */
    public String message() {
        if ("failed".equals(status)) {
            return "聚合失败：" + failReason;
        }
        return "范围 " + scopeText + "，明细 " + sourceCount + " 条，写入 daily " + dailyRows
            + " / dim " + dimRows + " / hot " + hotRows + " 行，耗时 " + costMs + "ms"
            + (notices.isEmpty() ? "" : "，提示：" + String.join("；", notices));
    }
}
