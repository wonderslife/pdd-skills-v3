package org.dromara.yuqing.push;

import lombok.Data;

/**
 * 一次推送的执行结果
 *
 * <p>{@code kind} 取值：{@code sent}（已发送，成败看 success）/ {@code deferred}（免打扰顺延）
 * / {@code skipped}（无目标或开关关闭）。</p>
 *
 * @author ruoyi
 */
@Data
public class PushOutcome {

    public static final String SENT = "sent";
    public static final String DEFERRED = "deferred";
    public static final String SKIPPED = "skipped";

    private String kind = SKIPPED;

    /** 是否为成功发送（kind = sent 时有意义） */
    private boolean success;

    /** 落 yq_push_record.send_status 的值 */
    private String sendStatus;

    /** 失败原因 / 跳过原因 */
    private String reason;

    /** 实际重试次数 */
    private int retryCount;

    /** 实际下发的企微成员 ID 串 */
    private String wecomTargets;

    /** 无法映射为企微成员的系统用户 ID */
    private String unmappedUserIds;

    /** 通道名 */
    private String channel;

    /** 耗时毫秒 */
    private long costMs;

    /** 免打扰顺延到的时刻（kind = deferred） */
    private java.time.LocalTime deferredUntil;

    public static PushOutcome skipped(String reason) {
        PushOutcome o = new PushOutcome();
        o.setKind(SKIPPED);
        o.setSendStatus("pending");
        o.setReason(reason);
        return o;
    }

    public static PushOutcome deferred(String reason, java.time.LocalTime until) {
        PushOutcome o = new PushOutcome();
        o.setKind(DEFERRED);
        o.setSendStatus("pending");
        o.setReason(reason);
        o.setDeferredUntil(until);
        return o;
    }
}
