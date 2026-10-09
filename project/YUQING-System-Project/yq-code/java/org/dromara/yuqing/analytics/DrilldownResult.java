package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 下钻结果（F-009 验收标准 6）
 *
 * @author ruoyi
 */
@Data
public class DrilldownResult {

    /** 维度类型 */
    private String dimType;

    /** 维度取值 */
    private String dimKey;

    /** 展示名 */
    private String dimLabel;

    /** 条件描述 */
    private String conditionText;

    /** 命中总条数 */
    private long total;

    /** 页码 */
    private int pageNum;

    /** 每页条数 */
    private int pageSize;

    /** 明细行 */
    private List<Row> rows = new ArrayList<>();

    /**
     * 下钻明细行（字段与舆情台账列表对齐，便于前端复用同一套表格列）
     *
     * @author ruoyi
     */
    @Data
    public static class Row {

        /** 舆情ID */
        private Long opinionId;

        /** 标题 */
        private String title;

        /** 渠道名称 */
        private String channelName;

        /** 发布时间 */
        private LocalDateTime publishTime;

        /** 舆情属性 */
        private String sentiAttr;

        /** 风险等级 */
        private String riskLevel;

        /** 发布地域 */
        private String region;

        /** 话题标签 */
        private String topicTags;

        /** 阅读量 */
        private Long readCount;

        /** 评论量 */
        private Long commentCount;

        /** 转发量 */
        private Long shareCount;

        /** 点赞量 */
        private Long likeCount;

        /** 原文链接 */
        private String opinionUrl;
    }
}
