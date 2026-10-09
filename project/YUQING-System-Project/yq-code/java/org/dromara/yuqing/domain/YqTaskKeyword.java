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
 * 任务关键词关联对象 yq_task_keyword
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_task_keyword")
@ExcelIgnoreUnannotated
public class YqTaskKeyword extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "id")
    private Long id;

    /** 任务ID */
    private Long taskId;

    /** 关键词ID */
    private Long keywordId;

    /** 任务级匹配策略（覆盖全局） */
    private String matchStrategy;

    /** 关键词文本 */
    @TableField(exist = false)
    @ExcelProperty(value = "关键词文本")
    private String keywordText;
}
