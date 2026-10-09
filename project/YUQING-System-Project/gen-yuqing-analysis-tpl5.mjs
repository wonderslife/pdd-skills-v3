/**
 * F-007 智能研判 · 模板 5：单条研判流水线引擎
 *
 * 产物：
 *   analysis/engine/AnalysisEngine.java
 *
 * 为什么把「单条流水线」单独抽成一个组件（而不是都塞进 ServiceImpl）：
 *   本类是写侧的核心 —— 认领 -> 组提示词 -> 调模型（含退避重试与熔断）->
 *   解析 -> 融合 -> 落库 -> 回写主表 -> 自动打标 -> 事件聚合 -> 写终态。
 *   它与「读 + 编排 + 校验」是两种性质完全不同的代码（一个有副作用、一个近乎纯读），
 *   混在一个类里会让任何一次改动都要通读上千行。拆开后：
 *     - 编排层（YqAnalysisServiceImpl）决定「处理哪些、以什么批次」；
 *     - 引擎层（本类）决定「一条怎么处理」。
 *
 * 转义约定：模板串内不得出现裸反引号；不得出现未转义 ${；Java 产物不出现
 *   \\n / \\t / \\r 转义序列（需要换行/回车字符时用 (char) 10 / (char) 13 构造）。
 */
export const ANALYSIS_TPL5 = [

  {
    rel: 'analysis/engine/AnalysisEngine.java',
    content: [
      `package org.dromara.yuqing.analysis.engine;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.analysis.cluster.ClusterDraft;
import org.dromara.yuqing.analysis.cluster.OpinionClusterer;
import org.dromara.yuqing.analysis.config.YqAnalysisProperties;
import org.dromara.yuqing.analysis.dao.AnalysisMetaDao;
import org.dromara.yuqing.analysis.dao.AnalysisOpinionDao;
import org.dromara.yuqing.analysis.domain.AnalysisBatchResult;
import org.dromara.yuqing.analysis.judge.JudgementMerger;
import org.dromara.yuqing.analysis.judge.RuleJudger;
import org.dromara.yuqing.analysis.llm.ILlmClient;
import org.dromara.yuqing.analysis.llm.LlmException;
import org.dromara.yuqing.analysis.llm.LlmRequest;
import org.dromara.yuqing.analysis.llm.LlmResponse;
import org.dromara.yuqing.analysis.parse.AnalysisResultParser;
import org.dromara.yuqing.analysis.parse.ParsedJudgement;
import org.dromara.yuqing.analysis.prompt.AnalysisPromptBuilder;
import org.dromara.yuqing.analysis.prompt.PromptPair;
import org.dromara.yuqing.analysis.prompt.PromptSpec;
import org.dromara.yuqing.analysis.stage.SpreadPathWriter;
import org.dromara.yuqing.analysis.stage.SpreadStageClassifier;
import org.dromara.yuqing.analysis.variant.VariantDetector;
import org.dromara.yuqing.analysis.variant.VariantRule;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqOpinionAnalysis;
import org.dromara.yuqing.domain.YqOpinionCluster;
import org.dromara.yuqing.domain.YqOpinionTag;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 单条舆情研判流水线（F-007）
 *
 * <p><b>一、流程固定为十步，顺序不可调换：</b></p>
 * <ol>
 *   <li>认领（CAS 把状态置 processing）—— 并发下防止同一条被两个批次研判；</li>
 *   <li>规则兜底先算（成本为零，且模型失败时立刻可用）；</li>
 *   <li>组提示词（含注入防护，见 {@link AnalysisPromptBuilder}）；</li>
 *   <li>调大模型（按 maxRetry 退避重试；批次内熔断）；</li>
 *   <li>解析为受控对象（枚举越界归一、超长截断）；</li>
 *   <li>与规则结论融合（取风险更高的一侧，置信度取小）；</li>
 *   <li>结论落库（{@code yq_opinion_analysis}）；</li>
 *   <li>事件聚合（新建或并入，并重算传播脉络）；</li>
 *   <li>结论回写主表（{@code yq_opinion} 的分级字段 + cluster_id）；</li>
 *   <li>自动打标签 + 写终态。</li>
 * </ol>
 * <p>第 8 步必须在第 9 步之前 —— 回写要把 cluster_id 一起写进主表；
 * 第 9 步必须早于第 10 步 —— 打标失败不该让一条已经算好的结论变成 failed。</p>
 *
 * <p><b>二、跨库写入不用事务：</b>本流程同时写 Doris（结论 / 主表 / 标签关联 / 事件）
 * 与 MySQL（标签定义）。动态数据源的事务只绑定当前连接，跨数据源事务是假事务。
 * 因此设计成「每步幂等 + 顺序固定 + 终态兜底」：重复执行结果一致，
 * 失败后重跑即可收敛。</p>
 *
 * <p><b>三、失败隔离：</b>单条异常一律本地捕获，绝不上抛 ——
 * 上抛会中断整个批次，后面排队的舆情一条都研判不了（验收标准 6 明确要求
 * 「不阻塞其他舆情研判」）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisEngine {

    /** 规则兜底时写入 {@code model_version} 的标记值（结论来源靠它区分） */
    public static final String MODEL_RULE = "rule-judger";

    /** 规则兜底时写入 {@code prompt_version} 的标记值 */
    public static final String PROMPT_RULE = "rule-v1";

    /** 大模型连续失败达到此值即在<b>本批内</b>熔断，不再对该批剩余条目发起调用 */
    private static final int LLM_BREAKER_THRESHOLD = 3;

    /** 退避起始毫秒 */
    private static final long BACKOFF_BASE_MS = 300L;

    /** 退避封顶毫秒（避免单条把整批拖死） */
    private static final long BACKOFF_MAX_MS = 2000L;

    /** 失败原因落库长度上限（与 DDL 的 VARCHAR(1000) 对齐） */
    private static final int FAIL_REASON_LEN = 1000;

    /** 命中依据落库长度上限 */
    private static final int EVIDENCE_LEN = 1000;

    /** 标签串落库长度上限（与 yq_opinion_analysis.tags 的 VARCHAR(500) 对齐） */
    private static final int TAGS_LEN = 500;

    /** 事件标题 / 主题列宽 */
    private static final int CLUSTER_TITLE_LEN = 200;

    /** 单批聚合候选事件上限 */
    private static final int CLUSTER_CANDIDATE_LIMIT = 200;

    /** 换行与回车：用十进制构造，避免源码里出现转义序列（本项目转义铁律） */
    private static final char LF = (char) 10;
    private static final char CR = (char) 13;

    private final AnalysisOpinionDao opinionDao;
    private final AnalysisMetaDao metaDao;
    private final YqAnalysisProperties props;
    private final List<ILlmClient> llmClients;

    /** 单条处理结果（供编排层计数） */
    public enum Outcome {
        /** 成功（含「模型降级、规则兜底」成功） */
        SUCCESS,
        /** 失败（写 failed 终态） */
        FAILED,
        /** 跳过（认领失败 = 已被别的批次拿走） */
        SKIPPED
    }

    /**
     * 单批次的运行时上下文。
     *
     * <p>熔断计数必须是「每批一份」而不是引擎的字段：引擎是单例 Bean，
     * 把计数放成成员变量会让定时任务与人工批量互相干扰，且永远无法复位。
     * 用上下文对象显式传递，生命周期一目了然。</p>
     */
    public static final class BatchCtx {

        /** 批次结果（由编排层初始化 batchNo / trigger / scopeDesc 后传入） */
        public final AnalysisBatchResult result = new AnalysisBatchResult();

        /** 失败明细（受 maxFailures 上限约束） */
        public final List<AnalysisBatchResult.Failure> failures = new ArrayList<>();

        /** 失败明细最多保留条数 */
        private final int maxFailures;

        private int consecutiveLlmFailures;

        private boolean llmBroken;

        public BatchCtx(int maxFailures) {
            this.maxFailures = maxFailures <= 0 ? 20 : maxFailures;
        }

        /** 大模型调用成功：复位连续失败计数 */
        void llmOk() {
            consecutiveLlmFailures = 0;
        }

        /** 大模型调用失败：累加计数，达阈值即熔断 */
        void llmFail() {
            consecutiveLlmFailures++;
            if (consecutiveLlmFailures >= LLM_BREAKER_THRESHOLD) {
                llmBroken = true;
            }
        }

        /** 本批是否已熔断（熔断后不再调模型，避免为每条都白等一次超时） */
        public boolean isLlmBroken() {
            return llmBroken;
        }

        /** 记录一条失败明细（超上限则丢弃，但计数仍准确） */
        public void addFailure(AnalysisBatchResult.Failure f) {
            if (f == null || failures.size() >= maxFailures) {
                return;
            }
            failures.add(f);
        }
    }

    /** 单条研判的内部结论载体（不对外暴露，避免把中间态写进接口契约） */
    private static final class Judgement {

        /** 融合后的结论（null 表示失败） */
        ParsedJudgement parsed;

        /** 传播量级（由规则计算，模型不产出该字段） */
        String spreadLevel;

        /** 结论是否来自大模型 */
        boolean llmUsed;

        /** 失败原因（成功时为「降级说明」，可为 null） */
        String failReason;

        /** 是否值得重试 */
        boolean retryable;

        /** 实际使用的模型名 */
        String modelName;

        /** 实际使用的提示词版本 */
        String promptVersion;

        /** 已尝试次数 */
        int attempt;
    }
`,
      `    /* ==================================================== 对外：单条处理 */

    /**
     * 处理一条舆情：认领 -> 研判 -> 落库 -> 聚合 -> 打标 -> 终态。
     *
     * <p>本方法<b>绝不抛异常</b>：所有异常在内部转成 FAILED 结果并写终态，
     * 保证批次能一直跑下去。</p>
     */
    public Outcome processOne(YqOpinion opinion, BatchCtx ctx) {
        if (opinion == null || opinion.getOpinionId() == null) {
            return Outcome.SKIPPED;
        }
        Long id = opinion.getOpinionId();
        /* 认领：单条 CAS。返回 0 表示该行已处于 processing（被别的批次拿着），
         * 此时跳过而不是硬跑 —— 硬跑会产生两条结论与两次标签写入。 */
        if (opinionDao.claimForProcessing(List.of(id)) <= 0) {
            ctx.result.setSkipped(ctx.result.getSkipped() + 1);
            return Outcome.SKIPPED;
        }
        ctx.result.setClaimed(ctx.result.getClaimed() + 1);
        try {
            Judgement j = judge(opinion, ctx);
            if (j == null || j.parsed == null) {
                return markFailed(opinion, j, ctx);
            }
            commit(opinion, j, ctx);
            return Outcome.SUCCESS;
        } catch (RuntimeException e) {
            /* 兜底：任何未预料的异常都不能让批次中断 */
            log.error("[F-007] 研判流水线异常, opinionId={}", id, e);
            Judgement j = new Judgement();
            j.failReason = "研判流水线异常：" + sound(e.getMessage());
            j.retryable = true;
            return markFailed(opinion, j, ctx);
        }
    }

    /** 批量前过滤：仅保留尚未用完重试次数的失败项（验收标准 6 的重试入口用） */
    public List<YqOpinion> filterRetryable(List<YqOpinion> candidates) {
        List<YqOpinion> out = new ArrayList<>();
        if (candidates == null || candidates.isEmpty()) {
            return out;
        }
        List<Long> ids = new ArrayList<>();
        for (YqOpinion o : candidates) {
            if (o != null && o.getOpinionId() != null) {
                ids.add(o.getOpinionId());
            }
        }
        Map<Long, Integer> used = opinionDao.analysisCounts(ids);
        int max = Math.max(1, props.getMaxRetry());
        for (YqOpinion o : candidates) {
            if (o == null || o.getOpinionId() == null) {
                continue;
            }
            Integer n = used.get(o.getOpinionId());
            if (n == null || n < max) {
                out.add(o);
            }
        }
        return out;
    }

    /* ==================================================== 判定：规则 + 模型 */

    /**
     * 判定一条舆情：规则兜底 + 大模型 + 融合。
     *
     * <p><b>为什么规则先算：</b>它零成本、纯函数、永远可用。无论大模型是否可用，
     * 它都作为「下限」参与融合 —— 模型说「正面」而正文里满是投诉词时，
     * 融合会取风险更高的一侧，避免模型偶发的乐观误判直接落到预警链路上。</p>
     *
     * <p><b>熔断后的行为：</b>本批已熔断时不调模型，直接用规则结论，
     * 并在命中依据里写明降级原因。降级必须可见，否则
     * 「为什么这批结论的置信度都卡在 60」将无从解释。</p>
     */
    private Judgement judge(YqOpinion o, BatchCtx ctx) {
        Judgement out = new Judgement();
        ParsedJudgement rule = props.isRuleFallbackEnabled() ? ruleJudge(o) : null;
        out.spreadLevel = RuleJudger.spreadLevel(o.getReadCount(), o.getLikeCount(),
            o.getCommentCount(), o.getShareCount());

        ILlmClient client = ctx.isLlmBroken() ? null : pickClient();
        if (client == null) {
            String note;
            if (ctx.isLlmBroken()) {
                note = "本批已熔断（连续调用失败达阈值），改由规则兜底";
            } else if (!props.getLlm().isEnabled()) {
                note = "大模型未启用（yuqing.analysis.llm.enabled=false），改由规则兜底";
            } else {
                note = "未找到可用的大模型客户端，改由规则兜底";
            }
            return fallback(out, rule, note);
        }

        int maxAttempts = Math.max(1, props.getMaxRetry());
        String lastReason = null;
        boolean lastRetryable = false;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            Judgement r = callLlm(o, client, attempt);
            if (r.parsed != null) {
                ctx.llmOk();
                /* 融合：模型结论优先，规则补齐缺失字段；风险取更高一侧，置信度取小 */
                r.parsed = rule == null ? r.parsed : JudgementMerger.merge(r.parsed, rule);
                r.spreadLevel = out.spreadLevel;
                r.llmUsed = true;
                return r;
            }
            lastReason = r.failReason;
            lastRetryable = r.retryable;
            ctx.llmFail();
            /* 熔断：本批剩余条目不再调模型，立刻降级，避免每条都白等一次超时 */
            if (ctx.isLlmBroken()) {
                break;
            }
            /* 配置类错误（如 api-key 缺失）重试一万次也不会成功，早停 */
            if (!lastRetryable) {
                break;
            }
            if (attempt < maxAttempts) {
                sleepQuietly(backoffMs(attempt));
            }
        }
        return fallback(out, rule, lastReason);
    }

    /**
     * 降级到规则兜底。
     *
     * <p>规则也没有可用结论时（{@code ruleFallbackEnabled=false}），
     * 返回 {@code parsed=null} 的失败载体 —— 由调用方写 failed 终态。
     * 失败原因里会带上模型侧的真实原因，研判员据此判断该不该点重试。</p>
     */
    private Judgement fallback(Judgement out, ParsedJudgement rule, String note) {
        out.attempt = 1;
        out.modelName = MODEL_RULE;
        out.promptVersion = PROMPT_RULE;
        if (rule != null) {
            out.parsed = rule;
            out.llmUsed = false;
            out.failReason = note;
            out.retryable = false;
            return out;
        }
        out.parsed = null;
        out.failReason = note == null ? "大模型不可用且规则兜底已关闭" : note;
        out.retryable = true;
        return out;
    }

    /**
     * 调用一次大模型并解析。
     *
     * <p>可重试性判定：</p>
     * <ul>
     *   <li><b>可重试</b>：网络异常、响应体为空、模型返回失败态、
     *       以及「返回格式不合法」—— 验收标准 6 明确要求格式不合法时按退避重试；</li>
     *   <li><b>不可重试</b>：{@link LlmException}（配置错误，如地址或密钥缺失）——
     *       这类错误重试只会浪费时间并拖垮批次。</li>
     * </ul>
     */
    private Judgement callLlm(YqOpinion o, ILlmClient client, int attempt) {
        Judgement out = new Judgement();
        out.attempt = attempt;
        out.modelName = client.modelName();
        out.promptVersion = PromptSpec.VERSION;
        try {
            PromptPair pair = AnalysisPromptBuilder.build(o.getTitle(), o.getContent(),
                null, props.getMaxContentLength());
            LlmRequest req = new LlmRequest();
            req.setSystemPrompt(pair.getSystem());
            req.setUserPrompt(pair.getUser());
            req.setModel(client.modelName());
            req.setTemperature(props.getLlm().getTemperature());
            req.setMaxTokens(props.getLlm().getMaxTokens());
            LlmResponse resp = client.chat(req);
            if (resp == null) {
                out.failReason = "大模型无响应（返回 null）";
                out.retryable = true;
                return out;
            }
            if (!resp.isSuccess()) {
                out.failReason = sound(resp.getReason());
                out.retryable = true;
                return out;
            }
            ParsedJudgement parsed = AnalysisResultParser.parse(resp.getContent(),
                props.getMaxTagsPerOpinion(), props.getMaxTagNameLength());
            if (parsed == null) {
                out.failReason = "解析结果为空";
                out.retryable = true;
                return out;
            }
            if (parsed.isFatal()) {
                /* 格式不合法：按验收标准 6 视为可重试（模型偶发输出截断很常见） */
                out.failReason = "返回格式不合法：" + sound(parsed.getFailReason());
                out.retryable = true;
                return out;
            }
            out.parsed = parsed;
            return out;
        } catch (LlmException e) {
            out.failReason = "大模型配置错误：" + sound(e.getMessage());
            out.retryable = false;
            return out;
        } catch (RuntimeException e) {
            out.failReason = "大模型调用异常：" + sound(e.getMessage());
            out.retryable = true;
            return out;
        }
    }

    /** 选一个可用的大模型客户端（按 Bean 声明顺序取第一个已启用的） */
    private ILlmClient pickClient() {
        if (llmClients == null || llmClients.isEmpty()) {
            return null;
        }
        for (ILlmClient c : llmClients) {
            if (c != null && c.isEnabled()) {
                return c;
            }
        }
        return null;
    }

    /** 规则兜底判定（纯函数） */
    private static ParsedJudgement ruleJudge(YqOpinion o) {
        return RuleJudger.judge(o.getTitle(), o.getContent(), o.getHeatScore(),
            o.getReadCount(), o.getLikeCount(), o.getCommentCount(), o.getShareCount());
    }
`,
      `    /* ==================================================== 落库：成功路径 */

    /**
     * 成功路径的落库与回写（验收标准 2、4、7）。
     *
     * <p>顺序刻意固定：结论落库 -> 事件聚合（含绑定）-> 回写主表 -> 自动打标 -> 终态。
     * 其中两个细节值得说明：</p>
     * <ul>
     *   <li>自动打标失败<b>不影响</b>结论：标签是锦上添花，
     *       而结论是预警与日报的数据来源。把打标异常上抛会让一条已经算对的结论被标成 failed，
     *       代价远大于少几个标签；</li>
     *   <li>终态 {@code completed} 写在最后：中途任何一步抛错都会落到
     *       {@link #processOne} 的兜底分支，由 {@link #markFailed} 写 failed ——
     *       不会留下永远停在 processing 的僵尸行。</li>
     * </ul>
     */
    private void commit(YqOpinion o, Judgement j, BatchCtx ctx) {
        ParsedJudgement p = j.parsed;
        List<String> tags = cleanTags(p.getTags());
        List<String> variants = variantHits(o.getContent(), o.getTaskId());
        /* 命中依据 = 变体命中（验收标准 3）+ 模型自述依据；降级时附上降级说明 */
        String evidence = composeEvidence(p.getMatchEvidence(), variants, j.llmUsed ? null : j.failReason);

        YqOpinionAnalysis row = new YqOpinionAnalysis();
        row.setOpinionId(o.getOpinionId());
        row.setTopic(cut(p.getTopic(), 200));
        row.setSummary(cut(p.getSummary(), 1000));
        row.setSentiAttr(p.getSentiAttr());
        row.setRiskAttr(cut(p.getRiskAttr(), 200));
        row.setRiskLevel(p.getRiskLevel());
        row.setOpinionLevel(p.getOpinionLevel());
        row.setTags(cut(joinTags(tags), TAGS_LEN));
        row.setMatchEvidence(cut(evidence, EVIDENCE_LEN));
        row.setSuggestion(cut(p.getSuggestion(), 1000));
        row.setConfidence(p.getConfidence());
        row.setModelVersion(cut(j.modelName, 50));
        row.setPromptVersion(cut(j.promptVersion, 50));
        row.setAnalyzeVersion(opinionDao.analysisCount(o.getOpinionId()) + 1);
        row.setCorrectedFlag("0");
        row.setAnalyzeTime(LocalDateTime.now());
        opinionDao.insertAnalysis(row);

        /* 事件聚合：先拿到 clusterId 并绑定，再回写主表 —— 回写要带上 cluster_id */
        Long clusterId = resolveCluster(o, p, ctx);
        if (clusterId != null) {
            opinionDao.bindCluster(List.of(o.getOpinionId()), clusterId);
            refreshClusterPath(clusterId);
        }

        YqOpinion wb = new YqOpinion();
        wb.setOpinionId(o.getOpinionId());
        wb.setSentiAttr(p.getSentiAttr());
        wb.setRiskLevel(p.getRiskLevel());
        wb.setOpinionLevel(p.getOpinionLevel());
        wb.setSpreadLevel(j.spreadLevel);
        wb.setClusterId(clusterId);
        opinionDao.writeBackConclusion(wb);

        int tagged = 0;
        try {
            tagged = autoTag(o, tags);
        } catch (RuntimeException e) {
            log.warn("[F-007] 自动打标签失败（结论已保留）, opinionId={}", o.getOpinionId(), e);
        }
        ctx.result.setTagged(ctx.result.getTagged() + tagged);

        opinionDao.markStatus(o.getOpinionId(), AnalysisOpinionDao.ST_COMPLETED);
        ctx.result.setSucceeded(ctx.result.getSucceeded() + 1);
        ctx.result.setProcessed(ctx.result.getProcessed() + 1);
        if (j.llmUsed) {
            ctx.result.setLlmUsed(ctx.result.getLlmUsed() + 1);
        } else {
            ctx.result.setRuleUsed(ctx.result.getRuleUsed() + 1);
        }
    }

    /* ==================================================== 落库：失败路径 */

    /**
     * 失败路径：写一条带失败原因的结论记录 + 置 failed 终态（验收标准 6）。
     *
     * <p><b>为什么失败也要写一条结论记录：</b>失败原因（{@code fail_reason}）挂在
     * {@code yq_opinion_analysis} 上，而不在主表上。只有写了这条记录，
     * 研判中心才能展示「为什么失败」，重试上限计数也才有依据。
     * 这条记录的主题 / 摘要为空，前端据此识别为「失败记录」而不是「结论为空」。</p>
     */
    private Outcome markFailed(YqOpinion o, Judgement j, BatchCtx ctx) {
        String reason = sound(j == null ? null : j.failReason);
        if (reason == null || reason.isBlank()) {
            reason = "未知原因";
        }
        YqOpinionAnalysis row = new YqOpinionAnalysis();
        row.setOpinionId(o.getOpinionId());
        row.setAnalyzeVersion(opinionDao.analysisCount(o.getOpinionId()) + 1);
        row.setCorrectedFlag("0");
        row.setAnalyzeTime(LocalDateTime.now());
        row.setFailReason(cut(reason, FAIL_REASON_LEN));
        try {
            opinionDao.insertAnalysis(row);
        } catch (RuntimeException e) {
            log.warn("[F-007] 写失败记录出错（状态仍会置 failed）, opinionId={}", o.getOpinionId(), e);
        }
        /* 置终态必须无条件执行：否则这条会永远停在 processing */
        opinionDao.markStatus(o.getOpinionId(), AnalysisOpinionDao.ST_FAILED);

        ctx.result.setFailed(ctx.result.getFailed() + 1);
        ctx.result.setProcessed(ctx.result.getProcessed() + 1);
        AnalysisBatchResult.Failure f = new AnalysisBatchResult.Failure();
        f.setOpinionId(o.getOpinionId());
        f.setTitle(cut(o.getTitle(), 80));
        f.setReason(cut(reason, 200));
        f.setAttempt(j == null ? 1 : Math.max(1, j.attempt));
        /* 已达重试上限的失败项标为不可重试，前端不应再显示「重试」按钮 */
        f.setRetryable(j != null && j.retryable && j.attempt < Math.max(1, props.getMaxRetry()));
        ctx.addFailure(f);
        return Outcome.FAILED;
    }
`,
      `    /* ==================================================== 事件聚合（验收标准 4） */

    /**
     * 决定这条舆情归属哪个事件：已归属的直接沿用，否则在时间窗内找相似事件，
     * 找不到就新建。
     *
     * <p>聚合决策本身是纯函数（{@link OpinionClusterer}），本方法只负责取候选与落库。
     * 「并入」时只调 {@code updateCluster} 更新计数与时间范围，
     * <b>不在</b>这里重算传播脉络 —— 因为此时新成员还没绑定到事件上，
     * 重算会漏掉刚研判的这条。重算交给绑定之后的 {@link #refreshClusterPath}。</p>
     */
    private Long resolveCluster(YqOpinion o, ParsedJudgement p, BatchCtx ctx) {
        if (o.getClusterId() != null) {
            return o.getClusterId();
        }
        LocalDateTime anchor = o.getPublishTime() == null ? LocalDateTime.now() : o.getPublishTime();
        int windowHours = Math.max(1, props.getClusterWindowHours());
        List<YqOpinionCluster> recent =
            opinionDao.recentClusters(anchor.minusHours(windowHours), CLUSTER_CANDIDATE_LIMIT);
        List<OpinionClusterer.Candidate> candidates = new ArrayList<>();
        if (recent != null) {
            for (YqOpinionCluster c : recent) {
                if (c == null || c.getClusterId() == null) {
                    continue;
                }
                candidates.add(new OpinionClusterer.Candidate(c.getClusterId(), c.getClusterTitle(),
                    c.getClusterTopic(), c.getOpinionCount(), c.getLastTime(), c.getPeakHeat()));
            }
        }
        ClusterDraft draft = OpinionClusterer.decide(safeTitle(o.getTitle()), o.getContent(), anchor,
            candidates, props.getSimilarityThreshold(), windowHours, props.getClusterMaxOpinions());
        if (draft == null) {
            return null;
        }
        if (draft.isCreated()) {
            YqOpinionCluster c = new YqOpinionCluster();
            c.setClusterTitle(cut(safeTitle(draft.getSeedTitle()), CLUSTER_TITLE_LEN));
            c.setClusterTopic(cut(prefer(p == null ? null : p.getTopic(), draft.getSeedTopic()),
                CLUSTER_TITLE_LEN));
            c.setOpinionCount(1);
            c.setFirstTime(anchor);
            c.setLastTime(anchor);
            c.setPeakHeat(o.getHeatScore());
            c.setRiskLevel(p == null ? null : p.getRiskLevel());
            c.setSpreadPath("[]");
            c.setCreateTime(LocalDateTime.now());
            opinionDao.insertCluster(c);
            ctx.result.setClusterCreated(ctx.result.getClusterCreated() + 1);
            return c.getClusterId();
        }
        Long cid = draft.getClusterId();
        YqOpinionCluster c = opinionDao.clusterById(cid);
        if (c == null) {
            /* 候选在决策与落库之间被删了（并发），直接沿用该ID即可：
             * 后面的 bindCluster 会把这条挂上去，事件字段下一轮聚合时自会修正。 */
            return cid;
        }
        c.setOpinionCount(nz(c.getOpinionCount()) + 1);
        c.setLastTime(anchor);
        if (c.getFirstTime() == null || anchor.isBefore(c.getFirstTime())) {
            c.setFirstTime(anchor);
        }
        if (o.getHeatScore() != null && (c.getPeakHeat() == null || o.getHeatScore() > c.getPeakHeat())) {
            c.setPeakHeat(o.getHeatScore());
        }
        if (c.getRiskLevel() == null && p != null) {
            c.setRiskLevel(p.getRiskLevel());
        }
        opinionDao.updateCluster(c);
        ctx.result.setClusterJoined(ctx.result.getClusterJoined() + 1);
        return cid;
    }

    /**
     * 重算事件的传播脉络（验收标准 4 的「按时间轴展示传播脉络」）。
     *
     * <p><b>为什么用 {@code LedgerScope.all()}：</b>这是写侧快照，代表事件的真实全貌。
     * 若按当前用户的可见范围算，同一个事件在不同人眼里会有不同的时间轴快照，
     * 「传播脉络」就不再是一个可审计的事实，而成了因人而异的视图。</p>
     */
    public void refreshClusterPath(Long clusterId) {
        if (clusterId == null) {
            return;
        }
        int limit = props.getClusterMaxOpinions() > 0 ? props.getClusterMaxOpinions() : 500;
        List<YqOpinion> members = opinionDao.opinionsInCluster(clusterId, LedgerScope.all(), true, limit);
        List<SpreadStageClassifier.Node> built = stageNodes(members, props.getTimelineNodeLimit());
        YqOpinionCluster upd = new YqOpinionCluster();
        upd.setClusterId(clusterId);
        upd.setSpreadPath(SpreadPathWriter.write(built));
        opinionDao.updateCluster(upd);
    }

    /**
     * 把舆情实体转成阶段标注节点（写侧重算与读侧展示<b>共用同一段实现</b>）。
     *
     * <p>抽出来是为了防止口径分叉：如果写侧与读侧各写一份「怎么把舆情变成时间轴节点」，
     * 迟早会出现「事件卡片上的峰值节点」与「快照里的峰值节点」不是同一条 ——
     * 这类不一致极难排查，因为两边单独看都是对的。</p>
     */
    public List<SpreadStageClassifier.Node> stageNodes(List<YqOpinion> members, int limit) {
        List<SpreadStageClassifier.Node> raw = new ArrayList<>();
        if (members != null) {
            for (YqOpinion m : members) {
                if (m == null || m.getOpinionId() == null) {
                    continue;
                }
                SpreadStageClassifier.Node n = new SpreadStageClassifier.Node();
                n.setOpinionId(m.getOpinionId());
                n.setPublishTime(m.getPublishTime());
                n.setHeatScore(m.getHeatScore());
                n.setTitle(m.getTitle());
                raw.add(n);
            }
        }
        return SpreadStageClassifier.build(raw, limit);
    }

    /** 事件的阶段计数（读侧事件卡片用；写侧用 {@link #stageNodes} 自行取数） */
    public Map<String, Integer> stageCount(Long clusterId, LedgerScope scope, int limit) {
        if (clusterId == null) {
            return new LinkedHashMap<>();
        }
        int cap = limit > 0 ? limit : 200;
        List<YqOpinion> members = opinionDao.opinionsInCluster(clusterId, scope, true, cap);
        return SpreadStageClassifier.countByStage(stageNodes(members, cap));
    }

    /* ==================================================== 自动打标签（验收标准 7） */

    /**
     * 自动打标签。
     *
     * <p>先删掉本条的「模型来源」标签再重建 —— 不清会让标签只增不减：
     * 同一条舆情研判三次，「负面」标签就出现三条。</p>
     *
     * <p>新标签的 {@code create_by} 留空（null），表示「由系统自动创建」。
     * 这里刻意不去取登录上下文：本方法也会被定时任务调用（无登录态），
     * 与其写「取不到就 null、取得到就填」的两套行为，
     * 不如统一为「自动标签的创建人不记名」，人工标签才记名（在修正流程里）。</p>
     *
     * @return 实际写入的标签关联条数
     */
    public int autoTag(YqOpinion o, List<String> tagNames) {
        if (!props.isAutoTagEnabled()) {
            return 0;
        }
        opinionDao.deleteTagsBySource(List.of(o.getOpinionId()), AnalysisMetaDao.TAG_SOURCE_MODEL);
        if (tagNames == null || tagNames.isEmpty()) {
            return 0;
        }
        int inserted = 0;
        for (String name : tagNames) {
            if (name == null || name.isBlank()) {
                continue;
            }
            Long tagId = metaDao.ensureTag(name, null);
            if (tagId == null) {
                continue;
            }
            YqOpinionTag t = new YqOpinionTag();
            t.setOpinionId(o.getOpinionId());
            t.setTagId(tagId);
            t.setTagSource(AnalysisMetaDao.TAG_SOURCE_MODEL);
            if (opinionDao.insertTag(t) > 0) {
                inserted++;
            }
        }
        return inserted;
    }

    /* ==================================================== 供编排层复用 */

    /**
     * 隐性 / 变体表述命中（验收标准 3）。
     *
     * <p>识别的基准是任务配置的关键词原词。任务下没有关键词时直接返回空 ——
     * 没有基准就无从谈「变形」，此时不做任何猜测。</p>
     *
     * @return 人类可读的命中描述列表（空列表表示无命中）
     */
    public List<String> variantHits(String content, Long taskId) {
        List<String> out = new ArrayList<>();
        if (content == null || content.isBlank() || taskId == null) {
            return out;
        }
        List<String> keywords;
        try {
            keywords = metaDao.keywordsOfTask(taskId);
        } catch (RuntimeException e) {
            /* 关键词查不到不该影响研判主流程：变体识别是「补充依据」，不是必需品 */
            log.warn("[F-007] 读取任务关键词失败, taskId={}", taskId, e);
            return out;
        }
        if (keywords == null || keywords.isEmpty()) {
            return out;
        }
        List<VariantRule> hits = VariantDetector.detect(content, keywords);
        if (hits == null || hits.isEmpty()) {
            return out;
        }
        for (VariantRule h : hits) {
            if (h == null) {
                continue;
            }
            StringBuilder sb = new StringBuilder();
            sb.append(VariantDetector.label(h.getCategory())).append('：').append(nvl(h.getForm()));
            if (h.getKeyword() != null && !h.getKeyword().isBlank()) {
                sb.append("（原词 ").append(h.getKeyword()).append('）');
            }
            out.add(sb.toString());
        }
        return out;
    }

    /**
     * 结论来源判定（验收标准 7、11 的展示口径）。
     *
     * <p>用 {@code model_version} 区分来源，而不是新加一列：
     * 规则兜底时该列写 {@link #MODEL_RULE}，模型路径写真实模型名。
     * 这样「哪次结论是模型给的、哪次是兜底给的」在库里直接可查（可导出、可比对），
     * 不依赖任何进程内状态。</p>
     *
     * @return {@code llm} / {@code rule} / {@code manual}；失败记录返回 null
     */
    public static String conclusionSource(YqOpinionAnalysis a) {
        if (a == null) {
            return null;
        }
        if (a.getCorrectedFlag() != null && "1".equals(a.getCorrectedFlag())) {
            return "manual";
        }
        if (a.getTopic() == null) {
            return null;
        }
        return MODEL_RULE.equals(a.getModelVersion()) ? "rule" : "llm";
    }

    /* ==================================================== 内部工具 */

    /** 标签清洗：去空、去重、限长、限数量（与 yq_opinion_analysis.tags 的列宽对齐） */
    private List<String> cleanTags(List<String> raw) {
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

    /** 拼接命中依据：降级说明 + 变体命中 + 模型自述依据 */
    private static String composeEvidence(String modelEvidence, List<String> variants, String degradeNote) {
        StringBuilder sb = new StringBuilder();
        if (degradeNote != null && !degradeNote.isBlank()) {
            sb.append("[模型降级] ").append(degradeNote);
        }
        if (variants != null && !variants.isEmpty()) {
            if (sb.length() > 0) {
                sb.append(" | ");
            }
            sb.append("变体命中：").append(String.join("；", variants));
        }
        if (modelEvidence != null && !modelEvidence.isBlank()) {
            if (sb.length() > 0) {
                sb.append(" | ");
            }
            sb.append("模型依据：").append(modelEvidence);
        }
        return sb.toString();
    }

    /** 清洗外部文本：去掉换行回车（避免污染单行字段）并 trim；全空白返回 null */
    private static String sound(String v) {
        if (v == null) {
            return null;
        }
        String s = v.replace(CR, ' ').replace(LF, ' ').trim();
        return s.isEmpty() ? null : s;
    }

    private static String cut(String v, int max) {
        if (v == null) {
            return null;
        }
        return v.length() <= max ? v : v.substring(0, max);
    }

    private static String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        return String.join(",", tags);
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static String prefer(String a, String b) {
        return a != null && !a.isBlank() ? a : b;
    }

    private static String nvl(String v) {
        return v == null ? "" : v;
    }

    private static String safeTitle(String title) {
        if (title == null || title.isBlank()) {
            return "(无标题舆情)";
        }
        return title.trim();
    }

    /** 退避时长：300ms 起、逐次翻倍、封顶 2000ms */
    private static long backoffMs(int attempt) {
        int shift = Math.min(Math.max(attempt - 1, 0), 10);
        long v = BACKOFF_BASE_MS << shift;
        return Math.min(v, BACKOFF_MAX_MS);
    }

    /**
     * 安静地睡一会儿。
     *
     * <p>捕获中断后<b>重新设置中断标志</b>而不是吞掉 ——
     * 吞掉会让上层（线程池 / 定时任务）无法感知取消请求，
     * 表现为「点了停止但任务还在跑」。</p>
     */
    private static void sleepQuietly(long ms) {
        if (ms <= 0) {
            return;
        }
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
`,
    ].join(''),
  },
];
