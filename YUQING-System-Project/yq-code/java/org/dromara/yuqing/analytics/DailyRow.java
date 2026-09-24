package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;

/**
 * 日聚合行 —— 对应 Doris {@code yq_stats_daily}
 *
 * <p>主键语义是 (stats_date, task_id, channel_id)：任务/渠道用 0 表示「未归属」，
 * 于是「全部任务合并口径」不需要单独一行，查询时按需 SUM 即可。</p>
 *
 * @author ruoyi
 */
@Data
public class DailyRow {

    /** 统计日 */
    private LocalDate statsDate;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 舆情总量 */
    private Integer totalCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 去重剔除条数（来自 yq_collect_log 的 dup_count 按日汇总） */
    private Integer dupCount;

    /** 降噪剔除条数（来自 yq_collect_log 的 rejected_count 按日汇总） */
    private Integer rejectedCount;

    /** 预警条数（来自主库 yq_alert） */
    private Integer alertCount;

    /** 推送条数（来自主库 yq_push_record） */
    private Integer pushCount;

    /** 报告生成数（F-014 未落地，恒为 0） */
    private Integer reportCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 负面占比（%，保留 2 位，由总量与负面数派生） */
    private Double negativeRate;

    /**
     * 由总量与负面数派生负面占比
     *
     * <p>总量为 0 时给 0 而不是 null：看板上的占比图不接受空点。</p>
     */
    public void derive() {
        int total = nz(totalCount);
        negativeRate = total == 0 ? 0D : round2(nz(negativeCount) * 100D / total);
    }

    static double round2(double v) {
        return Math.round(v * 100D) / 100D;
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
