package org.dromara.yuqing.collect.model;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 单批次采集执行结果（对应 yq_collect_log 一行，验收标准 10）。
 *
 * @author ruoyi
 */
@Data
public class CollectResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 采集批次号 */
    private String batchNo;

    private Long taskId;

    private String taskName;

    private Long channelId;

    private String channelName;

    private String strategy;

    /** 抓取条数 */
    private int fetchedCount;

    /** 入库条数 */
    private int insertedCount;

    /** 去重剔除条数 */
    private int dupCount;

    /** 降噪剔除条数（净化环节回填；本模块会把关键词组合条件不匹配的条数也计入） */
    private int rejectedCount;

    /** 关键词组合条件不匹配而剔除的条数（已包含在 rejectedCount 内，用于定位「采到了但不符合关键词」） */
    private int filteredCount;

    /**
     * 跨渠道重复条数（F-006 验收标准 8）。
     *
     * <p>已包含在 {@link #dupCount} 内：同一链接被另一渠道先采到时，本条不入库，
     * 只把本渠道ID补到首条记录的 {@code dup_channel_ids} 上。</p>
     */
    private int dupChannelCount;

    /** 失败条数 */
    private int failedCount;

    /** 耗时（毫秒） */
    private long costMs;

    /** 执行结果：success / partial / failed */
    private String resultStatus = "success";

    /** 失败原因（截断到 1000 字符，对齐 yq_collect_log.fail_reason） */
    private String failReason;

    /** 失败明细（逐条，最多保留 50 条） */
    private List<String> failDetails = new ArrayList<>();

    /** 采集时间 */
    private LocalDateTime collectTime;

    /** 命中的被拦信号类型（便于反爬统计） */
    private BlockType blockType = BlockType.NONE;

    /**
     * 记录一条失败明细，并同步维护失败条数与原因。
     *
     * @param detail 失败描述
     */
    public void addFailure(String detail) {
        this.failedCount++;
        if (failDetails.size() < 50) {
            failDetails.add(detail);
        }
        String merged = this.failReason == null ? detail : this.failReason + " | " + detail;
        this.failReason = merged.length() > 1000 ? merged.substring(0, 1000) : merged;
    }

    /**
     * 采集条数与失败条数判断执行结果。
     */
    public void settle() {
        if (failedCount > 0 && insertedCount == 0) {
            resultStatus = "failed";
        } else if (failedCount > 0 || dupCount > 0) {
            resultStatus = "partial";
        } else {
            resultStatus = "success";
        }
    }

    /**
     * 是否「零采集」——用于连续异常判定（验收标准 9）。
     *
     * @return true 表示本次抓取条数为 0
     */
    public boolean isEmptyFetch() {
        return fetchedCount == 0;
    }

    /**
     * 是否「全部失败」——用于连续异常判定（验收标准 9）。
     *
     * @return true 表示有失败且无任何入库
     */
    public boolean isAllFailed() {
        return failedCount > 0 && insertedCount == 0;
    }

    /**
     * 是否异常批次。
     *
     * @return true 表示零采集或全失败
     */
    public boolean isAbnormal() {
        return isEmptyFetch() || isAllFailed();
    }

    /**
     * 是否「抓到了但全被关键词条件过滤掉」。
     *
     * <p>典型成因是组合表达式写错（例如地区组与站点覆盖范围不相交），
     * 值得在采集日志中显式提示；但它是正常业务现象（某轮确实没有匹配内容），
     * 因此不纳入异常告警计数，避免误报。</p>
     *
     * @return true 表示命中数为 0 且全部被过滤
     */
    public boolean isAllFiltered() {
        return fetchedCount > 0 && insertedCount == 0 && filteredCount >= fetchedCount;
    }
}
