package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 净化批次对象 yq_clean_batch
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_clean_batch")
@ExcelIgnoreUnannotated
public class YqCleanBatch extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 批次ID,主键 */
    @TableId(value = "batch_id")
    private Long batchId;

    /** 批次名称 */
    @ExcelProperty(value = "批次名称")
    private String batchName;

    /** 重跑类型 */
    @ExcelProperty(value = "重跑类型")
    private String batchType;

    /** 范围-任务ID */
    private Long scopeTaskId;

    /** 范围-渠道ID */
    private Long scopeChannelId;

    /** 范围-起始采集日 */
    @ExcelProperty(value = "范围-起始采集日")
    private LocalDate scopeStartDate;

    /** 范围-截止采集日 */
    @ExcelProperty(value = "范围-截止采集日")
    private LocalDate scopeEndDate;

    /** 扫描条数 */
    @ExcelProperty(value = "扫描条数")
    private Integer totalCount;

    /** 净化保留条数 */
    @ExcelProperty(value = "净化保留条数")
    private Integer cleanedCount;

    /** 降噪剔除条数 */
    @ExcelProperty(value = "降噪剔除条数")
    private Integer rejectedCount;

    /** 链接去重条数 */
    @ExcelProperty(value = "链接去重条数")
    private Integer dupCount;

    /** 跨渠道重复条数 */
    @ExcelProperty(value = "跨渠道重复条数")
    private Integer dupChannelCount;

    /** 垃圾内容剔除量 */
    @ExcelProperty(value = "垃圾内容剔除量")
    private Integer noiseSpam;

    /** 广告营销剔除量 */
    @ExcelProperty(value = "广告营销剔除量")
    private Integer noiseAdvertisement;

    /** 灌水评论剔除量 */
    @ExcelProperty(value = "灌水评论剔除量")
    private Integer noiseFlooding;

    /** 无意义短句剔除量 */
    @ExcelProperty(value = "无意义短句剔除量")
    private Integer noiseMeaningless;

    /** 机器人内容剔除量 */
    @ExcelProperty(value = "机器人内容剔除量")
    private Integer noiseBot;

    /** 空白内容剔除量 */
    @ExcelProperty(value = "空白内容剔除量")
    private Integer noiseBlank;

    /** 违规屏蔽剔除量 */
    @ExcelProperty(value = "违规屏蔽剔除量")
    private Integer noiseViolation;

    /** 仅预览未落库（0否 1是） */
    @ExcelProperty(value = "仅预览未落库（0否 1是）")
    private String previewOnly;

    /** 执行状态 */
    @ExcelProperty(value = "执行状态")
    private String status;

    /** 失败原因 */
    private String failReason;

    /** 耗时（毫秒） */
    @ExcelProperty(value = "耗时（毫秒）")
    private Integer costMs;

    /** 任务名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "任务名称")
    private String taskName;

    /** 渠道名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "渠道名称")
    private String channelName;

    /** 去重率（%） */
    @TableField(exist = false)
    @ExcelProperty(value = "去重率（%）")
    private BigDecimal dupRate;

    /** 降噪率（%） */
    @TableField(exist = false)
    @ExcelProperty(value = "降噪率（%）")
    private BigDecimal rejectRate;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
