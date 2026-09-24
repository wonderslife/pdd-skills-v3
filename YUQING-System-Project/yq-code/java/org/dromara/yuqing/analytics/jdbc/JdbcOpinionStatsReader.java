package org.dromara.yuqing.analytics.jdbc;

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
