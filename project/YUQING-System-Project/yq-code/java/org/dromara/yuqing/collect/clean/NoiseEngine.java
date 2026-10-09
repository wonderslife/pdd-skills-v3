package org.dromara.yuqing.collect.clean;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * 降噪规则引擎（F-006 验收标准 1 / 2 / 3）。
 *
 * <p>判定顺序：</p>
 * <ol>
 *   <li><b>空白内容</b>——内置兜底，最快，先挡掉空壳记录</li>
 *   <li><b>库表规则</b>——业务自定义，按 {@code priority} 升序，先命中先判定</li>
 *   <li><b>机器人内容</b>——作者 / 设备信息命中内置特征</li>
 *   <li><b>灌水评论</b>——重复字符段</li>
 *   <li><b>无意义短句</b>——有效字符数低于阈值</li>
 * </ol>
 *
 * <p>把库表规则放在内置判定之前，是为了让「业务说这条该留/该杀」优先于通用启发式；
 * 空白先判是纯性能考虑（空文本跑正则没有意义）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NoiseEngine {

    /** 机器人作者特征（小写比较） */
    private static final String[] BOT_AUTHORS = {"机器人", "robot", "bot", "自动生成", "系统自动", "newsbot", "spider"};

    /** 机器人设备特征（小写比较） */
    private static final String[] BOT_DEVICES = {"bot", "spider", "crawler", "headless", "phantomjs"};

    /** 单字符连续重复达到该长度即判灌水 */
    private static final int CHAR_RUN_FLOODING = 20;

    private final NoiseRuleCompiler compiler;

    private final YqCollectProperties props;

    /**
     * 对一条原始舆情做「净化 + 降噪判定」。
     *
     * @param raw 原始舆情
     * @return 净化结论（含净化后的标题/正文与剔除原因）
     */
    public CleanVerdict evaluate(RawOpinion raw) {
        if (raw == null) {
            return CleanVerdict.reject(NoiseHit.of(NoiseCategory.BLANK, null, null, "记录为空"), "", "");
        }
        String title = ContentPurifier.purifyTitle(raw.getTitle());
        String content = ContentPurifier.purify(raw.getContent());
        int max = props.getClean().getMaxContentChars();
        if (max > 0 && content.length() > max) {
            content = ContentPurifier.truncate(content, max);
        }
        String text = title + "\n" + content;

        if (ContentPurifier.effectiveLength(text) == 0) {
            return CleanVerdict.reject(NoiseHit.of(NoiseCategory.BLANK, null, null, "标题与正文均无有效字符"), title, content);
        }

        NoiseHit hit = matchRules(text);
        if (hit == null) {
            hit = matchBot(raw);
        }
        if (hit == null) {
            hit = matchFlooding(content);
        }
        if (hit == null) {
            hit = matchMeaningless(text);
        }
        if (hit == null) {
            return CleanVerdict.accept(title, content);
        }
        return CleanVerdict.reject(hit, title, content);
    }

    /**
     * 库表规则匹配（按优先级，先命中先判定）。
     *
     * @param text 净化后文本
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchRules(String text) {
        List<CompiledNoiseRule> rules = compiler.activeRules();
        for (CompiledNoiseRule rule : rules) {
            if (!rule.hits(text)) {
                continue;
            }
            String evidence = rule.evidence(text);
            StringBuilder reason = new StringBuilder();
            reason.append(rule.getRuleName() == null ? "规则" + rule.getRuleId() : rule.getRuleName());
            if (!evidence.isEmpty()) {
                reason.append(" 命中[").append(evidence).append("]");
            }
            if (rule.isDegraded()) {
                reason.append("（正则已降级）");
            }
            return NoiseHit.of(rule.getCategory(), rule.getRuleId(), rule.getRuleName(), reason.toString());
        }
        return null;
    }

    /**
     * 机器人内容：作者名或设备信息带爬虫/机器人特征。
     *
     * @param raw 原始舆情
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchBot(RawOpinion raw) {
        String author = raw.getAuthor() == null ? "" : raw.getAuthor().toLowerCase(Locale.ROOT);
        for (String kw : BOT_AUTHORS) {
            if (author.contains(kw)) {
                return NoiseHit.of(NoiseCategory.BOT, null, null, "作者名含机器人特征[" + raw.getAuthor() + "]");
            }
        }
        String device = raw.getDeviceInfo() == null ? "" : raw.getDeviceInfo().toLowerCase(Locale.ROOT);
        for (String kw : BOT_DEVICES) {
            if (device.contains(kw)) {
                return NoiseHit.of(NoiseCategory.BOT, null, null, "设备信息含爬虫特征[" + raw.getDeviceInfo() + "]");
            }
        }
        return null;
    }

    /**
     * 灌水评论：连续重复字符，或同一片段反复出现。
     *
     * @param content 净化后正文
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchFlooding(String content) {
        int run = longestCharRun(content);
        if (run >= CHAR_RUN_FLOODING) {
            return NoiseHit.of(NoiseCategory.FLOODING, null, null, "连续重复字符 " + run + " 个");
        }
        int window = Math.max(4, props.getClean().getFloodingWindow());
        int threshold = Math.max(2, props.getClean().getFloodingRepeat());
        if (content.length() >= window * 2) {
            String probe = content.substring(0, window);
            int times = countOccurrences(content, probe);
            if (times >= threshold) {
                return NoiseHit.of(NoiseCategory.FLOODING, null, null, "片段[" + probe + "]重复 " + times + " 次");
            }
        }
        return null;
    }

    /**
     * 无意义短句：有效字符数低于阈值。
     *
     * @param text 净化后文本（标题 + 正文）
     * @return 命中记录；未命中返回 null
     */
    private NoiseHit matchMeaningless(String text) {
        int threshold = props.getClean().getMeaninglessChars();
        int len = ContentPurifier.effectiveLength(text);
        if (threshold > 0 && len < threshold) {
            return NoiseHit.of(NoiseCategory.MEANINGLESS, null, null, "有效字符 " + len + " < 阈值 " + threshold);
        }
        return null;
    }

    private static int longestCharRun(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int best = 1;
        int cur = 1;
        for (int i = 1; i < text.length(); i++) {
            char c = text.charAt(i);
            if (Character.isWhitespace(c)) {
                cur = 1;
                continue;
            }
            if (c == text.charAt(i - 1)) {
                cur++;
                if (cur > best) {
                    best = cur;
                }
            } else {
                cur = 1;
            }
        }
        return best;
    }

    private static int countOccurrences(String text, String probe) {
        int count = 0;
        int from = 0;
        while (true) {
            int at = text.indexOf(probe, from);
            if (at < 0) {
                break;
            }
            count++;
            from = at + probe.length();
        }
        return count;
    }

    /**
     * 供后台「规则试跑」用：直接判定一段文本，便于验证新写的正则是否误杀。
     *
     * @param title   标题
     * @param content 正文
     * @return 是否会被剔除
     */
    public boolean wouldReject(String title, String content) {
        if (StringUtils.isBlank(title) && StringUtils.isBlank(content)) {
            return true;
        }
        String text = ContentPurifier.purifyTitle(title) + "\n" + ContentPurifier.purify(content);
        if (ContentPurifier.effectiveLength(text) == 0) {
            return true;
        }
        return matchRules(text) != null || matchFlooding(text) != null || matchMeaningless(text) != null;
    }
}
