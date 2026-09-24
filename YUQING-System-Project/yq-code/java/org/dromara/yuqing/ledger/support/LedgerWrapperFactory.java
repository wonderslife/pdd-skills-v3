package org.dromara.yuqing.ledger.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.ledger.domain.LedgerQuery;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 台账查询条件构造（F-016 验收标准 1、7、8）
 *
 * <p><b>为什么单独抽一个工厂类而不是写在 ServiceImpl 里：</b>
 * 这里包含两处「错了就出事」的逻辑 —— 数据权限注入（验收标准 8）
 * 与空范围语义；写成纯函数后可以在离线自测里直接断言生成的 SQL 片段，
 * 例如「denyAll 范围必须生成恒假条件而不是没有条件」。
 * 写在 ServiceImpl 里就只能靠起 Spring 上下文 + 造数据来验证，
 * 实际结果是没人验证。</p>
 *
 * <p><b>安全约定：</b></p>
 * <ul>
 *   <li>全部条件走 MyBatis-Plus 的 Lambda 引用，不存在字段名拼接；</li>
 *   <li>标签筛选需要子查询，但拼进 SQL 的只有 {@code Long} 的
 *       {@code toString()} 结果（只能产出数字与可能的负号），
 *       且在 {@link #numericLiteral} 里做一次字符白名单校验兜底，
 *       不引入任何用户可控字符串；</li>
 *   <li><b>绝不允许</b>「范围为空 = 不加条件」，见 {@link #forQuery}。</li>
 * </ul>
 *
 * @author ruoyi
 */
public final class LedgerWrapperFactory {

    private LedgerWrapperFactory() {
    }

    /**
     * 构造台账查询条件。
     *
     * <p><b>数据权限（验收标准 8 / 决策 ③A）：</b></p>
     * <ul>
     *   <li>{@code unrestricted} -> 不加任务条件；</li>
     *   <li>{@code denyAll} -> 加恒假条件（opinion_id = -1）。
     *       注意这里是**生成 SQL 层面的空集**，
     *       而不是「什么都不加」—— 后者会退化成全量可见，是最典型的数据泄露写法；</li>
     *   <li>受限 -> {@code task_id IN (可见任务集合)}。</li>
     * </ul>
     */
    public static LambdaQueryWrapper<YqOpinion> forQuery(LedgerQuery q, LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerQuery query = q == null ? new LedgerQuery() : q;

        applyScope(w, scope);
        applyFilters(w, query);
        applyOrder(w, query);
        return w;
    }

    /**
     * 构造全文检索条件（验收标准 7）。
     *
     * <p>关键词同时匹配标题与正文（{@code scope} 为 title / content / both）。
     * 注意：这里是 {@code LIKE '%kw%'} 的前置模糊，PRD §6.3 明确禁用该写法
     * （无法命中索引）。因此本方法只用于 fallback / 小规模镜像库场景，
     * 生产走 Doris 倒排索引的 {@code MATCH_ANY}；
     * 当前的镜像库（①A，doris 段指向 MySQL）没有倒排索引，
     * 由 {@code YqLedgerServiceImpl.search} 择优选择实现并在响应里标注
     * {@code matchMode}，不假装走了倒排。</p>
     */
    public static LambdaQueryWrapper<YqOpinion> forSearch(String keyword, String scope, LedgerScope s) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        applyScope(w, s);
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            String mode = scope == null ? "both" : scope.trim().toLowerCase();
            boolean title = "title".equals(mode) || "both".equals(mode);
            boolean content = "content".equals(mode) || "both".equals(mode);
            if (title && content) {
                w.and(x -> x.like(YqOpinion::getTitle, kw).or().like(YqOpinion::getContent, kw));
            } else if (title) {
                w.like(YqOpinion::getTitle, kw);
            } else {
                w.like(YqOpinion::getContent, kw);
            }
        }
        w.orderByDesc(YqOpinion::getCollectTime);
        w.orderByDesc(YqOpinion::getOpinionId);
        return w;
    }

    /* ------------------------------------------------------------------ 内部 */

    /**
     * 注入数据权限条件（③A）。
     *
     * <p><b>必须 public：</b>{@code LedgerOpinionDao} 在 {@code ledger.dao} 包内，
     * 需要直接调用本方法给聚合/计数等自定义查询补范围条件。
     * 早期写成包级私有，编译直接失败（cross-package access）。</p>
     */
    public static void applyScope(LambdaQueryWrapper<YqOpinion> w, LedgerScope scope) {
        LedgerScope s = scope == null ? LedgerScope.none() : scope;
        if (s.isUnrestricted()) {
            return;
        }
        if (s.isDenyAll()) {
            w.eq(YqOpinion::getOpinionId, -1L);
            return;
        }
        w.in(YqOpinion::getTaskId, new ArrayList<>(s.getTaskIds()));
    }

    /** 注入业务筛选条件（验收标准 1 的 11 个维度） */
    static void applyFilters(LambdaQueryWrapper<YqOpinion> w, LedgerQuery q) {
        /* —— 时间维度：起用 atStartOfDay，止用 23:59:59（只给日期时） —— */
        LocalDateTime cb = LedgerTimeParser.parse(q.getCollectBeginTime());
        LocalDateTime ce = LedgerTimeParser.parseEnd(q.getCollectEndTime());
        if (cb != null) {
            w.ge(YqOpinion::getCollectTime, cb);
        }
        if (ce != null) {
            w.le(YqOpinion::getCollectTime, ce);
        }
        LocalDateTime pb = LedgerTimeParser.parse(q.getPublishBeginTime());
        LocalDateTime pe = LedgerTimeParser.parseEnd(q.getPublishEndTime());
        if (pb != null) {
            w.ge(YqOpinion::getPublishTime, pb);
        }
        if (pe != null) {
            w.le(YqOpinion::getPublishTime, pe);
        }

        /* —— 归属维度 —— */
        w.eq(q.getTaskId() != null, YqOpinion::getTaskId, q.getTaskId());
        w.eq(q.getChannelId() != null, YqOpinion::getChannelId, q.getChannelId());
        w.eq(q.getClusterId() != null, YqOpinion::getClusterId, q.getClusterId());

        /* —— 属性维度 —— */
        w.eq(notBlank(q.getSentiAttr()), YqOpinion::getSentiAttr, q.getSentiAttr());
        w.eq(notBlank(q.getRiskLevel()), YqOpinion::getRiskLevel, q.getRiskLevel());
        w.eq(notBlank(q.getOpinionLevel()), YqOpinion::getOpinionLevel, q.getOpinionLevel());
        w.eq(notBlank(q.getSpreadLevel()), YqOpinion::getSpreadLevel, q.getSpreadLevel());

        /* —— 流程维度 —— */
        w.eq(notBlank(q.getCollectSource()), YqOpinion::getCollectSource, q.getCollectSource());
        w.eq(notBlank(q.getCleanStatus()), YqOpinion::getCleanStatus, q.getCleanStatus());
        w.eq(notBlank(q.getAnalyzeStatus()), YqOpinion::getAnalyzeStatus, q.getAnalyzeStatus());
        w.eq(notBlank(q.getAlertFlag()), YqOpinion::getAlertFlag, q.getAlertFlag());

        /* —— 标签维度：子查询 —— */
        List<Long> tagIds = q.getTagIds();
        if (tagIds != null && !tagIds.isEmpty()) {
            String nums = numericLiteral(tagIds);
            if (!nums.isEmpty()) {
                /* numbersLiteral 只产出数字与逗号，无注入面；加 tag_source 条件无意义，故不加 */
                w.inSql(YqOpinion::getOpinionId,
                    "select opinion_id from yq_opinion_tag where tag_id in (" + nums + ")");
            }
        }

        /* —— 关键词：非全文模式下的标题/正文模糊 —— */
        String kw = q.getKeyword();
        if (notBlank(kw)) {
            String mode = q.normalizedKeywordScope();
            String k = kw.trim();
            if ("both".equals(mode)) {
                w.and(x -> x.like(YqOpinion::getTitle, k).or().like(YqOpinion::getContent, k));
            } else if ("title".equals(mode)) {
                w.like(YqOpinion::getTitle, k);
            } else {
                w.like(YqOpinion::getContent, k);
            }
        }
    }

    /** 排序：白名单三选一 + 主键兜底保证分页稳定 */
    static void applyOrder(LambdaQueryWrapper<YqOpinion> w, LedgerQuery q) {
        String by = q.getOrderBy() == null ? "collectTime" : q.getOrderBy().trim();
        boolean desc = q.getOrderDesc() == null || Boolean.TRUE.equals(q.getOrderDesc());
        switch (by) {
            case "publishTime":
                w.orderBy(true, desc, YqOpinion::getPublishTime);
                break;
            case "heatScore":
                w.orderBy(true, desc, YqOpinion::getHeatScore);
                break;
            case "collectTime":
            default:
                w.orderBy(true, desc, YqOpinion::getCollectTime);
                break;
        }
        /* 次级排序固定为 ID 降序：否则同一秒内多条的相对顺序在翻页间会漂移，
         * 表现为「第 2 页出现第 1 页的记录」 */
        w.orderByDesc(YqOpinion::getOpinionId);
    }

    /**
     * 把 Long 集合转成 SQL 数字字面量列表。
     *
     * <p>只接受数字与负号，任何其它字符直接丢弃。这是「即使上游类型被绕过
     * 也拼不出字符串」的最后一道闸；同时避免 {@code Long.toString()} 之外的
     * 任何用户可控内容进入 SQL。</p>
     */
    static String numericLiteral(List<Long> ids) {
        return ids.stream()
            .filter(Objects::nonNull)
            .map(String::valueOf)
            .filter(LedgerWrapperFactory::isNumeric)
            .collect(Collectors.joining(","));
    }

    private static boolean isNumeric(String s) {
        if (s == null || s.isEmpty()) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (i == 0 && c == '-') {
                continue;
            }
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return true;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }
}
