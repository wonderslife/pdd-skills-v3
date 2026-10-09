package org.dromara.yuqing.wecom.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 补充事件信息请求体（F-012 验收标准 4）
 *
 * @author ruoyi
 */
@Data
public class WecomSupplementBo {

    /** 舆情链接（必填） */
    @NotBlank(message = "链接不能为空")
    @Size(max = 1000, message = "链接长度不能超过 1000 字符")
    private String url;

    /** 备注说明 */
    @Size(max = 500, message = "备注长度不能超过 500 字符")
    private String remark;

    /** 可选：关联任务 ID */
    private Long refTaskId;
}
