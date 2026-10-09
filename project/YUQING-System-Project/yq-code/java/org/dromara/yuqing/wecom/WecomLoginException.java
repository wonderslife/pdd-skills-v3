package org.dromara.yuqing.wecom;

/**
 * 企业微信免登业务异常（F-012 验收标准 1 / 11）
 *
 * <p>携带用户可读原因：H5 端会把它直接展示成提示文案，
 * 因此 message 必须是人话，不能是堆栈或错误码。</p>
 *
 * @author ruoyi
 */
public class WecomLoginException extends RuntimeException {

    public WecomLoginException(String message) {
        super(message);
    }

    public WecomLoginException(String message, Throwable cause) {
        super(message, cause);
    }
}
