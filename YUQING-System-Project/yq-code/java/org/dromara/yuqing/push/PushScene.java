package org.dromara.yuqing.push;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * 推送场景（F-011 验收标准 2 / 字典 {@code yq_push_scene}）
 *
 * @author ruoyi
 */
public final class PushScene {

    /** 新增舆情 */
    public static final String NEW_OPINION = "new_opinion";

    /** 高风险舆情 */
    public static final String HIGH_RISK = "high_risk";

    /** 批量研判完成 */
    public static final String BATCH_COMPLETED = "batch_completed";

    /** 报告生成完成 */
    public static final String REPORT_READY = "report_ready";

    private PushScene() {
    }

    public static boolean isKnown(String scene) {
        return NEW_OPINION.equals(scene) || HIGH_RISK.equals(scene)
            || BATCH_COMPLETED.equals(scene) || REPORT_READY.equals(scene);
    }

    /** 解析逗号分隔的场景串，忽略空白与未知取值 */
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

    public static boolean contains(String csv, String scene) {
        return parse(csv).contains(scene);
    }
}
