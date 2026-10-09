package org.dromara.yuqing.ledger.dao;

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
