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
 * 推送记录对象 yq_push_record
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_push_record")
@ExcelIgnoreUnannotated
public class YqPushRecord extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 记录ID,主键 */
    @TableId(value = "record_id")
    private Long recordId;

    /** 推送规则ID */
    private Long ruleId;

    /** 推送场景 */
    @ExcelProperty(value = "推送场景")
    private String pushScene;

    /** 推送级别 */
    @ExcelProperty(value = "推送级别")
    private String pushLevel;

    /** 推送内容快照 */
    private String contentSnapshot;

    /** 实际接收人（逗号分隔） */
    private String targetIds;

    /** 关联舆情ID（逗号分隔） */
    private String opinionIds;

    /** 关联报告ID */
    private Long reportId;

    /** 发送状态 */
    @ExcelProperty(value = "发送状态")
    private String sendStatus;

    /** 已重试次数 */
    private Integer retryCount;

    /** 失败原因 */
    private String failReason;

    /** 发送时间 */
    @ExcelProperty(value = "发送时间")
    private LocalDateTime sendTime;

    /** 推送规则名称 */
    @TableField(exist = false)
    @ExcelProperty(value = "推送规则名称")
    private String ruleName;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
