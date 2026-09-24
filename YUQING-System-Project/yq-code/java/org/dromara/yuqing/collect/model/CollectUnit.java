package org.dromara.yuqing.collect.model;

import lombok.Data;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 采集单元 —— 调度的最小粒度：一个「任务 × 渠道」组合。
 *
 * <p>由 {@code YqCollectService.dispatch} 按任务、渠道与频率生成（PRD §6.2）。</p>
 *
 * @author ruoyi
 */
@Data
public class CollectUnit implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 任务ID */
    private Long taskId;

    /** 任务名称 */
    private String taskName;

    /** 渠道ID */
    private Long channelId;

    /** 渠道名称 */
    private String channelName;

    /** 站点适配器标识（yq_channel.adapter_class → yuqing.collect.adapters 的 key） */
    private String adapterCode;

    /** 采集策略：polling / incremental / realtime（验收标准 1） */
    private String collectStrategy;

    /** 本单元生效的采集间隔（秒）：任务级 channel 覆盖 > 任务 collectInterval */
    private Integer intervalSeconds;

    /** 采集批次号（一次下发生成一个，贯穿日志与溯源） */
    private String batchNo;

    /** 增量水位线：该渠道最近一次采集时间，早于它的内容不再抓取 */
    private LocalDateTime watermark;

    /** 关键词匹配器：检索词 + 本地组合匹配规则（F-002 关键词库 → F-004 采集） */
    private KeywordMatcher matcher;

    /** 渠道并发上限 */
    private Integer concurrencyLimit;

    /** 渠道请求间隔（毫秒） */
    private Integer requestIntervalMs;

    /** 代理池分组ID */
    private Long proxyGroupId;

    /** 失败率告警阈值（%） */
    private Integer failRateThreshold;

    /** 不下发原因（间隔越界、适配器缺失、渠道停用等）；非空则跳过本单元并计入日志 */
    private String skipReason;

    /**
     * 是否可下发。
     *
     * @return true 表示参数齐备可进入采集
     */
    public boolean dispatchable() {
        return skipReason == null || skipReason.isBlank();
    }

    /**
     * 采集单元业务键，用于日志与去重键拼接。
     *
     * @return taskId:channelId
     */
    public String unitKey() {
        return taskId + ":" + channelId;
    }
}
