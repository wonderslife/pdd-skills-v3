package org.dromara.yuqing.wecom.command;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 指令解析结果（F-012 验收标准 6）
 *
 * @param type       识别出的指令类型
 * @param confidence 置信度（0~1）：命中关键词越多、越靠前，置信度越高
 * @param keyword    从指令里抽取的核心关键词（查询/建任务用）
 * @param params     结构化参数（渠道、结束时间原始表述等），落库为 parsed_params JSON
 *
 * @author ruoyi
 */
public record ParsedCommand(WecomCommandType type, double confidence, String keyword, Map<String, String> params) {

    public static ParsedCommand unknown(String reason) {
        Map<String, String> p = new LinkedHashMap<>();
        p.put("reason", reason);
        return new ParsedCommand(WecomCommandType.UNKNOWN, 0d, null, p);
    }

    public boolean recognized() {
        return type != null && type != WecomCommandType.UNKNOWN;
    }
}
