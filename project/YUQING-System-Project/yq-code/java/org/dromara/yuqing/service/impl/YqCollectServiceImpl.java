package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.adapter.AdapterRegistry;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.keyword.ExcludeRule;
import org.dromara.yuqing.collect.keyword.KeywordExpression;
import org.dromara.yuqing.collect.keyword.KeywordExpressionException;
import org.dromara.yuqing.collect.keyword.KeywordMatcher;
import org.dromara.yuqing.collect.keyword.KeywordSpec;
import org.dromara.yuqing.collect.model.CollectOverview;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.model.CollectUnit;
import org.dromara.yuqing.collect.model.DispatchSummary;
import org.dromara.yuqing.collect.model.IntervalSpec;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.dromara.yuqing.collect.pipeline.CollectPipeline;
import org.dromara.yuqing.collect.schedule.CollectExecutor;
import org.dromara.yuqing.collect.schedule.CollectScheduleValidator;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.domain.YqNoiseRule;
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.domain.YqTaskChannel;
import org.dromara.yuqing.domain.YqTaskKeyword;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.mapper.YqKeywordMapper;
import org.dromara.yuqing.mapper.YqNoiseRuleMapper;
import org.dromara.yuqing.mapper.YqTaskChannelMapper;
import org.dromara.yuqing.mapper.YqTaskKeywordMapper;
import org.dromara.yuqing.mapper.YqTaskMapper;
import org.dromara.yuqing.service.IYqCollectService;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * 全网自动采集与调度 Service 业务层处理（F-004）。
 *
 * <p>调度模型（《技术架构说明》§5.4）：</p>
 * <ul>
 *   <li><b>任务矩阵</b>：任务 × 渠道 × 频次生成采集单元</li>
 *   <li><b>增量水位线</b>：按渠道的 {@code last_collect_time} 只抓新内容</li>
 *   <li><b>分片执行</b>：同一任务的多个渠道分片到线程池并发下发</li>
 *   <li><b>优先级 + 限流</b>：Redis 令牌桶按渠道配 QPS（见 ChannelRateLimiter）</li>
 *   <li><b>幂等</b>：url_hash 唯一键 + Stream Load label</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqCollectServiceImpl implements IYqCollectService {

    private static final DateTimeFormatter BATCH_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private static final String STATUS_ENABLED = "0";

    /** 关键词类型：组合表达式（yq_keyword_type） */
    private static final String COMBO_TYPE = "combo";

    /** 关键词类型：否定词 / 排除词（yq_keyword_type） */
    private static final String NEGATIVE_TYPE = "negative";

    /** 降噪规则匹配方式：正则（yq_match_type） */
    private static final String MATCH_TYPE_REGEX = "regex";

    private final YqCollectProperties props;

    private final YqTaskMapper taskMapper;

    private final YqTaskChannelMapper taskChannelMapper;

    private final YqTaskKeywordMapper taskKeywordMapper;

    private final YqKeywordMapper keywordMapper;

    private final YqChannelMapper channelMapper;

    private final YqNoiseRuleMapper noiseRuleMapper;

    private final AdapterRegistry adapterRegistry;

    private final CollectPipeline pipeline;

    private final CollectMetrics metrics;

    private final CollectExecutor executor;

    private final CollectScheduleValidator scheduleValidator;

    @Override
    public DispatchSummary dispatch() {
        return doDispatch(null, null);
    }

    @Override
    public DispatchSummary dispatchTask(Long taskId) {
        return doDispatch(taskId, null);
    }

    @Override
    public CollectResult collectOnce(Long taskId, Long channelId) {
        CollectUnit unit = buildUnit(taskMapper.selectById(taskId), channelId, newBatchNo(), true);
        if (unit == null) {
            CollectResult result = new CollectResult();
            result.setBatchNo(newBatchNo());
            result.setTaskId(taskId);
            result.setChannelId(channelId);
            result.setCollectTime(LocalDateTime.now());
            result.addFailure("任务或渠道不存在，或任务未绑定该渠道");
            result.settle();
            return result;
        }
        unit.setSkipReason(null);
        CollectResult result = pipeline.run(unit);
        pipeline.flush();
        return result;
    }

    @Override
    public CollectResult saveRaw(CollectUnit unit, List<RawOpinion> rawList) {
        CollectResult result = pipeline.saveRaw(unit, rawList);
        pipeline.flush();
        return result;
    }

    @Override
    public CollectOverview overview() {
        CollectOverview overview = new CollectOverview();
        overview.setEngineEnabled(props.isEnabled());
        overview.setSinkMode(props.getSink().getMode());
        overview.setDedupMode(props.getDedup().isRedisEnabled() ? "redis+memory" : "memory");
        overview.setAdapterCount(adapterRegistry.codes().size());
        overview.setServerTime(LocalDateTime.now());
        overview.setTotalFetched(metrics.totalFetched());
        Map<String, Long> today = metrics.today();
        overview.setTodayFetched(today.getOrDefault("fetched", 0L));
        overview.setTodayInserted(today.getOrDefault("inserted", 0L));
        overview.setTodayDup(today.getOrDefault("dup", 0L));
        overview.setTodayFailed(today.getOrDefault("failed", 0L));
        overview.setTodayBatches(today.getOrDefault("batches", 0L));

        List<YqTask> tasks = taskMapper.selectList(new LambdaQueryWrapper<YqTask>()
            .orderByDesc(YqTask::getTaskId));
        overview.setEnabledTasks(tasks.stream().filter(t -> STATUS_ENABLED.equals(t.getStatus())).count());
        overview.setEnabledChannels(channelMapper.selectCount(new LambdaQueryWrapper<YqChannel>()
            .eq(YqChannel::getStatus, STATUS_ENABLED)));
        Map<Long, List<Long>> taskChannels = groupTaskChannels(
            tasks.stream().map(YqTask::getTaskId).filter(Objects::nonNull).toList());
        int threshold = Math.max(1, props.getUnhealthyThreshold());
        List<CollectOverview.TaskRunState> states = new ArrayList<>(tasks.size());
        for (YqTask task : tasks) {
            CollectOverview.TaskRunState state = new CollectOverview.TaskRunState();
            state.setTaskId(task.getTaskId());
            state.setTaskName(task.getTaskName());
            state.setLastScheduleTime(task.getLastScheduleTime());
            int maxAbnormal = 0;
            for (Long channelId : taskChannels.getOrDefault(task.getTaskId(), List.of())) {
                maxAbnormal = Math.max(maxAbnormal, metrics.abnormalCount(task.getTaskId() + ":" + channelId));
            }
            state.setConsecutiveAbnormal(maxAbnormal);
            state.setAbnormal("0".equals(task.getStatus()) && maxAbnormal >= threshold);
            states.add(state);
        }
        overview.setTaskStates(states);
        overview.setUnhealthyUnits(new ArrayList<>(metrics.abnormalUnits(threshold).keySet()));
        return overview;
    }

    @Override
    public List<CollectUnit> planUnits(Long taskId) {
        List<YqTask> tasks = loadTasks(taskId);
        String batchNo = newBatchNo();
        List<CollectUnit> units = new ArrayList<>();
        for (YqTask task : tasks) {
            units.addAll(buildUnits(task, batchNo, null, false));
        }
        return units;
    }

    @Override
    public List<String> validateSchedule(YqTask task) {
        return scheduleValidator.validate(task);
    }

    @Override
    public List<String> validateKeywordExpression(String expression) {
        return KeywordExpression.validate(expression);
    }

    /* ------------------------------------------------------------------ 内部实现 */

    private DispatchSummary doDispatch(Long taskId, Long channelId) {
        DispatchSummary summary = new DispatchSummary();
        summary.setBatchNo(newBatchNo());
        summary.setStartedAt(LocalDateTime.now());
        summary.setEngineEnabled(props.isEnabled());
        long start = System.currentTimeMillis();
        if (!props.isEnabled()) {
            summary.setCostMs(System.currentTimeMillis() - start);
            summary.setFinishedAt(LocalDateTime.now());
            summary.setMessage("采集引擎未开启（yuqing.collect.enabled=false），本次调度未下发任何请求");
            log.warn(summary.getMessage());
            return summary;
        }
        List<YqTask> tasks = loadTasks(taskId);
        summary.setTaskCount(tasks.size());
        int maxUnits = Math.max(1, props.getMaxUnitsPerDispatch());
        for (YqTask task : tasks) {
            if (summary.getUnitCount() >= maxUnits) {
                break;
            }
            List<CollectUnit> units = buildUnits(task, summary.getBatchNo(), channelId, true);
            if (units.isEmpty()) {
                continue;
            }
            if (summary.getUnitCount() + units.size() > maxUnits) {
                units = new ArrayList<>(units.subList(0, maxUnits - summary.getUnitCount()));
            }
            for (CollectUnit unit : units) {
                if (!unit.dispatchable()) {
                    summary.setSkippedCount(summary.getSkippedCount() + 1);
                }
            }
            summary.setUnitCount(summary.getUnitCount() + units.size());
            runUnits(units, summary);
            touchTask(task.getTaskId());
        }
        summary.setCostMs(System.currentTimeMillis() - start);
        summary.setFinishedAt(LocalDateTime.now());
        summary.setMessage("下发单元 " + summary.getUnitCount() + " 个（跳过 " + summary.getSkippedCount()
            + "），成功 " + summary.getSuccessCount() + " / 部分 " + summary.getPartialCount()
            + " / 失败 " + summary.getFailedCount() + "，耗时 " + summary.getCostMs() + "ms");
        log.info("[采集调度] {}", summary.getMessage());
        return summary;
    }

    /**
     * 并发执行一批采集单元；单单元失败不影响其它单元（验收标准 5）。
     */
    private void runUnits(List<CollectUnit> units, DispatchSummary summary) {
        List<Callable<CollectResult>> callables = units.stream()
            .map(unit -> (Callable<CollectResult>) () -> pipeline.run(unit))
            .collect(Collectors.toList());
        List<Future<CollectResult>> futures = new ArrayList<>(callables.size());
        try {
            for (Callable<CollectResult> callable : callables) {
                futures.add(executor.pool().submit(callable));
            }
        } catch (Exception e) {
            log.error("[采集调度] 提交采集单元失败: {}", CollectPipeline.rootMessage(e));
        }
        for (int i = 0; i < futures.size(); i++) {
            CollectUnit unit = units.get(i);
            try {
                CollectResult result = futures.get(i).get();
                summary.getDetails().add(result);
                if ("success".equals(result.getResultStatus())) {
                    summary.setSuccessCount(summary.getSuccessCount() + 1);
                } else if ("partial".equals(result.getResultStatus())) {
                    summary.setPartialCount(summary.getPartialCount() + 1);
                } else {
                    summary.setFailedCount(summary.getFailedCount() + 1);
                }
                touchChannel(unit.getChannelId());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                summary.setFailedCount(summary.getFailedCount() + 1);
                log.warn("[采集调度] 调度被中断");
                return;
            } catch (Exception e) {
                summary.setFailedCount(summary.getFailedCount() + 1);
                log.warn("[采集调度] 单元执行异常 task={} channel={}: {}",
                    unit.getTaskId(), unit.getChannelId(), CollectPipeline.rootMessage(e));
            }
        }
    }

    private List<YqTask> loadTasks(Long taskId) {
        LambdaQueryWrapper<YqTask> wrapper = new LambdaQueryWrapper<>();
        if (taskId != null) {
            wrapper.eq(YqTask::getTaskId, taskId);
        } else {
            LocalDateTime now = LocalDateTime.now();
            wrapper.eq(YqTask::getStatus, STATUS_ENABLED);
            wrapper.and(w -> w.isNull(YqTask::getStartTime).or().le(YqTask::getStartTime, now));
            wrapper.and(w -> w.isNull(YqTask::getEndTime).or().ge(YqTask::getEndTime, now));
            wrapper.orderByDesc(YqTask::getTaskId);
        }
        List<YqTask> tasks = taskMapper.selectList(wrapper);
        int limit = Math.max(1, props.getMaxTasksPerDispatch());
        return tasks.size() > limit ? new ArrayList<>(tasks.subList(0, limit)) : tasks;
    }

    /**
     * 构建一个任务下的采集单元。
     *
     * @param task      任务
     * @param channelId 指定渠道；为空表示任务绑定的全部渠道
     * @param batchNo   批次号
     * @param dueCheck  是否做「是否到期」判定
     * @return 采集单元
     */
    private CollectUnit buildUnit(YqTask task, Long channelId, String batchNo, boolean dueCheck) {
        if (task == null) {
            return null;
        }
        List<CollectUnit> units = buildUnits(task, batchNo, channelId, dueCheck);
        return units.isEmpty() ? null : units.get(0);
    }

    /**
     * 构建任务下的采集单元列表。
     */
    private List<CollectUnit> buildUnits(YqTask task, String batchNo, Long onlyChannelId, boolean dueCheck) {
        List<CollectUnit> units = new ArrayList<>();
        if (task == null) {
            return units;
        }
        LocalDateTime now = LocalDateTime.now();
        if (dueCheck) {
            if (!STATUS_ENABLED.equals(task.getStatus())) {
                return units;
            }
            if (task.getStartTime() != null && task.getStartTime().isAfter(now)) {
                return units;
            }
            if (task.getEndTime() != null && task.getEndTime().isBefore(now)) {
                return units;
            }
        }
        LambdaQueryWrapper<YqTaskChannel> relationQuery = new LambdaQueryWrapper<YqTaskChannel>()
            .eq(YqTaskChannel::getTaskId, task.getTaskId());
        if (onlyChannelId != null) {
            relationQuery.eq(YqTaskChannel::getChannelId, onlyChannelId);
        }
        List<YqTaskChannel> relations = taskChannelMapper.selectList(relationQuery);
        if (relations.isEmpty()) {
            return units;
        }
        KeywordMatcher matcher = buildMatcher(task.getTaskId());
        Map<Long, YqChannel> channels = loadChannels(relations);
        for (YqTaskChannel relation : relations) {
            YqChannel channel = channels.get(relation.getChannelId());
            CollectUnit unit = new CollectUnit();
            unit.setTaskId(task.getTaskId());
            unit.setTaskName(task.getTaskName());
            unit.setChannelId(relation.getChannelId());
            unit.setBatchNo(batchNo);
            unit.setMatcher(matcher);
            unit.setCollectStrategy(task.getCollectStrategy());
            if (channel == null) {
                unit.setSkipReason("渠道不存在或已删除: " + relation.getChannelId());
                units.add(unit);
                continue;
            }
            unit.setChannelName(channel.getChannelName());
            unit.setAdapterCode(channel.getAdapterClass());
            unit.setConcurrencyLimit(channel.getConcurrencyLimit());
            unit.setRequestIntervalMs(channel.getRequestInterval());
            unit.setProxyGroupId(channel.getProxyGroupId());
            unit.setFailRateThreshold(channel.getFailRateThreshold());
            unit.setWatermark(channel.getLastCollectTime());
            int interval = scheduleValidator.effectiveInterval(task, relation, channel);
            unit.setIntervalSeconds(interval);
            if (!STATUS_ENABLED.equals(channel.getStatus())) {
                unit.setSkipReason("渠道已停用: " + channel.getChannelName());
            } else if (!adapterRegistry.has(unit.getAdapterCode())) {
                unit.setSkipReason("未配置站点适配器: " + unit.getAdapterCode()
                    + "（请在 yuqing.collect.adapters 中补充）");
            } else {
                List<String> issues = IntervalSpec.validate(interval, channel.getRequestInterval(),
                    channel.getConcurrencyLimit(), props.getMinIntervalSeconds());
                if (!issues.isEmpty()) {
                    unit.setSkipReason(String.join("；", issues));
                }
            }
            if (dueCheck) {
                if (unit.dispatchable() && !isDue(unit, channel)) {
                    continue;
                }
                if (!unit.dispatchable()) {
                    // 参数异常的单元仍下发一次，让日志留下可追溯的失败原因（验收标准 10）
                    units.add(unit);
                    continue;
                }
            }
            units.add(unit);
        }
        return units;
    }

    /**
     * 是否到期：以渠道最近采集时间（增量水位线）为基准。
     *
     * @param unit    采集单元
     * @param channel 渠道
     * @return true 表示应当下发
     */
    private boolean isDue(CollectUnit unit, YqChannel channel) {
        LocalDateTime last = channel.getLastCollectTime();
        if (last == null) {
            return true;
        }
        int interval = unit.getIntervalSeconds() == null ? 0 : unit.getIntervalSeconds();
        int tolerance = "realtime".equalsIgnoreCase(unit.getCollectStrategy()) ? 5 : interval;
        long elapsed = Duration.between(last, LocalDateTime.now()).getSeconds();
        return elapsed >= Math.max(1, tolerance);
    }

    /**
     * 装配任务的关键词匹配器（F-002 关键词库 → F-004 采集）。
     *
     * <p>把关键词库的完整语义（类型 / 分类 / 组合表达式 / 任务级匹配策略）落到采集侧：</p>
     * <ul>
     *   <li>{@code combineExpression} 或含括号竖线的文本 → 解析为「检索词组 + 匹配组 + 排除词」</li>
     *   <li>{@code keyword_type = negative} → 任务级排除词（经 yq_task_keyword 关联，天然带任务维度）</li>
     *   <li>表达式解析失败 → 记入 parseErrors 并随调度日志暴露，避免「静默采不到」</li>
     * </ul>
     *
     * @param taskId 任务ID
     * @return 关键词匹配器；任务无关键词时返回空匹配器（不过滤）
     */
    private KeywordMatcher buildMatcher(Long taskId) {
        YqCollectProperties.KeywordFilter conf = props.getKeywordFilter();
        List<YqTaskKeyword> relations = taskKeywordMapper.selectList(new LambdaQueryWrapper<YqTaskKeyword>()
            .eq(YqTaskKeyword::getTaskId, taskId));
        List<KeywordSpec> specs = new ArrayList<>();
        List<String> excludeTerms = new ArrayList<>();
        if (!relations.isEmpty()) {
            Map<Long, String> strategy = new HashMap<>();
            Set<Long> ids = new LinkedHashSet<>();
            for (YqTaskKeyword relation : relations) {
                if (relation.getKeywordId() == null) {
                    continue;
                }
                ids.add(relation.getKeywordId());
                if (StringUtils.isNotBlank(relation.getMatchStrategy())) {
                    strategy.put(relation.getKeywordId(), relation.getMatchStrategy());
                }
            }
            if (!ids.isEmpty()) {
                for (YqKeyword keyword : keywordMapper.selectByIds(ids)) {
                    if (!STATUS_ENABLED.equals(keyword.getStatus())) {
                        continue;
                    }
                    if (NEGATIVE_TYPE.equalsIgnoreCase(keyword.getKeywordType())) {
                        excludeTerms.addAll(splitTerms(keyword.getKeywordText()));
                        if (StringUtils.isNotBlank(keyword.getComboExpression())) {
                            excludeTerms.addAll(negativesOf(keyword.getComboExpression()));
                        }
                        continue;
                    }
                    specs.add(toSpec(keyword, strategy.get(keyword.getKeywordId()), conf.getSearchGroup()));
                }
            }
        }
        KeywordMatcher matcher = KeywordMatcher.builder()
            .specs(specs)
            .excludeTerms(conf.isExcludeEnabled() ? excludeTerms : new ArrayList<>())
            .rules(conf.isApplyGlobalNoise() ? loadGlobalNoise(conf.getMaxExcludeRules()) : new ArrayList<>())
            .searchGroup(conf.getSearchGroup())
            .maxSearchTerms(conf.getMaxSearchTermsPerUnit())
            .build();
        if (!matcher.getParseErrors().isEmpty()) {
            log.warn("[采集调度] 任务 {} 存在无法解析的关键词表达式：{}", taskId, matcher.getParseErrors());
        }
        return matcher;
    }

    /**
     * 关键词 → 采集规格。
     *
     * @param keyword       关键词
     * @param matchStrategy 任务级匹配策略（可为空）
     * @param searchGroup   检索词组选择策略
     * @return 规格；解析失败时返回带 parseError 的规格
     */
    private KeywordSpec toSpec(YqKeyword keyword, String matchStrategy, String searchGroup) {
        String text = keyword.getKeywordText();
        String expression = StringUtils.isNotBlank(keyword.getComboExpression())
            ? keyword.getComboExpression() : text;
        boolean combo = COMBO_TYPE.equalsIgnoreCase(keyword.getKeywordType())
            || StringUtils.isNotBlank(keyword.getComboExpression())
            || KeywordExpression.looksLikeExpression(expression);
        if (!combo) {
            /* 普通词：只做检索，不做本地过滤 —— 搜索引擎会做分词扩召回，
               强行要求原文包含该词会误杀大量真实命中。 */
            KeywordSpec spec = KeywordSpec.simple(text);
            spec.setKeywordId(keyword.getKeywordId());
            spec.setKeywordType(keyword.getKeywordType());
            spec.setKeywordCategory(keyword.getKeywordCategory());
            spec.setMatchStrategy(matchStrategy);
            return spec;
        }
        try {
            KeywordExpression parsed = KeywordExpression.parse(expression);
            KeywordSpec spec = KeywordSpec.fromExpression(keyword.getKeywordId(), text,
                keyword.getKeywordType(), keyword.getKeywordCategory(), parsed, searchGroup);
            spec.setMatchStrategy(matchStrategy);
            KeywordSpec.FilterMode mode = filterModeOf(matchStrategy);
            if (mode != null) {
                spec.setFilterMode(mode);
            }
            return spec;
        } catch (KeywordExpressionException e) {
            return KeywordSpec.failed(keyword.getKeywordId(), expression, e.getMessage());
        }
    }

    /**
     * 任务级匹配策略 → 过滤强度；无法识别返回 null 表示沿用默认。
     */
    private KeywordSpec.FilterMode filterModeOf(String matchStrategy) {
        if (StringUtils.isBlank(matchStrategy)) {
            return null;
        }
        String value = matchStrategy.trim().toLowerCase();
        return switch (value) {
            case "strict", "combo", "exact", "precise" -> KeywordSpec.FilterMode.STRICT;
            case "loose", "any" -> KeywordSpec.FilterMode.LOOSE;
            case "off", "none", "fuzzy" -> KeywordSpec.FilterMode.OFF;
            default -> null;
        };
    }

    /**
     * 全局降噪规则（默认不启用；深度降噪归 F-006）。
     */
    private List<ExcludeRule> loadGlobalNoise(int maxRules) {
        int limit = Math.max(1, maxRules);
        List<YqNoiseRule> rules = noiseRuleMapper.selectList(new LambdaQueryWrapper<YqNoiseRule>()
            .eq(YqNoiseRule::getStatus, STATUS_ENABLED)
            .orderByAsc(YqNoiseRule::getPriority)
            .last("limit " + limit));
        List<ExcludeRule> result = new ArrayList<>(rules.size());
        for (YqNoiseRule rule : rules) {
            if (StringUtils.isBlank(rule.getMatchValue())) {
                continue;
            }
            result.add(MATCH_TYPE_REGEX.equalsIgnoreCase(rule.getMatchType())
                ? ExcludeRule.regex(rule.getRuleName(), rule.getMatchValue())
                : ExcludeRule.keyword(rule.getRuleName(), rule.getMatchValue()));
        }
        return result;
    }

    /**
     * 排除词文本拆分为多条（支持 {@code 招聘|广告} 这类一行多词写法）。
     */
    private List<String> splitTerms(String text) {
        List<String> result = new ArrayList<>();
        if (StringUtils.isBlank(text)) {
            return result;
        }
        for (String part : text.split("[|,;，、；\\s]+")) {
            String word = part.trim();
            if (!word.isEmpty() && !result.contains(word)) {
                result.add(word);
            }
        }
        return result;
    }

    /**
     * 取组合表达式里的排除词（容错：解析失败不阻塞其它关键词）。
     */
    private List<String> negativesOf(String expression) {
        try {
            return KeywordExpression.parse(expression).getExcludes();
        } catch (KeywordExpressionException e) {
            return new ArrayList<>();
        }
    }

    private Map<Long, YqChannel> loadChannels(List<YqTaskChannel> relations) {
        Set<Long> ids = relations.stream().map(YqTaskChannel::getChannelId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, YqChannel> map = new LinkedHashMap<>();
        for (YqChannel channel : channelMapper.selectByIds(ids)) {
            map.put(channel.getChannelId(), channel);
        }
        return map;
    }

    private Map<Long, List<Long>> groupTaskChannels(List<Long> taskIds) {
        if (taskIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return taskChannelMapper.selectList(new LambdaQueryWrapper<YqTaskChannel>()
                .in(YqTaskChannel::getTaskId, taskIds))
            .stream()
            .collect(Collectors.groupingBy(YqTaskChannel::getTaskId,
                Collectors.mapping(YqTaskChannel::getChannelId, Collectors.toList())));
    }

    /**
     * 回写渠道最近采集时间（增量水位线）。
     */
    private void touchChannel(Long channelId) {
        if (channelId == null) {
            return;
        }
        try {
            YqChannel update = new YqChannel();
            update.setChannelId(channelId);
            update.setLastCollectTime(LocalDateTime.now());
            channelMapper.updateById(update);
        } catch (Exception e) {
            log.warn("[采集调度] 回写渠道最近采集时间失败 channel={}: {}", channelId, e.getMessage());
        }
    }

    /**
     * 回写任务最近调度时间。
     */
    private void touchTask(Long taskId) {
        if (taskId == null) {
            return;
        }
        try {
            YqTask update = new YqTask();
            update.setTaskId(taskId);
            update.setLastScheduleTime(LocalDateTime.now());
            taskMapper.updateById(update);
        } catch (Exception e) {
            log.warn("[采集调度] 回写任务最近调度时间失败 task={}: {}", taskId, e.getMessage());
        }
    }

    private String newBatchNo() {
        return "B" + LocalDateTime.now().format(BATCH_FORMAT) + "-"
            + String.format("%03d", ThreadLocalRandom.current().nextInt(1, 1000));
    }
}
