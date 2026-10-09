package org.dromara.yuqing.service.impl;

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
        for (String part : nz(props.getHighlightLevels()).split("[,，\s]+")) {
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
