/**
 * F-007 智能研判 · 模板 6：研判编排层实现
 *
 * 产物：
 *   analysis/service/impl/YqAnalysisServiceImpl.java
 *
 * 职责划分：本类只做「读 + 编排 + 校验」，单条流水线在
 * gen-yuqing-analysis-tpl5.mjs 的 {@code AnalysisEngine}。
 *
 * 转义约定：模板串内不得出现裸反引号；不得出现未转义 ${；Java 产物不出现
 *   \\n / \\t / \\r 转义序列（需要换行/回车字符时用 (char) 10 / (char) 13 构造）。
 */
export const ANALYSIS_TPL6 = [

  {
    rel: 'analysis/service/impl/YqAnalysisServiceImpl.java',
    content: [
      `package org.dromara.yuqing.analysis.service.impl;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.analysis.config.YqAnalysisProperties;
import org.dromara.yuqing.analysis.dao.AnalysisMetaDao;
import org.dromara.yuqing.analysis.dao.AnalysisOpinionDao;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.domain.AnalysisCorrectBo;
import org.dromara.yuqing.analysis.domain.AnalysisDetailView;
import org.dromara.yuqing.analysis.domain.AnalysisPage;
import org.dromara.yuqing.analysis.domain.AnalysisQuery;
import org.dromara.yuqing.analysis.domain.AnalysisRow;
import org.dromara.yuqing.analysis.domain.ClusterCard;
import org.dromara.yuqing.analysis.engine.AnalysisEngine;
import org.dromara.yuqing.analysis.parse.AnalysisJson;
import org.dromara.yuqing.analysis.prompt.PromptSpec;
import org.dromara.yuqing.analysis.service.IYqAnalysisService;
import org.dromara.yuqing.analysis.stage.SpreadPathWriter;
import org.dromara.yuqing.analysis.stage.SpreadStageClassifier;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.ledger.domain.LedgerDetail;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 智能研判服务实现（F-007）
 *
 * <p><b>本类的三块职责：</b></p>
 * <ol>
 *   <li><b>读</b>：研判台账分页、单条结论详情、事件聚合卡片。
 *       读路径一律由内部从 Sa-Token 上下文推导数据范围（F-016 决策 ③A），
 *       接口不接收范围参数，调用方无法伪造；</li>
 *   <li><b>编排</b>：决定「处理哪些、以什么批次」。真正的单条处理交给
 *       {@link AnalysisEngine} —— 批次循环本身很薄，重活都在引擎里；</li>
 *   <li><b>校验与留痕</b>：人工修正的取值白名单校验、修正留痕、
 *       训练样本登记（验收标准 8、9）、模型版本回滚（验收标准 11）。</li>
 * </ol>
 *
 * <p><b>写操作的前置权限校验：</b>每个写入口（单条重研判 / 修正 / 释放状态）
 * 都先过 {@code AnalysisOpinionDao.isVisible}。数据权限只挡在读接口上，
 * 是「读挡住了、写漏了」的经典漏洞 —— 越权探测者拿别人的 ID 直接调写接口即可。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqAnalysisServiceImpl implements IYqAnalysisService {

    /** 台账分页页大小上限（防止前端传 pageSize=100000 拖垮库） */
    private static final int PAGE_SIZE_MAX = 200;

    /** 事件聚合列表一次最多扫描的可见事件数 */
    private static final int CLUSTER_SCAN_LIMIT = 2000;

    /** 事件卡片下方的代表性节点条数 */
    private static final int CLUSTER_TOP_NODES = 3;

    /** 列表行的原文摘要长度 */
    private static final int BRIEF_LEN = 120;

    /** 批次失败明细保留上限 */
    private static final int MAX_FAILURES = 20;

    /** 单条详情预览的原文长度上限（详情页要展示全文，这里只用于列表回填的一致性） */
    private static final int DETAIL_BRIEF_LEN = 400;

    /** 批次号时间部分格式 */
    private static final DateTimeFormatter BATCH_FMT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    /** 模型版本列表返回条数上限 */
    private static final int MODEL_LIST_LIMIT = 200;

    /** 换行与回车：十进制构造，避免源码出现转义字符（本项目转义铁律） */
    private static final char LF = (char) 10;
    private static final char CR = (char) 13;

    private final AnalysisOpinionDao opinionDao;
    private final AnalysisMetaDao metaDao;
    private final YqAnalysisProperties props;
    private final IYqLedgerService ledgerService;
    private final AnalysisEngine engine;
`,
      `    /* ==================================================== 读：研判台账 */

    /**
     * 研判台账分页（验收标准 5、7、8）。
     *
     * <p>状态角标、范围说明与空状态建议都随本次响应一起返回：
     * 分开发请求会出现「角标是 5 分钟前的、列表是现在的」这种用户一眼就能看出的不一致。</p>
     */
    @Override
    public AnalysisPage queryPage(AnalysisQuery q, PageQuery pageQuery) {
        LedgerScope scope = currentScope();
        AnalysisQuery query = q == null ? new AnalysisQuery() : q;
        PageResult<YqOpinion> page = opinionDao.page(query, scope, pageQuery, PAGE_SIZE_MAX);
        AnalysisPage out = new AnalysisPage();
        out.setTotal(page.getTotal());
        out.setRows(assembleRows(new ArrayList<>(page.getRows())));
        out.setStatusCount(opinionDao.countByStatus(scope));
        out.setScopeDesc(scope.describe());
        out.setScopeEmpty(scope.isDenyAll());
        out.setHints(buildHints(scope, page.getTotal(), query));
        return out;
    }

    /**
     * 单条研判结论详情（验收标准 7、8、11）。
     *
     * <p>舆情主体直接复用 F-016 的详情组装（{@code ledgerService.detail}）——
     * 那里已经包含原文、互动数据、溯源字段、预警与推送记录，并且自带数据权限校验。
     * 本方法只在其上补充研判专属的三块：来源拆分的标签、变体命中依据、
     * 结论来源与修正人。</p>
     */
    @Override
    public AnalysisDetailView detail(Long opinionId) {
        LedgerDetail opinion = ledgerService.detail(opinionId);
        AnalysisDetailView out = new AnalysisDetailView();
        out.setOpinion(opinion);
        List<YqOpinionAnalysis> history = opinionDao.analysisHistory(opinionId);
        YqOpinionAnalysis latest = history.isEmpty() ? null : history.get(0);
        out.setConclusionSource(AnalysisEngine.conclusionSource(latest));

        List<YqOpinionTag> tags = opinionDao.tagsOf(List.of(opinionId));
        Set<Long> tagIds = new LinkedHashSet<>();
        for (YqOpinionTag t : tags) {
            if (t != null && t.getTagId() != null) {
                tagIds.add(t.getTagId());
            }
        }
        Map<Long, String> names = metaDao.tagNames(tagIds);
        List<String> modelTags = new ArrayList<>();
        List<String> manualTags = new ArrayList<>();
        for (YqOpinionTag t : tags) {
            if (t == null || t.getTagId() == null) {
                continue;
            }
            String nm = names.get(t.getTagId());
            if (nm == null || nm.isBlank()) {
                continue;
            }
            if (AnalysisMetaDao.TAG_SOURCE_MANUAL.equals(t.getTagSource())) {
                manualTags.add(nm);
            } else {
                modelTags.add(nm);
            }
        }
        out.setModelTagNames(modelTags);
        out.setManualTagNames(manualTags);
        out.setVariantHits(engine.variantHits(opinion.getContent(), opinion.getTaskId()));

        if (latest != null && latest.getCorrectedBy() != null) {
            Map<Long, String> users = metaDao.userNames(List.of(latest.getCorrectedBy()));
            out.setCorrectedByName(users.get(latest.getCorrectedBy()));
        }
        return out;
    }

    /* ==================================================== 读：行组装 */

    /**
     * 把舆情实体 + 最新结论组装成列表行。
     *
     * <p>做法是「批量取、内存拼」，不是「逐行查名称」：
     * 一页 20 行若逐行查任务名 / 渠道名 / 标签名 / 结论，就是 80 次往返。
     * 这里固定 4 次批量查询（任务名、渠道名、事件标题、结论）+ 1 次标签查询，
     * 与页大小无关。</p>
     */
    private List<AnalysisRow> assembleRows(List<YqOpinion> opinions) {
        List<AnalysisRow> out = new ArrayList<>();
        if (opinions == null || opinions.isEmpty()) {
            return out;
        }
        Set<Long> opinionIds = new LinkedHashSet<>();
        Set<Long> taskIds = new LinkedHashSet<>();
        Set<Long> channelIds = new LinkedHashSet<>();
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (YqOpinion o : opinions) {
            if (o == null || o.getOpinionId() == null) {
                continue;
            }
            opinionIds.add(o.getOpinionId());
            if (o.getTaskId() != null) {
                taskIds.add(o.getTaskId());
            }
            if (o.getChannelId() != null) {
                channelIds.add(o.getChannelId());
            }
            if (o.getClusterId() != null) {
                clusterIds.add(o.getClusterId());
            }
        }
        Map<Long, String> taskNames = metaDao.taskNames(taskIds);
        Map<Long, String> channelNames = metaDao.channelNames(channelIds);

        /* 最新结论：analysesOf 已按版本倒序返回，每个 opinionId 的首次出现即最新一条 */
        Map<Long, YqOpinionAnalysis> latest = new HashMap<>();
        for (YqOpinionAnalysis a : opinionDao.analysesOf(opinionIds)) {
            if (a == null || a.getOpinionId() == null) {
                continue;
            }
            latest.putIfAbsent(a.getOpinionId(), a);
        }
        Map<Long, String> clusterTitles = new HashMap<>();
        for (YqOpinionCluster c : opinionDao.clustersByIds(clusterIds)) {
            if (c != null && c.getClusterId() != null) {
                clusterTitles.put(c.getClusterId(), c.getClusterTitle());
            }
        }
        Map<Long, List<String>> tagNamesByOpinion = tagNamesOf(opinionIds);

        for (YqOpinion o : opinions) {
            if (o == null || o.getOpinionId() == null) {
                continue;
            }
            out.add(rowOf(o, latest.get(o.getOpinionId()),
                taskNames.get(o.getTaskId()), channelNames.get(o.getChannelId()),
                clusterTitles.get(o.getClusterId()),
                tagNamesByOpinion.get(o.getOpinionId())));
        }
        return out;
    }

    /** 批量取「舆情ID -> 标签名列表」 */
    private Map<Long, List<String>> tagNamesOf(Set<Long> opinionIds) {
        Map<Long, List<String>> out = new HashMap<>();
        List<YqOpinionTag> tags = opinionDao.tagsOf(opinionIds);
        if (tags == null || tags.isEmpty()) {
            return out;
        }
        Set<Long> tagIds = new LinkedHashSet<>();
        for (YqOpinionTag t : tags) {
            if (t != null && t.getTagId() != null) {
                tagIds.add(t.getTagId());
            }
        }
        Map<Long, String> names = metaDao.tagNames(tagIds);
        for (YqOpinionTag t : tags) {
            if (t == null || t.getOpinionId() == null || t.getTagId() == null) {
                continue;
            }
            String nm = names.get(t.getTagId());
            if (nm == null || nm.isBlank()) {
                continue;
            }
            out.computeIfAbsent(t.getOpinionId(), k -> new ArrayList<>()).add(nm);
        }
        return out;
    }

    /** 单行组装 */
    private AnalysisRow rowOf(YqOpinion o, YqOpinionAnalysis a, String taskName, String channelName,
                              String clusterTitle, List<String> tagNames) {
        AnalysisRow r = new AnalysisRow();
        r.setOpinionId(o.getOpinionId());
        r.setTaskId(o.getTaskId());
        r.setTaskName(taskName);
        r.setChannelId(o.getChannelId());
        r.setChannelName(channelName);
        r.setTitle(o.getTitle());
        r.setContentBrief(cut(stripControl(o.getContent()), BRIEF_LEN));
        r.setOpinionUrl(o.getOpinionUrl());
        r.setPublishTime(o.getPublishTime());
        r.setAuthor(o.getAuthor());
        r.setHeatScore(o.getHeatScore());
        r.setClusterId(o.getClusterId());
        r.setClusterTitle(clusterTitle);
        r.setAlertFlag(o.getAlertFlag());
        /* 状态以主表为准：主表是状态机的载体，结论表只有「算没算出来」 */
        r.setAnalyzeStatus(o.getAnalyzeStatus());
        if (a != null) {
            r.setAnalyzeTime(a.getAnalyzeTime());
            r.setTopic(a.getTopic());
            r.setConfidence(a.getConfidence());
            r.setModelVersion(a.getModelVersion());
            r.setPromptVersion(a.getPromptVersion());
            r.setAnalyzeVersion(a.getAnalyzeVersion());
            r.setCorrectedFlag(a.getCorrectedFlag());
            r.setFailReason(a.getFailReason());
        }
        /* 结论侧的分级优先取结论表；结论表为空（未研判 / 失败）时回落主表口径，
         * 这样列表上至少有可供筛选的分级值，不会整列空白。 */
        r.setSentiAttr(a == null || a.getSentiAttr() == null ? o.getSentiAttr() : a.getSentiAttr());
        r.setRiskLevel(a == null || a.getRiskLevel() == null ? o.getRiskLevel() : a.getRiskLevel());
        r.setOpinionLevel(a == null || a.getOpinionLevel() == null ? o.getOpinionLevel() : a.getOpinionLevel());
        r.setSpreadLevel(o.getSpreadLevel());
        if (tagNames != null && !tagNames.isEmpty()) {
            r.setTags(new ArrayList<>(tagNames));
        }
        return r;
    }
`,
      `    /* ==================================================== 读：事件聚合维度 */

    /**
     * 事件聚合列表（验收标准 4、10 的「按事件聚合维度查看」）。
     *
     * <p><b>为什么在内存里分页而不是交给数据库：</b>事件的可见性判定是
     * 「事件下是否存在我可见的舆情」—— 这是一次多对多的扫描，
     * 无法翻译成对 {@code yq_opinion_cluster} 的简单分页条件。
     * 因此先取可见事件ID（上限 {@link #CLUSTER_SCAN_LIMIT}），再取事件实体、
     * 过滤、排序、切页。事件是聚合实体，量级远小于舆情明细，这个上限足够用；
     * 若将来事件数逼近上限，应改为在事件上冗余「归属任务集合」字段。</p>
     */
    @Override
    public PageResult<ClusterCard> clusterPage(AnalysisQuery q, PageQuery pageQuery) {
        LedgerScope scope = currentScope();
        int num = pageQuery == null || pageQuery.getPageNum() == null ? 1 : Math.max(1, pageQuery.getPageNum());
        int size = pageQuery == null || pageQuery.getPageSize() == null ? 10 : pageQuery.getPageSize();
        if (size < 1) {
            size = 10;
        }
        if (size > PAGE_SIZE_MAX) {
            size = PAGE_SIZE_MAX;
        }
        List<Long> ids = opinionDao.visibleClusterIds(scope, CLUSTER_SCAN_LIMIT);
        if (ids.isEmpty()) {
            return PageResult.build(new ArrayList<>(), 0);
        }
        List<YqOpinionCluster> all = opinionDao.clustersByIds(ids);
        String kw = q != null && q.hasKeyword() ? q.getKeyword().trim() : "";
        List<YqOpinionCluster> filtered = new ArrayList<>();
        for (YqOpinionCluster c : all) {
            if (c == null || c.getClusterId() == null) {
                continue;
            }
            if (!kw.isEmpty()
                && !contains(c.getClusterTitle(), kw)
                && !contains(c.getClusterTopic(), kw)) {
                continue;
            }
            filtered.add(c);
        }
        /* 最近出现时间倒序；时间为空的事件排到最后（而不是当最早的排到最前） */
        filtered.sort(Comparator.comparing(YqOpinionCluster::getLastTime,
            Comparator.nullsLast(Comparator.reverseOrder())));

        int total = filtered.size();
        int from = Math.min((num - 1) * size, total);
        int to = Math.min(from + size, total);
        List<ClusterCard> cards = new ArrayList<>();
        for (YqOpinionCluster c : filtered.subList(from, to)) {
            cards.add(toCard(c, scope));
        }
        return PageResult.build(cards, total);
    }

    /**
     * 事件卡片组装。
     *
     * <p><b>已知代价：</b>每张卡片会发 3 次查询（可见条数、时间轴成员、热度前 3 条）。
     * 页大小 10 时约 30 次往返。之所以先接受而不是先优化：
     * 事件卡片是低频查看的页面（研判员主要盯着单条结论），
     * 而把 3 次查询合并成 1 次需要写自定义 SQL 与内存分组，
     * 在功能验证期不值得。若上线后实测慢，优先合并「时间轴成员」与「热度前 3 条」
     * —— 后者是前者按热度重排的结果。</p>
     */
    private ClusterCard toCard(YqOpinionCluster c, LedgerScope scope) {
        ClusterCard card = new ClusterCard();
        card.setClusterId(c.getClusterId());
        card.setClusterTitle(c.getClusterTitle());
        card.setClusterTopic(c.getClusterTopic());
        card.setOpinionCount(c.getOpinionCount());
        card.setFirstTime(c.getFirstTime());
        card.setLastTime(c.getLastTime());
        card.setPeakHeat(c.getPeakHeat());
        card.setRiskLevel(c.getRiskLevel());
        card.setVisibleCount(opinionDao.visibleCountInCluster(c.getClusterId(), scope));
        Map<String, Integer> stages = engine.stageCount(c.getClusterId(), scope, timelineLimit());
        card.setStageCount(stages);
        card.setSpreadSummary(SpreadPathWriter.summarize(stages));
        List<YqOpinion> top = opinionDao.opinionsInCluster(c.getClusterId(), scope, false, CLUSTER_TOP_NODES);
        card.setTopOpinions(assembleRows(top));
        return card;
    }

    private int timelineLimit() {
        return props.getTimelineNodeLimit() > 0 ? props.getTimelineNodeLimit() : 200;
    }

    /* ==================================================== 读：空状态建议 */

    /**
     * 空状态建议（沿用 F-016 验收标准 9 的做法）。
     *
     * <p>必须优先说明「看不到数据是因为没有授权范围」，否则用户会一轮轮放宽筛选条件，
     * 最后怀疑系统坏了 —— 而这其实是一条数据权限提示就能解决的问题。</p>
     */
    private List<String> buildHints(LedgerScope scope, long total, AnalysisQuery q) {
        List<String> hints = new ArrayList<>();
        if (total > 0) {
            return hints;
        }
        if (scope.isDenyAll()) {
            hints.add("当前账号不在任何监测任务名下，因此看不到研判数据；"
                + "请先创建任务，或联系管理员分配数据权限。");
            return hints;
        }
        hints.add(scope.isUnrestricted()
            ? "当前没有符合条件的研判数据；可放宽时间范围或清空筛选项后重试。"
            : "您授权范围内的任务没有符合条件的研判数据；可放宽时间范围或切换任务。");
        if (notBlank(q.getAnalyzeStatus()) || Boolean.TRUE.equals(q.getOnlyFailed())) {
            hints.add("若想看总体情况，可把「研判状态」筛选清空。");
        }
        if (q.getTagIds() != null && !q.getTagIds().isEmpty()) {
            hints.add("标签筛选较严格，可减少标签数量后重试。");
        }
        if (q.getClusterId() != null) {
            hints.add("已限定到某个事件，可去掉事件筛选查看全部。");
        }
        if (q.hasKeyword()) {
            hints.add("台账内关键词只匹配标题；若要搜正文，请使用台账的全文检索。");
        }
        return hints;
    }

    /* ==================================================== 模型版本（验收标准 11） */

    @Override
    public List<Map<String, Object>> modelVersions() {
        return metaDao.modelVersions(MODEL_LIST_LIMIT);
    }

    @Override
    public Long activeModelVersionId() {
        return metaDao.activeModelVersionId();
    }

    /**
     * 回滚到指定模型版本。
     *
     * <p><b>本方法是全类唯一带 {@code @Transactional} 的地方：</b>
     * 它只在 MySQL 单库内做两次更新（停用其余、启用目标），
     * 这里的事务是真实有效的。研判主链路跨 Doris 与 MySQL，
     * 那种场景加事务只会给出「会回滚」的错觉。</p>
     *
     * <p>回滚原因会写入目标版本的 {@code remark}：回滚是人为决策，
     * 三个月后必须能回答「为什么退回到 v2」。</p>
     */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public int rollbackModel(Long targetId, String remark) {
        if (targetId == null) {
            throw new ServiceException("目标模型版本不能为空");
        }
        String name = metaDao.modelVersionName(targetId);
        if (name == null || name.isBlank()) {
            throw new ServiceException("目标模型版本不存在");
        }
        Long current = metaDao.activeModelVersionId();
        if (current != null && current.equals(targetId)) {
            throw new ServiceException("目标版本已是当前生效版本，无需回滚");
        }
        String reason = remark == null || remark.isBlank()
            ? "人工回滚至 " + name
            : "人工回滚至 " + name + "：" + remark.trim();
        return metaDao.activateModelVersion(targetId, current, cut(reason, 500));
    }
`,
      `    /* ==================================================== 写：批量研判 */

    /**
     * 批量研判（验收标准 1、6、10）。
     *
     * <p>未指定状态时默认取 {@code pending}：这一条很重要 ——
     * 如果默认取「全部」，一次点击就会把已经研判过的数据全部重跑一遍，
     * 既浪费模型额度，又会让同一批数据产生多份结论版本。</p>
     */
    @Override
    public AnalysisBatchResult analyzeBatch(AnalysisQuery q, Integer limit, String trigger) {
        return doAnalyze(q, limit, trigger == null || trigger.isBlank() ? "manual" : trigger,
            false, currentScope());
    }

    /** 重试失败项（验收标准 6） */
    @Override
    public AnalysisBatchResult retryFailed(AnalysisQuery q, Integer limit) {
        return doAnalyze(q, limit, "manual", true, currentScope());
    }

    /**
     * 系统批量研判（定时任务用）。
     *
     * <p>显式用 {@link LedgerScope#all()} 而不是走 {@link #currentScope()}：
     * 定时任务线程里没有登录上下文，权限推导会保守地返回「可见 0 条」，
     * 结果是任务每次都「成功执行、零处理」，而日志里看不出任何异常。</p>
     */
    @Override
    public AnalysisBatchResult analyzeBatchAsSystem(Integer limit) {
        return doAnalyze(null, limit, "job", false, LedgerScope.all());
    }

    /**
     * 单条研判 / 重新研判（验收标准 6、7）。
     *
     * <p>{@code force=true} 时先无条件置回 {@code processing} 再跑：
     * 人工点「重新研判」的语义就是「我知道它可能是完成态，但我要求重算」。
     * 这一步必须写在 {@code processOne} 之前 —— 它内部的认领 CAS
     * 对 {@code processing} 的行会返回 0（跳过），不先置状态就永远跑不起来。</p>
     */
    @Override
    public AnalysisBatchResult analyzeOne(Long opinionId, boolean force) {
        if (opinionId == null) {
            throw new ServiceException("舆情ID不能为空");
        }
        LedgerScope scope = currentScope();
        if (!opinionDao.isVisible(opinionId, scope)) {
            throw new ServiceException("无权操作该舆情或该舆情不存在");
        }
        List<YqOpinion> rows = opinionDao.byIds(List.of(opinionId));
        if (rows == null || rows.isEmpty() || rows.get(0) == null) {
            throw new ServiceException("舆情不存在或已被清理");
        }
        AnalysisEngine.BatchCtx ctx = newCtx("single", scope);
        ctx.result.setTotal(1);
        if (force) {
            opinionDao.markStatus(opinionId, AnalysisOpinionDao.ST_PROCESSING);
        }
        engine.processOne(rows.get(0), ctx);
        ctx.result.setRemaining(opinionDao.pendingCount(scope));
        return finish(ctx);
    }

    /**
     * 释放卡住的 {@code processing}（见 AnalysisOpinionDao 的「已知边界」）。
     *
     * <p>上限 {@link #PAGE_SIZE_MAX} 条一次：这是一次人工干预动作，
     * 一次释放上万条通常意味着误操作，应当先与用户确认范围。</p>
     */
    @Override
    public int releaseProcessing(List<Long> opinionIds) {
        if (opinionIds == null || opinionIds.isEmpty()) {
            throw new ServiceException("请先选择要释放的舆情");
        }
        if (opinionIds.size() > PAGE_SIZE_MAX) {
            throw new ServiceException("一次最多释放 " + PAGE_SIZE_MAX + " 条，请缩小范围");
        }
        return opinionDao.releaseProcessing(opinionIds, currentScope());
    }

    /* ==================================================== 内部：批次循环 */

    /**
     * 批次执行。
     *
     * <p>循环体只有一行 {@code engine.processOne} —— 这不是「薄封装」的偷懒，
     * 而是刻意的：批次层只回答「处理哪些」，任何一条的成败都不该让它改变节奏
     * （{@code processOne} 内部已保证不抛异常）。这样「跑一半崩了」在结构上就不可能发生。</p>
     */
    private AnalysisBatchResult doAnalyze(AnalysisQuery q, Integer limit, String trigger,
                                          boolean retryMode, LedgerScope scope) {
        AnalysisEngine.BatchCtx ctx = newCtx(trigger, scope);

        int cap = limit == null || limit <= 0 ? props.getBatchSize() : limit;
        if (cap <= 0) {
            cap = 20;
        }
        AnalysisQuery query = q == null ? new AnalysisQuery() : q;
        if (retryMode) {
            query.setAnalyzeStatus(AnalysisOpinionDao.ST_FAILED);
            query.setOnlyFailed(Boolean.TRUE);
        } else if (!notBlank(query.getAnalyzeStatus()) && !Boolean.TRUE.equals(query.getOnlyFailed())) {
            query.setAnalyzeStatus(AnalysisOpinionDao.ST_PENDING);
        }
        if (!notBlank(query.getOrderBy())) {
            /* 先采到的先研判：保证事件聚合的时间轴与真实传播顺序一致 */
            query.setOrderBy("collectTime");
            query.setOrderDesc(Boolean.FALSE);
        }

        long total = opinionDao.count(query, scope);
        ctx.result.setTotal((int) Math.min(total, Integer.MAX_VALUE));

        List<YqOpinion> candidates = opinionDao.list(query, scope, cap);
        int fetched = candidates == null ? 0 : candidates.size();
        if (retryMode) {
            candidates = engine.filterRetryable(candidates);
        }
        if (candidates != null) {
            for (YqOpinion o : candidates) {
                engine.processOne(o, ctx);
            }
        }
        ctx.result.setTruncated(total > fetched);
        ctx.result.setRemaining(opinionDao.pendingCount(scope));
        return finish(ctx);
    }

    /** 初始化批次上下文（批次号 / 触发方式 / 范围说明 / 开始时间） */
    private AnalysisEngine.BatchCtx newCtx(String trigger, LedgerScope scope) {
        AnalysisEngine.BatchCtx ctx = new AnalysisEngine.BatchCtx(MAX_FAILURES);
        ctx.result.setBatchNo(batchNo());
        ctx.result.setTrigger(trigger);
        ctx.result.setScopeDesc(scope == null ? "" : scope.describe());
        ctx.result.setStartedAt(LocalDateTime.now());
        return ctx;
    }

    /** 收尾：补结束时间与耗时，挂上失败明细 */
    private AnalysisBatchResult finish(AnalysisEngine.BatchCtx ctx) {
        LocalDateTime end = LocalDateTime.now();
        ctx.result.setFinishedAt(end);
        if (ctx.result.getStartedAt() != null) {
            ctx.result.setDurationMs(Duration.between(ctx.result.getStartedAt(), end).toMillis());
        }
        ctx.result.setFailures(ctx.failures);
        return ctx.result;
    }

    /* ==================================================== 内部：上下文 */

    /**
     * 当前登录用户的可见范围。
     *
     * <p>推导失败时返回 {@link LedgerScope#none()}（可见 0 条）而不是 {@code all()} ——
     * 权限推导异常时的保守方向只能是「什么都看不到」，
     * 反过来就是一次全量数据泄露。异步线程（定时任务）本来就没有登录上下文，
     * 那里应当显式使用系统任务对应的范围或 {@code all()}，而不是靠这里兜底。</p>
     */
    private LedgerScope currentScope() {
        try {
            LedgerScope s = ledgerService.currentScope();
            return s == null ? LedgerScope.none() : s;
        } catch (RuntimeException e) {
            log.warn("[F-007] 无法推导数据范围，按最小权限（可见 0 条）处理", e);
            return LedgerScope.none();
        }
    }

    /** 当前用户ID；无登录上下文（定时任务）时返回 null，不抛异常 */
    private Long currentUserId() {
        try {
            return LoginHelper.getUserId();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** 批次号：时间戳 + 尾号，便于人工对账时快速定位是哪一次点击 */
    private static String batchNo() {
        return "YQA" + LocalDateTime.now().format(BATCH_FMT) + "-" + (IdWorker.getId() % 1000);
    }
`,
      `    /* ==================================================== 写：人工修正 */

    /**
     * 人工修正结论（验收标准 8、9）。
     *
     * <p>三件事按顺序做，且都不能省：</p>
     * <ol>
     *   <li>改结论行并留痕（{@code corrected_flag / corrected_by / corrected_time}）——
     *       没有留痕的修正在审计时等于没发生；</li>
     *   <li><b>回写舆情主表</b> —— 预警、统计、日报读的都是主表的分级字段，
     *       不回写就等于「研判员改了但我看到的还是旧的」；</li>
     *   <li>登记待标注训练样本（验收标准 9）—— 人工修正最有价值的用途就是喂模型。</li>
     * </ol>
     *
     * <p><b>取值校验用抛错而不是静默归一：</b>模型输出归一化（{@code AnalysisResultParser}）
     * 是为了「宁可要一个粗糙结论也不要失败」；而人工输入是人在操作界面，
     * 传了非法值说明前后端契约有问题，此时静默改掉会让问题被掩盖。</p>
     */
    @Override
    public AnalysisDetailView correct(AnalysisCorrectBo bo) {
        if (bo == null || bo.getOpinionId() == null) {
            throw new ServiceException("舆情ID不能为空");
        }
        LedgerScope scope = currentScope();
        if (!opinionDao.isVisible(bo.getOpinionId(), scope)) {
            throw new ServiceException("无权操作该舆情或该舆情不存在");
        }
        YqOpinionAnalysis latest = opinionDao.latestAnalysis(bo.getOpinionId());
        /* 主题为空 = 这条结论是失败记录（失败记录只写 fail_reason）。
         * 失败记录没有结论可改，必须明确拦住，否则会把失败记录改成一个「半成品结论」。 */
        if (latest == null || latest.getTopic() == null) {
            throw new ServiceException("该舆情尚无有效研判结论（可能仍在待研判或已失败），无法修正");
        }
        Long uid = currentUserId();
        if (notBlank(bo.getSentiAttr())) {
            latest.setSentiAttr(requireIn("情感倾向", bo.getSentiAttr(), PromptSpec.SENTI_ATTRS));
        }
        if (notBlank(bo.getRiskLevel())) {
            latest.setRiskLevel(requireIn("风险等级", bo.getRiskLevel(), PromptSpec.RISK_LEVELS));
        }
        if (notBlank(bo.getOpinionLevel())) {
            latest.setOpinionLevel(requireIn("舆情分级", bo.getOpinionLevel(), PromptSpec.OPINION_LEVELS));
        }
        /* 不变式：非负面舆情没有风险等级。模型侧已强制，人工侧也必须强制 ——
         * 否则「正面舆情 + 高风险」会顺着预警规则触发误报。 */
        if (!"negative".equals(latest.getSentiAttr())) {
            latest.setRiskLevel("general");
        }
        if (notBlank(bo.getRemark())) {
            latest.setSuggestion(appendNote(latest.getSuggestion(), "人工修正：" + bo.getRemark().trim()));
        }
        latest.setCorrectedFlag("1");
        latest.setCorrectedBy(uid);
        latest.setCorrectedTime(LocalDateTime.now());
        opinionDao.updateAnalysis(latest);

        YqOpinion wb = new YqOpinion();
        wb.setOpinionId(bo.getOpinionId());
        wb.setSentiAttr(latest.getSentiAttr());
        wb.setRiskLevel(latest.getRiskLevel());
        wb.setOpinionLevel(latest.getOpinionLevel());
        opinionDao.writeBackConclusion(wb);

        if (bo.getTags() != null) {
            applyManualTags(bo.getOpinionId(), bo.getTags(), uid);
        }
        if (props.isSampleOnCorrect() && !Boolean.FALSE.equals(bo.getCreateSample())) {
            registerSample(bo.getOpinionId(), latest, uid);
        }
        return detail(bo.getOpinionId());
    }

    /**
     * 人工标签覆盖。
     *
     * <p>语义澄清（接口契约）：{@code tags = null} 表示「本次不改标签」；
     * 空数组表示「清空全部人工标签」。这两者差别很大，
     * 前端必须用 {@code null} 而不是 {@code []} 来表达「不修改」。</p>
     */
    private void applyManualTags(Long opinionId, List<String> tags, Long uid) {
        opinionDao.deleteTagsBySource(List.of(opinionId), AnalysisMetaDao.TAG_SOURCE_MANUAL);
        for (String name : cleanTagNames(tags)) {
            Long tagId = metaDao.ensureTag(name, uid);
            if (tagId == null) {
                continue;
            }
            YqOpinionTag t = new YqOpinionTag();
            t.setOpinionId(opinionId);
            t.setTagId(tagId);
            t.setTagSource(AnalysisMetaDao.TAG_SOURCE_MANUAL);
            opinionDao.insertTag(t);
        }
    }

    /* ==================================================== 训练样本（验收标准 9） */

    /**
     * 登记待标注训练样本。
     *
     * <p><b>幂等设计（两步判定）：</b></p>
     * <ol>
     *   <li>该舆情是否已建过案例（{@code yq_knowledge.opinion_id}）—— 有则复用，
     *       不重复建案例，否则同一舆情改三次就产生三个案例；</li>
     *   <li>该案例下是否已有待标注样本 —— 有则跳过，不重复登记。</li>
     * </ol>
     * <p>两步都用「查存在」而不是唯一索引：这两张表是 gen-yuqing.mjs 归属的，
     * 本模块不应为了自己的幂等需求去改别人的表结构。</p>
     *
     * <p><b>失败只告警不抛错：</b>采样是「修正」的衍生动作。
     * 如果因为样本登记失败就把整个修正请求报成 500，用户会以为结论没改成功
     * ——而实际上结论已经改好了。这里选择「修正成功 + 日志留痕」，
     * 把采样缺失作为运维项处理。</p>
     */
    private void registerSample(Long opinionId, YqOpinionAnalysis a, Long uid) {
        try {
            Long knowledgeId = metaDao.knowledgeIdByOpinion(opinionId);
            YqOpinion o = firstOf(opinionDao.byIds(List.of(opinionId)));
            if (knowledgeId == null) {
                knowledgeId = IdWorker.getId();
                metaDao.insertKnowledge(knowledgeId, opinionId, AnalysisMetaDao.CASE_TYPE_CORRECTION,
                    o == null ? null : o.getTitle(),
                    AnalysisJson.toJsonString(originSnapshot(o, a)),
                    o == null ? null : o.getOpinionUrl(),
                    analyzeSnapshot(a),
                    joinNonBlank(",", a.getSentiAttr(), a.getRiskLevel(), a.getOpinionLevel()),
                    "sentiAttr=" + nvl(a.getSentiAttr())
                        + ";riskLevel=" + nvl(a.getRiskLevel())
                        + ";opinionLevel=" + nvl(a.getOpinionLevel()),
                    uid);
            }
            if (metaDao.pendingSampleId(knowledgeId) != null) {
                return;
            }
            String label = AnalysisJson.toJsonString(labelSnapshot(a, uid));
            metaDao.insertTrainSample(IdWorker.getId(), knowledgeId, metaDao.activeModelVersionId(),
                cut(label, 1000), uid);
        } catch (RuntimeException e) {
            log.warn("[F-007] 登记训练样本失败（人工修正已生效）, opinionId={}", opinionId, e);
        }
    }

    /** 原始数据快照。时间一律转成字符串 —— 兜底 JSON 映射器不带 JavaTime 模块，直接放对象会序列化失败。 */
    private Map<String, Object> originSnapshot(YqOpinion o, YqOpinionAnalysis a) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (o != null) {
            m.put("title", o.getTitle());
            m.put("content", o.getContent());
            m.put("author", o.getAuthor());
            m.put("opinionUrl", o.getOpinionUrl());
            m.put("publishTime", o.getPublishTime() == null ? null : o.getPublishTime().toString());
            m.put("collectTime", o.getCollectTime() == null ? null : o.getCollectTime().toString());
            m.put("heatScore", o.getHeatScore());
        }
        if (a != null) {
            m.put("modelVersion", a.getModelVersion());
            m.put("promptVersion", a.getPromptVersion());
            m.put("analyzeVersion", a.getAnalyzeVersion());
        }
        return m;
    }

    /** 修正后的标签快照（样本的 label_content） */
    private Map<String, Object> labelSnapshot(YqOpinionAnalysis a, Long uid) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("topic", a.getTopic());
        m.put("sentiAttr", a.getSentiAttr());
        m.put("riskLevel", a.getRiskLevel());
        m.put("opinionLevel", a.getOpinionLevel());
        m.put("tags", a.getTags());
        m.put("correctedBy", uid == null ? null : String.valueOf(uid));
        m.put("correctedTime", a.getCorrectedTime() == null ? null : a.getCorrectedTime().toString());
        return m;
    }

    /** 研判结果快照（纯文本，便于案例列表直接展示） */
    private String analyzeSnapshot(YqOpinionAnalysis a) {
        StringBuilder sb = new StringBuilder();
        sb.append("主题：").append(nvl(a.getTopic()));
        sb.append(" | 摘要：").append(nvl(a.getSummary()));
        sb.append(" | 情感：").append(nvl(a.getSentiAttr()));
        sb.append(" | 风险：").append(nvl(a.getRiskLevel()));
        sb.append(" | 分级：").append(nvl(a.getOpinionLevel()));
        sb.append(" | 标签：").append(nvl(a.getTags()));
        sb.append(" | 置信度：").append(a.getConfidence() == null ? "" : a.getConfidence().toPlainString());
        return cut(sb.toString(), 1000);
    }

    /* ==================================================== 内部工具 */

    /** 白名单校验：不在白名单内直接报错，不静默归一（人工输入与模型输出处理方式不同） */
    private static String requireIn(String label, String value, Set<String> allowed) {
        String v = value.trim();
        if (!allowed.contains(v)) {
            throw new ServiceException(label + "取值非法：" + v);
        }
        return v;
    }

    /** 在处置建议后追加一行备注（不覆盖模型原有建议，保留判断依据） */
    private static String appendNote(String original, String note) {
        String base = original == null ? "" : original.trim();
        String text = base.isEmpty() ? note : base + " | " + note;
        return cut(text, 1000);
    }

    private static String joinNonBlank(String sep, String... parts) {
        StringBuilder sb = new StringBuilder();
        if (parts != null) {
            for (String p : parts) {
                if (p == null || p.isBlank()) {
                    continue;
                }
                if (sb.length() > 0) {
                    sb.append(sep);
                }
                sb.append(p.trim());
            }
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private static YqOpinion firstOf(List<YqOpinion> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        return list.get(0);
    }

    private static String cut(String v, int max) {
        if (v == null) {
            return null;
        }
        return v.length() <= max ? v : v.substring(0, max);
    }

    /**
     * 人工标签入参清洗（与引擎侧 {@code AnalysisEngine.cleanTags} 同一套口径）。
     *
     * <p>为什么这边要再写一份：引擎那份是实例私有方法，服务层拿不到；
     * 而「修正」这条路径根本不经过引擎 —— 它直接落人工标签。
     * 两处都只做同一件小事（去空、去重、截断、限数），
     * 口径写在 {@code YqAnalysisProperties} 里，改配置两边同时生效。</p>
     *
     * <p>返回 {@code List} 而非 {@code null}：调用方直接 for 循环，不再判空。</p>
     */
    private List<String> cleanTagNames(List<String> raw) {
        List<String> out = new ArrayList<>();
        if (raw == null || raw.isEmpty()) {
            return out;
        }
        int max = Math.max(1, props.getMaxTagsPerOpinion());
        int maxLen = Math.max(2, props.getMaxTagNameLength());
        Set<String> seen = new LinkedHashSet<>();
        for (String t : raw) {
            if (t == null) {
                continue;
            }
            String v = t.trim();
            if (v.isEmpty()) {
                continue;
            }
            if (v.length() > maxLen) {
                v = v.substring(0, maxLen);
            }
            if (!seen.add(v)) {
                continue;
            }
            out.add(v);
            if (out.size() >= max) {
                break;
            }
        }
        return out;
    }

    /**
     * 去掉控制字符。
     *
     * <p>前端一律按纯文本渲染（不用 {@code v-html}），这里再从数据源头清一遍：
     * 摘要是要拼进列表与导出的，任何控制字符都会破坏排版。
     * 换行与回车替换为空格而不是删除 —— 删掉会让「第一行结尾」与「第二行开头」
     * 粘成一个不存在的词。</p>
     */
    private static String stripControl(String v) {
        if (v == null) {
            return null;
        }
        StringBuilder sb = new StringBuilder(v.length());
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (c == CR || c == LF) {
                sb.append(' ');
            } else if (c >= 32) {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** 大小写不敏感包含判断（事件标题/主题的关键词过滤） */
    private static boolean contains(String haystack, String needle) {
        if (needle == null || needle.isEmpty()) {
            return true;
        }
        if (haystack == null) {
            return false;
        }
        return haystack.toLowerCase().contains(needle.toLowerCase());
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    private static String nvl(String v) {
        return v == null ? "" : v;
    }
}
`,
    ].join(''),
  },
];
