package org.dromara.yuqing.push;

import java.io.IOException;

/**
 * 企业微信消息通道 SPI（F-011 验收标准 4 / 10）
 *
 * <p>抽成 SPI 的意义：生产注入真实 HTTP 通道；凭据缺失或离线自测时注入日志通道，
 * <b>并且日志通道会把结果标记为失败</b>，绝不静默假装成功——
 * 一次没发出去的预警如果不留失败痕迹，整条预警链路就等于不存在。</p>
 *
 * @author ruoyi
 */
public interface WecomTransport {

    /** 通道名（用于推送记录留痕） */
    String name();

    /** 发送文本消息 */
    SendResult sendText(String touser, String content);

    /** 发送 markdown 消息 */
    SendResult sendMarkdown(String touser, String content);

    /** 上传文件并发送文件消息（报告推送，验收标准 10） */
    SendResult sendFile(String touser, String fileName, byte[] bytes);

    /** 发送结果 */
    class SendResult {

        private final boolean ok;
        private final int errcode;
        private final String errmsg;
        private final String raw;

        public SendResult(boolean ok, int errcode, String errmsg, String raw) {
            this.ok = ok;
            this.errcode = errcode;
            this.errmsg = errmsg;
            this.raw = raw;
        }

        public static SendResult ok(String raw) {
            return new SendResult(true, 0, "ok", raw);
        }

        public static SendResult fail(int errcode, String errmsg) {
            return new SendResult(false, errcode, errmsg, null);
        }

        public boolean isOk() {
            return ok;
        }

        public int getErrcode() {
            return errcode;
        }

        public String getErrmsg() {
            return errmsg;
        }

        public String getRaw() {
            return raw;
        }

        /** 失败原因描述（落 fail_reason） */
        public String failReason() {
            if (ok) {
                return null;
            }
            String msg = errmsg == null || errmsg.isBlank() ? "未知错误" : errmsg;
            return "errcode=" + errcode + " errmsg=" + msg;
        }
    }
}
