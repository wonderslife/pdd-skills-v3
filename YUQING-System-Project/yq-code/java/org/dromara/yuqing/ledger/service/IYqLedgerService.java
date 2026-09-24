package org.dromara.yuqing.ledger.service;

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
