package org.dromara.yuqing.analysis.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.domain.AnalysisCorrectBo;
import org.dromara.yuqing.analysis.domain.AnalysisDetailView;
import org.dromara.yuqing.analysis.domain.AnalysisPage;
import org.dromara.yuqing.analysis.domain.AnalysisQuery;
import org.dromara.yuqing.analysis.domain.ClusterCard;

import java.util.List;
import java.util.Map;

/**
 * 智能研判服务（F-007）
 *
 * <p><b>数据权限（沿用 F-016 决策 ③A）：</b>读方法一律不接收「可见范围」参数，
 * 由实现内部从 Sa-Token 上下文推导 —— Controller 无法「忘记传范围」，
 * 调用方也无法伪造范围。写方法（批量研判 / 修正 / 释放）同样在实现内部
 * 套用同一范围，因此「能改的」严格是「能看的」的子集。</p>
 *
 * <p><b>为什么对外只有三个动作入口（批量研判 / 单条重研判 / 人工修正）：</b>
 * 研判是环环相扣的流程（拿队列 -> 提示词 -> 模型 -> 解析 -> 融合 -> 落库 ->
 * 回写 -> 打标 -> 聚合），拆成十几个细粒度接口会让调用方必须自己按正确顺序
 * 编排，而顺序一旦错了（例如先回写分级后落库）会产生难以排查的数据不一致。
 * 因此把顺序收进实现，对外只暴露业务语义上的动作。</p>
 *
 * @author ruoyi
 */
public interface IYqAnalysisService {

    /* ==================================================== 读 */

    /**
     * 研判台账分页（验收标准 5、7、8）。
     *
     * @param q         筛选条件（状态、属性、标签、关键词、排序等）
     * @param pageQuery 分页参数（页大小会被配置上限钳制）
     */
    AnalysisPage queryPage(AnalysisQuery q, PageQuery pageQuery);

    /**
     * 单条研判结论详情（验收标准 7、8、11 的展示载体）。
     *
     * <p>返回舆情原文、来源、热度、风险等级、研判分析、处置建议、
     * 变体命中依据、模型与提示词版本、修正留痕。</p>
     *
     * @throws org.dromara.common.core.exception.ServiceException 无权查看或不存在
     */
    AnalysisDetailView detail(Long opinionId);

    /**
     * 事件聚合维度列表（验收标准 4、10）。
     *
     * <p>事件是跨任务共享实体，可见性按「事件下是否存在我可见的舆情」判定，
     * 卡片上同时给出全量条数与可见条数。</p>
     */
    PageResult<ClusterCard> clusterPage(AnalysisQuery q, PageQuery pageQuery);

    /* ==================================================== 写：研判 */

    /**
     * 批量研判（验收标准 1、6、10）。
     *
     * @param q       筛选条件；未指定状态时默认取 {@code pending}
     * @param limit   本批最多处理条数，null 时用配置 {@code batchSize}
     * @param trigger 触发方式：manual / job
     * @return 批次结果（成功 / 失败 / 跳过计数、事件聚合数、失败明细）
     */
    AnalysisBatchResult analyzeBatch(AnalysisQuery q, Integer limit, String trigger);

    /**
     * 单条研判 / 重新研判（验收标准 6、7）。
     *
     * @param opinionId 舆情ID
     * @param force     true = 无视当前状态强制重跑（人工点「重新研判」）；
     *                  false = 仅在非 processing 时执行
     */
    AnalysisBatchResult analyzeOne(Long opinionId, boolean force);

    /**
     * 系统批量研判（定时任务用，验收标准 1、10）。
     *
     * <p>定时任务运行在<b>没有登录上下文</b>的线程里，无法推导「本人可见范围」——
     * 若直接复用 {@link #analyzeBatch} 的权限推导，得到的是
     * {@code LedgerScope.none()}（可见 0 条），任务会「成功但什么都没做」，
     * 这是最难发现的一类故障。</p>
     *
     * <p>因此系统批次单独一个入口，语义明确为「把全量的待研判队列跑完」，
     * 显式使用全量范围。权限上的差异是刻意的：这是系统自身的作业，
     * 不是某个用户发起的操作，因此不受用户数据范围约束。</p>
     */
    AnalysisBatchResult analyzeBatchAsSystem(Integer limit);

    /**
     * 重试失败项（验收标准 6 的「按退避策略重试」的手动入口）。
     *
     * <p>只挑「已失败且未超过重试上限」的舆情，避免研判员连点导致
     * 同一条被无意义地重跑几十次。</p>
     */
    AnalysisBatchResult retryFailed(AnalysisQuery q, Integer limit);

    /**
     * 释放卡住的 {@code processing}（见 DAO 的「已知边界」说明）。
     *
     * @return 实际释放条数
     */
    int releaseProcessing(List<Long> opinionIds);

    /* ==================================================== 写：修正 */

    /**
     * 人工修正结论（验收标准 8、9）。
     *
     * <p>修正后：结论行打上修正标记与修正人；被改动的分级字段
     * <b>回写舆情主表</b>（否则预警 / 统计 / 日报仍按旧结论跑）；
     * 且自动登记一条待标注训练样本（验收标准 9）。</p>
     */
    AnalysisDetailView correct(AnalysisCorrectBo bo);

    /* ==================================================== 模型版本 */

    /** 模型版本列表（验收标准 11） */
    List<Map<String, Object>> modelVersions();

    /** 当前生效的模型版本ID（可空） */
    Long activeModelVersionId();

    /**
     * 回滚到指定模型版本（验收标准 11 的「效果可比对」）。
     *
     * @param targetId 目标版本ID
     * @param remark   回滚原因（写入版本备注，便于事后解释）
     */
    int rollbackModel(Long targetId, String remark);
}
