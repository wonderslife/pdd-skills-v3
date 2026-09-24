package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.alert.AlertCandidate;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 推送模板渲染（F-011 验收标准 5 / 6 / 7）
 *
 * <p>统一明细模板固定包含 10 个要素：舆情标题、舆情等级、发布平台、发布时间、
 * 舆情核心内容、风险分析、传播态势、舆情原文链接、处置建议、推送时间。</p>
 *
 * <p>摘要模板包含采集概况统计与负面明细列表。</p>
 *
 * <p>长正文一律按 {@code push.maxContentChars} 截断并保留原文链接，
 * 保证单条消息不超企业微信应用消息上限。</p>
 *
 * @author ruoyi
 */
@RequiredArgsConstructor
@Component
public class PushTemplateRenderer {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final YqAlertProperties props;

    /** 明细式（单条舆情，含 10 要素） */
    public String renderDetail(AlertCandidate c, String alertLevel, LocalDateTime pushTime) {
        AlertCandidate x = c == null ? new AlertCandidate() : c;
        int max = maxChars();
        Map<String, String> v = new LinkedHashMap<>();
        v.put("title", nvl(x.getTitle(), "(无标题)"));
        v.put("level", levelText(alertLevel == null ? x.getOpinionLevel() : alertLevel));
        v.put("channel", nvl(x.getChannelName(), x.getChannelId() == null ? "未知" : String.valueOf(x.getChannelId())));
        v.put("publishTime", x.getPublishTime() == null ? "未知" : FMT.format(x.getPublishTime()));
        v.put("content", truncate(nvl(x.getContent(), "(无正文)"), max));
        v.put("risk", riskText(x.getRiskLevel()));
        v.put("spread", spreadText(x));
        v.put("url", nvl(x.getOpinionUrl(), "无原文链接"));
        v.put("suggestion", suggestionText(alertLevel));
        v.put("pushTime", FMT.format(pushTime == null ? LocalDateTime.now() : pushTime));

        StringBuilder sb = new StringBuilder();
        sb.append("【舆情预警】").append(v.get("title")).append('\n');
        sb.append("舆情等级：").append(v.get("level")).append('\n');
        sb.append("发布平台：").append(v.get("channel")).append('\n');
        sb.append("发布时间：").append(v.get("publishTime")).append('\n');
        sb.append("核心内容：").append(v.get("content")).append('\n');
        sb.append("风险分析：").append(v.get("risk")).append('\n');
        sb.append("传播态势：").append(v.get("spread")).append('\n');
        sb.append("原文链接：").append(v.get("url")).append('\n');
        sb.append("处置建议：").append(v.get("suggestion")).append('\n');
        sb.append("推送时间：").append(v.get("pushTime"));
        return truncate(sb.toString(), max);
    }

    /** 摘要式（采集概况 + 负面明细，验收标准 6） */
    public String renderSummary(String taskName, int total, int negative, int neutral, int deduped,
                                List<AlertCandidate> negatives, LocalDateTime pushTime) {
        int max = maxChars();
        StringBuilder sb = new StringBuilder();
        sb.append("【舆情采集概况】").append(nvl(taskName, "全站")).append('\n');
        sb.append("采集总数：").append(total)
            .append(" ｜ 负面：").append(negative)
            .append(" ｜ 中性：").append(neutral)
            .append(" ｜ 去重后：").append(deduped).append('\n');
        sb.append("负面明细：").append('\n');
        if (negatives == null || negatives.isEmpty()) {
            sb.append("（无）").append('\n');
        } else {
            int i = 1;
            for (AlertCandidate c : negatives) {
                sb.append(i++).append(". ").append(nvl(c.getTitle(), "(无标题)"))
                    .append(" | ").append(nvl(c.getChannelName(), "未知渠道"))
                    .append(" | ").append(c.getPublishTime() == null ? "未知" : FMT.format(c.getPublishTime()))
                    .append(" | ").append(levelText(c.getRiskLevel() == null ? c.getOpinionLevel() : c.getRiskLevel()))
                    .append('\n');
                sb.append("   链接：").append(nvl(c.getOpinionUrl(), "无")).append('\n');
                sb.append("   内容：").append(truncate(nvl(c.getContent(), "(无正文)"), 120)).append('\n');
                if (sb.length() > max) {
                    sb.append("…（明细过长已截断，完整列表见平台台账）");
                    return truncate(sb.toString(), max);
                }
            }
        }
        sb.append("推送时间：").append(FMT.format(pushTime == null ? LocalDateTime.now() : pushTime));
        return truncate(sb.toString(), max);
    }

    /** 按自定义模板占位符渲染（占位符形如 {title}） */
    public String applyTemplate(String bodyTemplate, Map<String, String> vars) {
        if (bodyTemplate == null) {
            return "";
        }
        String out = bodyTemplate;
        if (vars != null) {
            for (Map.Entry<String, String> e : vars.entrySet()) {
                out = out.replace("{" + e.getKey() + "}", nvl(e.getValue(), ""));
            }
        }
        // 未在 vars 中提供的占位符一律清空：否则 {url} 这种字面量会被直接发到企业微信，
        // 既泄露内部实现，也让接收人以为是平台故障。
        return truncate(dropUnknownPlaceholders(out), maxChars());
    }

    /** 去掉模板里未被 vars 提供的 {xxx} 占位符（只认单层、长度受限的占位符，避免误删正文花括号） */
    private static String dropUnknownPlaceholders(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        int i = 0;
        while (i < s.length()) {
            char c = s.charAt(i);
            if (c == '{') {
                int close = s.indexOf('}', i + 1);
                if (close > i && close - i <= 33) {
                    i = close + 1;
                    continue;
                }
            }
            sb.append(c);
            i++;
        }
        return sb.toString();
    }

    /** 截断并加省略号；不截断时原样返回 */
    public String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        int limit = max > 0 ? max : 1500;
        if (s.length() <= limit) {
            return s;
        }
        return s.substring(0, Math.max(0, limit - 1)) + "…";
    }

    private int maxChars() {
        return props.getPush().getMaxContentChars() > 0 ? props.getPush().getMaxContentChars() : 1500;
    }

    private static String nvl(String s, String dft) {
        return (s == null || s.isBlank()) ? dft : s;
    }

    private static String levelText(String level) {
        if (level == null) {
            return "未分级";
        }
        switch (level) {
            case "normal":
                return "一般";
            case "attention":
                return "关注";
            case "warning":
                return "预警";
            case "urgent":
                return "紧急";
            case "general":
                return "一般风险";
            case "moderate":
                return "较重风险";
            case "severe":
                return "严重风险";
            default:
                return level;
        }
    }

    private static String riskText(String riskLevel) {
        if (riskLevel == null) {
            return "未识别到明确风险等级（待智能研判补充）";
        }
        switch (riskLevel) {
            case "severe":
                return "严重：负面情绪集中，存在进一步发酵与大范围扩散可能，需立即介入";
            case "moderate":
                return "较重：负面舆情已有一定传播，需持续盯防并准备统一口径";
            case "general":
                return "一般：负面情绪存在但传播有限，建议例行跟踪";
            default:
                return riskLevel;
        }
    }

    private static String spreadText(AlertCandidate c) {
        String level = c.getSpreadLevel();
        String base;
        if (level == null) {
            base = "传播量级待评估";
        } else {
            switch (level) {
                case "viral":
                    base = "爆（大规模扩散）";
                    break;
                case "high":
                    base = "高（快速扩散）";
                    break;
                case "medium":
                    base = "中（局部传播）";
                    break;
                case "low":
                    base = "低（传播有限）";
                    break;
                default:
                    base = level;
            }
        }
        Long read = c.getReadCount();
        if (read != null && read > 0) {
            base = base + "，阅读 " + read;
        }
        return base;
    }

    private static String suggestionText(String alertLevel) {
        if (alertLevel == null) {
            return "建议按常规监测流程跟踪";
        }
        switch (alertLevel) {
            case "urgent":
                return "建议 30 分钟内核实情况并上报分管负责人，同步准备对外口径";
            case "warning":
                return "建议 2 小时内完成事实核查，明确责任部门并跟踪传播走势";
            case "attention":
                return "建议当日完成核查并纳入观察名单";
            default:
                return "建议按常规监测流程跟踪";
        }
    }
}
