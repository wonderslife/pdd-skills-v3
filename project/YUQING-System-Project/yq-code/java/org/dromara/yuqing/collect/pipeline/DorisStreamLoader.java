package org.dromara.yuqing.collect.pipeline;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import tools.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.dromara.yuqing.collect.json.CollectJson;
import org.dromara.yuqing.collect.config.YqCollectProperties;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.domain.YqCollectLog;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 攒批落库（《技术架构说明》§4.6：Doris Stream Load 直写，无消息中间件）。
 *
 * <p>攒批策略：达到 {@code sink.batch-size}（默认 1000 条）或到 {@code sink.flush-interval-ms}
 * （默认 5s）即触发一次 Stream Load；{@code label} 以批次号 + 序号生成，
 * 重试复用同一 label，Doris 侧自动幂等吸收。</p>
 *
 * <p>三种模式：{@code stream-load}（生产）/ {@code jdbc}（本地无 Doris）/ {@code noop}（离线自测）。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
public class DorisStreamLoader {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final YqCollectProperties props;

    private final ObjectProvider<CollectJdbcWriter> jdbcWriterProvider;

    private final Object lock = new Object();

    private final List<RawOpinion> opinionBuffer = new ArrayList<>();

    private final List<YqCollectLog> logBuffer = new ArrayList<>();

    private final AtomicLong loadedOpinions = new AtomicLong();

    private final AtomicLong loadedLogs = new AtomicLong();

    private final AtomicLong dropped = new AtomicLong();

    private final AtomicLong loadFailures = new AtomicLong();

    private final AtomicLong labelSeq = new AtomicLong();

    private final AtomicInteger feIndex = new AtomicInteger();

    private volatile HttpClient httpClient;

    private ScheduledExecutorService scheduler;

    public DorisStreamLoader(YqCollectProperties props, ObjectProvider<CollectJdbcWriter> jdbcWriterProvider) {
        this.props = props;
        this.jdbcWriterProvider = jdbcWriterProvider;
    }

    @PostConstruct
    public void start() {
        long interval = Math.max(500L, props.getSink().getFlushIntervalMs());
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "yq-collect-flush");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleWithFixedDelay(this::flushAll, interval, interval, TimeUnit.MILLISECONDS);
        log.info("[采集落库] 攒批通道已启动 mode={} batchSize={} flushInterval={}ms",
            props.getSink().getMode(), props.getSink().getBatchSize(), interval);
    }

    @PreDestroy
    public void stop() {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        flushAll();
    }

    /**
     * 追加待落库的舆情明细。
     *
     * @param list 原始舆情
     */
    public void appendOpinions(Collection<RawOpinion> list) {
        if (list == null || list.isEmpty()) {
            return;
        }
        boolean overflow = false;
        synchronized (lock) {
            for (RawOpinion raw : list) {
                if (opinionBuffer.size() >= props.getSink().getMaxQueueSize()) {
                    overflow = true;
                    dropped.incrementAndGet();
                    continue;
                }
                raw.setPipelineStatus("inserted");
                opinionBuffer.add(raw);
            }
        }
        if (overflow) {
            log.warn("[采集落库] 队列已满({})，本批部分记录被丢弃", props.getSink().getMaxQueueSize());
        }
        if (sizeOfOpinions() >= Math.max(1, props.getSink().getBatchSize())) {
            flushAll();
        }
    }

    /**
     * 追加一条采集日志（验收标准 10）。
     *
     * @param row 日志实体
     */
    public void appendLog(YqCollectLog row) {
        if (row == null || !props.getSink().isWriteCollectLog()) {
            return;
        }
        synchronized (lock) {
            logBuffer.add(row);
        }
    }

    /**
     * 立即刷写所有缓冲。
     */
    public void flushAll() {
        List<RawOpinion> opinions;
        List<YqCollectLog> logs;
        synchronized (lock) {
            opinions = new ArrayList<>(opinionBuffer);
            opinionBuffer.clear();
            logs = new ArrayList<>(logBuffer);
            logBuffer.clear();
        }
        if (!opinions.isEmpty()) {
            writeOpinions(opinions);
        }
        for (YqCollectLog row : logs) {
            writeLog(row);
        }
    }

    /**
     * 已成功落库的明细条数。
     *
     * @return 条数
     */
    /**
     * 当前尚未刷写的正文缓冲副本（只读快照）。
     *
     * <p>供自测与排障使用：{@code mode=noop} 时数据只进缓冲不落盘，
     * 通过它能确认「到底准备写什么」，也用于验证命中关键词是否已回写。</p>
     *
     * @return 正文缓冲副本
     */
    public List<RawOpinion> bufferedOpinions() {
        synchronized (lock) {
            return new ArrayList<>(opinionBuffer);
        }
    }

    public long loadedOpinionCount() {
        return loadedOpinions.get();
    }

    /**
     * 已成功落库的日志条数。
     *
     * @return 条数
     */
    public long loadedLogCount() {
        return loadedLogs.get();
    }

    /**
     * 因队列溢出被丢弃的条数。
     *
     * @return 条数
     */
    public long droppedCount() {
        return dropped.get();
    }

    /**
     * 落库失败次数。
     *
     * @return 次数
     */
    public long loadFailureCount() {
        return loadFailures.get();
    }

    private long sizeOfOpinions() {
        synchronized (lock) {
            return opinionBuffer.size();
        }
    }

    private void writeOpinions(List<RawOpinion> batch) {
        String mode = mode();
        if ("noop".equals(mode)) {
            loadedOpinions.addAndGet(batch.size());
            log.debug("[采集落库] noop 模式，跳过写入 {} 条", batch.size());
            return;
        }
        if ("jdbc".equals(mode)) {
            CollectJdbcWriter writer = jdbcWriterProvider.getIfAvailable();
            if (writer == null) {
                loadFailures.incrementAndGet();
                log.warn("[采集落库] jdbc 模式但未装配 CollectJdbcWriter");
                return;
            }
            try {
                loadedOpinions.addAndGet(writer.insertOpinions(batch));
            } catch (Exception e) {
                loadFailures.incrementAndGet();
                log.error("[采集落库] JDBC 写入失败 {} 条: {}", batch.size(), e.getMessage());
            }
            return;
        }
        List<Map<String, Object>> rows = new ArrayList<>(batch.size());
        int overSized = 0;
        int maxBytes = Math.max(1024, props.getSink().getDoris().getMaxRecordBytes());
        for (RawOpinion raw : batch) {
            Map<String, Object> row = toOpinionRow(raw);
            String json = CollectJson.toJsonString(row);
            if (json.getBytes(StandardCharsets.UTF_8).length > maxBytes) {
                overSized++;
                dropped.incrementAndGet();
                continue;
            }
            rows.add(row);
        }
        if (overSized > 0) {
            log.warn("[采集落库] {} 条记录超过单条字节上限({}B)，已丢弃", overSized, maxBytes);
        }
        if (rows.isEmpty()) {
            return;
        }
        String label = "yq_op_" + labelSeq.incrementAndGet() + "_" + System.currentTimeMillis();
        try {
            streamLoad("yq_opinion", CollectJson.toJsonString(rows), label);
            loadedOpinions.addAndGet(rows.size());
        } catch (Exception e) {
            loadFailures.incrementAndGet();
            log.error("[采集落库] Stream Load 失败 {} 条 label={}: {}", rows.size(), label, e.getMessage());
        }
    }

    private void writeLog(YqCollectLog row) {
        String mode = mode();
        try {
            if ("noop".equals(mode)) {
                loadedLogs.incrementAndGet();
                return;
            }
            if ("jdbc".equals(mode)) {
                CollectJdbcWriter writer = jdbcWriterProvider.getIfAvailable();
                if (writer == null) {
                    loadFailures.incrementAndGet();
                    return;
                }
                loadedLogs.addAndGet(writer.insertLog(row));
                return;
            }
            Map<String, Object> map = toLogRow(row);
            String label = "yq_log_" + labelSeq.incrementAndGet() + "_" + System.currentTimeMillis();
            streamLoad("yq_collect_log", CollectJson.toJsonString(List.of(map)), label);
            loadedLogs.incrementAndGet();
        } catch (Exception e) {
            loadFailures.incrementAndGet();
            log.error("[采集落库] 采集日志写入失败 batchNo={}: {}", row.getBatchNo(), e.getMessage());
        }
    }

    /**
     * 执行一次 Doris Stream Load（HTTP PUT，label 幂等）。
     */
    private void streamLoad(String table, String jsonBody, String label) throws IOException {
        YqCollectProperties.Sink.Doris cfg = props.getSink().getDoris();
        String[] endpoints = cfg.getFeHttp().split(",");
        String fe = endpoints[Math.floorMod(feIndex.getAndIncrement(), endpoints.length)].trim();
        String url = fe + "/api/" + cfg.getDatabase() + "/" + table + "/_stream_load";
        String auth = Base64.getEncoder()
            .encodeToString((cfg.getUsername() + ":" + cfg.getPassword()).getBytes(StandardCharsets.UTF_8));
        // 注意：JDK HttpClient 把 Expect / Connection / Content-Length 列为受限头，
        // 设置会抛 IllegalArgumentException；Doris 不依赖 Expect: 100-continue，故不设置。
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
            .timeout(Duration.ofMillis(cfg.getTimeoutMs()))
            .header("Authorization", "Basic " + auth)
            .header("label", label)
            .header("format", "json")
            .header("strip_outer_array", "true")
            .header("read_json_by_line", "false")
            .header("max_filter_ratio", cfg.getMaxFilterRatio())
            .PUT(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
            .build();
        try {
            HttpResponse<String> response = client().send(request, HttpResponse.BodyHandlers.ofString());
            String body = response.body();
            if (response.statusCode() != 200) {
                throw new IOException("HTTP " + response.statusCode() + " " + shorten(body));
            }
            JsonNode node = CollectJson.readTree(body);
            String status = node.path("Status").asText();
            if (!"Success".equalsIgnoreCase(status)) {
                throw new IOException("Doris 返回 " + status + " " + shorten(body));
            }
            log.debug("[采集落库] Stream Load 成功 table={} label={} rows={}", table, label, node.path("NumberLoadedRows").asText());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Stream Load 被中断", e);
        }
    }

    private Map<String, Object> toOpinionRow(RawOpinion raw) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("collect_date", raw.getCollectDate() == null ? LocalDate.now().format(DATE) : raw.getCollectDate().format(DATE));
        row.put("url_hash", raw.getUrlHash());
        row.put("opinion_id", raw.getOpinionId() == null ? IdWorker.getId() : raw.getOpinionId());
        row.put("task_id", raw.getTaskId());
        row.put("channel_id", raw.getChannelId() == null ? 0L : raw.getChannelId());
        row.put("title", blankTo(raw.getTitle(), "（无标题）"));
        row.put("content", raw.getContent());
        row.put("opinion_url", blankTo(raw.getOpinionUrl(), ""));
        row.put("publish_time", format(raw.getPublishTime()));
        row.put("author", raw.getAuthor());
        row.put("like_count", raw.getLikeCount());
        row.put("comment_count", raw.getCommentCount());
        row.put("share_count", raw.getShareCount());
        row.put("read_count", raw.getReadCount());
        row.put("region", raw.getRegion());
        row.put("device_info", raw.getDeviceInfo());
        row.put("topic_tags", raw.getTopicTags());
        row.put("collect_source", blankTo(raw.getCollectSource(), "auto"));
        row.put("collect_time", format(raw.getCollectTime() == null ? LocalDateTime.now() : raw.getCollectTime()));
        row.put("batch_no", raw.getBatchNo());
        row.put("clean_status", "pending");
        row.put("analyze_status", "pending");
        row.put("alert_flag", "0");
        row.put("push_flag", "0");
        row.put("del_flag", "0");
        return row;
    }

    private Map<String, Object> toLogRow(YqCollectLog row) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("log_id", row.getLogId() == null ? IdWorker.getId() : row.getLogId());
        map.put("task_id", row.getTaskId());
        map.put("channel_id", row.getChannelId());
        map.put("batch_no", blankTo(row.getBatchNo(), ""));
        map.put("collect_source", blankTo(row.getCollectSource(), "auto"));
        map.put("strategy", row.getStrategy());
        map.put("fetched_count", row.getFetchedCount());
        map.put("inserted_count", row.getInsertedCount());
        map.put("dup_count", row.getDupCount());
        map.put("rejected_count", row.getRejectedCount());
        map.put("failed_count", row.getFailedCount());
        map.put("cost_ms", row.getCostMs());
        map.put("result_status", blankTo(row.getResultStatus(), "success"));
        map.put("fail_reason", row.getFailReason());
        map.put("create_time", format(row.getCreateTime() == null ? LocalDateTime.now() : row.getCreateTime()));
        return map;
    }

    private String mode() {
        String mode = props.getSink().getMode();
        return mode == null ? "stream-load" : mode.trim().toLowerCase();
    }

    private String format(LocalDateTime time) {
        return time == null ? null : time.format(DATETIME);
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String shorten(String body) {
        if (body == null) {
            return "";
        }
        return body.length() > 500 ? body.substring(0, 500) : body;
    }

    private HttpClient client() {
        HttpClient c = httpClient;
        if (c == null) {
            synchronized (this) {
                c = httpClient;
                if (c == null) {
                    c = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(10))
                        .version(HttpClient.Version.HTTP_1_1)
                        .build();
                    httpClient = c;
                }
            }
        }
        return c;
    }
}
