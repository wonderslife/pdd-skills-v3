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
import java.io.Serial;

/**
 * 关键词对象 yq_keyword
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_keyword")
@ExcelIgnoreUnannotated
public class YqKeyword extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 关键词ID,主键 */
    @TableId(value = "keyword_id")
    private Long keywordId;

    /** 所属分组ID */
    private Long groupId;

    /** 关键词文本 */
    @ExcelProperty(value = "关键词文本")
    private String keywordText;

    /** 关键词类型 */
    @ExcelProperty(value = "关键词类型")
    private String keywordType;

    /** 关键词分类 */
    @ExcelProperty(value = "关键词分类")
    private String keywordCategory;

    /** 组合表达式（type=combo 必填） */
    private String comboExpression;

    /** 被引用次数 */
    private Integer refCount;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 备注 */
    private String remark;

    /** 分组名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "分组名称")
    private String groupName;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
