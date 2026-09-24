package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.io.Serial;

/**
 * 维度分布对象 yq_stats_dim *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_stats_dim")
@ExcelIgnoreUnannotated
public class YqStatsDim implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "dim_id")
    private Long dimId;

    /** 统计日期 */
    private LocalDate statsDate;

    /** 维度类型 */
    private String dimType;

    /** 维度取值（ID 或文本） */
    private String dimKey;

    /** 时间粒度 */
    private String timeGrain;

    /** 任务ID（0=未归属） */
    private Long taskId;

    /** 渠道ID（0=未归属） */
    private Long channelId;

    /** 维度展示名 */
    private String dimLabel;

    /** 舆情条数 */
    private Integer opinionCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 高风险条数 */
    private Integer highRiskCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 热度分值合计 */
    private Long heatSum;

    /** 负面占比（%） */
    private BigDecimal negativeRate;

    /** 聚合时间 */
    private LocalDateTime createTime;
}
