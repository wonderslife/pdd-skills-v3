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
 * 企业微信指令对象 yq_wecom_command
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_wecom_command")
@ExcelIgnoreUnannotated
public class YqWecomCommand extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "command_id")
    private Long commandId;

    /** 发起人用户ID */
    private Long userId;

    /** 企业微信成员ID */
    @ExcelProperty(value = "企业微信成员ID")
    private String wecomUserId;

    /** 指令原文 */
    @ExcelProperty(value = "指令原文")
    private String commandText;

    /** 识别出的指令类型 */
    @ExcelProperty(value = "识别出的指令类型")
    private String commandType;

    /** 解析出的参数（JSON） */
    private String parsedParams;

    /** 关联任务ID */
    private Long refTaskId;

    /** 关联报告ID */
    private Long refReportId;

    /** 执行状态 */
    @ExcelProperty(value = "执行状态")
    private String execStatus;

    /** 执行结果摘要 */
    private String execResult;

    /** 执行时间 */
    @ExcelProperty(value = "执行时间")
    private LocalDateTime execTime;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
