package org.dromara.yuqing.analysis.dao;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.analysis.domain.AnalysisQuery;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.ledger.support.LedgerTimeParser;
import org.dromara.yuqing.ledger.support.LedgerWrapperFactory;
import org.dromara.yuqing.mapper.YqOpinionAnalysisMapper;
import org.dromara.yuqing.mapper.YqOpinionClusterMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.mapper.YqOpinionTagMapper;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 研判链路 Doris 侧数据访问（F-007）
 *
 * <p><b>本类与 F-016 的 {@code LedgerOpinionDao} 的分工：</b>
 * 那个是**只读**台账查询，本类是**读写**研判链路。
 * 两者面向同一批表但生命周期不同（读侧 vs 写侧），刻意不复用同一个类 ——
 * 让读侧持有写方法，早晚会有人在不该写的地方写。
 * 注意 {@code YqOpinion} 的实体注释写着「业务侧只读，写入由采集/研判 Worker
 * 经 Stream Load 完成」—— <b>本类就是那个 Worker</b>，
 * 它是全项目唯一允许更新 {@code yq_opinion} 业务字段的入口。</p>
 *
 * <p><b>数据权限：</b>所有查询方法都接收 {@link LedgerScope}，
 * 由 Service 层从登录上下文推导后传入。范围条件的实现**复用**
 * {@code LedgerWrapperFactory.applyScope}，不在这里重写一份 ——
 * 同一个安全口径出现两份实现，就一定会有一份先腐烂。
 * 特别注意其 {@code none()} 态会落成恒假条件（可见 0 条），
 * <b>不会退化成不加条件</b>。</p>
 *
 * <p><b>状态机：</b>{@code yq_opinion.analyze_status} 的转移由本类以
 * <b>条件更新（CAS）</b>完成，而不是「先查后写」。并发下（定时任务与
 * 人工批量同时跑）先查后写会让同一条舆情被研判两次，
 * 产生两条结论与两次标签写入。</p>
 *
 * <p><b>已知边界（刻意不做的事）：</b>本类<b>不提供</b>「按时间自动回收
 * 僵死的 processing 状态」的方法。原因是 {@code yq_opinion} 上没有
 * 「认领时间 / 更新时间」列（该实体不继承 BaseEntity），
 * 用 {@code collect_time} 当兜底会立刻出事：批次刚认领一批历史数据，
 * 它们的采集时间都很久远，下一秒就会被自动回收，
 * 表现为「研判永远跑不完」。因此改为提供
 * {@link #releaseProcessing}：由研判员在台账按状态筛出卡住的行后手动释放。</p>
 *
 * @author ruoyi
 */
@Repository
@RequiredArgsConstructor
@DS("doris")
public class AnalysisOpinionDao {

    /** 待研判 */
    public static final String ST_PENDING = "pending";

    /** 研判中：被认领后、出结论之前 */
    public static final String ST_PROCESSING = "processing";

    /** 已完成 */
    public static final String ST_COMPLETED = "completed";

    /** 已失败 */
    public static final String ST_FAILED = "failed";

    /** 人工修正标记：已修正（用于台账筛选「仅看被修正过的」） */
    public static final String CORRECTED_YES = "1";

    /**
     * 「仅看已修正」一次最多扫描的结论行数。
     *
     * <p>修正记录是低频人工行为，5000 足以覆盖；
     * 若将来量级上来，应改为在 {@code yq_opinion} 上加冗余标记列，
     * 而不是把这个上限一路调大（调大等于把全表拉进内存）。</p>
     */
    private static final int CORRECTED_SCAN_LIMIT = 5000;

    private final YqOpinionMapper opinionMapper;
    private final YqOpinionAnalysisMapper analysisMapper;
    private final YqOpinionTagMapper tagMapper;
    private final YqOpinionClusterMapper clusterMapper;

    /* ==================================================== 查询：台账 / 队列 */

    /**
     * 分页查询研判台账（验收标准 5、7）
     *
     * <p>刻意不用 {@code pageQuery.build()}：它会把前端传的
     * {@code orderByColumn / isAsc} 直接拼进 ORDER BY。本模块的排序口径是
     * 产品固定的几项，由 {@link #applyOrder} 以白名单实现；
     * 再叠一层前端可控的排序，等于把「排序字段」这个注入面重新打开。</p>
     */
    public PageResult<YqOpinion> page(AnalysisQuery q, LedgerScope scope, PageQuery pageQuery, int maxPageSize) {
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
        LambdaQueryWrapper<YqOpinion> w = wrapper(q, scope);
        Page<YqOpinion> page = opinionMapper.selectPage(new Page<>(num, size), w);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    /**
     * 取舆情清单（批量研判的输入队列，验收标准 1、6）。
     *
     * <p>默认按「采集时间升序」：先采到的先研判，保证事件聚合的时间轴
     * 与真实传播顺序一致。若同一条事件里后发生的舆情先被研判，
     * 聚合时就成了「后来的当首发」，时间轴会反过来。
     * 调用方若要覆盖，通过 {@code AnalysisQuery.orderBy} 指定。</p>
     */
    public List<YqOpinion> list(AnalysisQuery q, LedgerScope scope, int limit) {
        LambdaQueryWrapper<YqOpinion> w = wrapper(q, scope);
        w.last("limit " + Math.max(limit, 0));
        return opinionMapper.selectList(w);
    }

    /**
     * 取待研判队列（按采集时间升序，便于事件聚合顺序正确）。
     *
     * <p>单独一个方法而不是让调用方自己拼条件：待研判的定义会随流程演进
     * （现在是 pending；将来可能加上「被要求重新研判的 completed」），
     * 集中在这里改一处即可。</p>
     */
    public List<YqOpinion> pendingQueue(LedgerScope scope, int limit) {
        AnalysisQuery q = new AnalysisQuery();
        q.setAnalyzeStatus(ST_PENDING);
        q.setOrderBy("collectTime");
        q.setOrderDesc(Boolean.FALSE);
        q.setLimit(limit);
        return list(q, scope, limit);
    }

    /** 按条件计数（验收标准 6：判定是否还有剩余待研判） */
    public long count(AnalysisQuery q, LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = wrapper(q, scope);
        Long n = opinionMapper.selectCount(w);
        return n == null ? 0L : n;
    }

    /** 待研判条数（批量研判结束后回填 remaining） */
    public long pendingCount(LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getAnalyzeStatus, ST_PENDING);
        Long n = opinionMapper.selectCount(w);
        return n == null ? 0L : n;
    }

    /**
     * 各研判状态条数（验收标准 5：台账状态筛选的角标数据）。
     *
     * <p>用四次 count 而不是一次 group by：group by 版需要手写列名，
     * 而手写列名的 SQL 无法被编译期检查 —— 列名写错只有运行到才发现。
     * 四次 count 走同一套 Lambda 条件构造器，安全且口径一致，
     * 数据权限范围也自动跟着走。四次全表 count 对 Doris/MySQL 都是
     * 索引覆盖扫描，代价可接受。</p>
     */
    public Map<String, Long> countByStatus(LedgerScope scope) {
        Map<String, Long> out = new LinkedHashMap<>();
        for (String st : new String[]{ST_PENDING, ST_PROCESSING, ST_COMPLETED, ST_FAILED}) {
            LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
            LedgerWrapperFactory.applyScope(w, scope);
            w.eq(YqOpinion::getAnalyzeStatus, st);
            Long n = opinionMapper.selectCount(w);
            out.put(st, n == null ? 0L : n);
        }
        return out;
    }

    /* ==================================================== 状态机（CAS） */

    /**
     * 认领待研判舆情：把 {@code pending / failed / NULL} 置为 {@code processing}。
     *
     * <p>条件里显式包含 {@code is null or <> processing}：直接写
     * {@code ne(analyzeStatus, "processing")} 在 SQL 里对 NULL 求值为
     * UNKNOWN 而不是 TRUE，会让「状态字段为 NULL 的历史数据」永远认领不到 ——
     * 现象是「有数据但一条都不研判」，且日志里没有任何异常。</p>
     *
     * <p>刻意允许认领 {@code failed}：验收标准 6 的重试就是重跑失败项。
     * 重试次数由 {@code yq_opinion_analysis} 里已有的结论行数体现，
     * Service 层用 {@code maxRetry} 卡住上限，避免无限重试。</p>
     *
     * @return 实际认领条数；小于入参 size 说明并发下被其它批次抢走
     */
    public int claimForProcessing(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.in(YqOpinion::getOpinionId, ids)
            .set(YqOpinion::getAnalyzeStatus, ST_PROCESSING)
            .and(w -> w.isNull(YqOpinion::getAnalyzeStatus)
                .or().ne(YqOpinion::getAnalyzeStatus, ST_PROCESSING));
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /**
     * 单条 CAS：仅当当前状态等于 {@code expect} 时置为 {@code next}。
     *
     * <p>人工「重新研判」用它把 completed 拉回 processing，
     * 避免与正在跑的批次撞车。</p>
     */
    public int compareAndSetStatus(Long opinionId, String expect, String next) {
        if (opinionId == null) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.eq(YqOpinion::getOpinionId, opinionId)
            .set(YqOpinion::getAnalyzeStatus, next);
        if (expect == null) {
            u.isNull(YqOpinion::getAnalyzeStatus);
        } else {
            u.eq(YqOpinion::getAnalyzeStatus, expect);
        }
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /**
     * 无条件置终态（completed / failed）。
     *
     * <p>终态不比对期望值：研判已经跑完，无论期间状态被别人改过什么，
     * 结论都以本次为准 —— 若这里再加 CAS，一旦中途被改就写不进终态，
     * 舆情会永远停在 processing，成为没人管的僵尸数据。</p>
     */
    public int markStatus(Long opinionId, String status) {
        if (opinionId == null) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.eq(YqOpinion::getOpinionId, opinionId)
            .set(YqOpinion::getAnalyzeStatus, status);
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /** 批量置终态（失败收尾用，一次 SQL 收干净） */
    public int markStatusBatch(Collection<Long> ids, String status) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.in(YqOpinion::getOpinionId, ids).set(YqOpinion::getAnalyzeStatus, status);
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /**
     * 手动释放卡住的 {@code processing}（见类注释「已知边界」）。
     *
     * <p>只把「当前仍等于 processing」的行改回 pending，因此
     * 即使研判员选中了正在跑的那一条，也不会造成重复研判 ——
     * 那条会在跑完后正常写终态。同时叠加数据权限条件，
     * 防止越权释放别人任务下的行。</p>
     */
    public int releaseProcessing(Collection<Long> ids, LedgerScope scope) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.in(YqOpinion::getOpinionId, ids)
            .eq(YqOpinion::getAnalyzeStatus, ST_PROCESSING)
            .set(YqOpinion::getAnalyzeStatus, ST_PENDING);
        applyScopeToUpdate(u, scope);
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /* ==================================================== 结论回写主表 */

    /**
     * 把研判结论的分级字段回写 {@code yq_opinion}（验收标准 1、6 的下游依赖）。
     *
     * <p><b>为什么必须回写而不是只落在 analysis 表：</b>
     * F-010 预警引擎、F-009 统计、F-014 日报读的都是 {@code yq_opinion} 上的
     * {@code senti_attr / risk_level / opinion_level / spread_level}。
     * 如果结论只写在 analysis 表，下游要么全部改成联表查（改动面巨大），
     * 要么继续用 F-010 的兜底规则（研判就白做了）。</p>
     *
     * <p>null 字段不参与更新：研判失败时这些字段应保持原样，
     * 不能被 null 抹掉（抹掉会让兜底规则也失效，变成「越研判越差」）。</p>
     */
    public int writeBackConclusion(YqOpinion o) {
        if (o == null || o.getOpinionId() == null) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.eq(YqOpinion::getOpinionId, o.getOpinionId());
        boolean any = false;
        if (o.getSentiAttr() != null) {
            u.set(YqOpinion::getSentiAttr, o.getSentiAttr());
            any = true;
        }
        if (o.getRiskLevel() != null) {
            u.set(YqOpinion::getRiskLevel, o.getRiskLevel());
            any = true;
        }
        if (o.getOpinionLevel() != null) {
            u.set(YqOpinion::getOpinionLevel, o.getOpinionLevel());
            any = true;
        }
        if (o.getSpreadLevel() != null) {
            u.set(YqOpinion::getSpreadLevel, o.getSpreadLevel());
            any = true;
        }
        if (o.getClusterId() != null) {
            u.set(YqOpinion::getClusterId, o.getClusterId());
            any = true;
        }
        if (!any) {
            return 0;
        }
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /** 绑定事件（验收标准 4：聚合落库的最后一公里） */
    public int bindCluster(Collection<Long> ids, Long clusterId) {
        if (ids == null || ids.isEmpty() || clusterId == null) {
            return 0;
        }
        LambdaUpdateWrapper<YqOpinion> u = new LambdaUpdateWrapper<>();
        u.in(YqOpinion::getOpinionId, ids).set(YqOpinion::getClusterId, clusterId);
        Integer n = opinionMapper.update(null, u);
        return n == null ? 0 : n;
    }

    /* ==================================================== 研判结论表 */

    public YqOpinionAnalysis analysisById(Long analysisId) {
        return analysisId == null ? null : analysisMapper.selectById(analysisId);
    }

    /**
     * 取指定舆情的最新一条结论（验收标准 7：详情展示当前结论）。
     *
     * <p>按 {@code analyze_version} 倒序取第一条：版本号是研判次数的单调计数，
     * 比 {@code analyze_time} 可靠 —— 同一次批量里多条结论的 analyzeTime
     * 可能落在同一毫秒（数据库时间粒度），排序会不稳定。</p>
     */
    public YqOpinionAnalysis latestAnalysis(Long opinionId) {
        if (opinionId == null) {
            return null;
        }
        List<YqOpinionAnalysis> rows = analysisMapper.selectList(
            new LambdaQueryWrapper<YqOpinionAnalysis>()
                .eq(YqOpinionAnalysis::getOpinionId, opinionId)
                .orderByDesc(YqOpinionAnalysis::getAnalyzeVersion)
                .orderByDesc(YqOpinionAnalysis::getAnalysisId)
                .last("limit 1"));
        return rows == null || rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 批量取结论（列表页用，避免 N+1 查询）。
     *
     * <p>取回后在 Service 层按 opinionId 去重保留版本号最大的一条。
     * 不用「子查询取 max(version)」是为了避开 Doris 对相关子查询
     * 支持度与 MySQL 不一致的隐患。</p>
     */
    public List<YqOpinionAnalysis> analysesOf(Collection<Long> opinionIds) {
        if (opinionIds == null || opinionIds.isEmpty()) {
            return new ArrayList<>();
        }
        return analysisMapper.selectList(new LambdaQueryWrapper<YqOpinionAnalysis>()
            .in(YqOpinionAnalysis::getOpinionId, opinionIds)
            .orderByDesc(YqOpinionAnalysis::getAnalyzeVersion)
            .orderByDesc(YqOpinionAnalysis::getAnalysisId));
    }

    /**
     * 某条舆情的全部历史结论（验收标准 11：展示研判版本演进）。
     *
     * <p>含失败留下的记录 —— 失败记录也是「研判历史」的一部分，
     * 隐藏它会让「这条为什么重试了 3 次」无法解释。</p>
     */
    public List<YqOpinionAnalysis> analysisHistory(Long opinionId) {
        if (opinionId == null) {
            return new ArrayList<>();
        }
        return analysisMapper.selectList(new LambdaQueryWrapper<YqOpinionAnalysis>()
            .eq(YqOpinionAnalysis::getOpinionId, opinionId)
            .orderByDesc(YqOpinionAnalysis::getAnalyzeVersion)
            .orderByDesc(YqOpinionAnalysis::getAnalysisId));
    }

    /**
     * 某条舆情已有多少次研判记录（重试上限判定与版本号计算）。
     *
     * <p>用 count 而不是 select max(version)：max 需要手写列名 SQL，
     * 且本表结论行只增不改（人工修正走 update 同一条），
     * 因此 count 与 max + 1 恒等，count 更安全。</p>
     */
    public int analysisCount(Long opinionId) {
        if (opinionId == null) {
            return 0;
        }
        Long n = analysisMapper.selectCount(new LambdaQueryWrapper<YqOpinionAnalysis>()
            .eq(YqOpinionAnalysis::getOpinionId, opinionId));
        return n == null ? 0 : n.intValue();
    }

    /**
     * 批量统计研判次数（重试上限筛选用）。
     *
     * <p>实现方式：只取 {@code opinion_id} 一列拉回来在内存里计数。
     * 之所以不用 {@code group by + count(*)}：那需要手写列名，
     * 而 MyBatis-Plus 的 Lambda 构造器无法表达聚合列
     * （{@code select(SFunction)} 只接受实体字段引用）。
     * 输入集合由调用方限制在批次规模内（默认 20 条），
     * 拉回的行数与之同量级，代价可接受。</p>
     */
    public Map<Long, Integer> analysisCounts(Collection<Long> opinionIds) {
        Map<Long, Integer> out = new LinkedHashMap<>();
        if (opinionIds == null || opinionIds.isEmpty()) {
            return out;
        }
        List<YqOpinionAnalysis> rows = analysisMapper.selectList(
            new LambdaQueryWrapper<YqOpinionAnalysis>()
                .select(YqOpinionAnalysis::getOpinionId)
                .in(YqOpinionAnalysis::getOpinionId, opinionIds));
        if (rows == null) {
            return out;
        }
        for (YqOpinionAnalysis r : rows) {
            if (r == null || r.getOpinionId() == null) {
                continue;
            }
            out.merge(r.getOpinionId(), 1, Integer::sum);
        }
        return out;
    }

    /**
     * 被人工修正过的舆情ID（台账「仅看已修正」筛选用，验收标准 8）。
     *
     * <p>修正标记在 analysis 表上，不在 opinion 表上（opinion 表没有这一列，
     * 也不该为它加列 —— 修正历史属于结论的属性）。
     * 因此这里先取一批「有修正记录的 opinionId」，
     * 再由调用方以 {@code in} 条件与数据权限条件叠加：
     * 两者相与后天然只留下「可见 且 被修正过」的行。</p>
     *
     * <p>{@code scanLimit} 防止把全表拉进内存。修正记录是低频人工行为，
     * 默认上限足够覆盖；若将来量级上来，应改为在 opinion 表上加冗余标记列。</p>
     */
    public Set<Long> correctedOpinionIds(int scanLimit) {
        List<YqOpinionAnalysis> rows = analysisMapper.selectList(
            new LambdaQueryWrapper<YqOpinionAnalysis>()
                .select(YqOpinionAnalysis::getOpinionId)
                .eq(YqOpinionAnalysis::getCorrectedFlag, CORRECTED_YES)
                .groupBy(YqOpinionAnalysis::getOpinionId)
                .orderByDesc(YqOpinionAnalysis::getOpinionId)
                .last("limit " + Math.max(scanLimit, 0)));
        Set<Long> out = new LinkedHashSet<>();
        if (rows != null) {
            for (YqOpinionAnalysis r : rows) {
                if (r != null && r.getOpinionId() != null) {
                    out.add(r.getOpinionId());
                }
            }
        }
        return out;
    }

    /** 新增一条结论 */
    public int insertAnalysis(YqOpinionAnalysis row) {
        return analysisMapper.insert(row);
    }

    /** 按主键更新结论（人工修正：只动被修正的字段） */
    public int updateAnalysis(YqOpinionAnalysis row) {
        return row == null || row.getAnalysisId() == null ? 0 : analysisMapper.updateById(row);
    }

    /* ==================================================== 标签 */

    public List<YqOpinionTag> tagsOf(Collection<Long> opinionIds) {
        if (opinionIds == null || opinionIds.isEmpty()) {
            return new ArrayList<>();
        }
        return tagMapper.selectList(new LambdaQueryWrapper<YqOpinionTag>()
            .in(YqOpinionTag::getOpinionId, opinionIds));
    }

    /**
     * 按来源删除关联（重新研判 / 重新打标签前先清干净）。
     *
     * <p>不清会让标签只增不减：同一条舆情研判三次，「负面」标签就出现三条。</p>
     */
    public int deleteTagsBySource(Collection<Long> opinionIds, String source) {
        if (opinionIds == null || opinionIds.isEmpty()) {
            return 0;
        }
        LambdaQueryWrapper<YqOpinionTag> w = new LambdaQueryWrapper<YqOpinionTag>()
            .in(YqOpinionTag::getOpinionId, opinionIds);
        if (source != null) {
            w.eq(YqOpinionTag::getTagSource, source);
        }
        return tagMapper.delete(w);
    }

    public int insertTag(YqOpinionTag tag) {
        return tag == null ? 0 : tagMapper.insert(tag);
    }

    /* ==================================================== 事件聚合 */

    public YqOpinionCluster clusterById(Long clusterId) {
        return clusterId == null ? null : clusterMapper.selectById(clusterId);
    }

    public List<YqOpinionCluster> clustersByIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        return clusterMapper.selectList(new LambdaQueryWrapper<YqOpinionCluster>()
            .in(YqOpinionCluster::getClusterId, ids));
    }

    /**
     * 聚合候选事件：最近出现时间在 {@code since} 之后的事件。
     *
     * <p><b>刻意不按数据权限过滤：</b>这是聚合决策的输入，属于写侧内部调用，
     * 不面向用户展示。如果按任务切，同一个热点会被切成多个事件
     * （A 任务采到的聚成一个、B 任务采到的聚成另一个），
     * 事件列表上出现若干「疑似重复」的条目，传播全貌也就看不出来了。
     * 用户侧的可见性由展示层（{@code ClusterCard.visibleCount}）保证。</p>
     */
    public List<YqOpinionCluster> recentClusters(LocalDateTime since, int limit) {
        LambdaQueryWrapper<YqOpinionCluster> w = new LambdaQueryWrapper<>();
        if (since != null) {
            w.ge(YqOpinionCluster::getLastTime, since);
        }
        w.orderByDesc(YqOpinionCluster::getLastTime);
        w.last("limit " + Math.max(limit, 0));
        return clusterMapper.selectList(w);
    }

    public int insertCluster(YqOpinionCluster c) {
        return c == null ? 0 : clusterMapper.insert(c);
    }

    public int updateCluster(YqOpinionCluster c) {
        return c == null || c.getClusterId() == null ? 0 : clusterMapper.updateById(c);
    }

    /**
     * 当前用户可见事件ID（验收标准 4 / 10：事件列表按数据权限收敛）。
     *
     * <p>事件是共享实体，本身没有归属字段，因此用「事件下是否存在
     * 我可见的舆情」来判定可见性。取 {@code cluster_id} 去重即可。
     * 上限 {@code limit} 防止把全表 cluster_id 拉进内存。</p>
     */
    public List<Long> visibleClusterIds(LedgerScope scope, int limit) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.isNotNull(YqOpinion::getClusterId);
        w.select(YqOpinion::getClusterId);
        w.groupBy(YqOpinion::getClusterId);
        w.orderByDesc(YqOpinion::getClusterId);
        w.last("limit " + Math.max(limit, 0));
        List<YqOpinion> rows = opinionMapper.selectList(w);
        Set<Long> ids = new LinkedHashSet<>();
        if (rows != null) {
            for (YqOpinion r : rows) {
                if (r != null && r.getClusterId() != null) {
                    ids.add(r.getClusterId());
                }
            }
        }
        return new ArrayList<>(ids);
    }

    /** 某事件下可见的舆情条数（ClusterCard.visibleCount） */
    public long visibleCountInCluster(Long clusterId, LedgerScope scope) {
        if (clusterId == null) {
            return 0L;
        }
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getClusterId, clusterId);
        Long n = opinionMapper.selectCount(w);
        return n == null ? 0L : n;
    }

    /**
     * 该事件下的舆情成员。
     *
     * <p><b>方法名不带 visible 前缀是刻意的：</b>写侧（重算传播脉络）需要事件的
     * 完整成员，此时传 {@code LedgerScope.all()}；读侧（事件卡片）传用户范围，
     * 得到的是可见子集。两种用法共用同一段 SQL 口径，避免出现
     * 「写侧一套、读侧一套」的阶段判定输入不一致。</p>
     *
     * @param asc   true = 按发布时间升序（画传播时间轴）；false = 按热度倒序（卡片缩略列表）
     * @param limit 行数上限
     */
    public List<YqOpinion> opinionsInCluster(Long clusterId, LedgerScope scope, boolean asc, int limit) {
        if (clusterId == null) {
            return new ArrayList<>();
        }
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getClusterId, clusterId);
        if (asc) {
            w.orderByAsc(YqOpinion::getPublishTime);
            w.orderByAsc(YqOpinion::getOpinionId);
        } else {
            w.orderByDesc(YqOpinion::getHeatScore);
            w.orderByDesc(YqOpinion::getOpinionId);
        }
        w.last("limit " + Math.max(limit, 0));
        return opinionMapper.selectList(w);
    }

    /** 按ID批量取舆情（回填聚合成员、批量研判结果明细用） */
    public List<YqOpinion> byIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new ArrayList<>();
        }
        return opinionMapper.selectList(new LambdaQueryWrapper<YqOpinion>()
            .in(YqOpinion::getOpinionId, ids));
    }

    /**
     * 某条舆情是否在当前可见范围内（写操作的前置校验）。
     *
     * <p>写入口（单条重研判 / 人工修正 / 释放状态）必须先过这一关：
     * 数据权限若只做在读接口上，越权探测者可以拿着别人的 opinionId
     * 直接调写接口 —— 这是最典型的「读挡住了、写漏了」。</p>
     *
     * <p>返回 false 时调用方统一提示「无权操作或不存在」，
     * 不区分两者，避免通过错误文案探测数据是否存在。</p>
     */
    public boolean isVisible(Long opinionId, LedgerScope scope) {
        if (opinionId == null) {
            return false;
        }
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        w.eq(YqOpinion::getOpinionId, opinionId);
        Long n = opinionMapper.selectCount(w);
        return n != null && n > 0L;
    }

    /* ==================================================== 内部：条件构造 */

    /**
     * 组装查询条件。
     *
     * <p>数据权限条件放在最前面（{@code applyScope}），后续过滤条件都是 AND 叠加 ——
     * 顺序不影响语义，但写在前面对读代码的人是一种提示：
     * 这是安全底座，不是可选条件。</p>
     */
    private LambdaQueryWrapper<YqOpinion> wrapper(AnalysisQuery q, LedgerScope scope) {
        LambdaQueryWrapper<YqOpinion> w = new LambdaQueryWrapper<>();
        LedgerWrapperFactory.applyScope(w, scope);
        AnalysisQuery query = q == null ? new AnalysisQuery() : q;

        /* 时间维度：起用当日 00:00:00，止用当日 23:59:59（只给日期时）。
         * 解析交给 F-016 的宽容解析器 —— 非法值直接忽略而不是抛 400，
         * 台账筛选场景下「用户少打一个字符就报错」体验很差。 */
        LocalDateTime cb = LedgerTimeParser.parse(query.getCollectBeginTime());
        LocalDateTime ce = LedgerTimeParser.parseEnd(query.getCollectEndTime());
        w.ge(cb != null, YqOpinion::getCollectTime, cb);
        w.le(ce != null, YqOpinion::getCollectTime, ce);

        /* 归属维度 */
        w.eq(query.getTaskId() != null, YqOpinion::getTaskId, query.getTaskId());
        w.eq(query.getChannelId() != null, YqOpinion::getChannelId, query.getChannelId());
        w.eq(query.getClusterId() != null, YqOpinion::getClusterId, query.getClusterId());

        /* 属性维度 */
        w.eq(notBlank(query.getSentiAttr()), YqOpinion::getSentiAttr, query.getSentiAttr());
        w.eq(notBlank(query.getRiskLevel()), YqOpinion::getRiskLevel, query.getRiskLevel());
        w.eq(notBlank(query.getOpinionLevel()), YqOpinion::getOpinionLevel, query.getOpinionLevel());
        w.eq(notBlank(query.getSpreadLevel()), YqOpinion::getSpreadLevel, query.getSpreadLevel());

        /* 流程维度：只支持 failed 与「按状态」；failedOnly 是它对前端的一个语法糖 */
        if (query.failedOnly()) {
            w.eq(YqOpinion::getAnalyzeStatus, ST_FAILED);
        } else if (notBlank(query.getAnalyzeStatus())) {
            w.eq(YqOpinion::getAnalyzeStatus, query.getAnalyzeStatus());
        }
        w.eq(notBlank(query.getAlertFlag()), YqOpinion::getAlertFlag, query.getAlertFlag());

        applyTagFilter(w, query);
        applyCorrectedFilter(w, query);
        applyKeyword(w, query);
        applyOrder(w, query);
        return w;
    }

    /**
     * 标签筛选（验收标准 7）。
     *
     * <p>用 {@code inSql} 子查询而不是「先查 tag 表拿 opinionId 列表再 in」：
     * 后者的 IN 列表会随标签命中量线性膨胀，上千条时会撞上
     * 数据库的占位符上限。拼进 SQL 的只有 {@link #numericLiteral}
     * 产出的「数字与逗号」，无任何用户可控字符串。</p>
     */
    private void applyTagFilter(LambdaQueryWrapper<YqOpinion> w, AnalysisQuery q) {
        List<Long> tagIds = q.getTagIds();
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        String nums = numericLiteral(tagIds);
        if (nums.isEmpty()) {
            /* 入参全是 null / 非法值：退化为恒假，而不是「不加条件」。
             * 后者会把「筛选标签」变成「显示全部」，是典型的数据越界。 */
            w.eq(YqOpinion::getOpinionId, -1L);
            return;
        }
        w.inSql(YqOpinion::getOpinionId,
            "select opinion_id from yq_opinion_tag where tag_id in (" + nums + ")");
    }

    /**
     * 「仅看已修正」筛选（验收标准 8）。
     *
     * <p>修正标记在 analysis 表上，因此先取一批被修正过的 opinionId 再 in。
     * 取空集时退化为恒假条件（不返回全部）。</p>
     */
    private void applyCorrectedFilter(LambdaQueryWrapper<YqOpinion> w, AnalysisQuery q) {
        if (!notBlank(q.getCorrectedFlag()) || !"1".equals(q.getCorrectedFlag().trim())) {
            return;
        }
        Set<Long> ids = correctedOpinionIds(CORRECTED_SCAN_LIMIT);
        if (ids.isEmpty()) {
            w.eq(YqOpinion::getOpinionId, -1L);
            return;
        }
        w.in(YqOpinion::getOpinionId, new ArrayList<>(ids));
    }

    /**
     * 关键词过滤（验收标准 7 的台账内搜索）。
     *
     * <p>默认只对标题做 LIKE，不做正文 —— 正文检索是 F-016 台账的职责
     * （那边有专门的检索入口与高亮实现）。这里再开一个正文检索，
     * 会让用户面对两个「搜同一件事、结果不一样」的入口。
     * 调用方显式指定 {@code keywordScope=content} 时才查正文。</p>
     */
    private void applyKeyword(LambdaQueryWrapper<YqOpinion> w, AnalysisQuery q) {
        if (!q.hasKeyword()) {
            return;
        }
        String kw = q.getKeyword().trim();
        if (kw.isEmpty()) {
            return;
        }
        String mode = q.normalizedKeywordScope();
        if ("both".equals(mode)) {
            w.and(x -> x.like(YqOpinion::getTitle, kw).or().like(YqOpinion::getContent, kw));
        } else if ("content".equals(mode)) {
            w.like(YqOpinion::getContent, kw);
        } else {
            w.like(YqOpinion::getTitle, kw);
        }
    }

    /**
     * 排序白名单（验收标准 5、7）。
     *
     * <p>只接受四个字段名，其余一律回落默认。
     * <b>绝不</b>把用户输入直接拼进 ORDER BY —— 这是最典型的二次注入面。
     * 主键降序作为固定次级排序键：否则同一秒内多条的相对顺序在翻页间会漂移，
     * 表现为「第 2 页出现第 1 页的记录」。</p>
     */
    private void applyOrder(LambdaQueryWrapper<YqOpinion> w, AnalysisQuery q) {
        String by = q.getOrderBy() == null ? "" : q.getOrderBy().trim();
        boolean desc = !Boolean.FALSE.equals(q.getOrderDesc());
        switch (by) {
            case "publishTime":
                w.orderBy(true, desc, YqOpinion::getPublishTime);
                break;
            case "heatScore":
                w.orderBy(true, desc, YqOpinion::getHeatScore);
                break;
            case "collectTime":
                w.orderBy(true, desc, YqOpinion::getCollectTime);
                break;
            default:
                /* 默认按采集时间倒序：最新采到的排前面。
                 * 不用发布时间是因为发布时间由来源站点给出，可能缺失或被伪造，
                 * 排序结果会忽前忽后。 */
                w.orderByDesc(YqOpinion::getCollectTime);
                break;
        }
        w.orderByDesc(YqOpinion::getOpinionId);
    }

    /**
     * 更新语句的数据权限条件（释放僵尸状态时用，防止跨任务释放）。
     *
     * <p>注意 {@code applyScope} 只接受 {@code LambdaQueryWrapper}，
     * 更新语句用的是 {@code LambdaUpdateWrapper}，两者没有公共父接口可承载
     * 这段逻辑，因此这里必须写一份等价实现 —— 语义与
     * {@code LedgerWrapperFactory.applyScope} 严格一致：
     * 空范围落成恒假条件，<b>绝不放行</b>。</p>
     */
    private void applyScopeToUpdate(LambdaUpdateWrapper<YqOpinion> u, LedgerScope scope) {
        LedgerScope s = scope == null ? LedgerScope.none() : scope;
        if (s.isUnrestricted()) {
            return;
        }
        if (s.isDenyAll() || s.getTaskIds().isEmpty()) {
            u.eq(YqOpinion::getOpinionId, -1L);
            return;
        }
        u.in(YqOpinion::getTaskId, new ArrayList<>(s.getTaskIds()));
    }

    /**
     * 把 Long 集合转成 SQL 数字字面量列表。
     *
     * <p>只接受数字与负号，任何其它字符直接丢弃。这是「即使上游类型被绕过
     * 也拼不出字符串」的最后一道闸。</p>
     *
     * <p>与 {@code LedgerWrapperFactory.numericLiteral} 是等价实现：
     * 那边是包级私有（cross-package access 编不过），
     * 而把它改成 public 需要改动 F-016 的生成器 —— 会牵动另一个已上线特性，
     * 因此本模块自带一份，两处都只做同一件小事（数字白名单）。</p>
     */
    private static String numericLiteral(List<Long> ids) {
        StringBuilder sb = new StringBuilder();
        if (ids == null) {
            return "";
        }
        for (Long id : ids) {
            if (id == null) {
                continue;
            }
            String s = String.valueOf(id);
            if (!isNumeric(s)) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(s);
        }
        return sb.toString();
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
