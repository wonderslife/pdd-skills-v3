package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 事件聚合对象 yq_opinion_cluster *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_opinion_cluster")
@ExcelIgnoreUnannotated
public class YqOpinionCluster implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 聚合ID,主键 */
    @TableId(value = "cluster_id")
    private Long clusterId;

    /** 事件标题 */
    @ExcelProperty(value = "事件标题")
    private String clusterTitle;

    /** 事件主题 */
    @ExcelProperty(value = "事件主题")
    private String clusterTopic;

    /** 关联舆情条数 */
    private Integer opinionCount;

    /** 首次出现时间 */
    @ExcelProperty(value = "首次出现时间")
    private LocalDateTime firstTime;

    /** 最近出现时间 */
    @ExcelProperty(value = "最近出现时间")
    private LocalDateTime lastTime;

    /** 传播脉络（时间轴 JSON） */
    private String spreadPath;

    /** 峰值热度 */
    private Integer peakHeat;

    /** 事件风险等级 */
    @ExcelProperty(value = "事件风险等级")
    private String riskLevel;

    /** 创建时间 */
    @ExcelProperty(value = "创建时间")
    private LocalDateTime createTime;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
