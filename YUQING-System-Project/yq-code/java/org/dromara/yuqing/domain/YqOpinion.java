package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import java.io.Serializable;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 舆情明细对象 yq_opinion *
 * <p>⚠ 本表存储于 <b>Apache Doris</b>，业务侧只读（禁止 INSERT/UPDATE/DELETE），
 * 写入由采集/研判 Worker 经 Stream Load 完成，详见《技术架构说明》§4.6。</p>
 *
 *
 * @author ruoyi
 */
@Data
@TableName("yq_opinion")
@ExcelIgnoreUnannotated
public class YqOpinion implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 舆情ID,主键 */
    @TableId(value = "opinion_id")
    private Long opinionId;

    /** 分区列=采集日期 */
    private LocalDate collectDate;

    /** 所属任务ID */
    private Long taskId;

    /** 来源渠道ID */
    private Long channelId;

    /** 舆情标题 */
    @ExcelProperty(value = "舆情标题")
    private String title;

    /** 原文内容 */
    private String content;

    /** 原文链接 */
    private String opinionUrl;

    /** 链接 SHA-256（唯一去重主键载体） */
    private String urlHash;

    /** 发布时间 */
    @ExcelProperty(value = "发布时间")
    private LocalDateTime publishTime;

    /** 发布作者/主体 */
    @ExcelProperty(value = "发布作者/主体")
    private String author;

    /** 点赞量 */
    private Long likeCount;

    /** 评论量 */
    private Long commentCount;

    /** 转发量 */
    private Long shareCount;

    /** 阅读量 */
    private Long readCount;

    /** 发布地域 */
    @ExcelProperty(value = "发布地域")
    private String region;

    /** 设备信息 */
    private String deviceInfo;

    /** 话题标签（逗号分隔） */
    private String topicTags;

    /** 综合热度分值 */
    private Integer heatScore;

    /** 舆情属性 */
    @ExcelProperty(value = "舆情属性")
    private String sentiAttr;

    /** 舆情分级 */
    @ExcelProperty(value = "舆情分级")
    private String opinionLevel;

    /** 风险等级 */
    @ExcelProperty(value = "风险等级")
    private String riskLevel;

    /** 传播量级 */
    @ExcelProperty(value = "传播量级")
    private String spreadLevel;

    /** 事件聚合ID */
    private Long clusterId;

    /** 采集来源 */
    @ExcelProperty(value = "采集来源")
    private String collectSource;

    /** 采集时间 */
    @ExcelProperty(value = "采集时间")
    private LocalDateTime collectTime;

    /** 采集批次号 */
    private String batchNo;

    /** 清洗状态 */
    @ExcelProperty(value = "清洗状态")
    private String cleanStatus;

    /** 降噪剔除原因 */
    private String noiseReason;

    /** 重复渠道ID（逗号分隔） */
    private String dupChannelIds;

    /** 净化时间 */
    @ExcelProperty(value = "净化时间")
    private LocalDateTime cleanTime;

    /** 研判状态 */
    @ExcelProperty(value = "研判状态")
    private String analyzeStatus;

    /** 是否已预警（0否 1是） */
    private String alertFlag;

    /** 是否已推送（0否 1是） */
    private String pushFlag;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 任务名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "任务名称")
    private String taskName;

    /** 渠道名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "渠道名称")
    private String channelName;

    /** 事件标题 */
    @TableField(exist = false)
    @ExcelProperty(value = "事件标题")
    private String clusterTitle;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
