package org.dromara.yuqing.collect.clean;

import org.dromara.yuqing.collect.model.RawOpinion;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 按天链接去重 + 跨渠道合并（F-006 验收标准 4 / 8）。
 *
 * <p><b>去重粒度取「按天」：</b>主键是 {@code (collect_date, url_hash)}，
 * 跨天不算重复——同一条事件连续多天被转发，本身就是传播态势的一部分，
 * 全局去重会把它压成一条，反而丢掉趋势信息。</p>
 *
 * <p><b>首条保留规则：</b>同一 {@code (采集日, 链接)} 分组内，取采集时间最早的一条；
 * 其余条目的渠道ID补充到首条的 {@code dup_channel_ids} 上，这样台账里
 * 「这条在哪些渠道都出现过」一目了然，而统计口径仍然只算一条。</p>
 *
 * <p><b>边界：</b>本类是纯内存合并，覆盖「同一次调度内多渠道撞车」这一主要场景。
 * 跨批次（间隔数小时）的跨渠道重复由 Redis 去重拦下并计入 {@code dupChannelCount}，
 * 但不会回写首条的渠道列表——攒批写入已落盘，回头改首条要再读一次全量内容，不划算。</p>
 *
 * @author ruoyi
 */
public final class CrossChannelMerger {

    /** 按采集时间升序（无采集时间的排后面），保证「首条」语义稳定可复现 */
    private static final Comparator<RawOpinion> BY_COLLECT_TIME =
        Comparator.comparing(RawOpinion::getCollectTime, Comparator.nullsLast(Comparator.naturalOrder()));

    private CrossChannelMerger() {
    }

    /**
     * 分组键：采集日 + 链接指纹。
     *
     * @param collectDate 采集日
     * @param urlHash     链接指纹
     * @return 分组键
     */
    public static String dayKey(LocalDate collectDate, String urlHash) {
        String d = collectDate == null ? "null" : collectDate.toString();
        return d + "|" + (urlHash == null ? "" : urlHash);
    }

    /**
     * 合并一批待入库记录。
     *
     * @param rows 候选记录（同一批次内）
     * @return 合并结果
     */
    public static MergeOutcome merge(List<RawOpinion> rows) {
        MergeOutcome outcome = new MergeOutcome();
        if (rows == null || rows.isEmpty()) {
            return outcome;
        }
        Map<String, List<RawOpinion>> groups = new LinkedHashMap<>();
        for (RawOpinion row : rows) {
            String key = dayKey(row.getCollectDate(), row.getUrlHash());
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(row);
        }
        for (List<RawOpinion> group : groups.values()) {
            List<RawOpinion> sorted = new ArrayList<>(group);
            sorted.sort(BY_COLLECT_TIME);
            RawOpinion keeper = sorted.get(0);
            Set<Long> extraChannels = new LinkedHashSet<>();
            String existing = keeper.getDupChannelIds();
            if (existing != null && !existing.isEmpty()) {
                for (String part : existing.split(",")) {
                    String s = part.trim();
                    if (!s.isEmpty()) {
                        extraChannels.add(Long.valueOf(s));
                    }
                }
            }
            for (int i = 1; i < sorted.size(); i++) {
                RawOpinion dup = sorted.get(i);
                outcome.dupCount++;
                if (dup.getChannelId() != null && !dup.getChannelId().equals(keeper.getChannelId())) {
                    extraChannels.add(dup.getChannelId());
                    outcome.dupChannelCount++;
                }
            }
            if (!extraChannels.isEmpty()) {
                keeper.setDupChannelIds(String.join(",", extraChannels.stream().map(String::valueOf).toArray(String[]::new)));
            }
            outcome.keepers.add(keeper);
        }
        return outcome;
    }

    /**
     * 合并结果。
     */
    public static final class MergeOutcome {

        private final List<RawOpinion> keepers = new ArrayList<>();

        private int dupCount;

        private int dupChannelCount;

        /**
         * 保留下来的首条集合。
         *
         * @return 待入库记录
         */
        public List<RawOpinion> getKeepers() {
            return keepers;
        }

        /**
         * 被判重复的条数。
         *
         * @return 重复条数
         */
        public int getDupCount() {
            return dupCount;
        }

        /**
         * 其中属于「不同渠道重复」的条数。
         *
         * @return 跨渠道重复条数
         */
        public int getDupChannelCount() {
            return dupChannelCount;
        }
    }
}
