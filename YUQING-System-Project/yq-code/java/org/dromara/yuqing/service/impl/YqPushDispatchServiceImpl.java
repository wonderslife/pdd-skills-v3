package org.dromara.yuqing.service.impl;

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
        for (String part : csv.split("[,，;；\s]+")) {
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
