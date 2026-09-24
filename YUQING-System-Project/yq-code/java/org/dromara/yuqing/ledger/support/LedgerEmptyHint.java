package org.dromara.yuqing.ledger.support;

import org.dromara.yuqing.ledger.domain.LedgerQuery;

import java.util.ArrayList;
import java.util.List;

/**
 * 空状态筛选建议（F-016 验收标准 9）
 *
 * <p>验收标准 9 要求「查询无结果时展示空状态提示并给出可放宽的筛选建议」。
 * 建议必须**针对当前实际生效的条件**，而不是一段固定文案 ——
 * 用户看到「请放宽条件」而自己明明只筛了一个渠道，只会更困惑。</p>
 *
 * <p>纯函数：输入查询条件与可见范围，输出按「最可能奏效」排序的建议列表。
 * 顺序即优先级，前端第一条作为主提示，其余作为补充。</p>
 *
 * <p><b>为什么第一条要判可见范围：</b>无结果有两种截然不同的原因 ——
 * 「条件太窄」与「本来就没有授权数据」。后者再怎么放宽条件都是 0 条，
 * 必须明确告知并指向管理员，否则用户会反复重试。</p>
 *
 * @author ruoyi
 */
public final class LedgerEmptyHint {

    private LedgerEmptyHint() {
    }

    /**
     * 生成放宽建议。
     *
     * @param q     查询条件（可为 null）
     * @param scope 可见范围（可为 null，视为不限）
     * @return 建议列表；恒非 null（无建议时返回含一条兜底文案的列表）
     */
    public static List<String> suggest(LedgerQuery q, LedgerScope scope) {
        List<String> out = new ArrayList<>();

        /* 0. 最高优先级：根本没有授权数据 */
        if (scope != null && scope.isDenyAll()) {
            out.add("当前账号没有被授权的监测任务，台账只展示本人任务范围内的舆情。"
                + "请联系管理员为您分配任务，或让管理员代为查询。");
            out.add("若您确认应能看到数据，请检查任务是否由本账号创建（数据范围按任务归属判定）。");
            return out;
        }

        if (q == null) {
            out.add("当前条件下没有查询到舆情。可以放宽时间范围后重试。");
            return out;
        }

        /* 1. 条件过多：先建议减少维度 */
        int active = countActiveConditions(q);
        if (active >= 5) {
            out.add("已同时启用 " + active + " 个筛选条件，多条件叠加很容易命中空集。"
                + "建议先只保留时间范围，再逐步逐个收窄。");
        }

        /* 2. 逐个条件给出针对性放宽建议（顺序 = 影响面从大到小） */
        if (notBlank(q.getCollectBeginTime()) || notBlank(q.getCollectEndTime())) {
            out.add("当前采集时间范围为「" + rangeHint(q.getCollectBeginTime(), q.getCollectEndTime())
                + "」，建议扩大到最近 7 天甚至 30 天。");
        }
        if (notBlank(q.getAnalyzeStatus())) {
            out.add("已限定研判状态为「" + q.getAnalyzeStatus()
                + "」。刚采集的数据通常还是 pending（待研判），可切换为「全部状态」。");
        }
        if (notBlank(q.getCleanStatus())) {
            out.add("已限定清洗状态为「" + q.getCleanStatus()
                + "」。被降噪剔除（rejected）的数据不进入研判流程，"
                + "若在找研判结论请改为「已净化」。");
        }
        if (q.getTagIds() != null && !q.getTagIds().isEmpty()) {
            out.add("已选择 " + q.getTagIds().size() + " 个标签，标签是「同时满足」的交集口径，"
                + "建议减少标签数量或改为逐个查看。");
        }
        if (q.getClusterId() != null) {
            out.add("已锁定到单个事件聚合，该事件下的舆情可能已被过滤条件排除，"
                + "建议去掉事件聚合再查一次。");
        }
        if (q.getTaskId() != null) {
            out.add("已限定到单个监测任务，换一个任务或清空该条件试试。");
        }
        if (q.getChannelId() != null) {
            out.add("已限定到单个采集渠道，可清空渠道条件对比其它来源。");
        }
        if (notBlank(q.getSentiAttr()) || notBlank(q.getRiskLevel()) || notBlank(q.getOpinionLevel())) {
            out.add("属性 / 风险等级 / 分级是互斥单值筛选，三者叠加时容易只留下极少数记录，"
                + "建议一次只保留一个。");
        }
        if (notBlank(q.getKeyword())) {
            out.add("关键词「" + brief(q.getKeyword()) + "」可能限定得过细，"
                + "建议改用更短的词根（去掉修饰语），或切换为全文检索在正文里找。");
        }
        if (notBlank(q.getCollectSource())) {
            out.add("已限定采集来源为「" + q.getCollectSource()
                + "」，人工导入与自动采集是分开的，可清空以同时查看。");
        }

        /* 3. 兜底 */
        if (out.isEmpty()) {
            out.add("当前条件下没有查询到舆情，建议扩大时间范围或减少筛选条件后重试。");
        }
        out.add("也可以直接清空全部条件，先看整体数据量再逐步收窄。");
        return out;
    }

    /** 统计已生效的条件个数（用于「条件过多」提示） */
    public static int countActiveConditions(LedgerQuery q) {
        if (q == null) {
            return 0;
        }
        int n = 0;
        if (notBlank(q.getCollectBeginTime()) || notBlank(q.getCollectEndTime())) {
            n++;
        }
        if (notBlank(q.getPublishBeginTime()) || notBlank(q.getPublishEndTime())) {
            n++;
        }
        if (q.getTaskId() != null) {
            n++;
        }
        if (q.getChannelId() != null) {
            n++;
        }
        if (q.getClusterId() != null) {
            n++;
        }
        if (notBlank(q.getSentiAttr())) {
            n++;
        }
        if (notBlank(q.getRiskLevel())) {
            n++;
        }
        if (notBlank(q.getOpinionLevel())) {
            n++;
        }
        if (notBlank(q.getSpreadLevel())) {
            n++;
        }
        if (notBlank(q.getCollectSource())) {
            n++;
        }
        if (notBlank(q.getCleanStatus())) {
            n++;
        }
        if (notBlank(q.getAnalyzeStatus())) {
            n++;
        }
        if (q.getTagIds() != null && !q.getTagIds().isEmpty()) {
            n++;
        }
        if (notBlank(q.getKeyword())) {
            n++;
        }
        if (notBlank(q.getAlertFlag())) {
            n++;
        }
        return n;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    /** 时间区间的可读片段，形如 2026-09-01~2026-09-23 */
    private static String rangeHint(String begin, String end) {
        boolean b = notBlank(begin);
        boolean e = notBlank(end);
        return (b ? begin.trim() : "不限") + " ~ " + (e ? end.trim() : "不限");
    }

    /** 关键词过长时截断展示，避免建议文案本身变成一堵墙 */
    private static String brief(String v) {
        String t = v.trim();
        return t.length() <= 12 ? t : t.substring(0, 12) + "...";
    }
}
