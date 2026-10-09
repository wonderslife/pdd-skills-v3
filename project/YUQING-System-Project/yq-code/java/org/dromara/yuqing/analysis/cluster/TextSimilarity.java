package org.dromara.yuqing.analysis.cluster;

import org.dromara.yuqing.analysis.variant.VariantDetector;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 中文文本相似度（F-007 验收标准 4）
 *
 * <p><b>为什么不用分词：</b>分词要么引入词典依赖（需要维护、需要更新，
 * 且不同领域切分口径不同），要么引入模型（成本与延迟都不合适）。
 * 字符 bi-gram（相邻两字组成一个特征）对中文短文本效果稳定、
 * 完全无依赖、结果确定可复现 —— 对「判断两条舆情是不是同一件事」
 * 这个粒度来说足够用。</p>
 *
 * <p><b>为什么用 Jaccard 而不是余弦：</b>不需要构造向量空间与词频权重，
 * 单条舆情与若干候选事件两两比较的场景用集合交并比更直观，
 * 也容易向业务方解释阈值含义。</p>
 *
 * <p><b>归一化：</b>调用 {@link VariantDetector#normalize} 做同一套归一
 * （去分隔符、全半角、小写）。这带来一个额外好处：插入分隔符的
 * 变体刷屏（把词拆成一个字一个字）在相似度层面也会被识别为同一条。</p>
 *
 * @author ruoyi
 */
public final class TextSimilarity {

    /** 默认标题权重 */
    public static final double DEFAULT_TITLE_WEIGHT = 0.7;

    /** 标题完全不像但正文雷同时的折扣（按转载处理，不轻易聚合） */
    private static final double REPOST_DISCOUNT = 0.5;

    private TextSimilarity() {
    }

    /**
     * bi-gram 集合 Jaccard 相似度。
     *
     * @return 0~1；任一侧为空返回 0
     */
    public static double jaccard(String a, String b) {
        Set<String> sa = bigrams(a);
        Set<String> sb = bigrams(b);
        if (sa.isEmpty() || sb.isEmpty()) {
            /* 极短文本（1 个字）退化为一元集合比较，避免恒为 0 */
            return overlap(chars(a), chars(b));
        }
        return overlap(sa, sb);
    }

    /**
     * 标题 + 正文加权相似度。
     *
     * <p>标题权重高于正文：同一事件的报道常常正文差异很大（不同媒体
     * 各写一段），但标题会高度接近；反之标题完全不同而正文雷同的，
     * 多半是模板稿或转载，聚合它们价值不大 —— 但仍给一个折扣后的分数，
     * 而不是直接归零，以免把真实的跨标题转载漏掉。</p>
     *
     * @param titleWeight 标题权重（0~1），非法值用 0.7
     */
    public static double weighted(String titleA, String contentA, String titleB, String contentB,
                                  double titleWeight) {
        double w = (titleWeight <= 0 || titleWeight >= 1) ? DEFAULT_TITLE_WEIGHT : titleWeight;
        double t = jaccard(titleA, titleB);
        double c = jaccard(contentA, contentB);
        if (t == 0d) {
            return c * (1 - w) * REPOST_DISCOUNT;
        }
        return t * w + c * (1 - w);
    }

    /**
     * 是否相似。
     *
     * @param threshold 阈值（0~1）；<=0 时用默认 0.62
     */
    public static boolean similar(String titleA, String contentA, String titleB, String contentB,
                                  double threshold) {
        double th = threshold <= 0 ? OpinionClusterer.DEFAULT_THRESHOLD : threshold;
        return weighted(titleA, contentA, titleB, contentB, DEFAULT_TITLE_WEIGHT) >= th;
    }

    /* ------------------------------------------------------------------ 内部 */

    static Set<String> bigrams(String s) {
        Set<String> out = new LinkedHashSet<>();
        if (s == null) {
            return out;
        }
        String n = VariantDetector.normalize(s);
        if (n.length() < 2) {
            return out;
        }
        for (int i = 0; i + 2 <= n.length(); i++) {
            out.add(n.substring(i, i + 2));
        }
        return out;
    }

    static Set<String> chars(String s) {
        Set<String> out = new LinkedHashSet<>();
        if (s == null) {
            return out;
        }
        String n = VariantDetector.normalize(s);
        for (int i = 0; i < n.length(); i++) {
            out.add(String.valueOf(n.charAt(i)));
        }
        return out;
    }

    static double overlap(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0d;
        }
        int inter = 0;
        Set<String> small = a.size() <= b.size() ? a : b;
        Set<String> large = small == a ? b : a;
        for (String s : small) {
            if (large.contains(s)) {
                inter++;
            }
        }
        int union = a.size() + b.size() - inter;
        return union == 0 ? 0d : (double) inter / union;
    }
}
