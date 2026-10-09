package org.dromara.yuqing.wecom.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 自然语言指令请求体（F-012 验收标准 6）
 *
 * @author ruoyi
 */
@Data
public class WecomCommandBo {

    /** 指令原文 */
    @NotBlank(message = "指令内容不能为空")
    @Size(max = 500, message = "指令长度不能超过 500 字符")
    private String text;

    /** 是否只解析不执行（预览模式，默认 false 即真执行） */
    private boolean previewOnly;
}
