package org.dromara.yuqing.analysis.stage;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 传播脉络阶段判定（F-007 验收标准 4）
 *
 * <p>把事件的关联舆情按时间排序后切分为四个阶段写入
 * {@code yq_opinion_cluster.spread_path}：</p>
 * <ul>
 *   <li>FIRST 首发：时间最早的节点</li>
 *   <li>SPREAD 扩散：峰值之前的中间节点</li>
 *   <li>PEAK 峰值：热度最高的节点（热度全空时取时间居中的节点）</li>
 *   <li>FALL 回落：峰值之后的节点</li>
 * </ul>
 *
 * <p><b>与 F-016 的关系：</b>F-016 的台账里也有一份阶段判定（用于展示），
 * 两者<b>口径一致、实现独立</b> —— 台账是读侧、本类是写侧，
 * 让读侧去调用写侧的代码会把两个生命周期绑在一起。
 * 阶段常量与切分规则在本类中集中定义，变更时两侧需同步。</p>
 *
 * @author ruoyi
 */
public final class SpreadStageClassifier {

    public static final String FIRST = "FIRST";
    public static final String SPREAD = "SPREAD";
    public static final String PEAK = "PEAK";
    public static final String FALL = "FALL";

    private SpreadStageClassifier() {
    }

    /**
     * 时间轴节点。
     */
    @Data
    public static class Node implements Serializable {

        private static final long serialVersionUID = 1L;

        private Long opinionId;
        private LocalDateTime publishTime;
        private Integer heatScore;
        private String title;
        private String stage;
    }

    /**
     * 构建传播脉络。
     *
     * @param raw   关联舆情（顺序不限，本方法会排序）
     * @param limit 节点数上限，<=0 表示不限制
     * @return 阶段标注后的节点列表，按时间升序；永不返回 null
     */
    public static List<Node> build(List<Node> raw, int limit) {
        List<Node> nodes = new ArrayList<>();
        if (raw != null) {
            for (Node n : raw) {
                if (n != null && n.getPublishTime() != null) {
                    nodes.add(n);
                }
            }
        }
        nodes.sort(Comparator.comparing(Node::getPublishTime)
            .thenComparing(n -> n.getOpinionId() == null ? 0L : n.getOpinionId()));
        if (nodes.isEmpty()) {
            return nodes;
        }
        if (limit > 0 && nodes.size() > limit) {
            nodes = new ArrayList<>(nodes.subList(0, limit));
        }
        if (nodes.size() == 1) {
            nodes.get(0).setStage(FIRST);
            return nodes;
        }

        int peakIdx = peakIndex(nodes);
        for (int i = 0; i < nodes.size(); i++) {
            Node n = nodes.get(i);
            if (i == 0) {
                n.setStage(FIRST);
            } else if (i < peakIdx) {
                n.setStage(SPREAD);
            } else if (i == peakIdx) {
                n.setStage(PEAK);
            } else {
                n.setStage(FALL);
            }
        }
        return nodes;
    }

    /**
     * 峰值下标：热度最高者；热度全为空时取时间居中的下标。
     *
     * <p>峰值刻意不取 0：如果峰值取首条，那么所有节点都会落在 FALL，
     * 时间轴上就看不到「扩散」段，研判员会误以为事件一出现就在下跌。</p>
     */
    static int peakIndex(List<Node> nodes) {
        int best = -1;
        int bestHeat = Integer.MIN_VALUE;
        boolean anyHeat = false;
        for (int i = 0; i < nodes.size(); i++) {
            Integer h = nodes.get(i).getHeatScore();
            if (h == null) {
                continue;
            }
            anyHeat = true;
            if (h > bestHeat) {
                bestHeat = h;
                best = i;
            }
        }
        if (!anyHeat || best <= 0) {
            /* 无热度信息，或热度峰值恰在首条（此时无扩散段可言）→ 取中位数下标 */
            return Math.max(1, nodes.size() / 2);
        }
        return best;
    }

    /** 统计各阶段节点数（供事件概要与自测断言） */
    public static Map<String, Integer> countByStage(List<Node> nodes) {
        Map<String, Integer> map = new LinkedHashMap<>();
        map.put(FIRST, 0);
        map.put(SPREAD, 0);
        map.put(PEAK, 0);
        map.put(FALL, 0);
        if (nodes != null) {
            for (Node n : nodes) {
                if (n.getStage() != null) {
                    map.merge(n.getStage(), 1, Integer::sum);
                }
            }
        }
        return map;
    }
}
