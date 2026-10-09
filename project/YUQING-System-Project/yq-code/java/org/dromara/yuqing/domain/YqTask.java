package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.io.Serial;

/**
 * 监测任务对象 yq_task
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_task")
@ExcelIgnoreUnannotated
public class YqTask extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 任务ID,主键 */
    @TableId(value = "task_id")
    private Long taskId;

    /** 任务名称 */
    @ExcelProperty(value = "任务名称")
    private String taskName;

    /** 任务类型 */
    @ExcelProperty(value = "任务类型")
    private String taskType;

    /** 任务来源 */
    @ExcelProperty(value = "任务来源")
    private String taskSource;

    /** 采集策略 */
    @ExcelProperty(value = "采集策略")
    private String collectStrategy;

    /** 采集间隔（秒） */
    private Integer collectInterval;

    /** 分级规则ID */
    private Long levelRuleId;

    /** 预警规则ID */
    private Long alertRuleId;

    /** 推送规则ID */
    private Long pushRuleId;

    /** 任务生效起始 */
    @ExcelProperty(value = "任务生效起始")
    private LocalDateTime startTime;

    /** 任务结束时间（常态化为空） */
    @ExcelProperty(value = "任务结束时间（常态化为空）")
    private LocalDateTime endTime;

    /** 最近一次调度时间 */
    @ExcelProperty(value = "最近一次调度时间")
    private LocalDateTime lastScheduleTime;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 备注 */
    private String remark;

    /** 分级规则名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "分级规则名称")
    private String levelRuleName;

    /** 预警规则名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "预警规则名称")
    private String alertRuleName;

    /** 推送规则名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "推送规则名称")
    private String pushRuleName;

    /** 关键词关联 */
    @TableField(exist = false)
    private List<YqTaskKeyword> keywordList;

    /** 渠道关联 */
    @TableField(exist = false)
    private List<YqTaskChannel> channelList;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
