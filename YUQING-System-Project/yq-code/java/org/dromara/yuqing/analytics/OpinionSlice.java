package org.dromara.yuqing.analytics;

import lombok.Builder;
import lombok.Data;
import org.dromara.yuqing.domain.YqOpinion;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 待聚合的舆情切片
 *
 * <p>为什么不直接把 {@link YqOpinion} 拖进聚合器：
 * 一是明细表带 {@code content} 大字段，几十万行会直接把堆打满；
 * 二是离线自测需要能手搓样本，投影对象比实体好构造。</p>
 *
 * <p>本类为不可变语义的投影（只读使用），不承载任何业务判定逻辑。</p>
 *
 * @author ruoyi
 */
@Data
@Builder
public class OpinionSlice {

    /** 舆情ID */
    private Long opinionId;

    /** 采集日（分区列，所有按日指标归属此列） */
    private LocalDate collectDate;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 渠道名称（可能为空，由 Service 用主库回填） */
    private String channelName;

    /** 标题 */
    private String title;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间（趋势曲线的默认归属列） */
    private LocalDateTime publishTime;

    /** 采集时间（发布时间缺失时的兜底归属列） */
    private LocalDateTime collectTime;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 发布地域（自由文本，需归一） */
    private String region;

    /** 话题标签（逗号分隔） */
    private String topicTags;

    /** 内容热度分值 */
    private Integer heatScore;

    /** 舆情属性 positive / neutral / negative */
    private String sentiAttr;

    /** 舆情分级 normal / attention / warning / urgent */
    private String opinionLevel;

    /** 风险等级 general / moderate / severe */
    private String riskLevel;

    /** 传播量级 low / medium / high / viral */
    private String spreadLevel;

    /** 事件聚合ID（0=未聚合） */
    private Long clusterId;

    /**
     * 从明细实体投影
     *
     * @param o 明细实体
     * @return 切片；入参为空时返回 {@code null}
     */
    public static OpinionSlice from(YqOpinion o) {
        if (o == null) {
            return null;
        }
        return OpinionSlice.builder()
            .opinionId(o.getOpinionId())
            .collectDate(o.getCollectDate())
            .taskId(zero(o.getTaskId()))
            .channelId(zero(o.getChannelId()))
            .channelName(o.getChannelName())
            .title(o.getTitle())
            .opinionUrl(o.getOpinionUrl())
            .publishTime(o.getPublishTime())
            .collectTime(o.getCollectTime())
            .readCount(o.getReadCount())
            .commentCount(o.getCommentCount())
            .shareCount(o.getShareCount())
            .likeCount(o.getLikeCount())
            .region(o.getRegion())
            .topicTags(o.getTopicTags())
            .heatScore(o.getHeatScore())
            .sentiAttr(o.getSentiAttr())
            .opinionLevel(o.getOpinionLevel())
            .riskLevel(o.getRiskLevel())
            .spreadLevel(o.getSpreadLevel())
            .clusterId(zero(o.getClusterId()))
            .build();
    }

    /**
     * 趋势归属时间：优先发布时间，为空则回落采集时间
     *
     * <p>这是派生取值（没有同名字段），命名成 getter 是为了让调用方写法统一；
     * 两者都为空说明该条记录时间信息缺失，只能计入总量、不进趋势曲线（不造假时间）。</p>
     */
    public LocalDateTime getTrendTime() {
        return publishTime != null ? publishTime : collectTime;
    }

    private static Long zero(Long v) {
        return v == null ? 0L : v;
    }
}
