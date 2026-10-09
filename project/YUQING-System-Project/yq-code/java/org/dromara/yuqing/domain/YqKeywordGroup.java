package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 关键词分组对象 yq_keyword_group
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_keyword_group")
@ExcelIgnoreUnannotated
public class YqKeywordGroup extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 分组ID,主键 */
    @TableId(value = "group_id")
    private Long groupId;

    /** 分组名称 */
    @ExcelProperty(value = "分组名称")
    private String groupName;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;
}
