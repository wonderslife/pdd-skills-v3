package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.io.Serial;

/**
 * 热点排行对象 yq_stats_hot *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_stats_hot")
@ExcelIgnoreUnannotated
public class YqStatsHot implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "hot_id")
    private Long hotId;

    /** 统计日期 */
    private LocalDate statsDate;

    /** 排序口径 */
    private String rankBy;

    /** 名次 */
    private Integer rankNo;

    /** 舆情ID */
    private Long opinionId;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 舆情标题 */
    private String title;

    /** 渠道名称 */
    private String channelName;

    /** 原文链接 */
    private String opinionUrl;

    /** 发布时间 */
    private LocalDateTime publishTime;

    /** 舆情属性 */
    private String sentiAttr;

    /** 风险等级 */
    private String riskLevel;

    /** 阅读量 */
    private Long readCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 点赞量 */
    private Long likeCount;

    /** 综合热度分值 */
    private Integer heatScore;

    /** 聚合时间 */
    private LocalDateTime createTime;
}
