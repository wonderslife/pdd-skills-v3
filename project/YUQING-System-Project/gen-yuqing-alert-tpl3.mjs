/**
 * F-010 / F-011 服务层 + 控制器 + 定时任务模板
 */
export const WEB_TPL = [

  /* ------------------------------------------------------------ Bean 装配 */
  {
    rel: 'alert/config/YqAlertConfig.java',
    content: `package org.dromara.yuqing.alert.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.push.HttpWecomTransport;
import org.dromara.yuqing.push.LoggingWecomTransport;
import org.dromara.yuqing.push.WecomTokenHolder;
import org.dromara.yuqing.push.WecomTransport;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 推送通道装配（F-011）
 *
 * <p>三条分支，优先级从高到低：</p>
 * <ol>
 *   <li>{@code push.dryRun=true} → 演练通道（按成功留痕，不打扰真实用户）</li>
 *   <li>凭据齐全 → 真实 HTTP 通道</li>
 *   <li>凭据缺失 → 日志通道，<b>并把结果标记为失败</b>（绝不静默假成功）</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class YqAlertConfig {

    private final YqAlertProperties props;

    @Bean
    public WecomTransport wecomTransport() {
        if (!props.getPush().isEnabled()) {
            log.warn("[推送] push.enabled=false，推送通道以日志通道装配（所有推送将标记为 skipped）");
            return new LoggingWecomTransport();
        }
        if (props.getPush().isDryRun()) {
            log.warn("[推送] 演练模式开启（push.dryRun=true），不会真正发送企业微信消息");
            return LoggingWecomTransport.dryRun();
        }
        if (!props.wecomConfigured()) {
            log.warn("[推送] 企业微信凭据未配置，通道降级为日志；推送记录将标记 failed，"
                + "请补齐 yuqing.alert.push.corpId / corpSecret / agentId");
            return new LoggingWecomTransport();
        }
        return new HttpWecomTransport(props, new WecomTokenHolder(props));
    }
}
`,
  },

  /* -------------------------------------------------------------- 请求 DTO */
  {
    rel: 'alert/AlertScanRequest.java',
    content: `package org.dromara.yuqing.alert;

import lombok.Data;

/**
 * 预警扫描请求（手动扫描 / 预览共用）
 *
 * @author ruoyi
 */
@Data
public class AlertScanRequest {

    /** 任务过滤，为空表示全部任务 */
    private Long taskId;

    /** 覆盖扫描窗口长度（分钟），为空取配置值 */
    private Integer windowMinutes;

    /** 仅预览不落库 */
    private boolean dryRun;

    /** 命中的预警是否需要立即推送（默认 true） */
    private boolean pushAfterCreate = true;
}
`,
  },

  {
    rel: 'alert/AlertScanStats.java',
    content: `package org.dromara.yuqing.alert;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 预警扫描结果（F-010 验收标准 3 / 10）
 *
 * @author ruoyi
 */
@Data
public class AlertScanStats {

    /** 扫描窗口（分钟） */
    private int windowMinutes;

    /** 是否仅预览 */
    private boolean dryRun;

    /** 启用的规则数 */
    private int ruleCount;

    /** 窗口内载入的候选舆情数 */
    private int scanned;

    /** 因「已预警过 / 冷却期内」被抑制的条数 */
    private int suppressed;

    /** 判定出的预警条数 */
    private int decisionCount;

    /** 实际落库的预警条数 */
    private int created;

    /** 新建预警 ID */
    private List<Long> alertIds = new ArrayList<>();

    /** 说明信息 */
    private String message;

    /** 逐条判定摘要（预览时给人看） */
    private List<String> details = new ArrayList<>();
}
`,
  },

  {
    rel: 'push/PushStats.java',
    content: `package org.dromara.yuqing.push;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 推送执行统计（F-011 验收标准 9）
 *
 * @author ruoyi
 */
@Data
public class PushStats {

    /** 处理的推送请求数 */
    private int attempted;

    /** 发送成功 */
    private int sent;

    /** 发送失败（含凭据缺失、目标无法映射） */
    private int failed;

    /** 免打扰顺延 */
    private int deferred;

    /** 跳过（开关关闭 / 无匹配规则） */
    private int skipped;

    /** 落库的推送记录 ID */
    private List<Long> recordIds = new ArrayList<>();

    /** 逐条结果摘要 */
    private List<String> details = new ArrayList<>();

    public void add(PushOutcome o) {
        attempted++;
        if (PushOutcome.SENT.equals(o.getKind())) {
            if (o.isSuccess()) {
                sent++;
            } else {
                failed++;
            }
        } else if (PushOutcome.DEFERRED.equals(o.getKind())) {
            deferred++;
        } else {
            skipped++;
        }
    }
}
`,
  },

  /* -------------------------------------------------------- 预警调度服务 */
  {
    rel: 'service/IYqAlertDispatchService.java',
    content: `package org.dromara.yuqing.service;

import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.domain.YqAlert;

import java.time.LocalDate;
import java.util.Map;

/**
 * 预警调度服务（F-010）
 *
 * @author ruoyi
 */
public interface IYqAlertDispatchService {

    /** 执行一次预警扫描（落库） */
    AlertScanStats scan(AlertScanRequest request);

    /** 仅预览，不落库 */
    AlertScanStats preview(AlertScanRequest request);

    /**
     * 处置一条预警（F-010 验收标准 5 / 6）
     *
     * @param bo         仅取 alertId / status / processRemark
     * @param operatorId 处置人（由 Controller 从 Sa-Token 取，不信请求体）
     * @return 是否更新成功
     */
    boolean process(YqAlert bo, Long operatorId);

    /** 未处置计数（含需醒目提示的条数，F-010 验收标准 8） */
    Map<String, Object> pendingCount();

    /** 按时间与级别统计（F-010 验收标准 10） */
    Map<String, Object> statistics(LocalDate from, LocalDate to);
}
`,
  },

  {
    rel: 'service/impl/YqAlertDispatchServiceImpl.java',
    content: `package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.alert.AlertDecision;
import org.dromara.yuqing.alert.AlertEngine;
import org.dromara.yuqing.alert.AlertRuleSpec;
import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.alert.AlertStatusMachine;
import org.dromara.yuqing.alert.YqOpinionReader;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.domain.YqAlertRule;
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.mapper.YqAlertMapper;
import org.dromara.yuqing.mapper.YqAlertRuleMapper;
import org.dromara.yuqing.mapper.YqChannelMapper;
import org.dromara.yuqing.service.IYqAlertDispatchService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 预警调度服务实现（F-010）
 *
 * <p><b>数据流：</b>{@code yq_opinion(Doris, @DS 由 YqOpinionReader 承担)}
 * → 载入候选 → {@link AlertEngine} 判定 → 落 {@code yq_alert(主库)}。</p>
 *
 * <p><b>为什么不在 Doris 侧回写 {@code alert_flag}：</b>按《技术架构说明》§4.6，
 * yq_opinion 业务侧只读，写入统一走采集/研判 Worker 的 Stream Load。
 * 因此「已预警过的不再重复预警」改为反查 {@code yq_alert.opinion_id}，
 * 保证 Doris 只有一个写入口。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqAlertDispatchServiceImpl implements IYqAlertDispatchService {

    private final YqAlertProperties props;
    private final AlertEngine alertEngine;
    private final YqOpinionReader opinionReader;
    private final YqAlertMapper alertMapper;
    private final YqAlertRuleMapper alertRuleMapper;
    private final YqChannelMapper channelMapper;

    @Override
    public AlertScanStats preview(AlertScanRequest request) {
        AlertScanRequest req = request == null ? new AlertScanRequest() : request;
        req.setDryRun(true);
        return scan(req);
    }

    @Override
    public AlertScanStats scan(AlertScanRequest request) {
        AlertScanRequest req = request == null ? new AlertScanRequest() : request;
        AlertScanStats stats = new AlertScanStats();
        stats.setDryRun(req.isDryRun());
        if (!props.isEnabled()) {
            stats.setMessage("预警引擎总开关（yuqing.alert.enabled）已关闭");
            return stats;
        }
        int window = req.getWindowMinutes() != null && req.getWindowMinutes() > 0
            ? req.getWindowMinutes() : props.getScanWindowMinutes();
        stats.setWindowMinutes(window);

        LocalDateTime now = LocalDateTime.now();
        List<AlertRuleSpec> rules = loadRules();
        stats.setRuleCount(rules.size());
        if (rules.isEmpty()) {
            stats.setMessage("没有启用的预警规则，请先在「预警规则」中配置并启用");
            return stats;
        }

        List<AlertCandidate> candidates = opinionReader.loadCandidates(
            req.getTaskId(), now.minusMinutes(window), now, props.getMaxScanRecords());
        fillChannelNames(candidates);
        stats.setScanned(candidates.size());
        if (candidates.isEmpty()) {
            stats.setMessage("窗口 " + window + " 分钟内没有新增舆情");
            return stats;
        }

        int maxCooldown = rules.stream()
            .mapToInt(r -> r.safeCooldownMinutes(props.getDefaultCooldownMinutes()))
            .max().orElse(props.getDefaultCooldownMinutes());
        Set<String> cooled = loadCooledFingerprints(now.minusMinutes(maxCooldown));
        // yq_opinion 只读，用 yq_alert 反查已预警舆情
        Set<Long> alerted = loadAlertedOpinionIds(now.minusMinutes(window));
        List<AlertCandidate> fresh = new ArrayList<>(candidates.size());
        for (AlertCandidate c : candidates) {
            if (c.getOpinionId() != null && alerted.contains(c.getOpinionId())) {
                continue;
            }
            fresh.add(c);
        }
        stats.setSuppressed(candidates.size() - fresh.size());

        List<AlertDecision> decisions = alertEngine.evaluate(fresh, rules, cooled, now);
        stats.setDecisionCount(decisions.size());
        for (AlertDecision d : decisions) {
            stats.getDetails().add("[" + d.getScene() + "|" + d.getAlertLevel() + "] "
                + d.getAlertTitle() + " —— " + d.getTriggerValue());
        }
        if (req.isDryRun()) {
            stats.setMessage("预览完成：命中 " + decisions.size() + " 条（未落库）");
            return stats;
        }

        List<Long> created = new ArrayList<>(decisions.size());
        for (AlertDecision d : decisions) {
            YqAlert entity = toEntity(d, now);
            try {
                if (alertMapper.insert(entity) > 0) {
                    created.add(entity.getAlertId());
                }
            } catch (Exception e) {
                // 单条失败不影响整批：记录并继续（与 F-006 重跑同一套 fail-soft 口径）
                log.error("[预警] 落库失败 scene={} opinionId={}: {}", d.getScene(), d.getOpinionId(), e.getMessage());
            }
        }
        stats.setCreated(created.size());
        stats.setAlertIds(created);
        stats.setMessage("扫描完成：候选 " + candidates.size() + " 条，命中 " + decisions.size()
            + " 条，落库 " + created.size() + " 条");
        log.info("[预警] {}", stats.getMessage());
        return stats;
    }

    @Override
    public boolean process(YqAlert bo, Long operatorId) {
        if (bo == null || bo.getAlertId() == null) {
            throw new ServiceException("预警ID不能为空");
        }
        YqAlert db = alertMapper.selectById(bo.getAlertId());
        if (db == null) {
            throw new ServiceException("预警记录不存在或已被删除");
        }
        String target = bo.getStatus();
        if (!AlertStatusMachine.canTransit(db.getStatus(), target)) {
            throw new ServiceException("不允许的处置流转：" + db.getStatus() + " → " + target);
        }
        YqAlert update = new YqAlert();
        update.setAlertId(db.getAlertId());
        update.setStatus(target);
        update.setProcessRemark(bo.getProcessRemark());
        // 状态机硬校验：已处置必须填说明（验收标准 6）
        AlertStatusMachine.validate(update, String.valueOf(operatorId));
        update.setProcessBy(operatorId);
        update.setProcessTime(LocalDateTime.now());
        return alertMapper.updateById(update) > 0;
    }

    @Override
    public Map<String, Object> pendingCount() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pending", countByStatus(AlertStatusMachine.PENDING));
        out.put("processing", countByStatus(AlertStatusMachine.PROCESSING));
        out.put("highlightPending", countHighlightPending());
        return out;
    }

    @Override
    public Map<String, Object> statistics(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (start.isAfter(end)) {
            throw new ServiceException("开始日期不能晚于结束日期");
        }
        LocalDateTime fromTime = start.atStartOfDay();
        LocalDateTime toTime = end.plusDays(1).atStartOfDay();

        List<YqAlert> rows = alertMapper.selectList(new LambdaQueryWrapper<YqAlert>()
            .ge(YqAlert::getTriggerTime, fromTime)
            .lt(YqAlert::getTriggerTime, toTime));

        Map<String, Integer> byLevel = new LinkedHashMap<>();
        Map<String, Integer> byScene = new LinkedHashMap<>();
        Map<String, Integer> byStatus = new LinkedHashMap<>();
        Map<String, Integer> byPush = new LinkedHashMap<>();
        for (YqAlert a : rows) {
            bump(byLevel, nvl(a.getAlertLevel(), "未分级"));
            bump(byScene, nvl(a.getTriggerScene(), "未知场景"));
            bump(byStatus, nvl(a.getStatus(), AlertStatusMachine.PENDING));
            bump(byPush, nvl(a.getPushResult(), "未推送"));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", start.toString());
        out.put("to", end.toString());
        out.put("total", rows.size());
        out.put("byLevel", byLevel);
        out.put("byScene", byScene);
        out.put("byStatus", byStatus);
        out.put("byPushResult", byPush);
        out.put("handledRate", rows.isEmpty() ? 0.0d
            : round(rows.stream().filter(a -> AlertStatusMachine.HANDLED.equals(a.getStatus())).count()
                / (double) rows.size()));
        return out;
    }

    /* ------------------------------------------------------------------ 内部 */

    private List<AlertRuleSpec> loadRules() {
        List<YqAlertRule> rules = alertRuleMapper.selectList(new LambdaQueryWrapper<YqAlertRule>()
            .eq(YqAlertRule::getStatus, "0"));
        if (rules == null || rules.isEmpty()) {
            return new ArrayList<>();
        }
        return rules.stream()
            .map(r -> AlertRuleSpec.from(r, props.getDefaultBurstRatio(),
                props.getMinBurstCount(), props.getDefaultCooldownMinutes()))
            .filter(AlertRuleSpec::enabled)
            .sorted(Comparator.comparing(r -> r.getRuleId() == null ? 0L : r.getRuleId()))
            .collect(Collectors.toList());
    }

    private Set<String> loadCooledFingerprints(LocalDateTime since) {
        List<YqAlert> rows = alertMapper.selectList(new LambdaQueryWrapper<YqAlert>()
            .ge(YqAlert::getTriggerTime, since)
            .isNotNull(YqAlert::getFingerprint)
            .in(YqAlert::getStatus, AlertStatusMachine.PENDING, AlertStatusMachine.PROCESSING));
        Set<String> out = new LinkedHashSet<>();
        if (rows != null) {
            for (YqAlert a : rows) {
                if (a.getFingerprint() != null && !a.getFingerprint().isBlank()) {
                    out.add(a.getFingerprint());
                }
            }
        }
        return out;
    }

    private Set<Long> loadAlertedOpinionIds(LocalDateTime since) {
        List<YqAlert> rows = alertMapper.selectList(new LambdaQueryWrapper<YqAlert>()
            .ge(YqAlert::getTriggerTime, since)
            .isNotNull(YqAlert::getOpinionId)
            .select(YqAlert::getOpinionId));
        Set<Long> out = new LinkedHashSet<>();
        if (rows != null) {
            for (YqAlert a : rows) {
                if (a.getOpinionId() != null) {
                    out.add(a.getOpinionId());
                }
            }
        }
        return out;
    }

    private void fillChannelNames(List<AlertCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        Set<Long> ids = candidates.stream().map(AlertCandidate::getChannelId)
            .filter(Objects::nonNull).collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return;
        }
        Map<Long, String> names = channelMapper.selectByIds(ids).stream()
            .collect(Collectors.toMap(YqChannel::getChannelId, YqChannel::getChannelName, (a, b) -> a));
        for (AlertCandidate c : candidates) {
            if (c.getChannelId() != null) {
                c.setChannelName(names.get(c.getChannelId()));
            }
        }
    }

    private YqAlert toEntity(AlertDecision d, LocalDateTime now) {
        YqAlert e = new YqAlert();
        e.setRuleId(d.getRuleId());
        e.setOpinionId(d.getOpinionId());
        e.setClusterId(d.getClusterId());
        e.setAlertTitle(d.getAlertTitle());
        e.setTriggerScene(d.getScene());
        e.setAlertLevel(d.getAlertLevel());
        e.setTriggerValue(d.getTriggerValue());
        e.setFingerprint(d.getFingerprint());
        e.setTriggerTime(now);
        e.setStatus(AlertStatusMachine.PENDING);
        return e;
    }

    private long countByStatus(String status) {
        Long n = alertMapper.selectCount(new LambdaQueryWrapper<YqAlert>()
            .eq(YqAlert::getStatus, status));
        return n == null ? 0L : n;
    }

    private long countHighlightPending() {
        List<String> levels = new ArrayList<>();
        for (String part : nz(props.getHighlightLevels()).split("[,，\\s]+")) {
            if (!part.isBlank()) {
                levels.add(part.trim());
            }
        }
        if (levels.isEmpty()) {
            return 0L;
        }
        Long n = alertMapper.selectCount(new LambdaQueryWrapper<YqAlert>()
            .eq(YqAlert::getStatus, AlertStatusMachine.PENDING)
            .in(YqAlert::getAlertLevel, levels));
        return n == null ? 0L : n;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static void bump(Map<String, Integer> map, String key) {
        map.merge(key, 1, Integer::sum);
    }

    private static String nvl(String s, String dft) {
        return (s == null || s.isBlank()) ? dft : s;
    }

    private static double round(double v) {
        return Math.round(v * 10000d) / 10000d;
    }
}
`,
  },

  /* -------------------------------------------------------- 推送调度服务 */
  {
    rel: 'service/IYqPushDispatchService.java',
    content: `package org.dromara.yuqing.service;

import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.push.PushStats;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 推送调度服务（F-011）
 *
 * @author ruoyi
 */
public interface IYqPushDispatchService {

    /**
     * 把指定预警推送到配置对象（场景由预警级别映射）
     *
     * @param alertIds 预警 ID
     */
    PushStats pushAlerts(Collection<Long> alertIds);

    /**
     * 通用批量推送（摘要式采集概况 / 报告文件）
     *
     * @param scene     推送场景
     * @param taskName  任务名（摘要标题用）
     * @param total     采集总数
     * @param negative  负面条数
     * @param neutral   中性条数
     * @param deduped   去重后条数
     * @param negatives 负面明细
     * @param reportId  报告 ID（report_ready 场景）
     * @param fileName  报告文件名
     * @param fileBytes 报告内容
     */
    PushStats pushBatch(String scene, String taskName, int total, int negative, int neutral, int deduped,
                        List<AlertCandidate> negatives, Long reportId, String fileName, byte[] fileBytes);

    /**
     * 重发一条失败记录（F-011 验收标准 8）
     *
     * @param recordId 推送记录 ID
     */
    PushStats retry(Long recordId);

    /**
     * 刷出免打扰顺延的定时批量（F-011 验收标准 1 / 3）
     *
     * @return 本次实际发送条数
     */
    int flushScheduled();

    /** 按时间与对象统计推送量与成功率（F-011 验收标准 9） */
    Map<String, Object> statistics(LocalDate from, LocalDate to);
}
`,
  },

  {
    rel: 'service/impl/YqPushDispatchServiceImpl.java',
    content: `package org.dromara.yuqing.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.domain.YqPushRecord;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.domain.YqPushTemplate;
import org.dromara.yuqing.mapper.YqAlertMapper;
import org.dromara.yuqing.mapper.YqPushRecordMapper;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import org.dromara.yuqing.mapper.YqPushTemplateMapper;
import org.dromara.yuqing.push.PushDispatcher;
import org.dromara.yuqing.push.PushOutcome;
import org.dromara.yuqing.push.PushRequest;
import org.dromara.yuqing.push.PushScene;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.push.PushTemplateRenderer;
import org.dromara.yuqing.push.PushTargetResolver;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 推送调度服务实现（F-011）
 *
 * <p><b>关键约定：</b></p>
 * <ul>
 *   <li>无论成功、失败还是免打扰顺延，<b>都写一条 {@code yq_push_record}</b>——
 *       推送记录是事后追责与成功率统计的唯一凭据，不能只记成功。</li>
 *   <li>失败记录保持 {@code failed} 并写入具体原因，由前端标红；不自动删除、不静默改成功。</li>
 *   <li>推送内容快照取最终下发的正文（已截断），便于复现「当时到底发了什么」。</li>
 * </ul>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqPushDispatchServiceImpl implements IYqPushDispatchService {

    private final YqAlertProperties props;
    private final PushDispatcher dispatcher;
    private final PushTemplateRenderer renderer;
    private final PushTargetResolver targetResolver;
    private final YqPushRuleMapper pushRuleMapper;
    private final YqPushTemplateMapper pushTemplateMapper;
    private final YqPushRecordMapper pushRecordMapper;
    private final YqAlertMapper alertMapper;

    @Override
    public PushStats pushAlerts(Collection<Long> alertIds) {
        PushStats stats = new PushStats();
        if (alertIds == null || alertIds.isEmpty()) {
            return stats;
        }
        List<YqAlert> alerts = alertMapper.selectByIds(alertIds);
        if (alerts == null || alerts.isEmpty()) {
            return stats;
        }
        List<YqPushRule> rules = enabledRules();
        if (rules.isEmpty()) {
            stats.getDetails().add("没有启用的推送规则");
            return stats;
        }
        for (YqAlert alert : alerts) {
            String scene = YqPushDispatchServiceImpl.pushSceneOf(alert);
            String level = defaultPushLevel(alert);
            List<YqPushRule> matched = matchRules(rules, scene, level);
            if (matched.isEmpty()) {
                stats.getDetails().add("预警 " + alert.getAlertId() + " 无匹配推送规则（场景 " + scene + "）");
                stats.setSkipped(stats.getSkipped() + 1);
                continue;
            }
            AlertCandidate candidate = candidateOf(alert);
            PushStats perAlert = new PushStats();
            for (YqPushRule rule : matched) {
                PushRequest req = buildRequest(rule, scene, level, candidate, null, null, null, alert);
                merge(perAlert, execute(req, rule));
            }
            // 回写预警的推送结果（验收标准 10）——按「本条预警」的结果回写，不混入其它预警
            writeBackAlertResult(alert, perAlert);
            merge(stats, perAlert);
        }
        return stats;
    }

    @Override
    public PushStats pushBatch(String scene, String taskName, int total, int negative, int neutral, int deduped,
                               List<AlertCandidate> negatives, Long reportId, String fileName, byte[] fileBytes) {
        PushStats stats = new PushStats();
        if (!PushScene.isKnown(scene)) {
            throw new ServiceException("未知推送场景: " + scene);
        }
        List<YqPushRule> rules = enabledRules();
        List<YqPushRule> matched = matchRules(rules, scene, null);
        if (matched.isEmpty()) {
            stats.getDetails().add("场景 " + scene + " 无匹配推送规则");
            return stats;
        }
        LocalDateTime now = LocalDateTime.now();
        for (YqPushRule rule : matched) {
            String content;
            String msgType = "text";
            String contentType = contentTypeOf(rule);
            if (PushScene.REPORT_READY.equals(scene)) {
                msgType = "file";
                content = renderer.renderSummary(taskName, total, negative, neutral, deduped, negatives, now);
            } else if ("summary".equals(contentType)) {
                content = renderer.renderSummary(taskName, total, negative, neutral, deduped, negatives, now);
            } else {
                AlertCandidate first = (negatives == null || negatives.isEmpty()) ? null : negatives.get(0);
                content = renderer.renderDetail(first, null, now);
            }
            PushRequest req = buildRequest(rule, scene, rule.getPushLevel(), null, content, fileName, fileBytes, null);
            req.setMsgType(msgType);
            if (reportId != null) {
                req.setReportId(reportId);
            }
            if (negatives != null) {
                List<Long> ids = new ArrayList<>();
                for (AlertCandidate c : negatives) {
                    if (c.getOpinionId() != null) {
                        ids.add(c.getOpinionId());
                    }
                }
                req.setOpinionIds(ids);
            }
            req.setCandidates(negatives);
            merge(stats, execute(req, rule));
        }
        return stats;
    }

    @Override
    public PushStats retry(Long recordId) {
        PushStats stats = new PushStats();
        if (recordId == null) {
            throw new ServiceException("推送记录ID不能为空");
        }
        YqPushRecord record = pushRecordMapper.selectById(recordId);
        if (record == null) {
            throw new ServiceException("推送记录不存在");
        }
        if ("success".equals(record.getSendStatus())) {
            throw new ServiceException("该记录已发送成功，无需重发");
        }
        PushRequest req = PushRequest.builder()
            .scene(record.getPushScene())
            .pushLevel(record.getPushLevel())
            .ruleId(record.getRuleId())
            .content(record.getContentSnapshot())
            .contentType("detail")
            .msgType("text")
            .targetUserIds(parseIds(record.getTargetIds()))
            .maxRetry(props.getPush().getMaxRetry())
            .now(LocalDateTime.now())
            .build();
        applyQuietFromRule(req, record.getRuleId());
        req.setHighPriority("immediate".equals(record.getPushLevel()));
        PushOutcome outcome = dispatcher.dispatch(req);
        record.setSendStatus(outcome.getSendStatus());
        record.setFailReason(outcome.getReason());
        record.setRetryCount((record.getRetryCount() == null ? 0 : record.getRetryCount()) + outcome.getRetryCount() + 1);
        record.setSendTime(LocalDateTime.now());
        pushRecordMapper.updateById(record);
        stats.add(outcome);
        stats.getRecordIds().add(record.getRecordId());
        stats.getDetails().add("重发记录 " + recordId + " → " + outcome.getSendStatus()
            + (outcome.getReason() == null ? "" : "（" + outcome.getReason() + "）"));
        return stats;
    }

    @Override
    public int flushScheduled() {
        List<YqPushRecord> pendings = pushRecordMapper.selectList(new LambdaQueryWrapper<YqPushRecord>()
            .eq(YqPushRecord::getSendStatus, "pending")
            .eq(YqPushRecord::getPushLevel, "scheduled")
            .orderByAsc(YqPushRecord::getRecordId)
            .last("limit 200"));
        if (pendings == null || pendings.isEmpty()) {
            return 0;
        }
        LocalTime now = LocalTime.now();
        int sent = 0;
        for (YqPushRecord record : pendings) {
            PushRequest req = PushRequest.builder()
                .scene(record.getPushScene())
                .pushLevel("scheduled")
                .ruleId(record.getRuleId())
                .content(record.getContentSnapshot())
                .contentType("detail")
                .msgType("text")
                .targetUserIds(parseIds(record.getTargetIds()))
                .maxRetry(props.getPush().getMaxRetry())
                .now(LocalDateTime.now())
                .build();
            applyQuietFromRule(req, record.getRuleId());
            if (!dispatcher.canFlushNow(req.getQuietStart(), req.getQuietEnd(), now)) {
                continue; // 仍在免打扰时段，留到下个节拍
            }
            PushOutcome outcome = dispatcher.dispatch(req);
            record.setSendStatus(outcome.getSendStatus());
            record.setFailReason(outcome.getReason());
            record.setSendTime(LocalDateTime.now());
            pushRecordMapper.updateById(record);
            if (outcome.isSuccess()) {
                sent++;
            }
        }
        if (sent > 0) {
            log.info("[推送] 定时批量刷出 {} 条", sent);
        }
        return sent;
    }

    @Override
    public Map<String, Object> statistics(LocalDate from, LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (start.isAfter(end)) {
            throw new ServiceException("开始日期不能晚于结束日期");
        }
        List<YqPushRecord> rows = pushRecordMapper.selectList(new LambdaQueryWrapper<YqPushRecord>()
            .ge(YqPushRecord::getCreateTime, start.atStartOfDay())
            .lt(YqPushRecord::getCreateTime, end.plusDays(1).atStartOfDay()));
        Map<String, Integer> byStatus = new LinkedHashMap<>();
        Map<String, Integer> byScene = new LinkedHashMap<>();
        Map<String, Integer> byRule = new LinkedHashMap<>();
        int success = 0;
        for (YqPushRecord r : rows) {
            byStatus.merge(nvl(r.getSendStatus(), "unknown"), 1, Integer::sum);
            byScene.merge(nvl(r.getPushScene(), "unknown"), 1, Integer::sum);
            byRule.merge(nvl(r.getRuleName(), r.getRuleId() == null ? "未绑定规则" : String.valueOf(r.getRuleId())), 1, Integer::sum);
            if ("success".equals(r.getSendStatus())) {
                success++;
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", start.toString());
        out.put("to", end.toString());
        out.put("total", rows.size());
        out.put("success", success);
        out.put("failed", rows.size() - success);
        out.put("successRate", rows.isEmpty() ? 0.0d : Math.round(success * 10000d / rows.size()) / 10000d);
        out.put("byStatus", byStatus);
        out.put("byScene", byScene);
        out.put("byRule", byRule);
        return out;
    }

    /* ------------------------------------------------------------------ 内部 */

    private List<YqPushRule> enabledRules() {
        List<YqPushRule> rules = pushRuleMapper.selectList(new LambdaQueryWrapper<YqPushRule>()
            .eq(YqPushRule::getStatus, "0"));
        return rules == null ? new ArrayList<>() : rules;
    }

    /** 场景 + 级别 双重匹配（级别为空时只匹配场景） */
    private List<YqPushRule> matchRules(List<YqPushRule> rules, String scene, String level) {
        List<YqPushRule> out = new ArrayList<>();
        if (rules == null) {
            return out;
        }
        for (YqPushRule r : rules) {
            if (!PushScene.contains(r.getPushScenes(), scene)) {
                continue;
            }
            if (level != null && r.getPushLevel() != null && !level.equals(r.getPushLevel())) {
                continue;
            }
            out.add(r);
        }
        return out;
    }

    private PushRequest buildRequest(YqPushRule rule, String scene, String level, AlertCandidate candidate,
                                     String presetContent, String fileName, byte[] fileBytes, YqAlert alert) {
        LocalDateTime now = LocalDateTime.now();
        String content = presetContent;
        if (content == null) {
            String template = templateBodyOf(rule);
            if (template != null && !template.isBlank()) {
                Map<String, String> vars = new LinkedHashMap<>();
                if (candidate != null) {
                    vars.put("title", candidate.getTitle());
                    vars.put("level", candidate.getOpinionLevel());
                    vars.put("channel", candidate.getChannelName());
                    vars.put("content", candidate.getContent());
                    vars.put("url", candidate.getOpinionUrl());
                }
                vars.put("pushTime", now.toString());
                content = renderer.applyTemplate(template, vars);
            } else {
                content = renderer.renderDetail(candidate, alert == null ? level : alert.getAlertLevel(), now);
            }
        }
        Set<Long> targets = targetResolver.resolve(rule.getTargetType(), rule.getTargetIds());
        PushRequest req = PushRequest.builder()
            .scene(scene)
            .pushLevel(level == null ? rule.getPushLevel() : level)
            .ruleId(rule.getRuleId())
            .ruleName(rule.getRuleName())
            .content(content)
            .fileName(fileName)
            .fileBytes(fileBytes)
            .contentType(contentTypeOf(rule))
            .msgType(fileBytes == null || fileBytes.length == 0 ? "text" : "file")
            .targetUserIds(targets)
            .maxRetry(rule.getMaxRetry() == null ? props.getPush().getMaxRetry() : rule.getMaxRetry())
            .quietStart(rule.getQuietStart())
            .quietEnd(rule.getQuietEnd())
            .now(now)
            .highPriority("immediate".equals(level == null ? rule.getPushLevel() : level))
            .build();
        if (alert != null) {
            req.setOpinionIds(alert.getOpinionId() == null ? new ArrayList<>() : List.of(alert.getOpinionId()));
            req.setCandidates(candidate == null ? new ArrayList<>() : List.of(candidate));
        }
        return req;
    }

    private PushStats execute(PushRequest req, YqPushRule rule) {
        PushStats stats = new PushStats();
        PushOutcome outcome = dispatcher.dispatch(req);
        stats.add(outcome);
        stats.getDetails().add("[" + req.getScene() + "] " + outcome.getSendStatus()
            + (outcome.getReason() == null ? "" : "（" + outcome.getReason() + "）"));

        YqPushRecord record = new YqPushRecord();
        record.setRuleId(req.getRuleId());
        record.setPushScene(req.getScene());
        record.setPushLevel(req.getPushLevel());
        record.setContentSnapshot(req.getContent());
        record.setTargetIds(joinIds(req.getTargetUserIds()));
        record.setOpinionIds(joinIds(req.getOpinionIds()));
        record.setReportId(req.getReportId());
        record.setSendStatus(outcome.getSendStatus());
        record.setRetryCount(outcome.getRetryCount());
        record.setFailReason(outcome.getReason());
        record.setSendTime(PushOutcome.SENT.equals(outcome.getKind()) ? LocalDateTime.now() : null);
        try {
            pushRecordMapper.insert(record);
            stats.getRecordIds().add(record.getRecordId());
        } catch (Exception e) {
            log.error("[推送] 记录落库失败 scene={}: {}", req.getScene(), e.getMessage());
        }
        return stats;
    }

    private void writeBackAlertResult(YqAlert alert, PushStats stats) {
        String result;
        if (stats.getSent() > 0) {
            result = "success";
        } else if (stats.getDeferred() > 0) {
            result = "pending";
        } else {
            result = "failed";
        }
        try {
            YqAlert update = new YqAlert();
            update.setAlertId(alert.getAlertId());
            update.setPushResult(result);
            alertMapper.updateById(update);
        } catch (Exception e) {
            log.error("[推送] 回写预警推送结果失败 alertId={}: {}", alert.getAlertId(), e.getMessage());
        }
    }

    private void applyQuietFromRule(PushRequest req, Long ruleId) {
        if (ruleId == null) {
            return;
        }
        YqPushRule rule = pushRuleMapper.selectById(ruleId);
        if (rule != null) {
            req.setQuietStart(rule.getQuietStart());
            req.setQuietEnd(rule.getQuietEnd());
        }
    }

    private String templateBodyOf(YqPushRule rule) {
        if (rule.getPushTemplateId() == null) {
            return null;
        }
        YqPushTemplate tpl = pushTemplateMapper.selectById(rule.getPushTemplateId());
        return tpl == null ? null : tpl.getBodyTemplate();
    }

    private String contentTypeOf(YqPushRule rule) {
        if (rule.getPushTemplateId() == null) {
            return "detail";
        }
        YqPushTemplate tpl = pushTemplateMapper.selectById(rule.getPushTemplateId());
        if (tpl == null || tpl.getContentType() == null) {
            return "detail";
        }
        return tpl.getContentType();
    }

    private AlertCandidate candidateOf(YqAlert alert) {
        AlertCandidate c = new AlertCandidate();
        c.setOpinionId(alert.getOpinionId());
        c.setClusterId(alert.getClusterId());
        c.setTitle(alert.getAlertTitle());
        c.setOpinionLevel(alert.getAlertLevel());
        c.setSentiAttr("negative");
        return c;
    }

    private static String defaultPushLevel(YqAlert alert) {
        return "warning".equals(alert.getAlertLevel()) || "urgent".equals(alert.getAlertLevel())
            ? "immediate" : "scheduled";
    }

    private static String pushSceneOf(YqAlert alert) {
        String level = alert.getAlertLevel();
        return ("warning".equals(level) || "urgent".equals(level)) ? PushScene.HIGH_RISK : PushScene.NEW_OPINION;
    }

    private static Set<Long> parseIds(String csv) {
        Set<Long> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；\\s]+")) {
            String s = part.trim();
            if (s.isEmpty()) {
                continue;
            }
            try {
                out.add(Long.valueOf(s));
            } catch (NumberFormatException ignored) {
                // 非数字片段静默丢弃：历史记录里可能存过企微成员 ID
            }
        }
        return out;
    }

    private static String joinIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (Long id : ids) {
            if (id == null) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(',');
            }
            sb.append(id);
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private static void merge(PushStats target, PushStats one) {
        target.setAttempted(target.getAttempted() + one.getAttempted());
        target.setSent(target.getSent() + one.getSent());
        target.setFailed(target.getFailed() + one.getFailed());
        target.setDeferred(target.getDeferred() + one.getDeferred());
        target.setSkipped(target.getSkipped() + one.getSkipped());
        target.getRecordIds().addAll(one.getRecordIds());
        target.getDetails().addAll(one.getDetails());
    }

    private static String nvl(String s, String dft) {
        return (s == null || s.isBlank()) ? dft : s;
    }

    /** 供外部构造 JSON 快照（避免前端拿到未序列化对象） */
    public static String toJson(Object o) {
        return JsonUtils.toJsonString(o);
    }
}
`,
  },

  /* ------------------------------------------------------------ 控制器 */
  {
    rel: 'controller/YqAlertDispatchController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqAlertDispatchService;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 预警调度Controller（F-010）
 *
 * <p><b>安全：</b>所有端点带 {@code @SaCheckPermission}；处置人身份只从 Sa-Token 取
 * （{@link LoginHelper#getUserId()}），请求体里即使带了 userId 也一律忽略，杜绝越权冒名处置。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/alert")
public class YqAlertDispatchController {

    private final IYqAlertDispatchService alertDispatchService;
    private final IYqPushDispatchService pushDispatchService;

    /** 手动触发一次预警扫描（落库） */
    @SaCheckPermission("yuqing:alert:list")
    @Log(title = "预警扫描", businessType = BusinessType.OTHER)
    @PostMapping("/scan")
    public R<AlertScanStats> scan(@RequestBody(required = false) AlertScanRequest request) {
        try {
            return R.ok(alertDispatchService.scan(request));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 预览：只看会命中哪些，不落库 */
    @SaCheckPermission("yuqing:alert:list")
    @PostMapping("/preview")
    public R<AlertScanStats> preview(@RequestBody(required = false) AlertScanRequest request) {
        try {
            return R.ok(alertDispatchService.preview(request));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 处置预警（已处置 / 已忽略必须填说明，服务端强制校验） */
    @SaCheckPermission("yuqing:alert:process")
    @Log(title = "预警处置", businessType = BusinessType.UPDATE)
    @PostMapping("/process")
    public R<Void> process(@RequestBody YqAlert bo) {
        try {
            return alertDispatchService.process(bo, LoginHelper.getUserId()) ? R.ok() : R.fail("处置失败");
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 未处置计数（台账与列表红标用） */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/pendingCount")
    public R<Map<String, Object>> pendingCount() {
        return R.ok(alertDispatchService.pendingCount());
    }

    /** 按时间与级别统计 */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/statistics")
    public R<Map<String, Object>> statistics(@RequestParam(required = false) String beginDate,
                                             @RequestParam(required = false) String endDate) {
        try {
            return R.ok(alertDispatchService.statistics(parseDate(beginDate), parseDate(endDate)));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 手动把指定预警推送到企业微信 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "预警推送", businessType = BusinessType.OTHER)
    @PostMapping("/push")
    public R<PushStats> push(@RequestBody List<Long> alertIds) {
        try {
            return R.ok(pushDispatchService.pushAlerts(alertIds));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    private static LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v.trim());
        } catch (Exception e) {
            throw new ServiceException("日期格式应为 yyyy-MM-dd: " + v);
        }
    }
}
`,
  },

  {
    rel: 'controller/YqPushDispatchController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

/**
 * 推送调度Controller（F-011）
 *
 * <p>本控制器只暴露「运维动作」——重发失败记录、刷出顺延批量、查统计。
 * 推送规则 / 模板 / 记录列表仍走代码生成器产出的标准 CRUD 端点。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/push")
public class YqPushDispatchController {

    private final IYqPushDispatchService pushDispatchService;

    /** 重发一条失败记录 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送重发", businessType = BusinessType.UPDATE)
    @PostMapping("/retry/{recordId}")
    public R<PushStats> retry(@PathVariable Long recordId) {
        try {
            return R.ok(pushDispatchService.retry(recordId));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 刷出免打扰顺延的定时批量 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送刷出", businessType = BusinessType.OTHER)
    @PostMapping("/flush")
    public R<Integer> flush() {
        return R.ok(pushDispatchService.flushScheduled());
    }

    /** 推送量与成功率统计 */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/statistics")
    public R<Map<String, Object>> statistics(@RequestParam(required = false) String beginDate,
                                             @RequestParam(required = false) String endDate) {
        try {
            return R.ok(pushDispatchService.statistics(parseDate(beginDate), parseDate(endDate)));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    private static LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v.trim());
        } catch (Exception e) {
            throw new ServiceException("日期格式应为 yyyy-MM-dd: " + v);
        }
    }
}
`,
  },

  /* ------------------------------------------------------------ 定时任务 */
  {
    rel: 'job/YqAlertScanJobExecutor.java',
    content: `package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqAlertDispatchService;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 预警扫描定时任务（SnailJob）
 *
 * <p>在 SnailJob 控制台创建执行器名 {@code yuqingAlertScan}，建议调度周期 5 分钟。
 * 与采集任务解耦的原因：突发增量必须跨采集批次看窗口，挂在采集管线尾部就只看得到当前批次，
 * 而且采集失败不应连累预警。</p>
 *
 * <p>同一任务里顺带刷出免打扰顺延的定时批量推送（验收标准 1 / 3）。</p>
 *
 * <p>⚠ 本任务不经 HTTP 暴露。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingAlertScan")
public class YqAlertScanJobExecutor {

    private final IYqAlertDispatchService alertDispatchService;
    private final IYqPushDispatchService pushDispatchService;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        try {
            AlertScanRequest req = new AlertScanRequest();
            req.setPushAfterCreate(true);
            AlertScanStats stats = alertDispatchService.scan(req);
            SnailJobLog.LOCAL.info("[预警扫描] {}", stats.getMessage());

            int pushed = 0;
            if (!stats.getAlertIds().isEmpty()) {
                PushStats ps = pushDispatchService.pushAlerts(stats.getAlertIds());
                pushed = ps.getSent();
                SnailJobLog.LOCAL.info("[预警扫描] 推送 成功{} 失败{} 顺延{}",
                    ps.getSent(), ps.getFailed(), ps.getDeferred());
            }
            int flushed = pushDispatchService.flushScheduled();
            SnailJobLog.LOCAL.info("[预警扫描] 顺延批量刷出 {}", flushed);

            List<Long> ids = stats.getAlertIds();
            return ExecuteResult.success("命中 " + stats.getDecisionCount() + " 条，落库 "
                + stats.getCreated() + " 条，推送成功 " + pushed + " 条，顺延刷出 " + flushed
                + " 条" + (ids.isEmpty() ? "" : "，预警ID " + ids));
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[预警扫描] 执行失败", e);
            return ExecuteResult.failure("预警扫描失败: " + e.getMessage());
        }
    }
}
`,
  },

];
