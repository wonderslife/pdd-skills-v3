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
import java.io.Serial;

/**
 * 标签对象 yq_tag
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_tag")
@ExcelIgnoreUnannotated
public class YqTag extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 标签ID,主键 */
    @TableId(value = "tag_id")
    private Long tagId;

    /** 标签名称 */
    @ExcelProperty(value = "标签名称")
    private String tagName;

    /** 父标签ID（顶级为0） */
    private Long parentId;

    /** 显示顺序 */
    private Integer orderNum;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 父标签名称 */
    @TableField(exist = false)
    private String parentName;
}
