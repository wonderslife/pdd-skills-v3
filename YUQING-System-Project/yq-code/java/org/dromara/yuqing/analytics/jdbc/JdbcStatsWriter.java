package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.AggregateOutcome;
import org.dromara.yuqing.analytics.DailyRow;
import org.dromara.yuqing.analytics.DimRow;
import org.dromara.yuqing.analytics.HotRow;
import org.dromara.yuqing.domain.YqStatsDaily;
import org.dromara.yuqing.domain.YqStatsDim;
import org.dromara.yuqing.domain.YqStatsHot;
import org.dromara.yuqing.mapper.YqStatsDailyMapper;
import org.dromara.yuqing.mapper.YqStatsDimMapper;
import org.dromara.yuqing.mapper.YqStatsHotMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 预聚合写入器（{@code @DS("doris")}）
 *
 * <p><b>幂等是怎么做到的：</b>三张表在 Doris 侧都是 Unique Key 模型，
 * 且 Unique Key 就是业务主键（daily = 统计日+任务+渠道；dim = 统计日+维度+取值+粒度+任务+渠道；
 * hot = 统计日+口径+名次）。因此重跑同一天只是覆盖同名次/同键的行，
 * <b>不需要先 DELETE</b> —— 这一点很重要，「先删后写」中间会有一个看板空窗，
 * 而覆盖写没有。</p>
 *
 * <p>分片写入（每片 {@link #BATCH_SIZE} 行）：Doris 的 INSERT 语句过长会触发
 * 单条 SQL 体积限制，几千行的 VALUES 很容易撞上。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DS("doris")
public class JdbcStatsWriter {

    /** 单次 batch insert 行数 */
    public static final int BATCH_SIZE = 500;

    private final YqStatsDailyMapper statsDailyMapper;

    private final YqStatsDimMapper statsDimMapper;

    private final YqStatsHotMapper statsHotMapper;

    /**
     * 写入一次聚合的全部产出
     *
     * @param out 聚合产出
     */
    public void write(AggregateOutcome out) {
        LocalDateTime now = LocalDateTime.now();
        writeDaily(out.getDaily(), now);
        writeDim(out.getDim(), now);
        writeHot(out.getHot(), now);
    }

    /**
     * 小数列转换：聚合器内部用 {@code double} 便于计算，实体侧小数列是 {@link BigDecimal}
     *
     * <p>刻意用 {@link BigDecimal#valueOf(double)} 而不是 {@code new BigDecimal(double)}：
     * 后者会把 double 的二进制表示误差原样搬进库里（0.1 会变成
     * 0.1000000000000000055511151231257827），看板上的百分比就成了乱码级别的小数。</p>
     */
    private static BigDecimal dec(Double v) {
        return v == null ? null : BigDecimal.valueOf(v);
    }

    private void writeDaily(List<DailyRow> rows, LocalDateTime now) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<YqStatsDaily> list = new ArrayList<>(rows.size());
        for (DailyRow r : rows) {
            YqStatsDaily e = new YqStatsDaily();
            e.setStatsId(IdWorker.getId());
            e.setStatsDate(r.getStatsDate());
            e.setTaskId(r.getTaskId());
            e.setChannelId(r.getChannelId());
            e.setTotalCount(r.getTotalCount());
            e.setPositiveCount(r.getPositiveCount());
            e.setNeutralCount(r.getNeutralCount());
            e.setNegativeCount(r.getNegativeCount());
            e.setDupCount(r.getDupCount());
            e.setRejectedCount(r.getRejectedCount());
            e.setAlertCount(r.getAlertCount());
            e.setPushCount(r.getPushCount());
            e.setReportCount(r.getReportCount());
            e.setReadSum(r.getReadSum());
            e.setCommentSum(r.getCommentSum());
            e.setShareSum(r.getShareSum());
            e.setLikeSum(r.getLikeSum());
            e.setNegativeRate(dec(r.getNegativeRate()));
            e.setCreateTime(now);
            list.add(e);
        }
        statsDailyMapper.insertBatch(list, BATCH_SIZE);
    }

    private void writeDim(List<DimRow> rows, LocalDateTime now) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<YqStatsDim> list = new ArrayList<>(rows.size());
        for (DimRow r : rows) {
            YqStatsDim e = new YqStatsDim();
            e.setDimId(IdWorker.getId());
            e.setStatsDate(r.getStatsDate());
            e.setDimType(r.getDimType());
            e.setDimKey(r.getDimKey());
            e.setTimeGrain(r.getTimeGrain());
            e.setTaskId(r.getTaskId());
            e.setChannelId(r.getChannelId());
            e.setDimLabel(r.getDimLabel());
            e.setOpinionCount(r.getOpinionCount());
            e.setPositiveCount(r.getPositiveCount());
            e.setNeutralCount(r.getNeutralCount());
            e.setNegativeCount(r.getNegativeCount());
            e.setHighRiskCount(r.getHighRiskCount());
            e.setReadSum(r.getReadSum());
            e.setCommentSum(r.getCommentSum());
            e.setShareSum(r.getShareSum());
            e.setLikeSum(r.getLikeSum());
            e.setHeatSum(r.getHeatSum());
            e.setNegativeRate(dec(r.getNegativeRate()));
            e.setCreateTime(now);
            list.add(e);
        }
        statsDimMapper.insertBatch(list, BATCH_SIZE);
    }

    private void writeHot(List<HotRow> rows, LocalDateTime now) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        List<YqStatsHot> list = new ArrayList<>(rows.size());
        for (HotRow r : rows) {
            YqStatsHot e = new YqStatsHot();
            e.setHotId(IdWorker.getId());
            e.setStatsDate(r.getStatsDate());
            e.setRankBy(r.getRankBy());
            e.setRankNo(r.getRankNo());
            e.setOpinionId(r.getOpinionId());
            e.setTaskId(r.getTaskId());
            e.setChannelId(r.getChannelId());
            e.setTitle(r.getTitle());
            e.setChannelName(r.getChannelName());
            e.setOpinionUrl(r.getOpinionUrl());
            e.setPublishTime(r.getPublishTime());
            e.setSentiAttr(r.getSentiAttr());
            e.setRiskLevel(r.getRiskLevel());
            e.setReadCount(r.getReadCount());
            e.setCommentCount(r.getCommentCount());
            e.setShareCount(r.getShareCount());
            e.setLikeCount(r.getLikeCount());
            e.setHeatScore(r.getHeatScore());
            e.setCreateTime(now);
            list.add(e);
        }
        statsHotMapper.insertBatch(list, BATCH_SIZE);
    }

    /**
     * 清理范围外的历史聚合行
     *
     * <p>可选动作：Unique Key 覆盖写只保证「写过的行不重复」，不会清理
     * 「这次没写的行」—— 例如某天的明细被删后重跑，旧聚合行会残留。
     * 定时任务默认不调用本方法（口径稳定时不需要）；手动补算历史时由调用方决定。</p>
     *
     * @param dateFrom 起始统计日
     * @param dateTo   截止统计日
     * @return 删除行数
     */
    public int purgeRange(java.time.LocalDate dateFrom, java.time.LocalDate dateTo) {
        if (dateFrom == null || dateTo == null || dateFrom.isAfter(dateTo)) {
            return 0;
        }
        int n = 0;
        n += statsDailyMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<YqStatsDaily>()
            .between("stats_date", dateFrom, dateTo));
        n += statsDimMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<YqStatsDim>()
            .between("stats_date", dateFrom, dateTo));
        n += statsHotMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<YqStatsHot>()
            .between("stats_date", dateFrom, dateTo));
        return n;
    }
}
