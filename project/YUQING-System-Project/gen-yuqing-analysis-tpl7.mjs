/**
 * F-007 智能研判 · 模板 7：控制器 + 定时任务 + 配置样例
 *
 * 产物：
 *   controller/YqAnalysisController.java   PC 控制器（研判中心）
 *   job/YqAnalysisJobExecutor.java         SnailJob 定时批量研判
 *   config/yq_analysis.yml                 配置样例
 *
 * 权限码零新增：完全复用主生成器已建的 7 枚舆情权限码与 3 枚知识库权限码
 *   （yuqing:opinion:list / query / analyze / correct、
 *     yuqing:model:iterate / rollback 等）。
 *   前端必须使用同一枚权限码控制按钮显隐，否则会出现「按钮看得见、点了 403」。
 *
 * 转义约定：模板串内不得出现裸反引号；不得出现未转义 ${；Java 产物不出现
 *   \\n / \\t / \\r 转义序列。
 */
export const ANALYSIS_TPL7 = [

  /* ==================================================== PC 控制器 */
  {
    rel: 'controller/YqAnalysisController.java',
    content: [
      `package org.dromara.yuqing.controller;

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
`,
    ].join(''),
  },

  /* ==================================================== 定时任务 */
  {
    rel: 'job/YqAnalysisJobExecutor.java',
    content: [
      `package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.analysis.config.YqAnalysisProperties;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.service.IYqAnalysisService;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 智能研判定时批量任务（SnailJob，F-007 验收标准 1、10）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingAnalysisBatch}。建议 Cron 每 5~10 分钟一次
 * （采集链路写入的新舆情状态是 {@code pending}，研判要尽快跟上，
 * 否则预警与日报拿不到分级）。作业ID 填到 {@code yuqing.analysis.analyze-job-id}。</p>
 *
 * <p><b>为什么用系统入口而不是人工入口：</b>定时任务线程没有登录上下文，
 * {@code currentScope()} 会保守地返回「可见 0 条」。若复用人工批量入口，
 * 任务会「每次成功执行、零处理」，日志里看不出异常 —— 这是最难发现的故障。
 * 因此调用 {@code analyzeBatchAsSystem}，显式使用全量范围。</p>
 *
 * <p><b>部分失败不算作业失败：</b>引擎已保证单条失败不阻塞其它条（验收标准 6）。
 * 若这里因「有几条失败」就返回 failure，调度中心会整批重跑，
 * 把已经成功的记录再研判一遍，白白消耗模型额度并产生重复结论版本。
 * 因此只在<b>批次级</b>异常（如数据库不可用）时才返回 failure。</p>
 *
 * <p><b>总开关：</b>{@code yuqing.analysis.enabled=false} 时直接成功返回并说明原因 ——
 * 刻意不返回失败，否则控制台会持续告警一个「本来就被关掉的功能」。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingAnalysisBatch")
public class YqAnalysisJobExecutor {

    private final IYqAnalysisService analysisService;

    private final YqAnalysisProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("智能研判已关闭（yuqing.analysis.enabled=false），本次跳过");
        }
        try {
            AnalysisBatchResult r = analysisService.analyzeBatchAsSystem(resolveLimit(jobArgs));
            SnailJobLog.LOCAL.info(
                "[智能研判] 批次 {} 结束：命中 {} / 认领 {} / 成功 {} / 失败 {} / 跳过 {} / 事件新建 {} / 事件并入 {} / 降级 {}",
                r.getBatchNo(), r.getTotal(), r.getClaimed(), r.getSucceeded(), r.getFailed(),
                r.getSkipped(), r.getClusterCreated(), r.getClusterJoined(), r.getRuleUsed());
            if (r.getFailed() > 0) {
                SnailJobLog.LOCAL.warn("[智能研判] 本批有 {} 条失败，可在研判中心使用「重试失败项」处理",
                    r.getFailed());
            }
            return ExecuteResult.success("批次 " + r.getBatchNo()
                + "：成功 " + r.getSucceeded() + " / 失败 " + r.getFailed()
                + " / 跳过 " + r.getSkipped() + "，剩余待研判 " + r.getRemaining());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[智能研判] 批次执行异常", e);
            return ExecuteResult.failure("智能研判异常: " + e.getMessage());
        }
    }

    /**
     * 取作业参数里的 {@code limit}（可选）。
     *
     * <p>允许在控制台临时把单批条数调大或调小，用于压测与故障期降速，
     * 不必改配置重启。参数缺失或非法时返回 null，由 Service 用配置值兜底 ——
     * 参数写错不该让任务失败。</p>
     */
    private Integer resolveLimit(JobArgs jobArgs) {
        if (jobArgs == null) {
            return null;
        }
        Object params = jobArgs.getJobParams();
        Object raw = params;
        if (params instanceof Map<?, ?> map) {
            raw = map.get("limit");
            if (raw == null) {
                raw = map.get("batchSize");
            }
        }
        if (raw == null) {
            return null;
        }
        try {
            int v = Integer.parseInt(String.valueOf(raw).trim());
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            SnailJobLog.LOCAL.warn("[智能研判] limit 参数非法，改用配置值: {}", raw);
            return null;
        }
    }
}
`,
    ].join(''),
  },

  /* ==================================================== 配置样例 */
  {
    rel: 'config/yq_analysis.yml',
    content: [
      `# ============================================================================
# F-007 智能研判 配置样例
# ----------------------------------------------------------------------------
# 使用方式：把 yuqing.analysis 段并入 ruoyi-admin 的 application-{profile}.yml。
# 全部项都有代码默认值，本文件只列出「必须或建议显式配置」的项与原因。
# ============================================================================
yuqing:
  analysis:
    # ---- 总开关 ----
    # false 时：定时任务直接跳过；人工批量仍可执行（人工操作是显式意图）。
    enabled: true

    # ---- 批次与重试 ----
    # 单批处理条数上限。定时任务与人工批量共用。
    # 调大 = 单次占用更久、失败影响面更大；20 条配合 5 分钟一次的 Cron 足够跟上采集节奏。
    batch-size: 20
    # 单条大模型调用的最大尝试次数（首次 + 重试）。超出后按规则兜底或置 failed。
    # 退避为 300ms 起、逐次翻倍、封顶 2000ms；实际最坏等待 300 + 600 = 900ms（3 次）。
    max-retry: 3
    # 送入模型的正文最大长度（字符）。超长会截断并保留头部 ——
    # 舆情的关键信息几乎都在开头，而超长正文会显著抬高 token 成本。
    max-content-length: 3000

    # ---- 标签 ----
    # 自动打标签总开关。关闭后只保留人工标签。
    auto-tag-enabled: true
    # 单条舆情最多保留的标签数（模型可能给出很多近义标签，会淹没真正的关键标签）。
    max-tags-per-opinion: 8
    # 单个标签名最大长度。超长会被截断；同时决定自动建标签时的名称长度。
    max-tag-name-length: 20

    # ---- 规则兜底 ----
    # 大模型不可用（未启用、网络异常、连续失败熔断）时改用规则判定。
    # ⚠ 生产必须保持 true：它保证 F-010 预警 / F-014 日报的数据链路不被外部服务阻塞。
    # 代价是结论精度下降（置信度封顶 60），因此降级会在结论的命中依据里留痕。
    rule-fallback-enabled: true

    # ---- 事件聚合 ----
    # 相似度阈值（0~1）。越高越不容易误聚合，越低越容易把不同事件并成一个。
    # 0.62 是基于中文标题 bi-gram Jaccard 的经验值：同事件改写稿通常 >= 0.7，
    # 不同事件偶发撞词通常 <= 0.5。
    similarity-threshold: 0.62
    # 聚合时间窗（小时）。只与「最近出现时间在 N 小时内」的事件比较；
    # 没有时间约束会让半年前的旧闻被聚合进当前事件。
    cluster-window-hours: 72
    # 单个事件的成员上限（含）。达到上限后不再并入，只更新计数 ——
    # 防止一个超级热点把海量记录塞进同一事件导致查询超时。
    cluster-max-opinions: 500
    # 传播脉络时间轴的最大节点数（写入 spread_path 与事件卡片展示）。
    timeline-node-limit: 200

    # ---- 训练样本 ----
    # 人工修正后自动登记待标注训练样本（验收标准 9）。
    sample-on-correct: true

    # ---- 数据权限 ----
    # 具备「全量数据可见」的角色键列表（沿用 F-016 台账的同名口径）。
    #   ⚠ 默认空 = 只有超级管理员看全量，其余角色只能看到自己名下任务产生的舆情。
    all-data-role-keys:

    # ---- 定时任务 ----
    # SnailJob 控制台建好作业后把作业ID 填在这里，服务端才能触发它。
    # 留空时任务仍可被控制台直接调度（Cron），只是无法通过 OpenAPI 主动触发。
    analyze-job-id:
    # 未配置作业ID 时的进程内兜底线程池并发度（开发环境用）。
    analyze-pool-size: 2

    # ---- 大模型 ----
    llm:
      # ⚠ 默认 false。置 true 前必须先在调度控制台或环境变量里提供 api-key，
      # 否则每次调用都会以「配置错误」失败并消耗重试次数。
      # 保持 false 时系统走规则兜底，功能完整可用（验收标准 1~11 均可通过），
      # 只是结论精度与「隐性舆情识别」能力受限。
      enabled: false
      base-url: https://api.deepseek.com
      chat-path: /v1/chat/completions
      # 密钥只从环境变量注入，绝不写入配置文件或仓库。
      api-key: \${YQ_LLM_API_KEY:}
      model: deepseek-chat
      # 温度 0.2：研判要的是稳定可复现的判定，不是文采。温度越高同一篇原文的结论越飘。
      temperature: 0.2
      max-tokens: 1024
      # 提示词版本。改动判定规范时必须同步递增（见 PromptSpec.VERSION），
      # 否则历史结论会失去可比基线（验收标准 11）。
      prompt-version: v1
      connect-timeout-ms: 5000
      read-timeout-ms: 60000
`,
    ].join(''),
  },
];
