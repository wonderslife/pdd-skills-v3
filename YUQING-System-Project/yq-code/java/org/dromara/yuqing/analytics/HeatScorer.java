package org.dromara.yuqing.analytics;

/**
 * 综合热度打分
 *
 * <p>权重拍板：阅读 1 / 评论 3 / 转发 5 / 点赞 1 / 内容热度 10。
 * 逻辑是「主动行为权重高于被动浏览，转发权重最高（跨圈层扩散）。」</p>
 *
 * <p><b>为什么用 {@code long} 而不是浮点：</b>热度既要用于排序、又要落库与做报表，
 * 浮点在「相等则按时间倒序」的 tie-break 上会因精度抖动导致同一天重跑名次变化，
 * 破坏幂等直觉。整数运算可复现，同输入必得同输出。</p>
 *
 * @author ruoyi
 */
public final class HeatScorer {

    /** 阅读权重 */
    public static final int W_READ = 1;

    /** 评论权重 */
    public static final int W_COMMENT = 3;

    /** 转发权重 */
    public static final int W_SHARE = 5;

    /** 点赞权重 */
    public static final int W_LIKE = 1;

    /** 内容热度分值权重 */
    public static final int W_CONTENT = 10;

    /**
     * 计算综合热度分值
     *
     * @param o 舆情切片
     * @return 分值（非负）
     */
    public static long score(OpinionSlice o) {
        if (o == null) {
            return 0L;
        }
        long v = nz(o.getReadCount()) * W_READ
            + nz(o.getCommentCount()) * W_COMMENT
            + nz(o.getShareCount()) * W_SHARE
            + nz(o.getLikeCount()) * W_LIKE
            + (o.getHeatScore() == null ? 0L : o.getHeatScore()) * W_CONTENT;
        return Math.max(v, 0L);
    }

    /** 互动量合计（阅读+评论+转发+点赞），看板「互动数据统计」用 */
    public static long interaction(OpinionSlice o) {
        if (o == null) {
            return 0L;
        }
        return nz(o.getReadCount()) + nz(o.getCommentCount()) + nz(o.getShareCount()) + nz(o.getLikeCount());
    }

    private static long nz(Long v) {
        return v == null ? 0L : Math.max(v, 0L);
    }

    private HeatScorer() {
    }
}
