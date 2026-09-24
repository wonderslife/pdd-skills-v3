package org.dromara.yuqing.alert;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 待预警判定的舆情切片
 *
 * <p>只携带判定所需字段，不直接把 {@code YqOpinion} 拖进引擎——
 * 一是 Doris 实体字段多、二是便于离线自测直接构造样本。</p>
 *
 * <p>⚠ 必须同时标注 {@code @NoArgsConstructor} 与 {@code @AllArgsConstructor}：
 * 只写 {@code @Builder} 时 Lombok 会收回默认无参构造，导致 {@code new AlertCandidate()}
 * 编译失败（推送渲染器需要一个「空对象」兜底）。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCandidate {

    private Long opinionId;
    private Long taskId;
    private Long channelId;
    /** 来源渠道名称（推送模板「发布平台」要素用） */
    private String channelName;
    private Long clusterId;

    private String title;
    private String content;
    private String opinionUrl;
    private LocalDateTime publishTime;

    private String sentiAttr;
    private String opinionLevel;
    private String riskLevel;
    private String spreadLevel;
    private Integer heatScore;
    private String analyzeStatus;

    /** 话题标签（逗号分隔），重点专项场景匹配用 */
    private String topicTags;

    private Long readCount;
    private Long likeCount;
    private Long commentCount;
    private Long shareCount;

    /** 从 YqOpinion 转换 */
    public static AlertCandidate from(org.dromara.yuqing.domain.YqOpinion o) {
        if (o == null) {
            return null;
        }
        return AlertCandidate.builder()
            .opinionId(o.getOpinionId())
            .taskId(o.getTaskId())
            .channelId(o.getChannelId())
            .clusterId(o.getClusterId())
            .title(o.getTitle())
            .content(o.getContent())
            .opinionUrl(o.getOpinionUrl())
            .publishTime(o.getPublishTime() == null ? o.getCollectTime() : o.getPublishTime())
            .sentiAttr(o.getSentiAttr())
            .opinionLevel(o.getOpinionLevel())
            .riskLevel(o.getRiskLevel())
            .spreadLevel(o.getSpreadLevel())
            .heatScore(o.getHeatScore())
            .analyzeStatus(o.getAnalyzeStatus())
            .topicTags(o.getTopicTags())
            .readCount(o.getReadCount())
            .likeCount(o.getLikeCount())
            .commentCount(o.getCommentCount())
            .shareCount(o.getShareCount())
            .build();
    }
}
