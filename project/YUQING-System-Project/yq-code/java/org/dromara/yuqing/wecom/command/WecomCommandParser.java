package org.dromara.yuqing.wecom.command;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 自然语言指令解析器（F-012 验收标准 6）
 *
 * <p><b>纯函数设计：</b>不依赖 Spring、数据库、网络，输入字符串、输出 {@link ParsedCommand}，
 * 便于 {@code OfflineCollectTestRunner} 直接反射调用做离线断言。</p>
 *
 * <p><b>解析策略（规则优先，不做大模型调用）：</b>
 * 规则解析的好处是「确定性 + 零成本 + 可审计」，且不会因为大模型不可用而整条链路挂掉。
 * 后续如需引入大模型兜底，应在规则全部未命中时调用，并且大模型结果只作为「建议」，
 * 仍需人工在 {@code yq_wecom_command} 里确认，避免误触发建任务这类写操作。</p>
 *
 * <p><b>安全：</b>本类不执行任何指令，<b>只做解析</b>。真正的执行由 {@code YqWecomCommandServiceExtImpl}
 * 在做完权限校验后发起 —— 解析与执行分离，避免「一句话就把任务建了」的越权风险。</p>
 *
 * @author ruoyi
 */
@Component
public class WecomCommandParser {

    /** 指令类型 -> 关键词组（命中任一即算该类型候选；命中越多置信度越高） */
    private static final Map<WecomCommandType, List<String>> KEYWORDS = new LinkedHashMap<>();

    /** 抽取「关于 XX / 查询 XX」里核心关键词的表达式
     *  终止符含「的 / 等 / 相关 / 舆情 / 任务」等虚词与类别词，避免贪婪吞掉整句
     *  （实测：不加终止符时「关于台风の临时任务」会被整段抽出） */
    private static final Pattern ABOUT = Pattern.compile("(?:关于|有关|针对)\\s*[\"\u201c]?([^\"\u201d，,。；;\\s的等和与]{2,30})");
    private static final Pattern QUERY_OF = Pattern.compile("(?:查询|查一下|查查|搜一下|检索)\\s*(?:关于|有关)?\\s*[\"\u201c]?([^\"\u201d，,。；;\\s的等和与]{2,30})");

    /** 结束时间表述抽取：到今晚8点 / 到明天中午 / 至 18:00
     *  终止符含「结束 / 为止 / 之前 / 截止」等动词虚词，避免把「今晚8点结束」整段抽出 */
    private static final Pattern UNTIL = Pattern.compile("(?:到|至|截止到?)\\s*([^，,。；;结束为止之前]{2,20})");

    static {
        // ⚠ 声明顺序 = 平票仲裁顺序（命中数相同时取先声明者）。
        //   排序原则：**具体意图优先于泛化意图**。实测踩坑：
        //   「研判一下这条舆情」同时命中 TRIGGER_ANALYSIS 的「研判」与 QUERY_OPINION 的「舆情」，
        //   两者各命中 1 次平票 —— 若把泛化的「舆情」放前面，会误判成「查询舆情」而丢掉研判意图。
        //   因此把写操作 / 具体动作类（建任务、研判、生成报告）排在泛化的查询类之前。
        KEYWORDS.put(WecomCommandType.CREATE_TASK, List.of("建任务", "建个任务", "创建任务", "新建任务", "临时任务", "专项任务", "加个任务"));
        KEYWORDS.put(WecomCommandType.TRIGGER_ANALYSIS, List.of("研判", "分析一下", "智能分析"));
        KEYWORDS.put(WecomCommandType.TRIGGER_REPORT, List.of("生成报告", "出报告", "生成日报", "生成月报", "出个日报", "出个月报", "日报", "月报"));
        KEYWORDS.put(WecomCommandType.QUERY_TASK, List.of("查任务", "任务状态", "采集任务", "任务进度", "任务列表"));
        KEYWORDS.put(WecomCommandType.QUERY_ALERT, List.of("预警", "告警", "报警", "风险提示"));
        KEYWORDS.put(WecomCommandType.QUERY_OPINION, List.of("舆情", "查一下", "查询", "搜一下", "检索"));
        KEYWORDS.put(WecomCommandType.HELP, List.of("帮助", "怎么用", "指令", "help", "菜单"));
    }

    /**
     * 解析指令。
     *
     * @param text 用户输入的原始指令
     * @param maxLength 允许的最大长度（超长直接判为未识别，防打爆解析）
     * @return 解析结果，永不为 null
     */
    public ParsedCommand parse(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return ParsedCommand.unknown("指令为空");
        }
        String t = text.trim();
        if (maxLength > 0 && t.length() > maxLength) {
            return ParsedCommand.unknown("指令过长（" + t.length() + " > " + maxLength + "）");
        }
        String lower = t.toLowerCase();

        WecomCommandType best = WecomCommandType.UNKNOWN;
        int bestHits = 0;
        String bestHitWord = null;

        for (Map.Entry<WecomCommandType, List<String>> e : KEYWORDS.entrySet()) {
            for (String kw : e.getValue()) {
                if (lower.contains(kw.toLowerCase())) {
                    int hits = countHits(lower, e.getValue());
                    // 同命中数时，先声明者优先。
                    // ⚠ 声明顺序已被刻意排序为「具体意图优先于泛化意图」——
                    //   实测：「研判一下这条舆情」同时命中 TRIGGER_ANALYSIS 的「研判」与 QUERY_OPINION 的「舆情」，
                    //   各命中 1 次平票，若泛化的「舆情」在前会误判成查询，丢掉研判意图。
                    //   KEYWORDS 的 put 顺序即仲裁顺序，调整顺序前务必先跑 F012WecomTest。
                    if (hits > bestHits) {
                        bestHits = hits;
                        best = e.getKey();
                        bestHitWord = kw;
                    }
                }
            }
        }

        /* 参数抽取统一在此处进行，**不因类型未识别而丢弃**。
         * 实测踩坑：早期实现把「未识别则直接 return」放在抽取之前，
         * 导致「建个任务，到今晚8点结束」这类未命中关键词的指令，
         * 连抽到的 untilText 都一起丢了 —— 排查时看不到任何有用信息。 */
        Map<String, String> params = new LinkedHashMap<>();
        String keyword = extractKeyword(t);
        if (keyword != null) {
            params.put("keyword", keyword);
        }
        String until = extract(t, UNTIL);
        if (until != null) {
            params.put("untilText", until);
        }

        if (best == WecomCommandType.UNKNOWN) {
            params.put("reason", "未命中任何指令关键词");
            return new ParsedCommand(WecomCommandType.UNKNOWN, 0d, keyword, params);
        }

        params.put("hitWord", bestHitWord);
        double confidence = Math.min(1.0d, 0.5d + bestHits * 0.15d);
        return new ParsedCommand(best, confidence, keyword, params);
    }

    /** 抽取查询/建任务的核心对象词 */
    private static String extractKeyword(String t) {
        String k = extract(t, ABOUT);
        if (k == null) {
            k = extract(t, QUERY_OF);
        }
        return k;
    }

    private static String extract(String text, Pattern p) {
        Matcher m = p.matcher(text);
        if (m.find()) {
            String g = m.group(1);
            if (g == null) {
                return null;
            }
            String v = g.trim();
            return v.isEmpty() ? null : v;
        }
        return null;
    }

    private static int countHits(String lower, List<String> words) {
        int n = 0;
        for (String w : words) {
            if (lower.contains(w.toLowerCase())) {
                n++;
            }
        }
        return n;
    }
}
