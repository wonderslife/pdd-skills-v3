package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 推送模板对象 yq_push_template
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_push_template")
@ExcelIgnoreUnannotated
public class YqPushTemplate extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 模板ID,主键 */
    @TableId(value = "template_id")
    private Long templateId;

    /** 模板名称 */
    @ExcelProperty(value = "模板名称")
    private String templateName;

    /** 内容形式 */
    @ExcelProperty(value = "内容形式")
    private String contentType;

    /** 模板正文（含占位符） */
    private String bodyTemplate;

    /** 模板包含字段清单 */
    private String fieldList;

    /** 状态（0正常 1停用） */
    private String status;
}
