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
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 舆情报告对象 yq_report
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_report")
@ExcelIgnoreUnannotated
public class YqReport extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 报告ID,主键 */
    @TableId(value = "report_id")
    private Long reportId;

    /** 报告名称 */
    @ExcelProperty(value = "报告名称")
    private String reportName;

    /** 报告类型 */
    @ExcelProperty(value = "报告类型")
    private String reportType;

    /** 报告归属日期 */
    @ExcelProperty(value = "报告归属日期")
    private LocalDate reportDate;

    /** 使用模板ID */
    private Long templateId;

    /** 生成方式 */
    @ExcelProperty(value = "生成方式")
    private String triggerType;

    /** 报告正文（渲染后） */
    private String content;

    /** 报告文件URL（MinIO） */
    private String fileUrl;

    /** 文件格式 */
    private String fileFormat;

    /** 版本号 */
    private Integer version;

    /** 状态 */
    @ExcelProperty(value = "状态")
    private String status;

    /** 提交状态 */
    @ExcelProperty(value = "提交状态")
    private String submitStatus;

    /** 提交人用户ID */
    private Long submitBy;

    /** 提交时间 */
    @ExcelProperty(value = "提交时间")
    private LocalDateTime submitTime;

    /** 生成失败原因 */
    private String failReason;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 使用模板名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "使用模板名称")
    private String templateName;

    /** 提交人 */
    @TableField(exist = false)
    @ExcelProperty(value = "提交人")
    private String submitByName;

    /** 纳入舆情条数 */
    @TableField(exist = false)
    @ExcelProperty(value = "纳入舆情条数")
    private Integer opinionCount;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
