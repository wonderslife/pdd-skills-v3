package org.dromara.yuqing.analysis.stage;

import java.util.List;
import java.util.Map;

/**
 * 传播脉络 JSON 写出（F-007 验收标准 4）
 *
 * <p>把 {@link SpreadStageClassifier} 判好的阶段序列写成
 * {@code yq_opinion_cluster.spread_path}（该列是 Doris 的 STRING，存时间轴 JSON）。
 * 独立成纯函数的原因：它是写侧唯一一处「拼字符串进库」的地方，
 * 而手拼 JSON 是最容易出转义问题的活，必须能被离线自测直接断言。</p>
 *
 * <p><b>为什么不用序列化框架：</b></p>
 * <ul>
 *   <li>容器未启动时（离线自测）兜底映射器不带 JavaTime 模块，
 *       序列化 {@code LocalDateTime} 会抛异常，而时间正是本结构的必需字段；</li>
 *   <li>本方法的输出**刻意只包含数字、枚举与 ISO 时间**，
 *       不写舆情标题等自由文本 —— 于是根本不存在需要转义的字符，
 *       也就不存在 JSON 注入面。标题在展示时从舆情表实时取
 *       （F-016 的时间轴就是这么做的），不必在这份快照里冗余一份。</li>
 * </ul>
 *
 * <p><b>引号为什么用 {@code (char) 34} 拼：</b>本项目三层转义（模板串 ->
 * 片段 -> 生成器 -> 产物），在模板里写转义引号要连写多层反斜杠，
 * 算错一层就产出「Java 源码里的裸引号」，编译期直接失败且报错位置很迷惑。
 * 用字符常量绕开整个问题。</p>
 *
 * <p><b>这是快照不是真相源：</b>该字段是聚合当时的留痕（可导出、可追溯），
 * 展示侧仍以「实时查关联舆情再判阶段」为准 ——
 * 舆情可能事后被人工修正归属，快照不会自动跟着变。</p>
 *
 * @author ruoyi
 */
public final class SpreadPathWriter {

    /** 双引号（十进制 34）。不写字面量，理由见类注释。 */
    private static final char QUOTE = (char) 34;

    /** 阶段未知时的回落值：标记为扩散，不臆造首发或峰值 */
    private static final String STAGE_FALLBACK = SpreadStageClassifier.SPREAD;

    private SpreadPathWriter() {
    }

    /**
     * 写出时间轴 JSON。
     *
     * @param nodes 已判阶段并按时间升序排好的节点（可为 null）
     * @return JSON 数组文本；空输入返回 {@code []}，永不返回 null
     */
    public static String write(List<SpreadStageClassifier.Node> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return "[]";
        }
        StringBuilder sb = new StringBuilder(64 + nodes.size() * 80);
        sb.append('[');
        boolean first = true;
        for (SpreadStageClassifier.Node n : nodes) {
            if (n == null || n.getOpinionId() == null) {
                continue;
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('{');
            key(sb, "opinionId");
            sb.append(n.getOpinionId());
            sb.append(',');
            key(sb, "stage");
            quote(sb, safeStage(n.getStage()));
            sb.append(',');
            key(sb, "heat");
            sb.append(n.getHeatScore() == null ? 0 : n.getHeatScore());
            sb.append(',');
            key(sb, "time");
            quote(sb, n.getPublishTime() == null ? "" : n.getPublishTime().toString());
            sb.append('}');
        }
        sb.append(']');
        return sb.toString();
    }

    /**
     * 人类可读的阶段摘要（写入 ClusterCard.spreadSummary 与日志，
     * 例如「首发 1 / 扩散 3 / 峰值 1 / 回落 2」）。
     *
     * <p>由阶段计数生成，**不解析** {@link #write} 产出的 JSON ——
     * 解析自己的快照只会多一处失败点，而计数本来就能直接算出来。</p>
     */
    public static String summarize(Map<String, Integer> stageCount) {
        if (stageCount == null || stageCount.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(64);
        appendPart(sb, stageCount, SpreadStageClassifier.FIRST, "首发");
        appendPart(sb, stageCount, SpreadStageClassifier.SPREAD, "扩散");
        appendPart(sb, stageCount, SpreadStageClassifier.PEAK, "峰值");
        appendPart(sb, stageCount, SpreadStageClassifier.FALL, "回落");
        return sb.toString();
    }

    private static void appendPart(StringBuilder sb, Map<String, Integer> m, String key, String label) {
        Integer v = m.get(key);
        if (v == null || v <= 0) {
            return;
        }
        if (sb.length() > 0) {
            sb.append(" / ");
        }
        sb.append(label).append(' ').append(v);
    }

    private static void key(StringBuilder sb, String name) {
        quote(sb, name);
        sb.append(':');
    }

    private static void quote(StringBuilder sb, String v) {
        sb.append(QUOTE).append(v).append(QUOTE);
    }

    private static String safeStage(String stage) {
        if (stage == null) {
            return STAGE_FALLBACK;
        }
        switch (stage) {
            case SpreadStageClassifier.FIRST:
            case SpreadStageClassifier.SPREAD:
            case SpreadStageClassifier.PEAK:
            case SpreadStageClassifier.FALL:
                return stage;
            default:
                return STAGE_FALLBACK;
        }
    }
}
