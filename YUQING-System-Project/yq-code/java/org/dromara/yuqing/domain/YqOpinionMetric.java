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
 * 互动数据快照对象 yq_opinion_metric *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_opinion_metric")
@ExcelIgnoreUnannotated
public class YqOpinionMetric implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "metric_id")
    private Long metricId;

    /** 舆情ID */
    private Long opinionId;

    /** 快照日期 */
    @ExcelProperty(value = "快照日期")
    private LocalDate snapshotDate;

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 热度分值 */
    private Integer heatScore;

    /** 采集时间 */
    @ExcelProperty(value = "采集时间")
    private LocalDateTime createTime;
}
