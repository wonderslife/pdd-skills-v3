package org.dromara.yuqing.alert;

/**
 * 舆情分级兜底判定器（F-010 依赖 F-008 分级体系）
 *
 * <p><b>为什么需要兜底：</b>F-007「智能研判」落地前，{@code yq_opinion.analyze_status}
 * 在采集链路里只会被写成 {@code pending}，分级/风险/传播量级三个字段为空。若引擎直接跳过空值，
 * 预警链路就是一条死链。这里按 F-008 的字典口径做本地可解释判定，
 * <b>F-007 落地后自动让位</b>（只补空值，不覆盖已有判定）。</p>
 *
 * <p>F-007 已落地（见 {@code org.dromara.yuqing.analysis}），研判结论会把三个字段
 * 直接回写主表；本兜底仍然保留 —— 它是「大模型不可用 + 规则也没跑」时的最后一道保险，
 * 成本是一次内存判定，收益是预警链路永不空转。</p>
 *
 * <p>判定口径（全部可解释、可单测）：</p>
 * <ul>
 *   <li>传播量级：阅读量 {@code <1千=low / <1万=medium / <10万=high / >=10万=viral}；
 *       阅读量缺失时用 点赞+评论+转发 之和按同一组阈值。</li>
 *   <li>风险等级：仅负面舆情有风险；{@code severe}=负面且(热度>=80 或 传播>=high)，
 *       {@code moderate}=负面且(热度>=50 或 传播>=medium)，其余负面为 {@code general}。</li>
 *   <li>舆情分级：{@code urgent}=severe 且 传播>=high；{@code warning}=severe 或 (moderate 且 传播>=medium)；
 *       {@code attention}=moderate 或 general 且 传播>=medium；其余 {@code normal}。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class LevelResolver {

    private static final long THOUSAND = 1_000L;
    private static final long TEN_THOUSAND = 10_000L;
    private static final long HUNDRED_THOUSAND = 100_000L;

    private LevelResolver() {
    }

    /**
     * 判定完成标记。
     *
     * <p><b>取值必须是 {@code completed}</b> —— 与字典 {@code yq_analyze_status}
     * （pending/processing/completed/failed）以及 F-007 的
     * {@code AnalysisOpinionDao.ST_COMPLETED} 三方一致。
     * 早期这里是 {@code "done"}，那是全项目从未被任何一方写入过的死常量：
     * 字典里没有它、台账按它筛选永远筛不到、F-007 也不会产出它。</p>
     */
    public static final String ANALYZED = "completed";

    /**
     * 就地补齐候选的分级字段（只填空，不覆盖）。
     *
     * @return true 表示本次发生了兜底判定
     */
    public static boolean resolve(AlertCandidate c) {
        if (c == null) {
            return false;
        }
        boolean filled = false;
        if (blank(c.getSpreadLevel())) {
            c.setSpreadLevel(resolveSpread(c));
            filled = true;
        }
        if (blank(c.getRiskLevel())) {
            c.setRiskLevel(resolveRisk(c));
            filled = true;
        }
        if (blank(c.getOpinionLevel())) {
            c.setOpinionLevel(resolveLevel(c));
            filled = true;
        }
        return filled;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** 传播量级 */
    public static String resolveSpread(AlertCandidate c) {
        long metric = spreadMetric(c);
        if (metric >= HUNDRED_THOUSAND) {
            return "viral";
        }
        if (metric >= TEN_THOUSAND) {
            return "high";
        }
        if (metric >= THOUSAND) {
            return "medium";
        }
        return "low";
    }

    /** 传播量取值：优先阅读量，缺失时用互动量之和 */
    public static long spreadMetric(AlertCandidate c) {
        Long read = c.getReadCount();
        if (read != null && read > 0) {
            return read;
        }
        return nz(c.getLikeCount()) + nz(c.getCommentCount()) + nz(c.getShareCount());
    }

    /** 风险等级：非负面一律无风险（返回 null，表示不参与风险阈值比较） */
    public static String resolveRisk(AlertCandidate c) {
        if (!"negative".equals(c.getSentiAttr())) {
            return null;
        }
        int heat = c.getHeatScore() == null ? 0 : c.getHeatScore();
        int spread = AlertRuleSpec.spreadRank(resolveSpread(c));
        if (heat >= 80 || spread >= AlertRuleSpec.spreadRank("high")) {
            return "severe";
        }
        if (heat >= 50 || spread >= AlertRuleSpec.spreadRank("medium")) {
            return "moderate";
        }
        return "general";
    }

    /** 舆情分级 */
    public static String resolveLevel(AlertCandidate c) {
        String risk = c.getRiskLevel() == null ? resolveRisk(c) : c.getRiskLevel();
        int spread = AlertRuleSpec.spreadRank(c.getSpreadLevel() == null ? resolveSpread(c) : c.getSpreadLevel());
        int riskRank = AlertRuleSpec.riskRank(risk);
        if (riskRank >= 3 && spread >= AlertRuleSpec.spreadRank("high")) {
            return "urgent";
        }
        if (riskRank >= 3 || (riskRank >= 2 && spread >= AlertRuleSpec.spreadRank("medium"))) {
            return "warning";
        }
        if (riskRank >= 2 || spread >= AlertRuleSpec.spreadRank("medium")) {
            return "attention";
        }
        return "normal";
    }

    private static long nz(Long v) {
        return v == null ? 0L : Math.max(0L, v);
    }
}
