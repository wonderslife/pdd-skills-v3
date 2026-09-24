package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.DailyRow;
import org.dromara.yuqing.analytics.DimRow;
import org.dromara.yuqing.analytics.DimType;
import org.dromara.yuqing.analytics.HotRow;
import org.dromara.yuqing.analytics.RankBy;
import org.dromara.yuqing.analytics.StatsGrain;
import org.dromara.yuqing.domain.YqStatsDim;
import org.dromara.yuqing.domain.YqStatsHot;
import org.dromara.yuqing.mapper.YqStatsDailyMapper;
import org.dromara.yuqing.mapper.YqStatsDimMapper;
import org.dromara.yuqing.mapper.YqStatsHotMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 预聚合查询（{@code @DS("doris")}，F-009 验收标准 1 / 2 / 3 / 4 / 8）
 *
 * <p>看板的每一条查询都只落在预聚合表上，且都是
 * 「按 (stats_date, dim_type, ...) 主键前缀过滤 + SUM」，行数与明细规模无关。
 * 这就是验收标准 8 的实现方式 —— 不是「加索引优化」，而是<b>把计算挪到写入侧</b>。</p>
 *
 * <p>聚合仍然在库内做（SUM + GROUP BY），不把明细行读回内存：
 * 分布类维度去重后的取值可能上千，读回来再算并不划算。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DS("doris")
public class JdbcStatsQuery {

    private final YqStatsDailyMapper statsDailyMapper;

    private final YqStatsDimMapper statsDimMapper;

    private final YqStatsHotMapper statsHotMapper;

    /**
     * 范围总量（SUM 成一行）
     *
     * @param scope 范围
     * @return 单行日聚合（字段为区间汇总值）
     */
    public List<DailyRow> queryTotals(AggregateScope scope) {
        QueryWrapper<org.dromara.yuqing.domain.YqStatsDaily> qw = new QueryWrapper<>();
        qw.select(
            "SUM(total_count) AS total_count",
            "SUM(positive_count) AS positive_count",
            "SUM(neutral_count) AS neutral_count",
            "SUM(negative_count) AS negative_count",
            "SUM(dup_count) AS dup_count",
            "SUM(rejected_count) AS rejected_count",
            "SUM(alert_count) AS alert_count",
            "SUM(push_count) AS push_count",
            "SUM(report_count) AS report_count",
            "SUM(read_sum) AS read_sum",
            "SUM(comment_sum) AS comment_sum",
            "SUM(share_sum) AS share_sum",
            "SUM(like_sum) AS like_sum");
        applyScope(qw, scope, "stats_date", "task_id", "channel_id");
        List<DailyRow> out = new ArrayList<>();
        List<Map<String, Object>> rows = statsDailyMapper.selectMaps(qw);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        Map<String, Object> row = rows.get(0);
        DailyRow r = new DailyRow();
        r.setStatsDate(scope == null ? null : scope.getDateFrom());
        r.setTaskId(scope == null || scope.getTaskId() == null ? 0L : scope.getTaskId());
        r.setChannelId(scope == null || scope.getChannelId() == null ? 0L : scope.getChannelId());
        r.setTotalCount(SqlMaps.toInt(SqlMaps.pick(row, "total_count")));
        r.setPositiveCount(SqlMaps.toInt(SqlMaps.pick(row, "positive_count")));
        r.setNeutralCount(SqlMaps.toInt(SqlMaps.pick(row, "neutral_count")));
        r.setNegativeCount(SqlMaps.toInt(SqlMaps.pick(row, "negative_count")));
        r.setDupCount(SqlMaps.toInt(SqlMaps.pick(row, "dup_count")));
        r.setRejectedCount(SqlMaps.toInt(SqlMaps.pick(row, "rejected_count")));
        r.setAlertCount(SqlMaps.toInt(SqlMaps.pick(row, "alert_count")));
        r.setPushCount(SqlMaps.toInt(SqlMaps.pick(row, "push_count")));
        r.setReportCount(SqlMaps.toInt(SqlMaps.pick(row, "report_count")));
        r.setReadSum(SqlMaps.toLong(SqlMaps.pick(row, "read_sum")));
        r.setCommentSum(SqlMaps.toLong(SqlMaps.pick(row, "comment_sum")));
        r.setShareSum(SqlMaps.toLong(SqlMaps.pick(row, "share_sum")));
        r.setLikeSum(SqlMaps.toLong(SqlMaps.pick(row, "like_sum")));
        r.derive();
        out.add(r);
        return out;
    }

    /**
     * 取某一维度类型的分布行（按 dim_key 汇总）
     *
     * @param scope    范围
     * @param type     维度类型
     * @param timeGrain 粒度（分布类维度固定 day）
     * @return 汇总后的维度行
     */
    public List<DimRow> queryDistribution(AggregateScope scope, DimType type, StatsGrain timeGrain) {
        QueryWrapper<YqStatsDim> qw = new QueryWrapper<>();
        qw.select(
            "dim_key AS dim_key",
            "MAX(dim_label) AS dim_label",
            "SUM(opinion_count) AS opinion_count",
            "SUM(positive_count) AS positive_count",
            "SUM(neutral_count) AS neutral_count",
            "SUM(negative_count) AS negative_count",
            "SUM(high_risk_count) AS high_risk_count",
            "SUM(read_sum) AS read_sum",
            "SUM(comment_sum) AS comment_sum",
            "SUM(share_sum) AS share_sum",
            "SUM(like_sum) AS like_sum",
            "SUM(heat_sum) AS heat_sum");
        qw.eq("dim_type", type.getCode());
        qw.eq("time_grain", timeGrain.getCode());
        applyScope(qw, scope, "stats_date", "task_id", "channel_id");
        qw.groupBy("dim_key");
        List<DimRow> out = new ArrayList<>();
        List<Map<String, Object>> rows = statsDimMapper.selectMaps(qw);
        if (rows == null) {
            return out;
        }
        for (Map<String, Object> row : rows) {
            out.add(toDimRow(type.getCode(), timeGrain.getCode(), row));
        }
        return out;
    }

    /**
     * 取趋势行（按 dim_key 排序，字典序即时间序）
     */
    public List<DimRow> queryTrend(AggregateScope scope, StatsGrain grain) {
        List<DimRow> rows = queryDistribution(scope, DimType.TREND, grain);
        rows.sort((a, b) -> String.valueOf(a.getDimKey()).compareTo(String.valueOf(b.getDimKey())));
        return rows;
    }

    /**
     * 取热点行
     *
     * @param scope  范围
     * @param rankBy 排序口径
     * @param limit  单日 TopN 行数上限（用于限制返回规模）
     */
    public List<HotRow> queryHot(AggregateScope scope, RankBy rankBy, int limit) {
        QueryWrapper<YqStatsHot> qw = new QueryWrapper<>();
        qw.eq("rank_by", rankBy.getCode());
        applyScope(qw, scope, "stats_date", "task_id", "channel_id");
        qw.orderByAsc("stats_date", "rank_no");
        qw.last("limit " + Math.max(1, limit));
        List<YqStatsHot> rows = statsHotMapper.selectList(qw);
        List<HotRow> out = new ArrayList<>();
        if (rows == null) {
            return out;
        }
        for (YqStatsHot e : rows) {
            HotRow r = new HotRow();
            r.setStatsDate(e.getStatsDate());
            r.setRankBy(e.getRankBy());
            r.setRankNo(e.getRankNo());
            r.setOpinionId(e.getOpinionId());
            r.setTaskId(e.getTaskId());
            r.setChannelId(e.getChannelId());
            r.setTitle(e.getTitle());
            r.setChannelName(e.getChannelName());
            r.setOpinionUrl(e.getOpinionUrl());
            r.setPublishTime(e.getPublishTime());
            r.setSentiAttr(e.getSentiAttr());
            r.setRiskLevel(e.getRiskLevel());
            r.setReadCount(e.getReadCount());
            r.setCommentCount(e.getCommentCount());
            r.setShareCount(e.getShareCount());
            r.setLikeCount(e.getLikeCount());
            r.setHeatScore(e.getHeatScore());
            out.add(r);
        }
        return out;
    }

    /**
     * 感知「预聚合表里有没有该范围的数据」
     *
     * <p>用于区分两种情况：范围本身没数据，还是聚合任务没跑过。
     * 前者是正常的空态，后者要在看板上提示「请先执行聚合」。</p>
     */
    public boolean hasAggregated(AggregateScope scope) {
        QueryWrapper<org.dromara.yuqing.domain.YqStatsDaily> qw = new QueryWrapper<>();
        qw.select("COUNT(1) AS cnt");
        applyScope(qw, scope, "stats_date", null, null);
        List<Map<String, Object>> rows = statsDailyMapper.selectMaps(qw);
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        return SqlMaps.toLong(SqlMaps.pick(rows.get(0), "cnt")) > 0L;
    }

    private DimRow toDimRow(String dimType, String grain, Map<String, Object> row) {
        DimRow r = new DimRow();
        r.setDimType(dimType);
        r.setTimeGrain(grain);
        r.setDimKey(SqlMaps.toString(SqlMaps.pick(row, "dim_key")));
        r.setDimLabel(SqlMaps.toString(SqlMaps.pick(row, "dim_label")));
        r.setTaskId(0L);
        r.setChannelId(0L);
        r.setOpinionCount(SqlMaps.toInt(SqlMaps.pick(row, "opinion_count")));
        r.setPositiveCount(SqlMaps.toInt(SqlMaps.pick(row, "positive_count")));
        r.setNeutralCount(SqlMaps.toInt(SqlMaps.pick(row, "neutral_count")));
        r.setNegativeCount(SqlMaps.toInt(SqlMaps.pick(row, "negative_count")));
        r.setHighRiskCount(SqlMaps.toInt(SqlMaps.pick(row, "high_risk_count")));
        r.setReadSum(SqlMaps.toLong(SqlMaps.pick(row, "read_sum")));
        r.setCommentSum(SqlMaps.toLong(SqlMaps.pick(row, "comment_sum")));
        r.setShareSum(SqlMaps.toLong(SqlMaps.pick(row, "share_sum")));
        r.setLikeSum(SqlMaps.toLong(SqlMaps.pick(row, "like_sum")));
        r.setHeatSum(SqlMaps.toLong(SqlMaps.pick(row, "heat_sum")));
        r.derive();
        return r;
    }

    /**
     * 统一套用范围条件
     *
     * <p>注意 {@code taskIdColumn} / {@code channelIdColumn} 允许为空：总量查询不需要
     * 按任务/渠道下钻，传 null 即跳过。所有值都作为绑定参数传入，不拼接。</p>
     */
    private void applyScope(QueryWrapper<?> qw, AggregateScope scope,
                            String dateColumn, String taskIdColumn, String channelIdColumn) {
        if (scope == null) {
            return;
        }
        if (scope.getDateFrom() != null) {
            qw.ge(dateColumn, scope.getDateFrom());
        }
        if (scope.getDateTo() != null) {
            qw.le(dateColumn, scope.getDateTo());
        }
        if (taskIdColumn != null && scope.getTaskId() != null) {
            qw.eq(taskIdColumn, scope.getTaskId());
        }
        if (channelIdColumn != null && scope.getChannelId() != null) {
            qw.eq(channelIdColumn, scope.getChannelId());
        }
    }
}
