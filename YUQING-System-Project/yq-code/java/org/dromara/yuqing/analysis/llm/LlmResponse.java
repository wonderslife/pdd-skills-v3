package org.dromara.yuqing.analysis.llm;

import lombok.Data;

/**
 * 一次对话补全结果（F-007）
 *
 * <p>失败态不抛异常而是返回值：批量研判里单条失败必须只影响这一条，
 * 调用方需要拿到「原因文本」写进 {@code yq_opinion_analysis.fail_reason}
 * 和 {@code yq_opinion.analyze_status = failed}，而不是让整个批次中断。</p>
 *
 * @author ruoyi
 */
@Data
public class LlmResponse {

    /** 是否成功（HTTP 2xx 且响应体含可用的 message.content） */
    private boolean success;

    /** 回复正文（模型原始输出，可能是 JSON、围栏 JSON 或夹带废话） */
    private String content;

    /** 实际使用的模型名 */
    private String model;

    /** 失败原因（可读，直接落库/展示） */
    private String reason;

    /** 原始响应体（截断后保存，便于排查；不进数据库） */
    private String rawBody;

    /** 消耗的输入 token（服务端未返回时为 null） */
    private Integer promptTokens;

    /** 消耗的输出 token（服务端未返回时为 null） */
    private Integer completionTokens;

    public static LlmResponse ok(String content, String model) {
        LlmResponse r = new LlmResponse();
        r.success = true;
        r.content = content;
        r.model = model;
        return r;
    }

    public static LlmResponse fail(String reason) {
        LlmResponse r = new LlmResponse();
        r.success = false;
        r.reason = reason;
        return r;
    }

    public LlmResponse raw(String body) {
        this.rawBody = body;
        return this;
    }

    public LlmResponse usage(Integer prompt, Integer completion) {
        this.promptTokens = prompt;
        this.completionTokens = completion;
        return this;
    }

    public static LlmResponse failed(String reason) {
        return fail(reason);
    }
}
