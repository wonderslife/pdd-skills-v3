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
import java.io.Serial;

/**
 * 任务渠道关联对象 yq_task_channel
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_task_channel")
@ExcelIgnoreUnannotated
public class YqTaskChannel extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "id")
    private Long id;

    /** 任务ID */
    private Long taskId;

    /** 渠道ID */
    private Long channelId;

    /** 任务级频率覆盖（秒） */
    private Integer overrideInterval;

    /** 渠道名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "渠道名称")
    private String channelName;
}
