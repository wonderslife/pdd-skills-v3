package org.dromara.yuqing.analytics.jdbc;

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
