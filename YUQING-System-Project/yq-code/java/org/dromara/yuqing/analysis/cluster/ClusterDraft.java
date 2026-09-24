package org.dromara.yuqing.analysis.cluster;

import lombok.Data;

import java.io.Serializable;

/**
 * 一次聚合决策的结果（F-007 验收标准 4）
 *
 * <p>本类只描述「这条舆情该归到哪个事件、相似度多少、是新建还是并入」，
 * 不负责落库 —— 落库需要事务与 ID 生成，属于服务层职责。
 * 把决策与副作用分开，决策部分才能离线自测。</p>
 *
 * @author ruoyi
 */
@Data
public class ClusterDraft implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 命中的既有事件ID；为 null 表示需要新建事件 */
    private Long clusterId;

    /** 是否新建 */
    private boolean created;

    /** 与命中事件的相似度（新建时为最高候选分，可为 0） */
    private double similarity;

    /** 新建时的建议事件标题（取首条舆情标题） */
    private String seedTitle;

    /** 新建时的建议事件主题 */
    private String seedTopic;

    /** 参与比较的候选事件数（用于解释「为什么没聚合」） */
    private int candidateCount;

    public static ClusterDraft create(String seedTitle, String seedTopic) {
        ClusterDraft d = new ClusterDraft();
        d.created = true;
        d.seedTitle = seedTitle;
        d.seedTopic = seedTopic;
        d.similarity = 0d;
        return d;
    }

    public static ClusterDraft join(Long clusterId, double similarity) {
        ClusterDraft d = new ClusterDraft();
        d.created = false;
        d.clusterId = clusterId;
        d.similarity = similarity;
        return d;
    }
}
