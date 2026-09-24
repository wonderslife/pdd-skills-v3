package org.dromara.yuqing.wecom.command;

import java.util.Arrays;

/**
 * 企业微信自然语言指令类型（F-012 验收标准 6）
 *
 * <p>码值为稳定契约，H5 端 {@code utils/yuqingDict.js} 的 {@code COMMAND_TYPE_MAP} 与之对应，
 * 新增类型必须两端同步，否则前端会显示成原始码值。</p>
 *
 * @author ruoyi
 */
public enum WecomCommandType {

    /** 未识别 */
    UNKNOWN("unknown", "未识别"),

    /** 查询任务状态，如「查一下今天的采集任务」 */
    QUERY_TASK("query_task", "查询任务"),

    /** 创建采集任务，如「建一个关于XX的临时任务，到今晚8点」 */
    CREATE_TASK("create_task", "创建任务"),

    /** 查询预警，如「今天有哪些预警」 */
    QUERY_ALERT("query_alert", "查询预警"),

    /** 查询舆情，如「查一下XX的舆情」 */
    QUERY_OPINION("query_opinion", "查询舆情"),

    /** 触发研判，如「研判一下这条」 */
    TRIGGER_ANALYSIS("trigger_analysis", "触发研判"),

    /** 触发报告生成，如「生成今天的日报」 */
    TRIGGER_REPORT("trigger_report", "生成报告"),

    /** 帮助 */
    HELP("help", "帮助");

    private final String code;
    private final String label;

    WecomCommandType(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 按码值反查，未知返回 UNKNOWN */
    public static WecomCommandType ofCode(String code) {
        if (code == null) {
            return UNKNOWN;
        }
        return Arrays.stream(values())
            .filter(t -> t.code.equalsIgnoreCase(code))
            .findFirst()
            .orElse(UNKNOWN);
    }
}
