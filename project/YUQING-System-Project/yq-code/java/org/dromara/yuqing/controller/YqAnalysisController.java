package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.domain.AnalysisCorrectBo;
import org.dromara.yuqing.analysis.domain.AnalysisDetailView;
import org.dromara.yuqing.analysis.domain.AnalysisPage;
import org.dromara.yuqing.analysis.domain.AnalysisQuery;
import org.dromara.yuqing.analysis.domain.ClusterCard;
import org.dromara.yuqing.analysis.service.IYqAnalysisService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 智能研判控制器（F-007，菜单「研判中心」）
 *
 * <p><b>端点总览（PRD §6.3）：</b></p>
 * <ul>
 *   <li>{@code GET  /yuqing/analysis/list}                研判台账分页（标准 5、7、8）</li>
 *   <li>{@code GET  /yuqing/analysis/{opinionId}}         单条结论详情（标准 7、8、11）</li>
 *   <li>{@code GET  /yuqing/analysis/cluster/list}        事件聚合列表（标准 4、10）</li>
 *   <li>{@code POST /yuqing/analysis/batch}               批量研判（标准 1、6、10）</li>
 *   <li>{@code POST /yuqing/analysis/one/{opinionId}}     单条重研判（标准 6、7）</li>
 *   <li>{@code POST /yuqing/analysis/retry}               重试失败项（标准 6）</li>
 *   <li>{@code POST /yuqing/analysis/release}             释放卡住的 processing</li>
 *   <li>{@code POST /yuqing/analysis/correct}             人工修正（标准 8、9）</li>
 *   <li>{@code GET  /yuqing/analysis/model/list}          模型版本列表（标准 11）</li>
 *   <li>{@code POST /yuqing/analysis/model/rollback}      模型版本回滚（标准 11）</li>
 * </ul>
 *
 * <p><b>路径顺序（重要）：</b>固定路径必须在 {@code /{opinionId}} 之前声明。
 * 这里 {@code /{opinionId}} 用 {@code Long} 绑定，误命中字面量路径时
 * 会抛类型转换 400 而不是 404，排查时很迷惑。对照 F-016 控制器同一约定。</p>
 *
 * <p><b>权限码（零新增）：</b>读走 {@code yuqing:opinion:list} /
 * {@code yuqing:opinion:query}，研判动作走 {@code yuqing:opinion:analyze}，
 * 修正走 {@code yuqing:opinion:correct}，模型版本走
 * {@code yuqing:model:iterate} / {@code yuqing:model:rollback}。
 * 这些都是主生成器在「舆情台账」「知识库」菜单下已经建好的按钮权限，
 * 因此 F-007 不新增任何权限码，只在 gen-yuqing.mjs 的「研判中心」菜单下
 * 复用其中 4 枚（同一码出现在两个菜单下是合法的，sys_menu 对 perms 无唯一约束；
 * Sa-Token 只关心这枚码是否在用户的授权集合里）。
 * 这样「研判员」这个角色可以只勾选「研判中心」一件事就具备完整可用权限。</p>
 *
 * <p><b>安全：</b>所有写端点在 Service 内部做数据权限前置校验
 * （{@code AnalysisOpinionDao.isVisible}），
 * 请求体无法指定或扩大可见范围。</p>
 *
 * @author ruoyi
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/analysis")
public class YqAnalysisController extends BaseController {

    private final IYqAnalysisService analysisService;

    /* ==================================================== 读 */

    /**
     * 研判台账分页（验收标准 5、7、8）
     *
     * <p>GET 参数与前端的筛选表单一一对应地铺开，而不接收一个复合对象 ——
     * 这样前端表单字段名与接口参数名一眼对得上，也避免把 Web 层关注点
     * 带进 {@code AnalysisQuery} 这个业务对象。时间参数用 String 接收，
     * 由 F-016 的 {@code LedgerTimeParser} 容错解析（非法值忽略而不是 400）。</p>
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/list")
    public R<AnalysisPage> list(
        @RequestParam(required = false) String collectBeginTime,
        @RequestParam(required = false) String collectEndTime,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) Long clusterId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) List<Long> tagIds,
        @RequestParam(required = false) String analyzeStatus,
        @RequestParam(required = false) String correctedFlag,
        @RequestParam(required = false) String alertFlag,
        @RequestParam(required = false) Boolean onlyFailed,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String keywordScope,
        @RequestParam(required = false) String orderBy,
        @RequestParam(required = false) Boolean orderDesc,
        PageQuery pageQuery) {
        return R.ok(analysisService.queryPage(buildQuery(collectBeginTime, collectEndTime, taskId, channelId,
            clusterId, sentiAttr, riskLevel, opinionLevel, spreadLevel, tagIds, analyzeStatus, correctedFlag,
            alertFlag, onlyFailed, keyword, keywordScope, orderBy, orderDesc), pageQuery));
    }

    /**
     * 单条结论详情（验收标准 7、8、11）
     *
     * <p>返回体里已含舆情原文、来源、热度、风险等级、研判分析、处置建议、
     * 变体命中依据、模型与提示词版本、修正留痕，前端一次请求即可渲染整页。</p>
     */
    @SaCheckPermission("yuqing:opinion:query")
    @GetMapping("/{opinionId}")
    public R<AnalysisDetailView> detail(@PathVariable Long opinionId) {
        return R.ok(analysisService.detail(opinionId));
    }

    /**
     * 事件聚合列表（验收标准 4、10）
     *
     * <p>只支持按关键词过滤事件标题 / 主题 —— 事件维度的筛选维度做多了
     * 反而没人用（研判员关心的永远是「最近发生了什么事」）。</p>
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/cluster/list")
    public R<PageResult<ClusterCard>> clusterList(
        @RequestParam(required = false) String keyword,
        PageQuery pageQuery) {
        AnalysisQuery q = new AnalysisQuery();
        q.setKeyword(keyword);
        return R.ok(analysisService.clusterPage(q, pageQuery));
    }

    /* ==================================================== 写：研判 */

    /**
     * 批量研判（验收标准 1、6、10）
     *
     * <p>请求体可空：空表示「按当前筛选条件的待研判队列跑一批」。
     * 但<b>筛选条件里不能有 status=completed</b> —— 由 Service 兜底为 pending，
     * 防止一次点击把历史数据全部重跑。</p>
     *
     * @param limit 本批条数上限，空则用配置 {@code yuqing.analysis.batch-size}
     */
    @SaCheckPermission("yuqing:opinion:analyze")
    @PostMapping("/batch")
    public R<AnalysisBatchResult> batch(
        @RequestBody(required = false) AnalysisQuery q,
        @RequestParam(required = false) Integer limit) {
        return R.ok(analysisService.analyzeBatch(q, limit, "manual"));
    }

    /**
     * 单条重研判（验收标准 6、7）
     *
     * @param force 默认 true：人工点「重新研判」的语义就是要求重算，
     *              不应该因为「它已经是 completed」而被拒绝
     */
    @SaCheckPermission("yuqing:opinion:analyze")
    @PostMapping("/one/{opinionId}")
    public R<AnalysisBatchResult> one(
        @PathVariable Long opinionId,
        @RequestParam(required = false, defaultValue = "true") Boolean force) {
        return R.ok(analysisService.analyzeOne(opinionId, !Boolean.FALSE.equals(force)));
    }

    /** 重试失败项（验收标准 6）：只跑未超过重试上限的失败记录 */
    @SaCheckPermission("yuqing:opinion:analyze")
    @PostMapping("/retry")
    public R<AnalysisBatchResult> retry(
        @RequestBody(required = false) AnalysisQuery q,
        @RequestParam(required = false) Integer limit) {
        return R.ok(analysisService.retryFailed(q, limit));
    }

    /**
     * 释放卡住的 processing。
     *
     * <p>存在的原因见 {@code AnalysisOpinionDao} 的「已知边界」：
     * 主表没有认领时间列，做不了按时间的自动回收，
     * 只能由研判员筛出卡住的行后手动释放。</p>
     */
    @SaCheckPermission("yuqing:opinion:analyze")
    @PostMapping("/release")
    public R<Integer> release(@RequestBody List<Long> opinionIds) {
        return R.ok(analysisService.releaseProcessing(opinionIds));
    }

    /* ==================================================== 写：修正 */

    /**
     * 人工修正结论（验收标准 8、9）
     *
     * <p>修正后自动把分级回写主表并登记待标注训练样本，
     * 前端只需刷新详情即可看到结果。</p>
     */
    @SaCheckPermission("yuqing:opinion:correct")
    @PostMapping("/correct")
    public R<AnalysisDetailView> correct(@Valid @RequestBody AnalysisCorrectBo bo) {
        return R.ok(analysisService.correct(bo));
    }

    /* ==================================================== 模型版本 */

    /** 模型版本列表（验收标准 11） */
    @SaCheckPermission("yuqing:model:iterate")
    @GetMapping("/model/list")
    public R<List<Map<String, Object>>> modelList() {
        return R.ok(analysisService.modelVersions());
    }

    /** 模型版本回滚（验收标准 11）：单库事务，回滚原因写入目标版本备注 */
    @SaCheckPermission("yuqing:model:rollback")
    @PostMapping("/model/rollback")
    public R<Integer> rollback(
        @RequestParam Long targetId,
        @RequestParam(required = false) String remark) {
        return R.ok(analysisService.rollbackModel(targetId, remark));
    }

    /* ==================================================== 内部 */

    /** 组装查询条件（把铺开的 GET 参数收进业务对象） */
    private AnalysisQuery buildQuery(String collectBeginTime, String collectEndTime, Long taskId,
                                     Long channelId, Long clusterId, String sentiAttr, String riskLevel,
                                     String opinionLevel, String spreadLevel, List<Long> tagIds,
                                     String analyzeStatus, String correctedFlag, String alertFlag,
                                     Boolean onlyFailed, String keyword, String keywordScope,
                                     String orderBy, Boolean orderDesc) {
        AnalysisQuery q = new AnalysisQuery();
        q.setCollectBeginTime(collectBeginTime);
        q.setCollectEndTime(collectEndTime);
        q.setTaskId(taskId);
        q.setChannelId(channelId);
        q.setClusterId(clusterId);
        q.setSentiAttr(sentiAttr);
        q.setRiskLevel(riskLevel);
        q.setOpinionLevel(opinionLevel);
        q.setSpreadLevel(spreadLevel);
        q.setTagIds(tagIds);
        q.setAnalyzeStatus(analyzeStatus);
        q.setCorrectedFlag(correctedFlag);
        q.setAlertFlag(alertFlag);
        q.setOnlyFailed(onlyFailed);
        q.setKeyword(keyword);
        q.setKeywordScope(keywordScope);
        q.setOrderBy(orderBy);
        q.setOrderDesc(orderDesc);
        return q;
    }
}
