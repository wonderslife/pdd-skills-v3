package org.dromara.yuqing.alert;

import lombok.Data;
import org.dromara.yuqing.domain.YqAlertRule;

import java.math.BigDecimal;
import java.util.Set;

/**
 * 编译后的预警规则
 *
 * <p>把 {@link YqAlertRule} 的零散字段整理成判定可直接消费的形态：
 * 场景集合、窗口长度、各阈值、冷却期、预警/推送级别。</p>
 *
 * @author ruoyi
 */
@Data
public class AlertRuleSpec {

    private Long ruleId;
    private String ruleName;
    private Set<String> scenes;

    private int windowMinutes = 10;
    private Integer countThreshold;
    private Integer heatThreshold;
    private String riskLevelThreshold = "moderate";
    private String spreadThreshold = "medium";

    private double burstRatio = 3.0d;
    private int minBurstCount = 5;
    private int cooldownMinutes = 360;

    /** 重点专项标签集合 */
    private Set<String> topicTags;

    private String alertLevel = "warning";
    private String pushLevel = "immediate";
    private String notifyUserIds;
    private String status = "0";

    /** 规则是否启用（status = 0 正常） */
    public boolean enabled() {
        return "0".equals(status);
    }

    /** 是否支持指定场景 */
    public boolean supports(String scene) {
        return scenes != null && scenes.contains(scene);
    }

    /** 窗口长度兜底：非法值回落到 10 分钟 */
    public int safeWindowMinutes(int fallback) {
        return windowMinutes > 0 ? windowMinutes : fallback;
    }

    public double safeBurstRatio(double fallback) {
        return burstRatio > 0 ? burstRatio : fallback;
    }

    public int safeMinBurstCount(int fallback) {
        return minBurstCount > 0 ? minBurstCount : fallback;
    }

    public int safeCooldownMinutes(int fallback) {
        return cooldownMinutes > 0 ? cooldownMinutes : fallback;
    }

    /** 风险等级序位：general=1 / moderate=2 / severe=3，未知=0 */
    public static int riskRank(String riskLevel) {
        if (riskLevel == null) {
            return 0;
        }
        switch (riskLevel) {
            case "general":
                return 1;
            case "moderate":
                return 2;
            case "severe":
                return 3;
            default:
                return 0;
        }
    }

    /** 传播量级序位：low=1 / medium=2 / high=3 / viral=4，未知=0 */
    public static int spreadRank(String spreadLevel) {
        if (spreadLevel == null) {
            return 0;
        }
        switch (spreadLevel) {
            case "low":
                return 1;
            case "medium":
                return 2;
            case "high":
                return 3;
            case "viral":
                return 4;
            default:
                return 0;
        }
    }

    public int riskThresholdRank() {
        return riskRank(riskLevelThreshold);
    }

    public int spreadThresholdRank() {
        return spreadRank(spreadThreshold);
    }

    /** 标签集合是否命中候选的任一话题标签 */
    public boolean hitTopic(String candidateTags) {
        if (topicTags == null || topicTags.isEmpty() || candidateTags == null || candidateTags.isBlank()) {
            return false;
        }
        for (String part : candidateTags.split("[,，;；]+")) {
            String t = part.trim();
            if (!t.isEmpty() && topicTags.contains(t)) {
                return true;
            }
        }
        return false;
    }

    /** 从实体编译 */
    public static AlertRuleSpec from(YqAlertRule r, double defaultBurstRatio, int defaultMinBurst, int defaultCooldown) {
        AlertRuleSpec s = new AlertRuleSpec();
        s.setRuleId(r.getRuleId());
        s.setRuleName(r.getRuleName());
        s.setScenes(AlertScene.parse(r.getTriggerScenes()));
        s.setWindowMinutes(r.getWindowMinutes() == null ? 0 : r.getWindowMinutes());
        s.setCountThreshold(r.getCountThreshold());
        s.setHeatThreshold(r.getHeatThreshold());
        s.setRiskLevelThreshold(r.getRiskLevelThreshold());
        s.setSpreadThreshold(r.getSpreadThreshold());
        BigDecimal br = r.getBurstRatio();
        s.setBurstRatio(br == null ? defaultBurstRatio : br.doubleValue());
        Integer mb = r.getMinBurstCount();
        s.setMinBurstCount(mb == null ? defaultMinBurst : mb);
        Integer cd = r.getCooldownMinutes();
        s.setCooldownMinutes(cd == null ? defaultCooldown : cd);
        s.setTopicTags(parseTags(r.getTopicTags()));
        s.setAlertLevel(r.getAlertLevel());
        s.setPushLevel(r.getPushLevel());
        s.setNotifyUserIds(r.getNotifyUserIds());
        s.setStatus(r.getStatus());
        return s;
    }

    private static Set<String> parseTags(String csv) {
        Set<String> out = new java.util.LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；]+")) {
            String t = part.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }
}
