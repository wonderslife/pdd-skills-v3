package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 数据来源批次元信息（F-009 验收标准 9）
 *
 * <p>预聚合任务失败时看板不报错，而是展示最近一次成功的聚合结果，
 * 并把「这批数据截止到什么时候」显式告诉使用者 —— 让看板能自证新鲜度，
 * 是防止误判形势最便宜的手段。</p>
 *
 * @author ruoyi
 */
@Data
public class BatchMeta {

    /** 最近一次成功聚合的批次号 */
    private String batchNo;

    /** 该批次的起止统计日 */
    private String beginDate;

    /** 该批次的结束统计日 */
    private String endDate;

    /** 数据截止时间（该批次覆盖到的最新发布时间） */
    private LocalDateTime dataUntil;

    /** 该批次的完成时间 */
    private LocalDateTime aggregatedAt;

    /** 最近一次聚合是否失败（看板据此显示黄色告警条） */
    private boolean degraded;

    /** 最近失败批次的失败原因 */
    private String failReason;

    /**
     * 该批次产出的结构化结论 JSON
     *
     * <p>为什么不另建一张结论表：结论是「一次聚合的产物」，与批次的生存周期
     * 完全一致（同一次运行产生、同一次重跑覆盖），拆表反而要维护外键与清理逻辑。</p>
     */
    private String conclusionJson;

    /** 是否存在可用的聚合结果 */
    private boolean available;
}
