package org.dromara.yuqing.push;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.alert.config.YqAlertProperties;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 推送调度器（F-011）
 *
 * <p>职责边界：只做「免打扰判定 → 目标映射 → 通道发送 → 指数退避重试」，
 * 内容渲染与落库分别在 {@link PushTemplateRenderer} 与 Service 层完成，
 * 便于各自单测。</p>
 *
 * <p><b>免打扰语义：</b>定时批量一律顺延；高风险直达在
 * {@code push.immediatePierceQuiet=true}（默认）时穿透——免打扰不该吞掉最要紧的预警。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PushDispatcher {

    private final YqAlertProperties props;
    private final PushTargetResolver targetResolver;
    private final WecomTransport transport;

    public PushOutcome dispatch(PushRequest req) {
        long t0 = System.currentTimeMillis();
        PushOutcome out = new PushOutcome();
        out.setChannel(transport.name());

        if (!props.getPush().isEnabled()) {
            out.setKind(PushOutcome.SKIPPED);
            out.setSendStatus("pending");
            out.setReason("推送总开关（yuqing.alert.push.enabled）已关闭");
            out.setCostMs(System.currentTimeMillis() - t0);
            return out;
        }

        LocalDateTime now = req.getNow() == null ? LocalDateTime.now() : req.getNow();
        boolean quiet = QuietHours.inQuiet(req.getQuietStart(), req.getQuietEnd(), now.toLocalTime());
        boolean pierce = req.isHighPriority() && props.getPush().isImmediatePierceQuiet();
        if (quiet && !pierce) {
            out.setKind(PushOutcome.DEFERRED);
            out.setSendStatus("pending");
            out.setReason("处于免打扰时段 " + req.getQuietStart() + "-" + req.getQuietEnd() + "，已顺延");
            out.setDeferredUntil(QuietHours.resolveResumeTime(req.getQuietEnd()));
            out.setCostMs(System.currentTimeMillis() - t0);
            return out;
        }

        PushTargetResolver.WecomTargets targets = targetResolver.toWecom(req.getTargetUserIds());
        out.setWecomTargets(targets.getTouser());
        out.setUnmappedUserIds(targets.getUnmappedUserIds());
        if (targets.isEmpty()) {
            out.setKind(PushOutcome.SKIPPED);
            out.setSendStatus("failed");
            String reason = targets.getTotal() == 0
                ? "推送目标解析为空（规则未配置有效对象）"
                : "目标均无法映射为企业微信成员 ID，共 " + targets.getTotal() + " 人，未发送";
            out.setReason(reason);
            out.setCostMs(System.currentTimeMillis() - t0);
            log.warn("[推送] {}", reason);
            return out;
        }

        int maxRetry = PushRetryPolicy.normalizeMaxRetry(req.getMaxRetry(), props.getPush().getMaxRetry());
        WecomTransport.SendResult result = null;
        int attempt = 0;
        while (true) {
            result = invoke(req, targets.getTouser());
            if (result.isOk()) {
                break;
            }
            if (!PushRetryPolicy.canRetry(attempt, maxRetry)) {
                break;
            }
            attempt++;
            long wait = PushRetryPolicy.backoffMs(props.getPush().getRetryBackoffMs(), attempt);
            if (wait > 0) {
                try {
                    Thread.sleep(wait);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        out.setKind(PushOutcome.SENT);
        out.setRetryCount(attempt);
        out.setSuccess(result.isOk());
        out.setSendStatus(result.isOk() ? "success" : "failed");
        String reason = result.failReason();
        if (!result.isOk() && targets.getUnmappedUserIds() != null && !targets.getUnmappedUserIds().isEmpty()) {
            reason = reason + "；另有 " + targets.getUnmappedUserIds().split(",").length + " 人未映射企微成员ID";
        }
        out.setReason(reason);
        out.setCostMs(System.currentTimeMillis() - t0);
        return out;
    }

    private WecomTransport.SendResult invoke(PushRequest req, String touser) {
        String type = req.getMsgType() == null ? "text" : req.getMsgType();
        switch (type) {
            case "markdown":
                return transport.sendMarkdown(touser, req.getContent());
            case "file":
                if (req.getFileBytes() == null || req.getFileBytes().length == 0) {
                    return WecomTransport.SendResult.fail(-1, "文件内容为空，未发送");
                }
                return transport.sendFile(touser, req.getFileName(), req.getFileBytes());
            default:
                return transport.sendText(touser, req.getContent());
        }
    }

    /** 定时批量顺延后的重投：仅判断当前是否已脱离免打扰 */
    public boolean canFlushNow(String quietStart, String quietEnd, LocalTime now) {
        return !QuietHours.inQuiet(quietStart, quietEnd, now);
    }
}
