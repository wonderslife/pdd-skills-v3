/**
 * F-016 台账 · 模板 2：纯函数支撑类（无 Spring 依赖，可离线自测）
 *
 * 产物：
 *   ledger/support/LedgerScope.java           数据可见范围值对象（③A）
 *   ledger/support/LedgerScopeResolver.java   范围推导（纯函数）
 *   ledger/support/LedgerHighlighter.java     全文检索高亮（XSS 安全，纯函数）
 *   ledger/support/LedgerEmptyHint.java       空状态筛选建议（纯函数）
 *   ledger/support/LedgerColumnCatalog.java   导出字段白名单（反射自 LedgerRow）
 *   ledger/support/LedgerQuerySummary.java    筛选条件可读摘要（审计用，纯函数）
 *   ledger/support/LedgerTimeParser.java      宽容时间解析（纯函数）
 *   ledger/support/LedgerStages.java          传播阶段判定（纯函数）
 *
 * 为什么单独拆一个 support 包：这些逻辑是「台账的正确性与安全性所在」，
 * 而它们都不需要数据库、不需要 Spring 上下文。拆出来就能被 F016LedgerTest
 * 直接断言 —— 尤其是高亮的 XSS 转义与数据权限的空集语义，
 * 这两处一旦回归，后果是「信息泄露」而不是「页面难看」。
 */
export const LEDGER_TPL2 = [

  /* ==================================================== 数据可见范围 */
  {
    rel: 'ledger/support/LedgerScope.java',
    content: `package org.dromara.yuqing.ledger.support;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 台账数据可见范围（F-016 验收标准 8，架构决策 ③A）
 *
 * <p><b>③A 口径：</b>非管理员的可见范围 = 他名下监测任务
 * （{@code yq_task.create_by = 当前用户}）所产生的舆情。
 * 判定依据是「任务归属」而不是「部门」，因为舆情任务常常是跨部门临时专项，
 * 按部门切会把协作者挡在外面、把无关同事放进来。</p>
 *
 * <p><b>为什么必须是三态而不是一个集合：</b>如果只用「可见 taskId 集合」表达，
 * 空集合既可解释为「看不到任何数据」也可解释为「不过滤」—— 这两者差一次
 * 全量数据泄露。因此本类显式区分：</p>
 * <ul>
 *   <li>{@code unrestricted = true}：管理员，不加任何行级条件</li>
 *   <li>{@code denyAll = true}：范围为空，直接返回空结果，<b>不查库</b></li>
 *   <li>两者皆 false：按 {@code taskIds} 过滤</li>
 * </ul>
 *
 * <p><b>任务未归属（task_id 为 NULL）的数据：</b>不在任何人的「任务范围」内，
 * 因此非管理员看不到第三方导入的、尚未挂到任务下的舆情。这是刻意的保守选择 ——
 * 宁可让管理员去挂任务，也不要让范围外的数据自动可见。</p>
 *
 * @author ruoyi
 */
public final class LedgerScope {

    /** 不加行级限制（管理员） */
    private final boolean unrestricted;

    /** 范围为空，可见结果必为空集 */
    private final boolean denyAll;

    /** 可见任务ID集合（仅 restricted 态有意义） */
    private final Set<Long> taskIds;

    private LedgerScope(boolean unrestricted, boolean denyAll, Set<Long> taskIds) {
        this.unrestricted = unrestricted;
        this.denyAll = denyAll;
        this.taskIds = taskIds == null
            ? Collections.emptySet()
            : Collections.unmodifiableSet(new LinkedHashSet<>(taskIds));
    }

    /** 不限制（管理员 / 具备全量数据角色的用户） */
    public static LedgerScope all() {
        return new LedgerScope(true, false, null);
    }

    /** 显式空范围（会返回空结果，不会退化成全量） */
    public static LedgerScope none() {
        return new LedgerScope(false, true, null);
    }

    /**
     * 按任务集合限定范围。
     *
     * <p><b>关键安全语义：</b>传入空集合时返回 {@link #none()} 而不是
     * {@link #all()}。调用方不需要（也不应该）自己判空。</p>
     */
    public static LedgerScope ofTasks(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return none();
        }
        Set<Long> clean = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                clean.add(id);
            }
        }
        if (clean.isEmpty()) {
            return none();
        }
        return new LedgerScope(false, false, clean);
    }

    public boolean isUnrestricted() {
        return unrestricted;
    }

    public boolean isDenyAll() {
        return denyAll;
    }

    public Set<Long> getTaskIds() {
        return taskIds;
    }

    /**
     * 判断某条舆情（按 taskId）是否在本范围内。
     *
     * <p>供离线自测直接断言隔离正确性；生产查询走 SQL 条件（见 LedgerOpinionDao），
     * 但两者必须口径一致，因此本方法即「口径的可执行定义」。</p>
     */
    public boolean allows(Long taskId) {
        if (unrestricted) {
            return true;
        }
        if (denyAll) {
            return false;
        }
        return taskId != null && taskIds.contains(taskId);
    }

    /** 人类可读描述，用于审计记录与调试 */
    public String describe() {
        if (unrestricted) {
            return "全量";
        }
        if (denyAll) {
            return "无授权范围（可见 0 条）";
        }
        return "任务范围(" + taskIds.size() + " 个任务)";
    }
}
`,
  },

  {
    rel: 'ledger/support/LedgerScopeResolver.java',
    content: `package org.dromara.yuqing.ledger.support;

import java.util.Collection;
import java.util.Set;

/**
 * 台账数据范围推导（F-016 验收标准 8，架构决策 ③A）
 *
 * <p>纯函数：输入「是否管理员 + 名下任务ID集合」，输出 {@link LedgerScope}。
 * 不依赖 Sa-Token、不依赖数据库，便于离线自测覆盖全部分支。</p>
 *
 * <p><b>为什么把判定抽成纯函数：</b>数据权限是「错了就泄露」的逻辑，
 * 必须有可重复执行的断言。若把判定写在 ServiceImpl 里，
 * 就只能靠跑起整个 Spring 上下文 + 造多用户会话来验证，
 * 实际结果就是没人验证。抽成纯函数后，
 * {@code F016LedgerTest} 用一个循环就能覆盖管理员 / 单任务 / 空范围三种分支。</p>
 *
 * @author ruoyi
 */
public final class LedgerScopeResolver {

    private LedgerScopeResolver() {
    }

    /**
     * 推导可见范围。
     *
     * @param superAdmin    是否超级管理员（等价于「全量可见」）
     * @param hasAllDataRole 是否具备「全量数据」角色（如舆情主管按 PRD §7.3 为 ✅ 全部）
     * @param ownedTaskIds  当前用户名下的监测任务ID（{@code yq_task.create_by = 本人}）
     * @return 可见范围；{@code ownedTaskIds} 为空且无全量角色时返回 {@link LedgerScope#none()}
     */
    public static LedgerScope resolve(boolean superAdmin, boolean hasAllDataRole, Collection<Long> ownedTaskIds) {
        if (superAdmin || hasAllDataRole) {
            return LedgerScope.all();
        }
        return LedgerScope.ofTasks(ownedTaskIds);
    }

    /**
     * 反向校验：一个范围对象是否与「期望可见的 taskId 集合」一致。
     *
     * <p>仅用于自测断言，生产代码不要调用 —— 它会把整个候选集合遍历一遍。</p>
     */
    public static boolean consistent(LedgerScope scope, Collection<Long> candidates, Set<Long> shouldSee) {
        if (scope == null || candidates == null) {
            return false;
        }
        for (Long id : candidates) {
            boolean visible = scope.allows(id);
            boolean expected = shouldSee != null && shouldSee.contains(id);
            if (visible != expected) {
                return false;
            }
        }
        return true;
    }
}
`,
  },

  /* ==================================================== 全文检索高亮 */
  {
    rel: 'ledger/support/LedgerHighlighter.java',
    content: `package org.dromara.yuqing.ledger.support;

import java.util.ArrayList;
import java.util.List;

/**
 * 全文检索高亮（F-016 验收标准 7）
 *
 * <p><b>安全核心：先转义、后标记。</b>返回的片段是「可被 v-html 直接渲染的
 * 安全 HTML」，因此转义必须在服务端完成，且顺序不可颠倒：</p>
 * <ol>
 *   <li>对原文中**非命中部分**做 HTML 实体转义（&amp; &lt; &gt; &quot; &#39;）；</li>
 *   <li>命中词本身同样转义后，再整体包进 &lt;em class="yq-hit"&gt; 标记；</li>
 *   <li>标记字符串由本类以自己的常量拼接，绝不来自输入。</li>
 * </ol>
 *
 * <p>如果反过来（先插标记再转义），标记会被转义成文本，高亮失效；
 * 如果先插标记且不转义，那么正文里的 {@code <script>} 会原样进入 DOM ——
 * 因为采集来的舆情正文是完全不可信的外部内容，这是存储型 XSS 的标准入口。</p>
 *
 * <p>关键词本身也不可信：用户可以把 {@code <img onerror=...>} 当关键词搜。
 * 本类对命中词做了与正文同样的转义，因此关键词注入同样无效
 * （自测用例 F016LedgerTest 覆盖）。</p>
 *
 * @author ruoyi
 */
public final class LedgerHighlighter {

    /** 高亮标记（前端样式类名固定为 yq-hit，勿改） */
    public static final String MARK_OPEN = "<em class=\\"yq-hit\\">";
    public static final String MARK_CLOSE = "</em>";

    /** 省略号占位 */
    private static final String ELLIPSIS = "...";

    private LedgerHighlighter() {
    }

    /**
     * HTML 实体转义。
     *
     * <p>顺序敏感：{@code &} 必须最先替换，否则会把后续替换产生的
     * {@code &lt;} 再转义成 {@code &amp;lt;}（双重转义，页面显示成乱码文本）。</p>
     */
    public static String escapeHtml(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(raw.length() + 16);
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            switch (c) {
                case '&':
                    sb.append("&amp;");
                    break;
                case '<':
                    sb.append("&lt;");
                    break;
                case '>':
                    sb.append("&gt;");
                    break;
                case '"':
                    sb.append("&quot;");
                    break;
                case '\\'':
                    sb.append("&#39;");
                    break;
                default:
                    sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * 统计命中次数（大小写不敏感）。
     *
     * @return 命中次数；正文或关键词为空时返回 0
     */
    public static int countHits(String text, String keyword) {
        if (text == null || text.isEmpty() || keyword == null || keyword.isEmpty()) {
            return 0;
        }
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();
        int count = 0;
        int i = 0;
        while (true) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                break;
            }
            count++;
            i = hit + lk.length();
        }
        return count;
    }

    /**
     * 整段高亮（用于摘要 / 标题等短文本）。
     *
     * @return 已转义的安全 HTML
     */
    public static String highlight(String text, String keyword) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        if (keyword == null || keyword.isEmpty()) {
            return escapeHtml(text);
        }
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();
        StringBuilder sb = new StringBuilder(text.length() + 32);
        int i = 0;
        while (i < text.length()) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                sb.append(escapeHtml(text.substring(i)));
                break;
            }
            sb.append(escapeHtml(text.substring(i, hit)));
            sb.append(MARK_OPEN)
              .append(escapeHtml(text.substring(hit, hit + keyword.length())))
              .append(MARK_CLOSE);
            i = hit + keyword.length();
        }
        return sb.toString();
    }

    /**
     * 抽取高亮片段（验收标准 7 的「高亮命中片段」）。
     *
     * <p>算法：先定位所有命中位置，把每个命中扩成半径 {@code radius} 的窗口，
     * 再合并相互重叠/相邻的窗口，最后对每个窗口做整段高亮并补省略号。
     * 这样长正文里连续多处命中会合并成一段，而不是产出几条几乎重复的碎片。</p>
     *
     * @param text         原文
     * @param keyword      关键词
     * @param radius       命中词左右各取的字符数（小于 0 视为 0）
     * @param maxFragments 最多返回的片段数（小于等于 0 时返回空列表）
     * @return 已转义的片段列表（可直接 v-html）；无命中返回空列表
     */
    public static List<String> fragments(String text, String keyword, int radius, int maxFragments) {
        List<String> out = new ArrayList<>();
        if (text == null || text.isEmpty() || keyword == null || keyword.isEmpty() || maxFragments <= 0) {
            return out;
        }
        int r = Math.max(radius, 0);
        int klen = keyword.length();
        String lower = text.toLowerCase();
        String lk = keyword.toLowerCase();

        /* 1. 收集命中区间并扩窗 */
        List<int[]> windows = new ArrayList<>();
        int i = 0;
        while (true) {
            int hit = lower.indexOf(lk, i);
            if (hit < 0) {
                break;
            }
            int start = Math.max(0, hit - r);
            int end = Math.min(text.length(), hit + klen + r);
            if (!windows.isEmpty()) {
                int[] last = windows.get(windows.size() - 1);
                if (start <= last[1]) {
                    /* 与上一窗口重叠或相接 -> 合并 */
                    last[1] = Math.max(last[1], end);
                    i = hit + klen;
                    continue;
                }
            }
            windows.add(new int[]{start, end});
            i = hit + klen;
        }

        /* 2. 逐窗口整段高亮（内部仍按命中位置插标记，保证窗口内所有命中都高亮） */
        for (int w = 0; w < windows.size() && out.size() < maxFragments; w++) {
            int start = windows.get(w)[0];
            int end = windows.get(w)[1];
            String piece = highlight(text.substring(start, end), keyword);
            StringBuilder sb = new StringBuilder();
            if (start > 0) {
                sb.append(ELLIPSIS);
            }
            sb.append(piece);
            if (end < text.length()) {
                sb.append(ELLIPSIS);
            }
            out.add(sb.toString());
        }
        return out;
    }

    /**
     * 命中字段判定（验收标准 7 要求区分标题 / 正文命中）。
     *
     * @return title / content / both / none
     */
    public static String hitField(String title, String content, String keyword) {
        boolean t = countHits(title, keyword) > 0;
        boolean c = countHits(content, keyword) > 0;
        if (t && c) {
            return "both";
        }
        if (t) {
            return "title";
        }
        if (c) {
            return "content";
        }
        return "none";
    }
}
`,
  },

  /* ==================================================== 空状态建议 */
  {
    rel: 'ledger/support/LedgerEmptyHint.java',
    content: `package org.dromara.yuqing.ledger.support;

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
`,
  },

  /* ==================================================== 导出列白名单 */
  {
    rel: 'ledger/support/LedgerColumnCatalog.java',
    content: `package org.dromara.yuqing.ledger.support;

import org.apache.fesod.sheet.annotation.ExcelProperty;
import org.dromara.yuqing.ledger.domain.LedgerRow;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 导出字段目录（F-016 验收标准 5「字段范围可配置」）
 *
 * <p><b>白名单靠反射从 {@link LedgerRow} 自动派生，不手写第二份清单。</b>
 * 手写清单一定会与实体漂移：加了字段忘了加目录 → 新字段永远导不出来，
 * 且没有任何报错。反射派生则天然同步。</p>
 *
 * <p><b>安全：</b>前端传入的 columns 只能取本目录的子集，
 * 非法字段名一律丢弃（而不是报错中断导出）。因此不存在
 * 「构造任意字段名把不该导的列导出去」的越权面；
 * 同时输出列顺序按目录声明顺序固定，
 * 避免用户用 columns 顺序探测内部字段布局。</p>
 *
 * @author ruoyi
 */
public final class LedgerColumnCatalog {

    /** 字段名 -> 中文列名（LinkedHashMap 保序） */
    private static final Map<String, String> CATALOG;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        for (Field f : LedgerRow.class.getDeclaredFields()) {
            ExcelProperty p = f.getAnnotation(ExcelProperty.class);
            if (p != null && p.value() != null && p.value().length > 0) {
                m.put(f.getName(), p.value()[0]);
            }
        }
        CATALOG = Collections.unmodifiableMap(m);
    }

    private LedgerColumnCatalog() {
    }

    /** 全部可导出字段（按声明顺序） */
    public static List<String> allFields() {
        return new ArrayList<>(CATALOG.keySet());
    }

    /** 字段名 -> 中文列名 */
    public static Map<String, String> labels() {
        return CATALOG;
    }

    /** 字段是否在白名单内 */
    public static boolean isExportable(String field) {
        return field != null && CATALOG.containsKey(field);
    }

    /**
     * 把前端请求的列裁剪为合法列。
     *
     * @param requested 请求的字段名（可为 null / 空 -> 返回全量）
     * @return 合法字段名列表，按目录声明顺序（不是请求顺序，防止用顺序做指纹）
     */
    public static List<String> resolve(Collection<String> requested) {
        if (requested == null || requested.isEmpty()) {
            return allFields();
        }
        java.util.Set<String> want = new java.util.HashSet<>();
        for (String r : requested) {
            if (r != null && CATALOG.containsKey(r.trim())) {
                want.add(r.trim());
            }
        }
        if (want.isEmpty()) {
            /* 传了一堆非法字段：回落全量，而不是导出一张只有表头的空表 */
            return allFields();
        }
        List<String> out = new ArrayList<>();
        for (String f : CATALOG.keySet()) {
            if (want.contains(f)) {
                out.add(f);
            }
        }
        return out;
    }
}
`,
  },

  /* ==================================================== 条件摘要 */
  {
    rel: 'ledger/support/LedgerQuerySummary.java',
    content: `package org.dromara.yuqing.ledger.support;

import org.dromara.yuqing.ledger.domain.LedgerQuery;

import java.util.ArrayList;
import java.util.List;

/**
 * 筛选条件可读摘要（F-016 验收标准 10）
 *
 * <p>验收标准 10 要求导出审计记录「导出人、时间、条件、条数」。
 * 「条件」若只存一段 JSON，事后审计要自己解析还看不懂；
 * 因此同时落一份人可读摘要（本类产出）与一份原始 JSON
 * （供将来做条件回放）。</p>
 *
 * <p>本类同时是导出文件名的构成部分，让下载下来的 xlsx 自带语境。</p>
 *
 * @author ruoyi
 */
public final class LedgerQuerySummary {

    private LedgerQuerySummary() {
    }

    /**
     * 生成摘要，形如：
     * {@code 采集时间:2026-09-01~2026-09-23 | 任务:123 | 属性:negative | 关键词:医美}
     *
     * <p>无任何条件时返回「全部数据」，而不是空串 ——
     * 空串在审计表里无法区分「没筛条件」与「记录写坏了」。</p>
     */
    public static String summarize(LedgerQuery q) {
        if (q == null) {
            return "全部数据";
        }
        List<String> parts = new ArrayList<>();
        String cr = range(q.getCollectBeginTime(), q.getCollectEndTime());
        if (cr != null) {
            parts.add("采集时间:" + cr);
        }
        String pr = range(q.getPublishBeginTime(), q.getPublishEndTime());
        if (pr != null) {
            parts.add("发布时间:" + pr);
        }
        add(parts, "任务", q.getTaskId());
        add(parts, "渠道", q.getChannelId());
        add(parts, "事件", q.getClusterId());
        addText(parts, "属性", q.getSentiAttr());
        addText(parts, "风险", q.getRiskLevel());
        addText(parts, "分级", q.getOpinionLevel());
        addText(parts, "传播量级", q.getSpreadLevel());
        addText(parts, "采集来源", q.getCollectSource());
        addText(parts, "清洗状态", q.getCleanStatus());
        addText(parts, "研判状态", q.getAnalyzeStatus());
        if (q.getTagIds() != null && !q.getTagIds().isEmpty()) {
            parts.add("标签:" + q.getTagIds().size() + "个");
        }
        addText(parts, "关键词", q.getKeyword());
        if ("1".equals(q.getAlertFlag())) {
            parts.add("仅看已预警");
        }
        if (parts.isEmpty()) {
            return "全部数据";
        }
        return String.join(" | ", parts);
    }

    /**
     * 由摘要生成安全的文件名片段（去掉不适合做文件名的字符）。
     *
     * <p>Windows 文件名禁止 {@code \\ / : * ? " &lt; &gt; |}，
     * 且长度有限 —— 摘要里含时间与中文，直接当文件名会在下载时失败或截断。</p>
     */
    public static String toFileTag(LedgerQuery q) {
        String s = summarize(q);
        String illegal = "\\\\/:*?\\"<>|";
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (illegal.indexOf(c) >= 0) {
                sb.append('_');
            } else if (c == ' ') {
                continue;
            } else {
                sb.append(c);
            }
        }
        String out = sb.toString();
        return out.length() <= 60 ? out : out.substring(0, 60);
    }

    private static String range(String begin, String end) {
        boolean b = begin != null && !begin.isBlank();
        boolean e = end != null && !end.isBlank();
        if (!b && !e) {
            return null;
        }
        return (b ? begin.trim() : "*") + "~" + (e ? end.trim() : "*");
    }

    private static void add(List<String> parts, String label, Object v) {
        if (v != null) {
            parts.add(label + ":" + v);
        }
    }

    private static void addText(List<String> parts, String label, String v) {
        if (v != null && !v.isBlank()) {
            parts.add(label + ":" + v.trim());
        }
    }
}
`,
  },

  /* ==================================================== 时间解析 */
  {
    rel: 'ledger/support/LedgerTimeParser.java',
    content: `package org.dromara.yuqing.ledger.support;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * 宽容时间解析（F-016 台账时间维度）
 *
 * <p>台账是「打开就要能用」的页面：用户可能手敲 URL、可能由看板下钻带过来
 * 半截参数。解析失败一律返回 null（该条件不生效），<b>绝不抛异常</b> ——
 * 否则一个拼错的时间参数会让整页 500，而用户其实只想看默认范围。</p>
 *
 * <p>与 YqAnalyticsController 的 parseDate 保持同样的宽容策略，
 * 避免两个页面同样输入却一个能用一个报错。</p>
 *
 * @author ruoyi
 */
public final class LedgerTimeParser {

    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DT_MIN = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private LedgerTimeParser() {
    }

    /**
     * 解析为 LocalDateTime。
     *
     * <p>只给日期时：作为「起」取 00:00:00，作为「止」需调用方用
     * {@link #parseEnd(String)} 取 23:59:59，否则会漏掉当天数据。</p>
     */
    public static LocalDateTime parse(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim();
        try {
            if (s.length() == 10) {
                return LocalDate.parse(s, D).atStartOfDay();
            }
            if (s.length() == 16) {
                return LocalDateTime.parse(s, DT_MIN);
            }
            if (s.length() >= 19) {
                return LocalDateTime.parse(s.substring(0, 19), DT);
            }
            return LocalDateTime.parse(s);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /**
     * 解析为「区间止点」。
     *
     * <p>用户选 2026-09-23 作为截止，真实意图是「含当天全部」。
     * 若按 00:00:00 处理，9 月 23 日采到的数据全被排除，
     * 表现为「明明今天有数据却查不到」—— 这是舆情类系统最常见的体验投诉。</p>
     */
    public static LocalDateTime parseEnd(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        String s = v.trim();
        if (s.length() == 10) {
            LocalDate d = parseDate(s);
            return d == null ? null : d.atTime(LocalTime.MAX.withNano(0));
        }
        return parse(s);
    }

    /** 解析为 LocalDate */
    public static LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            String s = v.trim();
            if (s.length() == 10) {
                return LocalDate.parse(s, D);
            }
            LocalDateTime dt = parse(s);
            return dt == null ? null : dt.toLocalDate();
        } catch (RuntimeException e) {
            return null;
        }
    }
}
`,
  },

  /* ==================================================== 传播阶段 */
  {
    rel: 'ledger/support/LedgerStages.java',
    content: `package org.dromara.yuqing.ledger.support;

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
`,
  },
];
