package org.dromara.yuqing.analysis.cluster;

import lombok.Data;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 相似舆情聚合器（F-007 验收标准 4）
 *
 * <p>给定一条待研判舆情与若干候选事件，决定它并入哪个事件或新建事件。
 * 决策要素有三个：<b>时间窗</b>、<b>相似度</b>、<b>容量上限</b>。</p>
 *
 * <ul>
 *   <li><b>时间窗</b>：只与「最近出现时间在 N 小时内」的事件比较。
 *       没有时间约束的话，半年前同一主体的旧闻会被聚合进当前事件，
 *       时间轴上会突然出现一条历史节点，反而误导研判。</li>
 *   <li><b>相似度</b>：取候选中最高的一个，超过阈值即并入（不做多事件归并，
 *       避免一次聚合把两个真实不同的事件合并成一个，那是不可逆的）。</li>
 *   <li><b>容量上限</b>：簇内条数达上限后不再并入，只更新计数 ——
 *       防止一个超级热点把海量记录全塞进一个事件，导致该事件的任何查询都超时。</li>
 * </ul>
 *
 * <p>聚合是<b>单向追加</b>的：本类只在「新舆情 → 既有事件」方向做决策，
 * 不拆分、不合并既有事件。拆分与合并属于人工干预范畴。</p>
 *
 * @author ruoyi
 */
public final class OpinionClusterer {

    /** 相似度默认阈值 */
    public static final double DEFAULT_THRESHOLD = 0.62;

    /** 默认时间窗（小时） */
    public static final int DEFAULT_WINDOW_HOURS = 72;

    /** 默认容量上限 */
    public static final int DEFAULT_MAX_OPINIONS = 500;

    /* 换行与回车用十进制构造，理由同 RuleJudger：避免转义序列被提前解析 */
    private static final char LF = (char) 10;
    private static final char CR = (char) 13;

    private OpinionClusterer() {
    }

    /**
     * 候选事件（只带决策需要的字段）。
     */
    @Data
    public static class Candidate {

        private Long clusterId;
        private String clusterTitle;
        private String clusterTopic;
        private Integer opinionCount;
        private LocalDateTime lastTime;
        private Integer peakHeat;

        public Candidate() {
        }

        public Candidate(Long clusterId, String clusterTitle, String clusterTopic,
                         Integer opinionCount, LocalDateTime lastTime, Integer peakHeat) {
            this.clusterId = clusterId;
            this.clusterTitle = clusterTitle;
            this.clusterTopic = clusterTopic;
            this.opinionCount = opinionCount;
            this.lastTime = lastTime;
            this.peakHeat = peakHeat;
        }
    }

    /**
     * 决策。
     *
     * @param title       待聚合舆情标题
     * @param content     待聚合舆情正文
     * @param publishTime 待聚合舆情发布时间（null 用当前时间）
     * @param candidates  候选事件列表（可为 null）
     * @param threshold   相似度阈值，<=0 用默认
     * @param windowHours 时间窗小时，<=0 用默认
     * @param maxOpinions 容量上限，<=0 用默认
     * @return 决策结果，永不返回 null
     */
    public static ClusterDraft decide(String title, String content, LocalDateTime publishTime,
                                      List<Candidate> candidates,
                                      double threshold, int windowHours, int maxOpinions) {
        double th = threshold <= 0 ? DEFAULT_THRESHOLD : threshold;
        int win = windowHours <= 0 ? DEFAULT_WINDOW_HOURS : windowHours;
        int cap = maxOpinions <= 0 ? DEFAULT_MAX_OPINIONS : maxOpinions;
        LocalDateTime now = publishTime == null ? LocalDateTime.now() : publishTime;

        List<Candidate> pool = new ArrayList<>();
        if (candidates != null) {
            for (Candidate c : candidates) {
                if (c == null || c.getClusterId() == null) {
                    continue;
                }
                if (!inWindow(c.getLastTime(), now, win)) {
                    continue;
                }
                if (c.getOpinionCount() != null && c.getOpinionCount() >= cap) {
                    continue;
                }
                pool.add(c);
            }
        }
        pool.sort(Comparator.comparing(Candidate::getClusterId));

        Candidate best = null;
        double bestScore = 0d;
        for (Candidate c : pool) {
            double score = TextSimilarity.weighted(title, content,
                c.getClusterTitle(), c.getClusterTopic(), TextSimilarity.DEFAULT_TITLE_WEIGHT);
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        if (best != null && bestScore >= th) {
            ClusterDraft d = ClusterDraft.join(best.getClusterId(), round(bestScore));
            d.setCandidateCount(pool.size());
            return d;
        }
        ClusterDraft d = ClusterDraft.create(safeTitle(title), safeTitle(title));
        d.setCandidateCount(pool.size());
        d.setSimilarity(round(bestScore));
        return d;
    }

    /**
     * 时间窗判定。
     *
     * <p>允许「事件最近出现时间」晚于当前舆情发布时间（乱序采集、
     * 补采历史数据都会造成），因此用绝对值比较，不做单边判断。</p>
     */
    static boolean inWindow(LocalDateTime lastTime, LocalDateTime now, int windowHours) {
        if (lastTime == null) {
            /* 事件从未有过时间：视为可比较，让首条数据能自愈 */
            return true;
        }
        long minutes = Math.abs(Duration.between(lastTime, now).toMinutes());
        return minutes <= (long) windowHours * 60L;
    }

    static String safeTitle(String title) {
        String t = title == null ? "" : title.trim().replace(CR, ' ').replace(LF, ' ');
        if (t.isEmpty()) {
            return "未命名事件";
        }
        return t.length() > 200 ? t.substring(0, 200) : t;
    }

    static double round(double v) {
        return Math.round(v * 10000d) / 10000d;
    }
}
