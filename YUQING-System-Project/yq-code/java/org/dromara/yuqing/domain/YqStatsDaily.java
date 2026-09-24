package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 统计预聚合对象 yq_stats_daily *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_stats_daily")
@ExcelIgnoreUnannotated
public class YqStatsDaily implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "stats_id")
    private Long statsId;

    /** 统计日期 */
    @ExcelProperty(value = "统计日期")
    private LocalDate statsDate;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 舆情总量 */
    private Integer totalCount;

    /** 正面条数 */
    private Integer positiveCount;

    /** 中性条数 */
    private Integer neutralCount;

    /** 负面条数 */
    private Integer negativeCount;

    /** 去重剔除条数 */
    private Integer dupCount;

    /** 降噪剔除条数 */
    private Integer rejectedCount;

    /** 预警条数 */
    private Integer alertCount;

    /** 推送条数 */
    private Integer pushCount;

    /** 报告生成数 */
    private Integer reportCount;

    /** 阅读量合计 */
    private Long readSum;

    /** 评论量合计 */
    private Long commentSum;

    /** 转发量合计 */
    private Long shareSum;

    /** 点赞量合计 */
    private Long likeSum;

    /** 负面占比（%） */
    private BigDecimal negativeRate;

    /** 聚合时间 */
    @ExcelProperty(value = "聚合时间")
    private LocalDateTime createTime;

    /** 任务名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "任务名称")
    private String taskName;

    /** 渠道名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "渠道名称")
    private String channelName;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
