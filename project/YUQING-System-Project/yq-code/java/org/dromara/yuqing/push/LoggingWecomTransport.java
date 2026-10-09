package org.dromara.yuqing.push;

import lombok.extern.slf4j.Slf4j;

/**
 * 日志降级通道
 *
 * <p>两种用途，语义严格区分（由构造参数决定）：</p>
 * <ol>
 *   <li><b>凭据缺失降级</b>（{@code markSuccess=false}）：一律返回失败。
 *       没配凭据就是「没发出去」，把结果标成 success 会让推送记录、成功率看板、
 *       失败重试全部失真，运维再也发现不了推送其实是空转。</li>
 *   <li><b>演练模式</b>（{@code markSuccess=true}，由 {@code push.dryRun} 打开）：
 *       人为开关，联调期避免打扰真实用户，按成功留痕并在内容里标注。</li>
 * </ol>
 *
 * @author ruoyi
 */
@Slf4j
public class LoggingWecomTransport implements WecomTransport {

    /** 默认：凭据缺失降级 —— 必须标记失败 */
    public static final String UNCONFIGURED_REASON =
        "企业微信凭据未配置（corpId/corpSecret/agentId），通道降级为日志，消息未发送";

    private final boolean markSuccess;
    private final String reason;

    /** 凭据缺失降级（默认用法） */
    public LoggingWecomTransport() {
        this(false, UNCONFIGURED_REASON);
    }

    /** 演练模式 */
    public LoggingWecomTransport(boolean markSuccess, String reason) {
        this.markSuccess = markSuccess;
        this.reason = reason == null ? UNCONFIGURED_REASON : reason;
    }

    public static LoggingWecomTransport dryRun() {
        return new LoggingWecomTransport(true, "演练模式（push.dryRun=true），消息未真正发送");
    }

    @Override
    public String name() {
        return markSuccess ? "logging-dryrun" : "logging-fallback";
    }

    @Override
    public SendResult sendText(String touser, String content) {
        log.warn("[推送降级] {}。touser={} content={}", reason, touser, brief(content));
        return result();
    }

    @Override
    public SendResult sendMarkdown(String touser, String content) {
        return sendText(touser, content);
    }

    @Override
    public SendResult sendFile(String touser, String fileName, byte[] bytes) {
        log.warn("[推送降级] {}。touser={} file={} size={}", reason, touser, fileName,
            bytes == null ? 0 : bytes.length);
        return result();
    }

    private SendResult result() {
        return markSuccess ? SendResult.ok(null) : SendResult.fail(-1, reason);
    }

    private static String brief(String s) {
        if (s == null) {
            return "";
        }
        return s.length() > 200 ? s.substring(0, 200) + "…" : s;
    }
}
