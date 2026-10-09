/**
 * F-009 多维分析 · 第 4 片：JDBC 读写层（Doris 只读明细 + Doris 预聚合读写 + 主库流程量）
 *
 * 本片是唯一接触 SQL 的一层，安全约定写死在注释与实现里：
 *   - 所有用户输入一律走 MyBatis-Plus 的 eq/between/apply 参数占位符，绝不字符串拼接；
 *   - 分页 limit/offset 由 Java 里算出的 int 拼入（值域受配置常量约束，不来自请求）；
 *   - 一个类只连一个数据源（@DS 是类级 AOP），跨库读写在 Service 层拼接，
 *     不做「一个方法里既读 Doris 又读 MySQL」——那条路必然踩路由错乱。
 */
export const ANALYTICS_TPL4 = [

  /* ================================================= 明细读取（Doris，只读） */
  {
    rel: 'analytics/jdbc/SliceLoad.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import lombok.Data;
import org.dromara.yuqing.analytics.OpinionSlice;

import java.util.ArrayList;
import java.util.List;

/**
 * 明细读取结果（含截断标记）
 *
 * @author ruoyi
 */
@Data
public class SliceLoad {

    /** 明细切片 */
    private List<OpinionSlice> slices = new ArrayList<>();

    /** 是否因命中上限被截断 */
    private boolean truncated;

    public int size() {
        return slices.size();
    }
}
`,
  },
  {
    rel: 'analytics/jdbc/JdbcOpinionStatsReader.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.OpinionSlice;
import org.dromara.yuqing.domain.YqCollectLog;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqCollectLogMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 预聚合的明细读取器（{@code @DS("doris")}）
 *
 * <p>为什么聚合任务敢把明细读进内存：<b>这是唯一一次全量扫描</b>。
 * 三张预聚合表由这一次扫描一起产出，之后所有看板查询都只读预聚合表，
 * 于是「看板响应时长」与「明细规模」解耦（F-009 验收标准 8）。</p>
 *
 * <p>读进来的条数由 {@code maxSourceRecords} 硬约束：命中上限即截断并在
 * 聚合产出里记一条提示，看板上会显示「不完全统计」——
 * 比默默算出一个偏小的总量要诚实得多。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DS("doris")
public class JdbcOpinionStatsReader {

    private final YqOpinionMapper opinionMapper;

    private final YqCollectLogMapper collectLogMapper;

    /**
     * 载入范围内的明细切片
     *
     * @param scope      范围
     * @param maxRecords 上限
     * @return 读取结果
     */
    public SliceLoad loadSlices(AggregateScope scope, int maxRecords) {
        SliceLoad out = new SliceLoad();
        int cap = Math.max(1, maxRecords);
        LambdaQueryWrapper<YqOpinion> lqw = base(scope);
        lqw.orderByAsc(YqOpinion::getCollectDate, YqOpinion::getOpinionId);
        // cap + 1：多取一条用来判断是否还有剩余
        lqw.last("limit " + (cap + 1));
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        if (rows.size() > cap) {
            out.setTruncated(true);
            rows = rows.subList(0, cap);
        }
        List<OpinionSlice> slices = new ArrayList<>(rows.size());
        for (YqOpinion o : rows) {
            OpinionSlice s = OpinionSlice.from(o);
            if (s != null) {
                slices.add(s);
            }
        }
        out.setSlices(slices);
        return out;
    }

    /**
     * 按日汇总采集批次的去重 / 降噪剔除量
     *
     * <p>数据源是 {@code yq_collect_log}（同在 Doris），不是 {@code yq_clean_batch}——
     * 后者在主库且以「批次」而非「日」为单位，跨日批次无法按天拆分，
     * 强行摊还会造出假数字。采集日志天然带 {@code create_time}，按日汇总准确。</p>
     *
     * <p>这里刻意不做 SQL 聚合：日志行数在业务上是「任务 × 渠道 × 调度轮次」量级，
     * 一天通常几百行，读回内存求和在可控范围内，换来的是不依赖任何 SQL 方言函数。</p>
     *
     * @param scope 范围
     * @param limit 保护性上限
     * @return 日期 -&gt; [dupCount, rejectedCount, insertedCount]
     */
    public Map<LocalDate, int[]> loadCollectLog(AggregateScope scope, int limit) {
        Map<LocalDate, int[]> out = new HashMap<>();
        if (scope == null || scope.getDateFrom() == null || scope.getDateTo() == null) {
            return out;
        }
        LambdaQueryWrapper<YqCollectLog> lqw = new LambdaQueryWrapper<>();
        lqw.ge(YqCollectLog::getCreateTime, scope.getDateFrom().atStartOfDay());
        lqw.lt(YqCollectLog::getCreateTime, scope.getDateTo().plusDays(1L).atStartOfDay());
        lqw.orderByAsc(YqCollectLog::getCreateTime);
        lqw.last("limit " + Math.max(1, limit));
        List<YqCollectLog> rows = collectLogMapper.selectList(lqw);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        for (YqCollectLog r : rows) {
            if (r.getCreateTime() == null) {
                continue;
            }
            LocalDate d = r.getCreateTime().toLocalDate();
            int[] cell = out.computeIfAbsent(d, k -> new int[3]);
            cell[0] += nz(r.getDupCount());
            cell[1] += nz(r.getRejectedCount());
            cell[2] += nz(r.getInsertedCount());
        }
        return out;
    }

    /** 读取范围内最新的发布时间，作为「数据截止时间」 */
    public java.time.LocalDateTime maxPublishTime(AggregateScope scope) {
        LambdaQueryWrapper<YqOpinion> lqw = base(scope);
        lqw.isNotNull(YqOpinion::getPublishTime);
        lqw.orderByDesc(YqOpinion::getPublishTime);
        lqw.last("limit 1");
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        return rows.get(0).getPublishTime();
    }

    /**
     * 构造范围条件（全部走预编译占位符）
     */
    private LambdaQueryWrapper<YqOpinion> base(AggregateScope scope) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        if (scope == null) {
            return lqw;
        }
        // collect_date 是 Doris 分区列，范围过滤落到这一列才能命中分区裁剪
        lqw.ge(Objects.nonNull(scope.getDateFrom()), YqOpinion::getCollectDate, scope.getDateFrom());
        lqw.le(Objects.nonNull(scope.getDateTo()), YqOpinion::getCollectDate, scope.getDateTo());
        lqw.eq(Objects.nonNull(scope.getTaskId()), YqOpinion::getTaskId, scope.getTaskId());
        lqw.eq(Objects.nonNull(scope.getChannelId()), YqOpinion::getChannelId, scope.getChannelId());
        lqw.eq(notBlank(scope.getSentiAttr()), YqOpinion::getSentiAttr, scope.getSentiAttr());
        lqw.eq(notBlank(scope.getRiskLevel()), YqOpinion::getRiskLevel, scope.getRiskLevel());
        lqw.eq(notBlank(scope.getOpinionLevel()), YqOpinion::getOpinionLevel, scope.getOpinionLevel());
        lqw.eq(notBlank(scope.getSpreadLevel()), YqOpinion::getSpreadLevel, scope.getSpreadLevel());
        return lqw;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }
}
`,
  },

  /* ============================================ 流程量读取（主库，MySQL） */
  {
    rel: 'analytics/jdbc/JdbcProcessMetricsReader.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.domain.YqPushRecord;
import org.dromara.yuqing.mapper.YqAlertMapper;
import org.dromara.yuqing.mapper.YqPushRecordMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 流程量读取器（主库 MySQL）
 *
 * <p>预警数与推送数在 {@code yq_alert} / {@code yq_push_record}，这两张表在主库；
 * 明细与预聚合表在 Doris。跨库不可能共享事务，所以做法是：<b>先分别读、再在内存里合并</b>，
 * 而不是试图在一条 SQL 里 join 两个库。</p>
 *
 * <p>聚合在库内完成（{@code DATE()} + {@code GROUP BY} + {@code COUNT}），
 * 因为这两张表随时间只增不减，读回内存不是好主意。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JdbcProcessMetricsReader {

    private final YqAlertMapper alertMapper;

    private final YqPushRecordMapper pushRecordMapper;

    /**
     * 按日汇总预警数与推送成功数
     *
     * @param from 起始日（含）
     * @param to   截止日（含）
     * @return 日期 -&gt; [alertCount, pushCount]
     */
    public Map<LocalDate, int[]> load(LocalDate from, LocalDate to) {
        Map<LocalDate, int[]> out = new HashMap<>();
        if (from == null || to == null || from.isAfter(to)) {
            return out;
        }
        LocalDateTime begin = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1L).atStartOfDay();

        QueryWrapper<YqAlert> aq = new QueryWrapper<>();
        aq.select("DATE(trigger_time) AS statDay", "COUNT(1) AS cnt");
        aq.ge("trigger_time", begin);
        aq.lt("trigger_time", end);
        aq.isNotNull("trigger_time");
        aq.groupBy("DATE(trigger_time)");
        accumulate(out, alertMapper.selectMaps(aq), 0);

        QueryWrapper<YqPushRecord> pq = new QueryWrapper<>();
        // 只统计真实发出的：send_status=success
        pq.select("DATE(send_time) AS statDay", "COUNT(1) AS cnt");
        pq.eq("send_status", "success");
        pq.ge("send_time", begin);
        pq.lt("send_time", end);
        pq.isNotNull("send_time");
        pq.groupBy("DATE(send_time)");
        accumulate(out, pushRecordMapper.selectMaps(pq), 1);
        return out;
    }

    private void accumulate(Map<LocalDate, int[]> out, List<Map<String, Object>> rows, int slot) {
        if (rows == null || rows.isEmpty()) {
            return;
        }
        for (Map<String, Object> row : rows) {
            LocalDate d = toDate(SqlMaps.pick(row, "statDay", "statday", "stat_day"));
            if (d == null) {
                continue;
            }
            long n = SqlMaps.toLong(SqlMaps.pick(row, "cnt", "CNT", "count"));
            out.computeIfAbsent(d, k -> new int[2])[slot] += (int) Math.min(n, Integer.MAX_VALUE);
        }
    }

    /**
     * 宽容解析日期字段
     *
     * <p>同一段 SQL 在不同驱动下可能返回 {@code java.sql.Date}、{@code LocalDate}
     * 或已格式化字符串，这里全部兜住 —— 云上换一次 MySQL 版本踩一次，不如一次写完。</p>
     */
    static LocalDate toDate(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof LocalDate) {
            return (LocalDate) v;
        }
        if (v instanceof java.sql.Date) {
            return ((java.sql.Date) v).toLocalDate();
        }
        if (v instanceof java.util.Date) {
            return new java.sql.Timestamp(((java.util.Date) v).getTime()).toLocalDateTime().toLocalDate();
        }
        String s = String.valueOf(v);
        if (s.length() >= 10) {
            try {
                return LocalDate.parse(s.substring(0, 10));
            } catch (RuntimeException e) {
                return null;
            }
        }
        return null;
    }
}
`,
  },
  {
    rel: 'analytics/jdbc/SqlMaps.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import java.util.Map;

/**
 * {@code selectMaps} 结果取值工具
 *
 * <p>MyBatis 把聚合查询结果放进 {@code Map} 时，键名到底是原样、大写还是带下划线，
 * 取决于驱动与连接参数。写死一个键名，换个环境就 NPE。这里统一做
 * 「先精确匹配、再大小写不敏感匹配」。</p>
 *
 * @author ruoyi
 */
public final class SqlMaps {

    /**
     * 按候选键名取值
     *
     * @param row  一行
     * @param keys 候选键名（按优先级）
     * @return 值；全不命中返回 {@code null}
     */
    public static Object pick(Map<String, Object> row, String... keys) {
        if (row == null || row.isEmpty()) {
            return null;
        }
        for (String k : keys) {
            if (row.containsKey(k)) {
                return row.get(k);
            }
        }
        for (Map.Entry<String, Object> e : row.entrySet()) {
            for (String k : keys) {
                if (k.equalsIgnoreCase(e.getKey())) {
                    return e.getValue();
                }
            }
        }
        return null;
    }

    /**
     * 取值并转 long
     */
    public static long toLong(Object v) {
        if (v == null) {
            return 0L;
        }
        if (v instanceof Number) {
            return ((Number) v).longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /**
     * 取值并转 int
     */
    public static int toInt(Object v) {
        return (int) Math.min(toLong(v), Integer.MAX_VALUE);
    }

    /**
     * 取值并转 double
     */
    public static double toDouble(Object v) {
        if (v == null) {
            return 0D;
        }
        if (v instanceof Number) {
            return ((Number) v).doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 0D;
        }
    }

    /**
     * 取值并转字符串
     */
    public static String toString(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private SqlMaps() {
    }
}
`,
  },

  /* ================================================ 预聚合写（Doris） */
  {
    rel: 'analytics/jdbc/JdbcStatsWriter.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

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
`,
  },

  /* ================================================ 预聚合读（Doris） */
  {
    rel: 'analytics/jdbc/JdbcStatsQuery.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

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
`,
  },

  /* ================================================ 下钻读取（Doris） */
  {
    rel: 'analytics/jdbc/JdbcDrilldownReader.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.DrilldownQuery;
import org.dromara.yuqing.analytics.DrilldownResult;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * 下钻明细读取（{@code @DS("doris")}，F-009 验收标准 6）
 *
 * <p><b>安全要点：</b>下钻条件里的地域 / 话题来自采集侧的自由文本，
 * 属于「不可信输入」。这里用 {@code apply("INSTR(region, {0}) > 0", token)} ——
 * MyBatis-Plus 的 apply 会把 {@code {0}} 编译成预编译占位符，
 * 因此 token 永远只是参数值，不可能参与 SQL 语法解析。</p>
 *
 * <p>为什么是 {@code INSTR} 而不是 {@code LIKE}：{@code LIKE} 需要对
 * {@code %} 与 {@code _} 做转义，任何一处漏转义都会让用户输入变成通配符
 * （信息泄露）或语法错误。{@code INSTR} 天然没有通配语义，一步去掉整个风险面。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
@DS("doris")
public class JdbcDrilldownReader {

    private final YqOpinionMapper opinionMapper;

    /**
     * 执行下钻查询
     *
     * @param q 条件（须已归一化分页）
     * @return 分页明细
     */
    public DrilldownResult query(DrilldownQuery q) {
        DrilldownResult result = new DrilldownResult();
        result.setDimType(q.getDimType());
        result.setDimKey(q.getDimKey());
        result.setDimLabel(q.getDimLabel());
        result.setConditionText(q.describe());
        result.setPageNum(q.getPageNum());
        result.setPageSize(q.getPageSize());
        LambdaQueryWrapper<YqOpinion> lqw = conditions(q);
        Long total = opinionMapper.selectCount(lqw);
        result.setTotal(total == null ? 0L : total);
        if (result.getTotal() == 0L) {
            return result;
        }
        // 分页参数已由 DrilldownQuery.paged(maxPageSize) 收敛到常量区间，
        // 这里的 limit/offset 只可能落在受控范围内
        int offset = Math.max(0, (q.getPageNum() - 1) * q.getPageSize());
        lqw.orderByDesc(YqOpinion::getPublishTime, YqOpinion::getOpinionId);
        lqw.last("limit " + q.getPageSize() + " offset " + offset);
        List<YqOpinion> rows = opinionMapper.selectList(lqw);
        List<DrilldownResult.Row> list = new ArrayList<>();
        if (rows != null) {
            for (YqOpinion o : rows) {
                DrilldownResult.Row r = new DrilldownResult.Row();
                r.setOpinionId(o.getOpinionId());
                r.setTitle(o.getTitle());
                r.setChannelName(o.getChannelName());
                r.setPublishTime(o.getPublishTime());
                r.setSentiAttr(o.getSentiAttr());
                r.setRiskLevel(o.getRiskLevel());
                r.setRegion(o.getRegion());
                r.setTopicTags(o.getTopicTags());
                r.setReadCount(o.getReadCount());
                r.setCommentCount(o.getCommentCount());
                r.setShareCount(o.getShareCount());
                r.setLikeCount(o.getLikeCount());
                r.setOpinionUrl(o.getOpinionUrl());
                list.add(r);
            }
        }
        result.setRows(list);
        return result;
    }

    /**
     * 组装下钻条件
     *
     * <p>所有分支都是「有值才加条件」；一个条件都没加会被上游拦住
     * （见 Service 层校验），不会出现「下钻出全表」这种事故。</p>
     */
    private LambdaQueryWrapper<YqOpinion> conditions(DrilldownQuery q) {
        LambdaQueryWrapper<YqOpinion> lqw = new LambdaQueryWrapper<>();
        if (q.getScope() != null) {
            lqw.ge(Objects.nonNull(q.getScope().getDateFrom()), YqOpinion::getCollectDate, q.getScope().getDateFrom());
            lqw.le(Objects.nonNull(q.getScope().getDateTo()), YqOpinion::getCollectDate, q.getScope().getDateTo());
            lqw.eq(Objects.nonNull(q.getScope().getTaskId()), YqOpinion::getTaskId, q.getScope().getTaskId());
            lqw.eq(Objects.nonNull(q.getScope().getChannelId()), YqOpinion::getChannelId, q.getScope().getChannelId());
        }
        lqw.eq(Objects.nonNull(q.getChannelId()), YqOpinion::getChannelId, q.getChannelId());
        lqw.eq(Objects.nonNull(q.getOpinionId()), YqOpinion::getOpinionId, q.getOpinionId());
        lqw.eq(notBlank(q.getSentiAttr()), YqOpinion::getSentiAttr, q.getSentiAttr());
        lqw.eq(notBlank(q.getRiskLevel()), YqOpinion::getRiskLevel, q.getRiskLevel());
        lqw.eq(notBlank(q.getOpinionLevel()), YqOpinion::getOpinionLevel, q.getOpinionLevel());
        lqw.eq(notBlank(q.getSpreadLevel()), YqOpinion::getSpreadLevel, q.getSpreadLevel());
        if (notBlank(q.getRegionToken())) {
            // {0} 会编译成预编译占位符；INSTR 无通配语义，无需转义
            lqw.apply("INSTR(region, {0}) > 0", q.getRegionToken());
        }
        if (notBlank(q.getTopicToken())) {
            lqw.apply("INSTR(topic_tags, {0}) > 0", q.getTopicToken());
        }
        if (q.getTimeFrom() != null) {
            lqw.ge(YqOpinion::getPublishTime, q.getTimeFrom());
        }
        if (q.getTimeTo() != null) {
            lqw.lt(YqOpinion::getPublishTime, q.getTimeTo());
        }
        return lqw;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }
}
`,
  },

  /* ============================================ 批次台账（主库 MySQL） */
  {
    rel: 'analytics/jdbc/StatsBatchLedger.java',
    content: `package org.dromara.yuqing.analytics.jdbc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analytics.AggregateOutcome;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.BatchMeta;
import org.dromara.yuqing.domain.YqStatsBatch;
import org.dromara.yuqing.mapper.YqStatsBatchMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 聚合批次台账（主库 MySQL，F-009 验收标准 9）
 *
 * <p>台账承担两件事：
 * <ol>
 *   <li>留痕 —— 谁在什么时候补算了哪一段、耗时多少、有没有被截断；</li>
 *   <li>回退依据 —— 看板不直接读明细，而是读「最近一次成功批次」，</li>
 * </ol>
 * 因此聚合失败时看板依然可用，只是会显示上一批数据的截止时间。
 * <b>这条路径是本模块唯一允许「降级」的地方</b>：失败可见，但不影响主流程。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StatsBatchLedger {

    private final YqStatsBatchMapper statsBatchMapper;

    /**
     * 开启一个批次（状态 running）
     *
     * @param scope      范围
     * @param triggerType 触发方式 auto / manual / replay
     * @return 批次实体（已落库）
     */
    public YqStatsBatch begin(AggregateScope scope, String triggerType) {
        YqStatsBatch b = new YqStatsBatch();
        b.setBatchId(IdWorker.getId());
        b.setBatchNo("YQSTAT" + b.getBatchId());
        b.setBeginDate(scope.getDateFrom());
        b.setEndDate(scope.getDateTo());
        b.setTriggerType(triggerType == null || triggerType.isBlank() ? "auto" : triggerType);
        b.setStatus("running");
        b.setSourceCount(0);
        b.setDailyRows(0);
        b.setDimRows(0);
        b.setHotRows(0);
        b.setCostMs(0L);
        statsBatchMapper.insert(b);
        return b;
    }

    /**
     * 标记成功
     *
     * @param batch          批次
     * @param out            聚合产出
     * @param dataUntil      数据截止时间
     * @param costMs         耗时
     * @param conclusionJson 结构化结论 JSON（可为空）
     */
    public void success(YqStatsBatch batch, AggregateOutcome out, LocalDateTime dataUntil,
                        long costMs, String conclusionJson) {
        if (batch == null) {
            return;
        }
        batch.setStatus("success");
        batch.setSourceCount(out == null ? 0 : out.getSourceCount());
        batch.setDailyRows(out == null ? 0 : out.getDaily().size());
        batch.setDimRows(out == null ? 0 : out.getDim().size());
        batch.setHotRows(out == null ? 0 : out.getHot().size());
        batch.setCostMs(costMs);
        batch.setDataUntil(dataUntil);
        batch.setNotice(out == null ? null : out.noticeText());
        batch.setConclusionJson(conclusionJson);
        batch.setFailReason(null);
        statsBatchMapper.updateById(batch);
    }

    /**
     * 标记失败
     *
     * <p>失败原因截断到列宽以内：宁可丢尾部的堆栈，也不能让 update 因为超长而再抛一次异常，
     * 那会把真实的失败原因彻底盖掉。</p>
     */
    public void fail(YqStatsBatch batch, Throwable e, long costMs) {
        if (batch == null) {
            return;
        }
        batch.setStatus("failed");
        batch.setCostMs(costMs);
        batch.setFailReason(cut(e == null ? "未知错误" : String.valueOf(e.getMessage()), 900));
        statsBatchMapper.updateById(batch);
    }

    /**
     * 最近一次成功的批次 + 最近一次失败信息（用于看板降级提示）
     *
     * <p>降级判定用 batchId 比大小，而不是比时间字段：batchId 是雪花 ID 单调递增，
     * 而 createTime 依赖自动填充，手写数据或补算历史时可能出现时间倒挂。</p>
     */
    public BatchMeta latestMeta() {
        BatchMeta meta = new BatchMeta();
        Long successId = null;
        LambdaQueryWrapper<YqStatsBatch> ok = new LambdaQueryWrapper<>();
        ok.eq(YqStatsBatch::getStatus, "success");
        ok.orderByDesc(YqStatsBatch::getBatchId);
        ok.last("limit 1");
        List<YqStatsBatch> success = statsBatchMapper.selectList(ok);
        if (success != null && !success.isEmpty()) {
            YqStatsBatch b = success.get(0);
            successId = b.getBatchId();
            meta.setAvailable(true);
            meta.setBatchNo(b.getBatchNo());
            meta.setBeginDate(String.valueOf(b.getBeginDate()));
            meta.setEndDate(String.valueOf(b.getEndDate()));
            meta.setDataUntil(b.getDataUntil());
            meta.setAggregatedAt(b.getCreateTime());
            meta.setConclusionJson(b.getConclusionJson());
        }
        LambdaQueryWrapper<YqStatsBatch> bad = new LambdaQueryWrapper<>();
        bad.eq(YqStatsBatch::getStatus, "failed");
        bad.orderByDesc(YqStatsBatch::getBatchId);
        bad.last("limit 1");
        List<YqStatsBatch> failed = statsBatchMapper.selectList(bad);
        if (failed != null && !failed.isEmpty()) {
            YqStatsBatch b = failed.get(0);
            boolean newerThanSuccess = successId == null
                || (b.getBatchId() != null && b.getBatchId() > successId);
            if (newerThanSuccess) {
                meta.setDegraded(true);
                meta.setFailReason(b.getFailReason());
            }
        }
        return meta;
    }

    /**
     * 分页查批次台账（看板「聚合记录」抽屉用）
     */
    public List<YqStatsBatch> recent(int limit) {
        LambdaQueryWrapper<YqStatsBatch> lqw = new LambdaQueryWrapper<>();
        lqw.orderByDesc(YqStatsBatch::getBatchId);
        lqw.last("limit " + Math.max(1, Math.min(limit, 200)));
        return statsBatchMapper.selectList(lqw);
    }

    private static String cut(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
`,
  },
];
