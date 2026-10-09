package org.dromara.yuqing.analysis.llm;

import lombok.Data;

/**
 * 一次对话补全请求（F-007）
 *
 * <p>刻意只保留「系统提示 + 用户提示」双段结构：研判的输入是
 * 「固定的判定规范」+「不固定的舆情原文」，把两者分成两个角色
 * 是提示词注入防护的第一步（原文永远落在 user 段，且被定界符包裹）。</p>
 *
 * @author ruoyi
 */
@Data
public class LlmRequest {

    /** 系统提示（判定规范，由提示词构建器生成） */
    private String systemPrompt;

    /** 用户提示（舆情原文，已做定界与净化） */
    private String userPrompt;

    /** 模型名；为空时用通道默认值 */
    private String model;

    /** 采样温度 */
    private Double temperature;

    /** 最大回复 token 数 */
    private Integer maxTokens;
}
