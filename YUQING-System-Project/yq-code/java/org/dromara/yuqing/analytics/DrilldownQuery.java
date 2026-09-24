package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 下钻查询条件（F-009 验收标准 6）
 *
 * <p><b>这是整个 F-009 的安全关键点。</b>用户点击的是「某个维度取值」，
 * 而这个取值来自采集侧的文本字段（地域、话题）。任何把它直接拼进 SQL 的写法
 * 都会立刻变成注入点。因此这里只做「归一 + 参数化准备」：</p>
 * <ul>
 *   <li>地域：{@link RegionNormalizer#matchToken} 得到核心词，JDBC 层用
 *       {@code INSTR(region, ?) > 0} —— 不做 LIKE，彻底规避 % 与 _ 的转义问题；</li>
 *   <li>话题：直接作为参数传给 {@code INSTR(topic_tags, ?) > 0}；</li>
 *   <li>其余维度：等值参数。</li>
 * </ul>
 * <p>本类里没有、也不允许出现任何 SQL 片段。</p>
 *
 * @author ruoyi
 */
@Data
public class DrilldownQuery {

    /** 范围条件 */
    private AggregateScope scope;

    /** 维度类型（dim_type 或 hot） */
    private String dimType;

    /** 维度取值 */
    private String dimKey;

    /** 展示名（回显用） */
    private String dimLabel;

    /** 渠道ID（dim_type=channel 时使用） */
    private Long channelId;

    /** 地域核心词（INSTR 参数） */
    private String regionToken;

    /** 话题文本（INSTR 参数） */
    private String topicToken;

    /** 舆情属性等值条件 */
    private String sentiAttr;

    /** 风险等级等值条件 */
    private String riskLevel;

    /** 舆情分级等值条件 */
    private String opinionLevel;

    /** 传播量级等值条件 */
    private String spreadLevel;

    /** 单条舆情下钻（热点行点击） */
    private Long opinionId;

    /** 趋势行下钻：发布时间起（含） */
    private LocalDateTime timeFrom;

    /** 趋势行下钻：发布时间止（不含） */
    private LocalDateTime timeTo;

    /** 页码 */
    private int pageNum = 1;

    /** 每页条数 */
    private int pageSize = 20;

    /**
     * 由维度条目构造下钻条件
     *
     * @param scope  生效范围
     * @param type   维度类型
     * @param key    维度取值
     * @param label  展示名
     * @param grain  当前粒度（趋势下钻用）
     * @return 下钻条件；无法映射时返回 {@code null}
     */
    public static DrilldownQuery of(AggregateScope scope, DimType type, String key, String label, StatsGrain grain) {
        if (scope == null || type == null || key == null || key.isBlank()) {
            return null;
        }
        DrilldownQuery q = new DrilldownQuery();
        q.setScope(scope);
        q.setDimType(type.getCode());
        q.setDimKey(key);
        q.setDimLabel(label == null ? key : label);
        switch (type) {
            case CHANNEL:
                try {
                    q.setChannelId(Long.parseLong(key));
                } catch (NumberFormatException e) {
                    return null;
                }
                break;
            case REGION:
                q.setRegionToken(RegionNormalizer.matchToken(key));
                if (q.getRegionToken().isEmpty()) {
                    // 未知 / 海外 / 其他 三个桶无法用单值匹配，交给 Service 走「无地域」分支
                    q.setRegionToken(null);
                }
                break;
            case TOPIC:
                q.setTopicToken(key);
                break;
            case SENTI:
                q.setSentiAttr(key);
                break;
            case RISK:
                q.setRiskLevel(key);
                break;
            case LEVEL:
                q.setOpinionLevel(key);
                break;
            case SPREAD:
                q.setSpreadLevel(key);
                break;
            case TREND:
                LocalDateTime[] range = trendRange(key, grain);
                if (range == null) {
                    return null;
                }
                q.setTimeFrom(range[0]);
                q.setTimeTo(range[1]);
                break;
            default:
                return null;
        }
        return q;
    }

    /**
     * 由时间桶标识反解出精确的发布时间区间 [起, 止)
     *
     * <p>桶标识是自产的 ISO 串（yyyy-MM-dd / yyyy-MM-dd HH:00 / yyyy-Www），
     * 解析失败即返回 {@code null}，绝不猜测；小时桶必须解析到「时」，
     * 否则下钻出来的是一整天而不是那一个小时，使用者会以为数据错了。</p>
     */
    static LocalDateTime[] trendRange(String bucketKey, StatsGrain grain) {
        if (bucketKey == null || bucketKey.isBlank()) {
            return null;
        }
        try {
            if (grain == StatsGrain.HOUR) {
                /* 小时桶键形如 2026-09-05 14:00（16 位），必须解析到「时」 */
                if (bucketKey.length() < 13) {
                    return null;
                }
                LocalDateTime t = LocalDateTime.parse(bucketKey.substring(0, 13).replace(' ', 'T') + ":00");
                return new LocalDateTime[]{t, t.plusHours(1L)};
            }
            if (grain == StatsGrain.WEEK) {
                int idx = bucketKey.indexOf("-W");
                if (idx < 4) {
                    return null;
                }
                int year = Integer.parseInt(bucketKey.substring(0, idx));
                int week = Integer.parseInt(bucketKey.substring(idx + 2));
                java.time.temporal.WeekFields iso = java.time.temporal.WeekFields.ISO;
                LocalDate monday = LocalDate.of(year, 1, 4).with(iso.dayOfWeek(), 1).plusWeeks(week - 1L);
                // 跨年边界用 ISO 周反算可能差一周，做一次对齐校验
                if (monday.get(iso.weekBasedYear()) != year || monday.get(iso.weekOfWeekBasedYear()) != week) {
                    monday = monday.plusWeeks(1L);
                }
                return new LocalDateTime[]{monday.atStartOfDay(), monday.plusDays(7L).atStartOfDay()};
            }
            /* 日桶键形如 2026-09-05（10 位）—— 显式挡短串，不靠 substring 抛异常兜底 */
            if (bucketKey.length() < 10) {
                return null;
            }
            LocalDate d = LocalDate.parse(bucketKey.substring(0, 10));
            return new LocalDateTime[]{d.atStartOfDay(), d.plusDays(1L).atStartOfDay()};
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 归一化分页参数 */
    public DrilldownQuery paged(int maxPageSize) {
        if (pageNum < 1) {
            pageNum = 1;
        }
        int max = Math.max(1, maxPageSize);
        if (pageSize < 1) {
            pageSize = 20;
        }
        if (pageSize > max) {
            pageSize = max;
        }
        return this;
    }

    /** 人类可读的条件描述（前端下钻抽屉标题） */
    public String describe() {
        StringBuilder sb = new StringBuilder();
        if (scope == null) {
            return "（无范围条件）";
        }
        sb.append(scope.getDateFrom()).append(" 至 ").append(scope.getDateTo());
        if (scope.getTaskId() != null) {
            sb.append(" · 任务#").append(scope.getTaskId());
        }
        if (scope.getChannelId() != null) {
            sb.append(" · 渠道#").append(scope.getChannelId());
        }
        if (dimLabel != null && !dimLabel.isBlank()) {
            sb.append(" · ").append(dimLabel);
        }
        return sb.toString();
    }
}
