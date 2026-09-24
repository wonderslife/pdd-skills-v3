package org.dromara.yuqing.collect.guard;

import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.json.CollectJson;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.CollectResult;
import org.dromara.yuqing.collect.pipeline.CollectMetrics;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 采集健康守卫（F-004 验收标准 9）。
 *
 * <p>某采集单元（任务 × 渠道）连续 N 次「零采集」或「全部失败」时生成告警，
 * 并按配置通道推送异常提醒。N 由 {@code yuqing.collect.unhealthy-threshold} 控制。</p>
 *
 * <p>通知通道：{@code log}（默认，只落日志与监控）/ {@code webhook}（POST JSON）/
 * {@code wecom}（企业微信，待 F-011 推送模块落地后接入，当前降级为日志）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class CollectHealthGuard {

    private final YqCollectProperties props;

    private final CollectMetrics metrics;

    private volatile HttpClient httpClient;

    public CollectHealthGuard(YqCollectProperties props, CollectMetrics metrics) {
        this.props = props;
        this.metrics = metrics;
    }

    /**
     * 评估一个批次结果：更新连续异常计数，达到阈值则告警。
     *
     * @param result 批次结果
     */
    public void evaluate(CollectResult result) {
        if (result == null || result.getTaskId() == null) {
            return;
        }
        String unitKey = result.getTaskId() + ":" + result.getChannelId();
        int count = metrics.bumpAbnormal(unitKey, result.isAbnormal());
        int threshold = Math.max(1, props.getUnhealthyThreshold());
        if (!result.isAbnormal() || count < threshold) {
            return;
        }
        // 达到阈值时告警一次，之后每累计 N 次再告警一次，避免刷屏
        if (count != threshold && count % threshold != 0) {
            return;
        }
        String message = buildMessage(result, count);
        log.error("[采集告警] {}", message);
        notifyExternal(result, count, message);
    }

    private String buildMessage(CollectResult result, int count) {
        String reason = result.isEmptyFetch() ? "连续零采集" : "连续采集失败";
        return "采集异常：" + reason + " " + count + " 次 | 任务「" + safe(result.getTaskName(), result.getTaskId())
            + "」× 渠道「" + safe(result.getChannelName(), result.getChannelId())
            + "」| 批次 " + result.getBatchNo() + " | 原因: " + safe(result.getFailReason(), "未记录");
    }

    private void notifyExternal(CollectResult result, int count, String message) {
        if (!props.getNotify().isEnabled()) {
            return;
        }
        String channel = props.getNotify().getChannel() == null ? "log" : props.getNotify().getChannel().trim().toLowerCase();
        if ("wecom".equals(channel)) {
            log.warn("[采集告警] 企业微信通道待 F-011 推送模块接入，本次仅记录日志");
            return;
        }
        if (!"webhook".equals(channel) || props.getNotify().getWebhookUrl().isBlank()) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", "yuqing.collect.abnormal");
        payload.put("taskId", result.getTaskId());
        payload.put("taskName", result.getTaskName());
        payload.put("channelId", result.getChannelId());
        payload.put("channelName", result.getChannelName());
        payload.put("batchNo", result.getBatchNo());
        payload.put("consecutiveCount", count);
        payload.put("resultStatus", result.getResultStatus());
        payload.put("message", message);
        payload.put("timestamp", System.currentTimeMillis());
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(props.getNotify().getWebhookUrl()))
                .timeout(Duration.ofMillis(props.getNotify().getTimeoutMs()))
                .header("Content-Type", "application/json;charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(CollectJson.toJsonString(payload), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            log.info("[采集告警] webhook 推送完成 status={}", response.statusCode());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("[采集告警] webhook 推送失败: {}", e.getMessage());
        }
    }

    private String safe(String value, Object fallback) {
        return value == null || value.isBlank() ? String.valueOf(fallback) : value;
    }

    private HttpClient client() {
        HttpClient c = httpClient;
        if (c == null) {
            synchronized (this) {
                c = httpClient;
                if (c == null) {
                    c = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                    httpClient = c;
                }
            }
        }
        return c;
    }
}
