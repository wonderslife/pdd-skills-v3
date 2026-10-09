package org.dromara.yuqing.alert;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 预警判定引擎（F-010）
 *
 * <p>四类场景判定：</p>
 * <ol>
 *   <li>{@code new_negative}：候选为负面，且窗口内同任务负面条数达到条数阈值（阈值空则不校验条数）。</li>
 *   <li>{@code high_risk}：候选风险等级序位 ≥ 规则阈值，或传播量级序位 ≥ 规则阈值。</li>
 *   <li>{@code burst_increment}：任务级判定，由 {@link BurstDetector} 出结论；命中后只在该任务本轮
 *       第一条候选上挂一次预警，避免同一轮里每条舆情都发一次突发预警。</li>
 *   <li>{@code special_topic}：候选话题标签命中规则配置的重点专项标签。</li>
 * </ol>
 *
 * <p>冷却去重（验收标准 7）：同一 {@code fingerprint} 在冷却期内已产生过未终结预警则跳过，
 * 由调用方传入 {@code cooledFingerprints}；同一轮内命中多次也只取一次。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AlertEngine {

    private final YqAlertProperties props;
    private final AlertCountSource countSource;

    /**
     * @param candidates         本轮候选舆情
     * @param rules              启用的预警规则
     * @param cooledFingerprints 冷却期内的聚合指纹（命中即抑制）
     * @param now                当前时刻
     * @return 判定结果
     */
    public List<AlertDecision> evaluate(List<AlertCandidate> candidates,
                                        List<AlertRuleSpec> rules,
                                        Set<String> cooledFingerprints,
                                        LocalDateTime now) {
        List<AlertDecision> out = new ArrayList<>();
        if (candidates == null || candidates.isEmpty() || rules == null || rules.isEmpty()) {
            return out;
        }
        Set<String> cooled = cooledFingerprints == null ? new HashSet<>() : cooledFingerprints;
        // 同一轮内已产出过的指纹，避免一轮里重复
        Set<String> produced = new HashSet<>();
        // 突发增量按任务只判定一次
        Map<Long, Boolean> burstChecked = new LinkedHashMap<>();

        for (AlertCandidate c : candidates) {
            LevelResolver.resolve(c);
            String fp = AlertFingerprint.of(c);
            if (cooled.contains(fp) || produced.contains(fp)) {
                continue;
            }
            for (AlertRuleSpec rule : rules) {
                if (!rule.enabled()) {
                    continue;
                }
                AlertDecision d = match(c, rule, fp, now, burstChecked);
                if (d == null) {
                    continue;
                }
                out.add(d);
                produced.add(fp);
                // 一条舆情被某条规则命中后不再被其它规则重复命中（防止刷屏）
                break;
            }
        }
        return out;
    }

    private AlertDecision match(AlertCandidate c, AlertRuleSpec rule, String fp,
                                LocalDateTime now, Map<Long, Boolean> burstChecked) {
        int window = rule.safeWindowMinutes(10);

        if (rule.supports(AlertScene.NEW_NEGATIVE) && "negative".equals(c.getSentiAttr())) {
            Integer threshold = rule.getCountThreshold();
            if (threshold == null || threshold <= 0) {
                return build(c, rule, fp, AlertScene.NEW_NEGATIVE, "新增负面舆情（未设条数阈值，单条即触发）");
            }
            LocalDateTime from = now.minusMinutes(window);
            long n = countSource.count(c.getTaskId(), null, "negative", from, now);
            if (n >= threshold) {
                return build(c, rule, fp, AlertScene.NEW_NEGATIVE,
                    "窗口 " + window + " 分钟内负面 " + n + " 条（阈值 " + threshold + "）");
            }
            return null;
        }

        if (rule.supports(AlertScene.HIGH_RISK)) {
            int riskRank = AlertRuleSpec.riskRank(c.getRiskLevel());
            int spreadRank = AlertRuleSpec.spreadRank(c.getSpreadLevel());
            boolean riskHit = rule.riskThresholdRank() > 0 && riskRank >= rule.riskThresholdRank();
            boolean spreadHit = rule.spreadThresholdRank() > 0 && spreadRank >= rule.spreadThresholdRank();
            if (riskHit || spreadHit) {
                StringBuilder sb = new StringBuilder();
                if (riskHit) {
                    sb.append("风险 ").append(c.getRiskLevel()).append(" ≥ ").append(rule.getRiskLevelThreshold());
                }
                if (spreadHit) {
                    if (sb.length() > 0) {
                        sb.append("；");
                    }
                    sb.append("传播 ").append(c.getSpreadLevel()).append(" ≥ ").append(rule.getSpreadThreshold());
                }
                return build(c, rule, fp, AlertScene.HIGH_RISK, sb.toString());
            }
            return null;
        }

        if (rule.supports(AlertScene.SPECIAL_TOPIC) && rule.hitTopic(c.getTopicTags())) {
            return build(c, rule, fp, AlertScene.SPECIAL_TOPIC, "命中重点专项标签: " + c.getTopicTags());
        }

        if (rule.supports(AlertScene.BURST_INCREMENT)) {
            Long taskKey = c.getTaskId() == null ? 0L : c.getTaskId();
            if (Boolean.TRUE.equals(burstChecked.get(taskKey))) {
                return null;
            }
            BurstDetector.BurstOutcome outcome = BurstDetector.detect(countSource, c.getTaskId(), now,
                window, props.getBaselineWindows(),
                rule.safeBurstRatio(props.getDefaultBurstRatio()),
                rule.safeMinBurstCount(props.getMinBurstCount()));
            burstChecked.put(taskKey, Boolean.TRUE);
            if (outcome.isHit()) {
                return build(c, rule, fp, AlertScene.BURST_INCREMENT,
                    outcome.getDescription() + "（阈值 " + String.format("%.2f", outcome.getThresholdRatio()) + " 倍）");
            }
        }
        return null;
    }

    private AlertDecision build(AlertCandidate c, AlertRuleSpec rule, String fp, String scene, String triggerValue) {
        String title = c.getTitle() == null ? "(无标题)" : c.getTitle();
        String shortTitle = title.length() > 80 ? title.substring(0, 80) + "…" : title;
        return AlertDecision.builder()
            .ruleId(rule.getRuleId())
            .ruleName(rule.getRuleName())
            .opinionId(c.getOpinionId())
            .clusterId(c.getClusterId())
            .scene(scene)
            .alertLevel(rule.getAlertLevel())
            .pushLevel(rule.getPushLevel())
            .alertTitle(shortTitle)
            .triggerValue(triggerValue)
            .fingerprint(fp)
            .candidate(c)
            .build();
    }
}
