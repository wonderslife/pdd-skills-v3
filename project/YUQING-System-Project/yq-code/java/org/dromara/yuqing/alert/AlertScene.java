package org.dromara.yuqing.alert;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 预警触发场景（F-010 验收标准 1 / 字典 {@code yq_alert_scene}）
 *
 * <p>四类：新增负面 / 高风险 / 突发增量 / 重点专项。</p>
 *
 * @author ruoyi
 */
public final class AlertScene {

    /** 新增负面 */
    public static final String NEW_NEGATIVE = "new_negative";

    /** 高风险 */
    public static final String HIGH_RISK = "high_risk";

    /** 突发增量 */
    public static final String BURST_INCREMENT = "burst_increment";

    /** 重点专项 */
    public static final String SPECIAL_TOPIC = "special_topic";

    private AlertScene() {
    }

    /** 是否为已知场景 */
    public static boolean isKnown(String scene) {
        return NEW_NEGATIVE.equals(scene) || HIGH_RISK.equals(scene)
            || BURST_INCREMENT.equals(scene) || SPECIAL_TOPIC.equals(scene);
    }

    /**
     * 解析逗号分隔的场景串；忽略空白与未知取值，保持声明顺序。
     *
     * <p>未知取值静默丢弃而不是抛异常：规则表里存了已下线场景时不应让整条规则失效，
     * 也不应让一次扫描全批失败（与 F-006「正则写错降级为字面量」同一套纵深防御）。</p>
     */
    public static Set<String> parse(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split("[,，;；\s]+")) {
            String s = part.trim();
            if (isKnown(s)) {
                out.add(s);
            }
        }
        return out;
    }

    /** 逗号分隔场景串是否包含指定场景 */
    public static boolean contains(String csv, String scene) {
        return parse(csv).contains(scene);
    }
}
