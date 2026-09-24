package org.dromara.yuqing.ledger.support;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 事件传播阶段判定（F-016 验收标准 4）
 *
 * <p>把一整条时间轴切成「首发 / 扩散 / 峰值 / 回落」四段，
 * 供前端在时间轴上着色、并在阶段统计里展示条数分布。</p>
 *
 * <p><b>为什么由后端判定：</b>阶段划分依赖整条时间轴的统计特征
 * （首条时间、末条时间、热度最高点），前端只能看到当前页的节点，
 * 让它自己算会得出与后端不一致的阶段分布。后端算一次、
 * 前端只负责渲染，口径才是唯一的。</p>
 *
 * <p><b>算法（与热点事件的实际传播形态对齐）：</b></p>
 * <ol>
 *   <li>首条 = 时间轴上最早的一条，标 first；</li>
 *   <li>最后 20% 时间窗内的节点标 fall（回落）；</li>
 *   <li>剩下中间段里，热度 >= 峰值 80% 的标 peak，其余标 spread；</li>
 *   <li>若整条轴只有 1 条，直接 first；只有 2 条时第二条为 fall。</li>
 * </ol>
 *
 * <p>纯函数、无 IO，可离线自测（F016LedgerTest 覆盖边界：空轴、单条、
 * 两条、无热度数据）。</p>
 *
 * @author ruoyi
 */
public final class LedgerStages {

    public static final String FIRST = "first";
    public static final String SPREAD = "spread";
    public static final String PEAK = "peak";
    public static final String FALL = "fall";

    private LedgerStages() {
    }

    /** 时间轴节点最小投影：判定只需要时间与热度 */
    public interface Node {
        LocalDateTime time();

        Integer heat();
    }

    /**
     * 逐节点判定阶段。
     *
     * @param nodes 按时间升序的节点（调用方负责排序）；可为 null / 空
     * @return 与输入等长的阶段数组；输入为空时返回空数组（不返回 null）
     */
    public static List<String> classify(List<? extends Node> nodes) {
        List<String> out = new ArrayList<>();
        if (nodes == null || nodes.isEmpty()) {
            return out;
        }
        int n = nodes.size();
        for (int i = 0; i < n; i++) {
            out.add(FIRST);
        }
        if (n == 1) {
            return out;
        }
        if (n == 2) {
            out.set(1, FALL);
            return out;
        }

        LocalDateTime start = nodes.get(0).time();
        LocalDateTime end = nodes.get(n - 1).time();

        /* 峰值热度：全部节点里的最大热度；全为空时视为 0（退化为按时间划分） */
        int peakHeat = 0;
        for (Node nd : nodes) {
            Integer h = nd.heat();
            if (h != null && h > peakHeat) {
                peakHeat = h;
            }
        }
        int peakThreshold = (int) Math.floor(peakHeat * 0.8);

        /* 回落窗口：轴长的最后 20%（轴长 0 时退化为「最后一条」） */
        long totalMinutes = start != null && end != null
            ? Math.max(Duration.between(start, end).toMinutes(), 0L)
            : 0L;
        double fallBoundary = totalMinutes * 0.8;

        for (int i = 1; i < n; i++) {
            Node nd = nodes.get(i);
            LocalDateTime t = nd.time();

            boolean inFall = false;
            if (start != null && t != null) {
                long offset = Math.max(Duration.between(start, t).toMinutes(), 0L);
                inFall = totalMinutes == 0L ? i == n - 1 : offset >= fallBoundary;
            } else if (totalMinutes == 0L) {
                /* 时间缺失：用位置近似 —— 后 20% 的位置算回落 */
                inFall = i >= Math.ceil(n * 0.8);
            }

            if (inFall) {
                out.set(i, FALL);
            } else {
                Integer h = nd.heat();
                boolean hot = peakHeat > 0 && h != null && h >= peakThreshold;
                out.set(i, hot ? PEAK : SPREAD);
            }
        }
        return out;
    }

    /**
     * 阶段条数统计。
     *
     * @return 固定含四个键的映射（值为 0 也保留，前端不用判空）
     */
    public static java.util.Map<String, Integer> countByStage(List<String> stages) {
        java.util.Map<String, Integer> m = new java.util.LinkedHashMap<>();
        m.put(FIRST, 0);
        m.put(SPREAD, 0);
        m.put(PEAK, 0);
        m.put(FALL, 0);
        if (stages == null) {
            return m;
        }
        for (String s : stages) {
            if (s != null && m.containsKey(s)) {
                m.put(s, m.get(s) + 1);
            }
        }
        return m;
    }
}
