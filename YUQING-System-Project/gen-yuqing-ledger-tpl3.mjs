/**
 * F-016 台账 · 模板 3：查询条件工厂 + 双库 DAO + 服务接口与实现
 *
 * 产物：
 *   ledger/support/LedgerWrapperFactory.java   查询条件构造（纯函数，可离线断言 SQL）
 *   ledger/dao/LedgerOpinionDao.java           Doris 侧只读查询（@DS("doris")）
 *   ledger/dao/LedgerMetaDao.java              MySQL 侧名称回填与预警/推送记录（@DS("master")）
 *   ledger/service/IYqLedgerService.java
 *   ledger/service/impl/YqLedgerServiceImpl.java
 *
 * ⚠ 归属边界：本模板只产 ledger 包与 ledger/dao 包；
 *   不产 controller、不产 opinion 的 domain/mapper/service（归 gen-yuqing.mjs）、
 *   不产 analytics/**（归 gen-yuqing-analytics.mjs）、不产 alert/**（归 gen-yuqing-alert.mjs）。
 */
export const LEDGER_TPL3 = [

  /* ==================================================== 查询条件工厂 */
  {
    rel: 'ledger/support/LedgerWrapperFactory.java',
    content: `package org.dromara.yuqing.ledger.support;

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
`,
  },

  /* ==================================================== Doris 侧 DAO */
  {
    rel: 'ledger/dao/LedgerOpinionDao.java',
    content: `package org.dromara.yuqing.ledger.dao;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.domain.YqOpinionMetric;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.ledger.support.LedgerWrapperFactory;
import org.dromara.yuqing.mapper.YqOpinionAnalysisMapper;
import org.dromara.yuqing.mapper.YqOpinionClusterMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.mapper.YqOpinionMetricMapper;
import org.dromara.yuqing.mapper.YqOpinionTagMapper;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

/**
 * 台账 Doris 侧只读数据访问（F-016）
 *
 * <p><b>为什么单独一个 DAO 而不是直接在 ServiceImpl 上打 {@code @DS("doris")}：</b>
 * 台账是双库组合场景 —— 明细在 Doris，任务名 / 渠道名 / 预警 / 推送记录在 MySQL。
 * 如果 {@code @DS("doris")} 打在 ServiceImpl 上，那么同一个类里对
 * {@code yq_task}、{@code yq_alert} 的查询也会被路由到 Doris
 * （动态数据源按线程上下文生效，不区分被访问的表），
 * 结果是「本地跑得通、接上真 Doris 就报表不存在」。
 * 因此：Doris 查询只留在本类，MySQL 回查只留在 {@link LedgerMetaDao}，
 * 由 Service 层编排。</p>
 *
 * <p><b>只读约定（PRD §6.3）：</b>本类不得出现任何 insert / update / delete。
 * Doris 侧数据的写入由采集与研判 Worker 经 Stream Load 完成。</p>
 *
 * @author ruoyi
 */
@Repository
@RequiredArgsConstructor
@DS("doris")
public class LedgerOpinionDao {

    private final YqOpinionMapper opinionMapper;
    private final YqOpinionAnalysisMapper analysisMapper;
    private final YqOpinionTagMapper tagMapper;
    private final YqOpinionMetricMapper metricMapper;
    private final YqOpinionClusterMapper clusterMapper;

    /* ------------------------------------------------------------ 台账列表 */

    /**
     * 分页查询台账（验收标准 1 / 2 / 8）
     *
     * <p><b>刻意不用 {@code pageQuery.build()}：</b>该方法会把前端的
     * {@code orderByColumn / isAsc} 带进 SQL 的 ORDER BY。台账的排序口径是
     * 产品需求（仅允许 采集时间 / 发布时间 / 热度 三选一），已由
     * {@code LedgerWrapperFactory.applyOrder} 以白名单方式实现；
     * 再叠加一层前端可控的 ORDER BY，等于把「排序字段」这个注入面重新打开。
     * 因此这里自己构造 Page，只取分页号与页大小，并在本方法内做上限钳制。</p>
     */
    public PageResult<YqOpinion> page(LedgerQuery q, LedgerScope scope, PageQuery pageQuery, int maxPageSize) {
        int num = pageQuery == null || pageQuery.getPageNum() == null ? 1 : pageQuery.getPageNum();
        if (num < 1) {
            num = 1;
        }
        int size = pageQuery == null || pageQuery.getPageSize() == null ? 10 : pageQuery.getPageSize();
        if (size < 1) {
            size = 10;
        }
        if (maxPageSize > 0 && size > maxPageSize) {
            size = maxPageSize;
        }
        LambdaQueryWrapper<YqOpinion> w = LedgerWrapperFactory.forQuery(q, scope);
        Page<YqOpinion> page = opinionMapper.selectPage(new Page<>(num, size), w);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    /**
     * 按条件取明细（导出用，验收标准 5）。
     *
     * <p>导出必须用「一次取够」而不是分页循环：分页循环期间数据可能变化，
     * 会导致同一份导出文件里出现重复或漏行。上限由调用方按
     * {@code maxExportRows} 控制。</p>
     */
    public List<YqOpinion> list(LedgerQuery q, LedgerScope scope, int limit) {
        LambdaQueryWrapper<YqOpinion> w = LedgerWrapperFactory.forQuery(q, scope);
        w.last("limit " + Math.max(limit, 0));
        return opinionMapper.selectList(w);
    }

    /** 按条件计数（导出前判定是否超限，验收标准 6） */
    public long count(LedgerQuery q, LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = LedgerWrapperFactory.forQuery(q, scope);
        Long n = opinionMapper.selectCount(w);
        return n == null ? 0L : n;
    }

    /* ------------------------------------------------------------ 详情 */

    public YqOpinion getById(Long opinionId) {
        return opinionId == null ? null : opinionMapper.selectById(opinionId);
    }

    /** 研判结论（按版本倒序，第一条为最新） */
    public List<YqOpinionAnalysis> analyses(Long opinionId) {
        return analysisMapper.selectList(new LambdaQueryWrapper<YqOpinionAnalysis>()
            .eq(YqOpinionAnalysis::getOpinionId, opinionId)
            .orderByDesc(YqOpinionAnalysis::getAnalyzeVersion)
            .orderByDesc(YqOpinionAnalysis::getAnalyzeTime));
    }

    /** 系统标签关联 */
    public List<YqOpinionTag> tags(Long opinionId) {
        return tagMapper.selectList(new LambdaQueryWrapper<YqOpinionTag>()
            .eq(YqOpinionTag::getOpinionId, opinionId));
    }

    /** 互动数据快照（按日期倒序取最近 limit 条，供详情页画趋势） */
    public List<YqOpinionMetric> metrics(Long opinionId, int limit) {
        return metricMapper.selectList(new LambdaQueryWrapper<YqOpinionMetric>()
            .eq(YqOpinionMetric::getOpinionId, opinionId)
            .orderByDesc(YqOpinionMetric::getSnapshotDate)
            .last("limit " + Math.max(limit, 0)));
    }

    /* ------------------------------------------------------------ 事件聚合 */

    public YqOpinionCluster clusterById(Long clusterId) {
        return clusterId == null ? null : clusterMapper.selectById(clusterId);
    }

    /**
     * 事件下关联舆情（验收标准 4）。
     *
     * @param asc true 取时间升序（画时间轴），false 取倒序（列清单）
     */
    public List<YqOpinion> clusterOpinions(Long clusterId, LedgerScope scope, boolean asc, int limit) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getClusterId, clusterId);
        if (asc) {
            w.orderByAsc(YqOpinion::getPublishTime);
            w.orderByAsc(YqOpinion::getOpinionId);
        } else {
            w.orderByDesc(YqOpinion::getCollectTime);
            w.orderByDesc(YqOpinion::getOpinionId);
        }
        w.last("limit " + Math.max(limit, 0));
        return opinionMapper.selectList(w);
    }

    /** 事件下关联舆情总数 */
    public long clusterOpinionCount(Long clusterId, LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getClusterId, clusterId);
        Long n = opinionMapper.selectCount(w);
        return n == null ? 0L : n;
    }

    /* ------------------------------------------------------------ 检索 */

    /**
     * 全文检索候选集（验收标准 7）。
     *
     * <p>只回候选行，命中判定与片段抽取由 {@code LedgerHighlighter} 在服务层做 ——
     * 高亮必须基于完整原文，若在 SQL 里截断再高亮，命中词可能正好落在截断处。</p>
     */
    public List<YqOpinion> searchCandidates(String keyword, String scope, LedgerScope s, int limit) {
        LambdaQueryWrapper<YqOpinion> w =
            LedgerWrapperFactory.forSearch(keyword, scope, s);
        w.last("limit " + Math.max(limit, 0));
        return opinionMapper.selectList(w);
    }

    /** 批量取明细（用于补充事件聚合下的行） */
    public List<YqOpinion> byIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        return opinionMapper.selectList(new LambdaQueryWrapper<YqOpinion>()
            .in(YqOpinion::getOpinionId, ids));
    }
}
`,
  },

  /* ==================================================== MySQL 侧 DAO */
  {
    rel: 'ledger/dao/LedgerMetaDao.java',
    content: `package org.dromara.yuqing.ledger.dao;

import com.baomidou.dynamic.datasource.annotation.DS;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * 台账 MySQL 侧数据访问：名称回填 + 预警 / 推送记录（F-016 验收标准 3、8）
 *
 * <p><b>为什么用 JdbcTemplate 而不是复用各模块的 Mapper：</b>
 * 名称回填要读 yq_task / yq_channel / yq_tag / sys_user，
 * 若 import 它们各自的 Entity 与 Mapper，F-016 就与
 * gen-yuqing.mjs（表的归属方）耦合在一起：
 * 对方改字段名，本模块跟着编译失败，而编译错误出现在「台账」文件里、
 * 根因却在别处。用 JdbcTemplate 只读所需列，耦合面缩到「列名」这一层，
 * 且台账本来就不需要这些表的其它列。</p>
 *
 * <p><b>安全：</b>所有 SQL 均使用 {@code ?} 预编译占位符，
 * IN 子句的占位符个数由集合大小生成、值全部走绑定，
 * 不存在字符串拼接注入。返回列均为非敏感字段
 * （名称、标题、状态），不带出手机号、身份证等个人信息。</p>
 *
 * <p><b>@DS("master") 显式标注：</b>防止被上游 {@code @DS("doris")} 的
 * 上下文污染（动态数据源是线程级上下文，不会自动切回主库）。</p>
 *
 * @author ruoyi
 */
@Repository
@RequiredArgsConstructor
@DS("master")
public class LedgerMetaDao {

    private final JdbcTemplate jdbc;

    /* ------------------------------------------------------------ 名称回填 */

    /**
     * 批量取任务名称（③A 的归属字段也在这里读）。
     *
     * <p>一处两用：既给列表回填 taskName，也是统计「本人名下任务」
     * 的取数入口（{@link #ownedTaskIds}）。</p>
     */
    public Map<Long, String> taskNames(Collection<Long> ids) {
        return nameMap("select task_id as k, task_name as v from yq_task where task_id in (%s)",
            ids);
    }

    /** 批量取渠道名称 */
    public Map<Long, String> channelNames(Collection<Long> ids) {
        return nameMap("select channel_id as k, channel_name as v from yq_channel where channel_id in (%s)",
            ids);
    }

    /** 批量取标签名称 */
    public Map<Long, String> tagNames(Collection<Long> ids) {
        return nameMap("select tag_id as k, tag_name as v from yq_tag where tag_id in (%s)",
            ids);
    }

    /** 批量取事件标题 */
    public Map<Long, String> clusterTitles(Collection<Long> ids) {
        return nameMap("select cluster_id as k, cluster_title as v from yq_opinion_cluster where cluster_id in (%s)",
            ids);
    }

    /**
     * 批量取用户昵称（预警处置人展示用）。
     *
     * <p>只取 user_id / nick_name，不触碰手机号、邮箱等字段。</p>
     */
    public Map<Long, String> userNames(Collection<Long> ids) {
        return nameMap("select user_id as k, nick_name as v from sys_user where user_id in (%s)", ids);
    }

    /* ------------------------------------------------------------ 数据权限 */

    /**
     * 当前用户名下的监测任务ID（③A 任务归属口径）。
     *
     * <p>只读 {@code yq_task.create_by} 一列，且带 {@code del_flag = '0'} ——
     * 已删除的任务不应再授权数据可见性，否则「删了任务还看得见数据」。
     * 返回空集时上层会得到 {@code LedgerScope.none()}（可见 0 条），
     * <b>不会退化为全量</b>。</p>
     */
    public Set<Long> ownedTaskIds(Long userId) {
        if (userId == null) {
            return new LinkedHashSet<>();
        }
        List<Long> ids = jdbc.queryForList(
            "select task_id from yq_task where create_by = ? and del_flag = '0'",
            Long.class, userId);
        return new LinkedHashSet<>(ids);
    }

    /* ------------------------------------------------------------ 预警 / 推送 */

    /** 某条舆情的预警记录（按触发时间倒序） */
    public List<Map<String, Object>> alertsOf(Long opinionId, int limit) {
        if (opinionId == null) {
            return List.of();
        }
        return jdbc.queryForList(
            "select alert_id, alert_title, trigger_scene, alert_level, trigger_value, "
                + "trigger_time, status, process_remark, process_by, process_time, push_result "
                + "from yq_alert where opinion_id = ? order by trigger_time desc limit " + Math.max(limit, 0),
            opinionId);
    }

    /**
     * 某条舆情的推送记录。
     *
     * <p>{@code yq_push_record.opinion_ids} 是逗号分隔字符串（历史设计），
     * 因此用 {@code FIND_IN_SET} 判定包含关系 —— 参数走绑定，
     * 不会因为 opinionId 是字符串而注入。该写法无法命中索引，
     * 仅在详情页单条查询时使用；若将来推送记录量级上来，
     * 应改为在推送时落一张关联表。</p>
     *
     * <p>内容快照只取前 200 字符：它是推送审计证据，全文对详情页无意义。</p>
     */
    public List<Map<String, Object>> pushesOf(Long opinionId, int limit) {
        if (opinionId == null) {
            return List.of();
        }
        return jdbc.queryForList(
            "select record_id, push_scene, push_level, send_status, target_ids, retry_count, "
                + "fail_reason, send_time, left(content_snapshot, 200) as content_digest "
                + "from yq_push_record where find_in_set(?, opinion_ids) "
                + "order by send_time desc limit " + Math.max(limit, 0),
            String.valueOf(opinionId));
    }

    /** 推送规则名称（推送记录展示用） */
    public Map<Long, String> pushRuleNames(Collection<Long> ids) {
        return nameMap("select rule_id as k, rule_name as v from yq_push_rule where rule_id in (%s)", ids);
    }

    /* ------------------------------------------------------------ 内部 */

    /** 通用「ID -> 名称」批量查询；空集合直接返回空 Map，不产生 IN () 语法错误 */
    private Map<Long, String> nameMap(String tpl, Collection<Long> ids) {
        Map<Long, String> out = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) {
            return out;
        }
        Set<Long> clean = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null) {
                clean.add(id);
            }
        }
        if (clean.isEmpty()) {
            return out;
        }
        String sql = String.format(tpl, placeholders(clean.size()));
        Object[] args = clean.toArray();
        List<Map<String, Object>> rows = jdbc.queryForList(sql, args);
        for (Map<String, Object> row : rows) {
            Object k = row.get("k");
            Object v = row.get("v");
            if (k == null) {
                continue;
            }
            out.put(((Number) k).longValue(), v == null ? null : String.valueOf(v));
        }
        return out;
    }

    /** 生成 n 个 ? 占位符（由集合大小决定，不含任何用户输入） */
    private static String placeholders(int n) {
        StringBuilder sb = new StringBuilder(n * 2);
        for (int i = 0; i < n; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('?');
        }
        return sb.toString();
    }

    /** 供子类/扩展使用的空 Map 常量防护 */
    static <K, V> Map<K, V> emptyMap() {
        return new HashMap<>();
    }

    /** 便于函数式回填：取 name 或回落占位 */
    static String nameOr(Map<Long, String> m, Long id, String fallback) {
        if (id == null || m == null) {
            return fallback;
        }
        String v = m.get(id);
        return v == null || v.isBlank() ? fallback : v;
    }

    /** 便于函数式转换：从 Map 取 long 值 */
    static Long asLong(Object v, Long fallback) {
        if (v == null) {
            return fallback;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.valueOf(String.valueOf(v));
        } catch (RuntimeException e) {
            return fallback;
        }
    }

    /** 便于函数式转换：从 Map 取字符串 */
    static String asString(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    /** 便于函数式转换：把查询结果按字段名抽取（预防驱动返回大小写差异） */
    static Object pick(Map<String, Object> row, String key, String... aliases) {
        if (row == null) {
            return null;
        }
        Object v = row.get(key);
        if (v != null) {
            return v;
        }
        for (String a : aliases) {
            v = row.get(a);
            if (v != null) {
                return v;
            }
        }
        return null;
    }

    /** 便于函数式转换：统一小写字段名索引，规避驱动大小写差异 */
    static Function<Map<String, Object>, Map<String, Object>> lowerKeyed() {
        return src -> {
            Map<String, Object> m = new HashMap<>();
            if (src != null) {
                for (Map.Entry<String, Object> e : src.entrySet()) {
                    m.put(e.getKey() == null ? null : e.getKey().toLowerCase(), e.getValue());
                }
            }
            return m;
        };
    }
}
`,
  },
];
