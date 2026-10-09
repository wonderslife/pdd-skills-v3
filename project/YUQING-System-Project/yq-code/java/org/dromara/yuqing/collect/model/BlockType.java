package org.dromara.yuqing.collect.model;

/**
 * 被拦信号类型（《技术架构说明》§5.5.1）。
 *
 * @author ruoyi
 */
public enum BlockType {

    /** 未被拦截 */
    NONE("未被拦截"),
    /** HTTP 4xx/5xx 错误 */
    HTTP_ERROR("HTTP 错误"),
    /** 触发限流（429） */
    RATE_LIMITED("触发限流"),
    /** 返回内容为空或仅 JS 壳，需要渲染通道 */
    RENDER_REQUIRED("需要动态渲染"),
    /** 跳转验证码 / 滑块页 */
    CAPTCHA("触发人机校验"),
    /** 连接重置 / TLS 握手失败 */
    CONNECTION_RESET("连接被重置"),
    /** 返回内容与关键词无关（蜜罐页或降级内容） */
    IRRELEVANT("内容与检索词无关"),
    /** 内容长度异常（疑似蜜罐 / 陷阱字段） */
    ABNORMAL_LENGTH("内容长度异常"),
    /** 登录墙 / 付费墙（合规红线，不破解） */
    PAYWALL("登录墙或付费墙");

    private final String label;

    BlockType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
