/**
 * F-016 台账 · 模板 4：分页结果对象 + 检索结果对象 + 台账读服务接口与实现
 *
 * 产物：
 *   ledger/domain/LedgerPage.java         列表分页结果（含空状态建议与范围说明）
 *   ledger/domain/LedgerSearchResult.java 检索结果（含实现方式标注）
 *   ledger/service/IYqLedgerService.java
 *   ledger/service/impl/YqLedgerServiceImpl.java
 *
 * 覆盖验收标准：1（多维筛选）、2（列表列）、3（详情）、4（事件聚合与时间轴）、
 *                7（全文检索高亮）、8（数据权限）、9（空状态建议）
 * 导出链路（5 / 6 / 10）在 gen-yuqing-ledger-tpl5.mjs
 */
export const LEDGER_TPL4 = [

  /* ==================================================== 分页结果 */
  {
    rel: 'ledger/domain/LedgerPage.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 台账列表分页结果（F-016 验收标准 2、8、9）
 *
 * <p>刻意不复用 {@code PageResult}：验收标准 9 要求「无结果时展示空状态提示
 * 并给出可放宽的筛选建议」，这些建议必须**与本次查询条件一起返回**，
 * 否则前端要么丢失条件上下文、要么再发一次请求去问「为什么是空的」。
 * 验收标准 8 的范围说明同理 —— 用户需要知道「我看到的是我授权范围内的数据」，
 * 而不是以为自己看到的就是全量。</p>
 *
 * <p>{@code rows} / {@code total} 沿用 RuoYi 分页字段命名，
 * 前端表格组件可直接对接。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerPage implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 当前页数据 */
    private List<LedgerRow> rows;

    /** 满足条件的总条数 */
    private long total;

    /**
     * 空结果时的放宽建议（非空即有内容；有结果时为 null）。
     *
     * <p>恒在「结果为空」时填充 —— 包括因数据权限为空的情况，
     * 那种情况下第一条建议会明确说明「没有授权任务」，避免用户反复放宽条件。</p>
     */
    private List<String> hints;

    /** 本次查询的数据范围说明，如「任务范围(3 个任务)」/「全量」/「无授权范围（可见 0 条）」 */
    private String scopeDesc;

    /** 本次生效的筛选条件个数（前端可提示「已启用 N 个条件」） */
    private int activeConditions;

    /** 是否因数据权限而看不到任何数据（前端给出不同的空状态插画与引导） */
    private boolean scopeEmpty;
}
`,
  },

  /* ==================================================== 检索结果 */
  {
    rel: 'ledger/domain/LedgerSearchResult.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 全文检索结果（F-016 验收标准 7）
 *
 * <p><b>为什么要把 {@code matchMode} 显式暴露给前端：</b>
 * PRD §6.3 要求检索走 Doris 倒排索引 {@code MATCH_ANY}，
 * 但按架构决策 ①A，当前 doris 数据源指向的是 MySQL 镜像库，
 * 没有倒排索引。此时若默默用 {@code LIKE '%kw%'} 顶上去却不说明，
 * 将来接上真 Doris 后「为什么换了库结果不一样」将无从排查。
 * 因此实现方式随结果一起返回，前端在检索框下方标注当前口径。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerSearchResult implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 命中明细（已含高亮片段） */
    private List<SearchHit> hits;

    /** 命中总条数（可能大于 hits.size()，受 limit 限制） */
    private long total;

    /** 关键词原文（回显用） */
    private String keyword;

    /** 检索范围：title / content / both */
    private String keywordScope;

    /**
     * 实际检索实现方式：
     * <ul>
     *   <li>{@code inverted-index}：Doris 倒排索引 MATCH_ANY（生产目标口径）</li>
     *   <li>{@code like-scan}：镜像库兜底的前置模糊扫描（①A 现状）</li>
     * </ul>
     */
    private String matchMode;

    /** 为空的说明（无命中时给出放宽建议） */
    private List<String> hints;
}
`,
  },

  /* ==================================================== 服务接口 */
  {
    rel: 'ledger/service/IYqLedgerService.java',
    content: `package org.dromara.yuqing.ledger.service;

import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.ledger.domain.ClusterView;
import org.dromara.yuqing.ledger.domain.LedgerDetail;
import org.dromara.yuqing.ledger.domain.LedgerPage;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerRow;
import org.dromara.yuqing.ledger.domain.LedgerSearchResult;
import org.dromara.yuqing.ledger.support.LedgerScope;

import java.util.List;

/**
 * 舆情台账读服务（F-016）
 *
 * <p><b>只读接口：</b>台账不提供任何写操作（除导出审计落库）。
 * 舆情的写入属于采集与研判链路，研判修正属于 F-007，
 * 预警处置属于 F-010 —— 台账只做「可查、可看、可导、可审」。</p>
 *
 * <p><b>数据权限（验收标准 8 / 决策 ③A）：</b>所有查询方法都不接收
 * 「可见范围」参数，一律由实现内部从 Sa-Token 上下文推导 ——
 * 这样 Controller 层无法「忘记传范围」，调用方也无法伪造范围。
 * 唯一的例外是 {@link #scopeOfUser(Long)}，专为异步导出任务准备
 * （它运行在无登录上下文的线程里），且只接受 userId 且重新查库推导，
 * 不接受任何外部构造的范围对象。</p>
 *
 * @author ruoyi
 */
public interface IYqLedgerService {

    /**
     * 台账分页查询（验收标准 1 / 2 / 8 / 9）
     *
     * @param q         多维筛选条件
     * @param pageQuery 分页参数（页大小会被配置上限钳制）
     * @return 分页结果 + 空状态建议 + 范围说明
     */
    LedgerPage queryPage(LedgerQuery q, PageQuery pageQuery);

    /**
     * 舆情详情（验收标准 3）
     *
     * <p>会做数据权限校验：不在可见范围内的舆情一律抛出
     * 「无权查看或不存在」的统一提示（不区分两者，避免探测存在性）。</p>
     */
    LedgerDetail detail(Long opinionId);

    /**
     * 全文检索（验收标准 7）
     *
     * @param keyword      关键词
     * @param keywordScope 检索范围 title / content / both
     * @param limit        命中上限，null 时用配置值
     */
    LedgerSearchResult search(String keyword, String keywordScope, Integer limit);

    /**
     * 事件聚合视图：事件概要 + 传播时间轴 + 关联舆情（验收标准 4）
     *
     * @param nodeLimit 时间轴节点上限，null 时用配置值
     */
    ClusterView cluster(Long clusterId, Integer nodeLimit, PageQuery pageQuery);

    /**
     * 按条件取导出行（验收标准 5，供导出服务调用）
     *
     * @param scope 由调用方（导出服务）通过 {@link #scopeOfUser(Long)} 取得
     * @param limit 行数上限
     */
    List<LedgerRow> rowsForExport(LedgerQuery q, LedgerScope scope, int limit);

    /**
     * 按条件计数（验收标准 6，判定是否需转异步）
     */
    long countFor(LedgerQuery q, LedgerScope scope);

    /** 当前登录用户的可见范围（从 Sa-Token 上下文推导） */
    LedgerScope currentScope();

    /**
     * 指定用户的可见范围（供异步任务使用）
     *
     * <p>异步导出运行在 SnailJob / 线程池线程中，没有登录上下文，
     * 因此必须按「发起人」重新推导 —— 而不是把范围快照存进数据库。
     * 重新推导的额外好处是：即使发起人的任务归属在导出期间发生变化，
     * 导出结果也遵循**当前**权限，不会越过后来的权限收缩。</p>
     */
    LedgerScope scopeOfUser(Long userId);
}
`,
  },

  /* ==================================================== 服务实现 */
  {
    rel: 'ledger/service/impl/YqLedgerServiceImpl.java',
    content: `package org.dromara.yuqing.ledger.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.domain.YqOpinionMetric;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.ledger.config.YqLedgerProperties;
import org.dromara.yuqing.ledger.dao.LedgerMetaDao;
import org.dromara.yuqing.ledger.dao.LedgerOpinionDao;
import org.dromara.yuqing.ledger.domain.ClusterView;
import org.dromara.yuqing.ledger.domain.LedgerAlertView;
import org.dromara.yuqing.ledger.domain.LedgerAnalysisView;
import org.dromara.yuqing.ledger.domain.LedgerDetail;
import org.dromara.yuqing.ledger.domain.LedgerPage;
import org.dromara.yuqing.ledger.domain.LedgerPushView;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerRow;
import org.dromara.yuqing.ledger.domain.LedgerSearchResult;
import org.dromara.yuqing.ledger.domain.SearchHit;
import org.dromara.yuqing.ledger.domain.TimelineNode;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.dromara.yuqing.ledger.support.LedgerEmptyHint;
import org.dromara.yuqing.ledger.support.LedgerHighlighter;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.ledger.support.LedgerScopeResolver;
import org.dromara.yuqing.ledger.support.LedgerStages;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 舆情台账读服务实现（F-016）
 *
 * <p><b>跨库编排（PRD §6.3）：</b>「先查 Doris 取明细 → 再用 taskId / channelId
 * 批量回查 MySQL 补配置字段」，禁止跨库 JOIN、禁止分布式事务。
 * 本类是唯一的编排点：{@link LedgerOpinionDao}（Doris）与
 * {@link LedgerMetaDao}（MySQL）各自只管自己的库，本类负责把两边拼起来。</p>
 *
 * <p><b>不做 N+1：</b>所有名称回填都是「收集本页 ID 集合 → 一次批量查 → 建 Map → 回填」。
 * 一页 20 行若逐行查任务名，就是 20 次额外查询，且随页大小线性恶化。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqLedgerServiceImpl implements IYqLedgerService {

    /** 详情页互动快照最多取多少天的点 */
    private static final int METRIC_TREND_DAYS = 30;

    /** 详情页预警 / 推送记录最多各回多少条 */
    private static final int DETAIL_RECORD_LIMIT = 20;

    private final LedgerOpinionDao opinionDao;
    private final LedgerMetaDao metaDao;
    private final YqLedgerProperties props;

    /* ================================================================ 列表 */

    @Override
    public LedgerPage queryPage(LedgerQuery q, PageQuery pageQuery) {
        LedgerScope scope = currentScope();
        LedgerPage out = new LedgerPage();
        out.setScopeDesc(scope.describe());
        out.setActiveConditions(LedgerEmptyHint.countActiveConditions(q));

        /* 范围为空：直接返回空集，不查库。这是与「不加条件」最关键的区分点。 */
        if (scope.isDenyAll()) {
            out.setRows(List.of());
            out.setTotal(0L);
            out.setScopeEmpty(true);
            out.setHints(LedgerEmptyHint.suggest(q, scope));
            return out;
        }

        PageResult<YqOpinion> page = opinionDao.page(q, scope, pageQuery, props.getMaxPageSize());
        List<LedgerRow> rows = toRows(page.getRows());
        out.setRows(rows);
        out.setTotal(page.getTotal());
        if (rows.isEmpty()) {
            out.setHints(LedgerEmptyHint.suggest(q, scope));
        }
        return out;
    }

    /* ================================================================ 详情 */

    @Override
    public LedgerDetail detail(Long opinionId) {
        if (opinionId == null) {
            throw new ServiceException("舆情ID不能为空");
        }
        LedgerScope scope = currentScope();

        YqOpinion op = opinionDao.getById(opinionId);
        /* 统一话术：不区分「不存在」与「无权限」，避免用详情接口探测数据存在性 */
        if (op == null || !scope.allows(op.getTaskId())) {
            throw new ServiceException("无权查看该舆情，或该舆情已不存在");
        }

        LedgerDetail d = new LedgerDetail();
        BeanUtils.copyProperties(op, d);

        /* —— 溯源与归属：名称回填 —— */
        Map<Long, String> taskNames = metaDao.taskNames(
            op.getTaskId() == null ? List.of() : List.of(op.getTaskId()));
        Map<Long, String> channelNames = metaDao.channelNames(
            op.getChannelId() == null ? List.of() : List.of(op.getChannelId()));
        d.setTaskName(taskNames.get(op.getTaskId()));
        d.setChannelName(channelNames.get(op.getChannelId()));
        Map<Long, String> clusterTitles = metaDao.clusterTitles(
            op.getClusterId() == null ? List.of() : List.of(op.getClusterId()));
        d.setClusterTitle(clusterTitles.get(op.getClusterId()));

        /* —— 研判块 —— */
        List<YqOpinionAnalysis> analyses = opinionDao.analyses(opinionId);
        List<LedgerAnalysisView> analysisViews = new ArrayList<>();
        for (YqOpinionAnalysis a : analyses) {
            LedgerAnalysisView v = new LedgerAnalysisView();
            BeanUtils.copyProperties(a, v);
            analysisViews.add(v);
        }
        d.setAnalysisHistory(analysisViews);
        d.setAnalysis(analysisViews.isEmpty() ? null : analysisViews.get(0));

        /* —— 系统标签 —— */
        List<YqOpinionTag> tags = opinionDao.tags(opinionId);
        if (!tags.isEmpty()) {
            Set<Long> tagIds = new LinkedHashSet<>();
            for (YqOpinionTag t : tags) {
                if (t.getTagId() != null) {
                    tagIds.add(t.getTagId());
                }
            }
            Map<Long, String> tagNames = metaDao.tagNames(tagIds);
            List<String> names = new ArrayList<>();
            for (YqOpinionTag t : tags) {
                String n = tagNames.get(t.getTagId());
                names.add(n == null || n.isBlank() ? String.valueOf(t.getTagId()) : n);
            }
            d.setTagNames(names);
        } else {
            d.setTagNames(List.of());
        }

        /* —— 互动数据趋势 —— */
        List<YqOpinionMetric> metrics = opinionDao.metrics(opinionId, METRIC_TREND_DAYS);
        List<LedgerDetail.MetricPoint> points = new ArrayList<>();
        for (YqOpinionMetric m : metrics) {
            LedgerDetail.MetricPoint p = new LedgerDetail.MetricPoint();
            p.setSnapshotDate(m.getSnapshotDate());
            p.setLikeCount(m.getLikeCount());
            p.setCommentCount(m.getCommentCount());
            p.setShareCount(m.getShareCount());
            p.setReadCount(m.getReadCount());
            p.setHeatScore(m.getHeatScore());
            points.add(p);
        }
        /* 前端画趋势要从早到晚，DAO 取的是倒序（取最近 N 条），这里翻转 */
        points.sort(Comparator.comparing(LedgerDetail.MetricPoint::getSnapshotDate,
            Comparator.nullsLast(Comparator.naturalOrder())));
        d.setMetricTrend(points);

        /* —— 预警记录（MySQL） —— */
        d.setAlerts(buildAlerts(metaDao.alertsOf(opinionId, DETAIL_RECORD_LIMIT)));

        /* —— 推送记录（MySQL） —— */
        d.setPushes(buildPushes(metaDao.pushesOf(opinionId, DETAIL_RECORD_LIMIT)));

        return d;
    }

    /* ================================================================ 检索 */

    @Override
    public LedgerSearchResult search(String keyword, String keywordScope, Integer limit) {
        LedgerSearchResult out = new LedgerSearchResult();
        String kw = keyword == null ? "" : keyword.trim();
        String scopeMode = keywordScope == null || keywordScope.isBlank() ? "both" : keywordScope.trim();
        out.setKeyword(kw);
        out.setKeywordScope(scopeMode);
        /* 镜像库现状：没有倒排索引，走前置模糊扫描。如实标注，不假装走了 MATCH_ANY。 */
        out.setMatchMode("like-scan");
        out.setHits(List.of());
        out.setTotal(0L);

        LedgerScope scope = currentScope();
        LedgerQuery probe = new LedgerQuery();
        probe.setKeyword(kw);
        probe.setKeywordScope(scopeMode);
        if (kw.isEmpty()) {
            out.setHints(List.of("请输入检索关键词。"));
            return out;
        }
        if (scope.isDenyAll()) {
            out.setHints(LedgerEmptyHint.suggest(probe, scope));
            return out;
        }

        int cap = limit == null || limit <= 0 ? props.getSearchHitLimit() : limit;
        if (cap > props.getSearchHitLimit()) {
            cap = props.getSearchHitLimit();
        }

        List<YqOpinion> candidates = opinionDao.searchCandidates(kw, scopeMode, scope, cap);
        if (candidates.isEmpty()) {
            out.setHints(LedgerEmptyHint.suggest(probe, scope));
            return out;
        }

        Map<Long, String> channelNames = metaDao.channelNames(collectChannelIds(candidates));
        List<SearchHit> hits = new ArrayList<>();
        for (YqOpinion o : candidates) {
            int hitsTitle = LedgerHighlighter.countHits(o.getTitle(), kw);
            int hitsContent = LedgerHighlighter.countHits(o.getContent(), kw);
            SearchHit h = new SearchHit();
            h.setOpinionId(o.getOpinionId());
            h.setTitle(o.getTitle());
            h.setChannelName(channelNames.get(o.getChannelId()));
            h.setPublishTime(o.getPublishTime());
            h.setSentiAttr(o.getSentiAttr());
            h.setRiskLevel(o.getRiskLevel());
            h.setOpinionUrl(o.getOpinionUrl());
            h.setHitField(LedgerHighlighter.hitField(o.getTitle(), o.getContent(), kw));
            h.setHitCount(hitsTitle + hitsContent);
            h.setScore(hitsTitle * 3 + hitsContent);
            /* 标题优先取片段；标题没命中（纯正文命中）才从正文抽 */
            List<String> frags = new ArrayList<>();
            if (hitsTitle > 0) {
                frags.addAll(LedgerHighlighter.fragments(o.getTitle(), kw,
                    props.getSearchFragmentRadius(), 1));
            }
            if (hitsContent > 0) {
                frags.addAll(LedgerHighlighter.fragments(o.getContent(), kw,
                    props.getSearchFragmentRadius(), props.getSearchFragmentLimit()));
            }
            h.setFragments(frags);
            hits.add(h);
        }
        /* 相关度倒序：标题命中权重 3 倍于正文，命中越多越靠前 */
        hits.sort(Comparator.comparing(SearchHit::getScore,
            Comparator.nullsLast(Comparator.reverseOrder())));
        out.setHits(hits);
        out.setTotal(hits.size());
        return out;
    }

    /* ================================================================ 事件聚合 */

    @Override
    public ClusterView cluster(Long clusterId, Integer nodeLimit, PageQuery pageQuery) {
        if (clusterId == null) {
            throw new ServiceException("事件聚合ID不能为空");
        }
        LedgerScope scope = currentScope();
        if (scope.isDenyAll()) {
            throw new ServiceException("当前账号没有可查看的授权范围");
        }

        YqOpinionCluster c = opinionDao.clusterById(clusterId);
        if (c == null) {
            throw new ServiceException("事件聚合不存在：" + clusterId);
        }

        int cap = nodeLimit == null || nodeLimit <= 0 ? props.getTimelineNodeLimit() : nodeLimit;
        if (cap > props.getTimelineNodeLimit()) {
            cap = props.getTimelineNodeLimit();
        }

        /* 时间轴：升序取节点；节点数可能超过上限，用 count 判定是否被截断 */
        List<YqOpinion> asc = opinionDao.clusterOpinions(clusterId, scope, true, cap);
        long totalLinked = opinionDao.clusterOpinionCount(clusterId, scope);

        ClusterView view = new ClusterView();
        view.setClusterId(c.getClusterId());
        view.setClusterTitle(c.getClusterTitle());
        view.setClusterTopic(c.getClusterTopic());
        view.setOpinionCount(c.getOpinionCount());
        view.setFirstTime(c.getFirstTime());
        view.setLastTime(c.getLastTime());
        view.setPeakHeat(c.getPeakHeat());
        view.setRiskLevel(c.getRiskLevel());
        view.setTimelineTruncated(totalLinked > asc.size());

        /* 阶段判定：把节点投影成 (time, heat) 后交给纯函数，保证口径唯一 */
        List<TimelineNode> nodes = buildTimeline(asc);
        view.setTimeline(nodes);
        List<String> stages = new ArrayList<>();
        for (TimelineNode n : nodes) {
            stages.add(n.getStage());
        }
        view.setStageCount(LedgerStages.countByStage(stages));

        /* 关联清单：倒序 + 分页（下钻明细，与时间轴互补） */
        int num = pageQuery == null || pageQuery.getPageNum() == null ? 1 : pageQuery.getPageNum();
        if (num < 1) {
            num = 1;
        }
        int size = pageQuery == null || pageQuery.getPageSize() == null ? 20 : pageQuery.getPageSize();
        if (size < 1) {
            size = 20;
        }
        if (size > props.getMaxPageSize()) {
            size = props.getMaxPageSize();
        }
        List<YqOpinion> desc = opinionDao.clusterOpinions(clusterId, scope, false, num * size);
        List<LedgerRow> rows = toRows(slice(desc, (num - 1) * size, size));
        view.setOpinions(rows);
        return view;
    }

    /* ================================================================ 导出支撑 */

    @Override
    public List<LedgerRow> rowsForExport(LedgerQuery q, LedgerScope scope, int limit) {
        if (scope == null || scope.isDenyAll()) {
            return List.of();
        }
        List<YqOpinion> list = opinionDao.list(q, scope, limit);
        return toRows(list);
    }

    @Override
    public long countFor(LedgerQuery q, LedgerScope scope) {
        if (scope == null || scope.isDenyAll()) {
            return 0L;
        }
        return opinionDao.count(q, scope);
    }

    /* ================================================================ 权限范围 */

    @Override
    public LedgerScope currentScope() {
        if (LoginHelper.isLogin() && LoginHelper.isSuperAdmin()) {
            return LedgerScope.all();
        }
        Long uid = LoginHelper.getUserId();
        return scopeOfUser(uid);
    }

    @Override
    public LedgerScope scopeOfUser(Long userId) {
        if (userId == null) {
            return LedgerScope.none();
        }
        /* 先判全量角色，再查任务归属 —— 全量角色可以省掉一次查询 */
        if (hasAllDataRole()) {
            return LedgerScope.all();
        }
        Set<Long> owned = metaDao.ownedTaskIds(userId);
        return LedgerScopeResolver.resolve(false, false, owned);
    }

    /**
     * 当前用户是否具备「全量数据」角色。
     *
     * <p>角色键列表来自配置 {@code yuqing.ledger.all-data-role-keys}。
     * 之所以做成配置而不是硬编码：各部署环境的角色键不同
     * （PRD §7.3 只规定了「舆情主管」这一角色语义，未规定 key），
     * 硬编码某个 key 在客户环境里会静默失效 ——
     * 表现为「主管只能看到自己的任务」，且没有任何报错。</p>
     *
     * <p>默认空列表 = 只有超管看全量，这是最保守的默认值。</p>
     */
    private boolean hasAllDataRole() {
        List<String> keys = props.getAllDataRoleKeys();
        if (keys == null || keys.isEmpty()) {
            return false;
        }
        try {
            var loginUser = LoginHelper.getLoginUser();
            if (loginUser == null || loginUser.getRolePermission() == null) {
                return false;
            }
            for (String k : keys) {
                if (k != null && !k.isBlank() && loginUser.getRolePermission().contains(k.trim())) {
                    return true;
                }
            }
            return false;
        } catch (RuntimeException e) {
            /* 无登录上下文（异步线程）时不能误判为全量 —— 必须返回 false，
             * 否则异步导出会绕过数据权限。 */
            log.warn("[台账] 判定全量角色失败，按受限处理: {}", e.getMessage());
            return false;
        }
    }

    /* ================================================================ 组装辅助 */

    /**
     * 实体 -> 行对象，并批量回填跨库名称。
     *
     * <p>三批查询对应三个名称来源，全部是本页 ID 去重后的一次查询。</p>
     */
    private List<LedgerRow> toRows(Collection<YqOpinion> ops) {
        List<LedgerRow> rows = new ArrayList<>();
        if (ops == null || ops.isEmpty()) {
            return rows;
        }
        Map<Long, String> taskNames = metaDao.taskNames(collectTaskIds(ops));
        Map<Long, String> channelNames = metaDao.channelNames(collectChannelIds(ops));
        Map<Long, String> clusterTitles = metaDao.clusterTitles(collectClusterIds(ops));
        for (YqOpinion o : ops) {
            LedgerRow r = new LedgerRow();
            BeanUtils.copyProperties(o, r);
            r.setTaskName(taskNames.get(o.getTaskId()));
            r.setChannelName(channelNames.get(o.getChannelId()));
            r.setClusterTitle(clusterTitles.get(o.getClusterId()));
            rows.add(r);
        }
        return rows;
    }

    /** 构造时间轴节点并判定传播阶段 */
    private List<TimelineNode> buildTimeline(List<YqOpinion> asc) {
        List<TimelineNode> nodes = new ArrayList<>();
        if (asc == null || asc.isEmpty()) {
            return nodes;
        }
        Map<Long, String> channelNames = metaDao.channelNames(collectChannelIds(asc));
        LocalDateTime firstTime = null;
        for (YqOpinion o : asc) {
            LocalDateTime t = o.getPublishTime() != null ? o.getPublishTime() : o.getCollectTime();
            if (firstTime == null && t != null) {
                firstTime = t;
            }
        }
        for (YqOpinion o : asc) {
            TimelineNode n = new TimelineNode();
            n.setOpinionId(o.getOpinionId());
            LocalDateTime t = o.getPublishTime() != null ? o.getPublishTime() : o.getCollectTime();
            n.setTime(t);
            n.setTimeBasis(o.getPublishTime() != null ? "PUBLISH" : "COLLECT");
            n.setTitle(o.getTitle());
            n.setChannelName(channelNames.get(o.getChannelId()));
            n.setAuthor(o.getAuthor());
            n.setSentiAttr(o.getSentiAttr());
            n.setRiskLevel(o.getRiskLevel());
            n.setHeatScore(o.getHeatScore());
            n.setOpinionUrl(o.getOpinionUrl());
            if (firstTime != null && t != null) {
                n.setOffsetMinutes(Math.max(Duration.between(firstTime, t).toMinutes(), 0L));
            }
            nodes.add(n);
        }
        /* 阶段判定交给纯函数（可离线自测） */
        List<String> stages = LedgerStages.classify(nodes.stream()
            .map(x -> (LedgerStages.Node) new LedgerStages.Node() {
                @Override
                public LocalDateTime time() {
                    return x.getTime();
                }

                @Override
                public Integer heat() {
                    return x.getHeatScore();
                }
            })
            .toList());
        for (int i = 0; i < nodes.size() && i < stages.size(); i++) {
            nodes.get(i).setStage(stages.get(i));
        }
        return nodes;
    }

    private List<LedgerAlertView> buildAlerts(List<Map<String, Object>> rows) {
        List<LedgerAlertView> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        /* 处置人昵称批量回填 */
        Set<Long> userIds = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            Long uid = asLong(r.get("process_by"));
            if (uid != null) {
                userIds.add(uid);
            }
        }
        Map<Long, String> userNames = metaDao.userNames(userIds);
        for (Map<String, Object> r : rows) {
            LedgerAlertView v = new LedgerAlertView();
            v.setAlertId(asLong(r.get("alert_id")));
            v.setAlertTitle(asString(r.get("alert_title")));
            v.setTriggerScene(asString(r.get("trigger_scene")));
            v.setAlertLevel(asString(r.get("alert_level")));
            v.setTriggerValue(asString(r.get("trigger_value")));
            v.setTriggerTime(asDateTime(r.get("trigger_time")));
            v.setStatus(asString(r.get("status")));
            v.setProcessRemark(asString(r.get("process_remark")));
            Long pb = asLong(r.get("process_by"));
            v.setProcessBy(pb);
            v.setProcessByName(pb == null ? null : userNames.get(pb));
            v.setProcessTime(asDateTime(r.get("process_time")));
            v.setPushResult(asString(r.get("push_result")));
            out.add(v);
        }
        return out;
    }

    private List<LedgerPushView> buildPushes(List<Map<String, Object>> rows) {
        List<LedgerPushView> out = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        Set<Long> ruleIds = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            Long rid = asLong(r.get("rule_id"));
            if (rid != null) {
                ruleIds.add(rid);
            }
        }
        Map<Long, String> ruleNames = metaDao.pushRuleNames(ruleIds);
        for (Map<String, Object> r : rows) {
            LedgerPushView v = new LedgerPushView();
            v.setRecordId(asLong(r.get("record_id")));
            Long rid = asLong(r.get("rule_id"));
            v.setRuleName(rid == null ? null : ruleNames.get(rid));
            v.setPushScene(asString(r.get("push_scene")));
            v.setPushLevel(asString(r.get("push_level")));
            v.setSendStatus(asString(r.get("send_status")));
            v.setTargetIds(asString(r.get("target_ids")));
            v.setRetryCount(asInt(r.get("retry_count")));
            v.setFailReason(asString(r.get("fail_reason")));
            v.setSendTime(asDateTime(r.get("send_time")));
            v.setContentDigest(asString(r.get("content_digest")));
            out.add(v);
        }
        return out;
    }

    /* ================================================================ 小工具 */

    private static Set<Long> collectTaskIds(Collection<YqOpinion> ops) {
        Set<Long> s = new LinkedHashSet<>();
        for (YqOpinion o : ops) {
            if (o.getTaskId() != null) {
                s.add(o.getTaskId());
            }
        }
        return s;
    }

    private static Set<Long> collectChannelIds(Collection<YqOpinion> ops) {
        Set<Long> s = new LinkedHashSet<>();
        for (YqOpinion o : ops) {
            if (o.getChannelId() != null) {
                s.add(o.getChannelId());
            }
        }
        return s;
    }

    private static Set<Long> collectClusterIds(Collection<YqOpinion> ops) {
        Set<Long> s = new LinkedHashSet<>();
        for (YqOpinion o : ops) {
            if (o.getClusterId() != null) {
                s.add(o.getClusterId());
            }
        }
        return s;
    }

    private static <T> List<T> slice(List<T> list, int from, int size) {
        if (list == null || list.isEmpty() || from >= list.size()) {
            return List.of();
        }
        int to = Math.min(from + size, list.size());
        return list.subList(Math.max(from, 0), to);
    }

    private static Long asLong(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.valueOf(String.valueOf(v));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static Integer asInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.valueOf(String.valueOf(v));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String asString(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static LocalDateTime asDateTime(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof LocalDateTime dt) {
            return dt;
        }
        if (v instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (v instanceof java.util.Date d) {
            return LocalDateTime.ofInstant(d.toInstant(), java.time.ZoneId.systemDefault());
        }
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            String t = s.length() >= 19 ? s.substring(0, 19) : s;
            return LocalDateTime.parse(t.replace(' ', 'T'));
        } catch (RuntimeException e) {
            return null;
        }
    }
}
`,
  },
];
