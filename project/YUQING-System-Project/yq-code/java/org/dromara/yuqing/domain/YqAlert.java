package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 预警记录对象 yq_alert
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_alert")
@ExcelIgnoreUnannotated
public class YqAlert extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 预警ID,主键 */
    @TableId(value = "alert_id")
    private Long alertId;

    /** 触发规则ID */
    private Long ruleId;

    /** 关联舆情ID */
    private Long opinionId;

    /** 关联事件聚合ID */
    private Long clusterId;

    /** 预警标题 */
    @ExcelProperty(value = "预警标题")
    private String alertTitle;

    /** 触发场景 */
    @ExcelProperty(value = "触发场景")
    private String triggerScene;

    /** 预警级别 */
    @ExcelProperty(value = "预警级别")
    private String alertLevel;

    /** 触发值描述 */
    @ExcelProperty(value = "触发值描述")
    private String triggerValue;

    /** 事件聚合指纹（同指纹冷却期内不重复预警） */
    private String fingerprint;

    /** 触发时间 */
    @ExcelProperty(value = "触发时间")
    private LocalDateTime triggerTime;

    /** 处置状态 */
    @ExcelProperty(value = "处置状态")
    private String status;

    /** 处置说明 */
    private String processRemark;

    /** 处置人用户ID */
    private Long processBy;

    /** 处置时间 */
    @ExcelProperty(value = "处置时间")
    private LocalDateTime processTime;

    /** 推送结果 */
    @ExcelProperty(value = "推送结果")
    private String pushResult;

    /** 触发规则名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "触发规则名称")
    private String ruleName;

    /** 舆情标题 */
    @TableField(exist = false)
    @ExcelProperty(value = "舆情标题")
    private String opinionTitle;

    /** 事件标题 */
    @TableField(exist = false)
    @ExcelProperty(value = "事件标题")
    private String clusterTitle;

    /** 处置人 */
    @TableField(exist = false)
    @ExcelProperty(value = "处置人")
    private String processByName;

    /** 来源渠道 */
    @TableField(exist = false)
    @ExcelProperty(value = "来源渠道")
    private String channelName;

    /** 发布时间 */
    @TableField(exist = false)
    @ExcelProperty(value = "发布时间")
    private LocalDateTime publishTime;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
