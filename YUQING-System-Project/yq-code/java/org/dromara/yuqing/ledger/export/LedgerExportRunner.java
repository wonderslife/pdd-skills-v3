package org.dromara.yuqing.ledger.export;

import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.oss.client.OssClient;
import org.dromara.common.oss.factory.OssFactory;
import org.dromara.common.oss.model.Options;
import org.dromara.common.oss.model.PutObjectResult;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.config.YqLedgerProperties;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerRow;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.dromara.yuqing.ledger.support.LedgerColumnCatalog;
import org.dromara.yuqing.ledger.support.LedgerQuerySummary;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.mapper.YqLedgerExportLogMapper;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 台账导出执行器（F-016 验收标准 5、6、10）
 *
 * <p><b>同步与异步共用同一份实现：</b>{@link #render(LedgerExportBo, LedgerScope)}
 * 是唯一的「取数 + 生成 xlsx」路径。同步导出由 Service 直接调用；
 * 异步导出由 SnailJob 执行器（{@link org.dromara.yuqing.job.YqLedgerExportJobExecutor}）
 * 或本类的进程内线程池调用。两条路走同一份代码，才不会出现
 * 「同步导出的列对了、异步少了三列」这种只在生产暴露的差异。</p>
 *
 * <p><b>权限（验收标准 8）：</b>异步执行时不在请求线程里，
 * 因此范围必须由发起人的 userId **重新推导**（{@code IYqLedgerService.scopeOfUser}），
 * 而不是把范围快照存进库接着用。重新推导保证：即使发起人的任务归属
 * 在执行期间发生变化，导出也遵循当前权限 —— 权限只可能收紧，不会因为
 * 「任务已经提交了」而固化一个过期的宽范围。</p>
 *
 * <p><b>为什么保留进程内线程池兜底：</b>SnailJob 的作业触发需要一个在控制台
 * 预先创建的作业ID（{@code yuqing.ledger.export-job-id}）。开发 / 演示环境
 * 通常没有这个作业，若只支持 SnailJob，异步导出会直接不可用。
 * 配置了就优先用 SnailJob（可观测、可重试、可人工补偿），
 * 没配置就退化为本进程线程池，并在日志里明确标注退化。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LedgerExportRunner {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final IYqLedgerService ledgerService;
    private final YqLedgerExportLogMapper exportLogMapper;
    private final YqLedgerProperties props;

    /** 懒初始化：只有真正走到「退化为进程内执行」时才创建线程池 */
    private volatile ExecutorService localPool;

    /**
     * 渲染导出字节（纯取数 + 生成，不落库、不上传）。
     *
     * @param bo    导出请求
     * @param scope 已解析的可见范围
     * @return 生成结果（含字节与行数）
     */
    public RenderOutput render(LedgerExportBo bo, LedgerScope scope) {
        LedgerQuery q = bo.getQuery() == null ? new LedgerQuery() : bo.getQuery();
        List<String> fields = LedgerColumnCatalog.resolve(bo.getColumns());

        int hardLimit = props.getMaxExportRows();
        int limit = hardLimit;
        if (bo.getRowLimit() != null && bo.getRowLimit() > 0 && bo.getRowLimit() < hardLimit) {
            limit = bo.getRowLimit();
        }

        List<LedgerRow> rows = ledgerService.rowsForExport(q, scope, limit);
        String name = buildFileName(bo, q);
        byte[] bytes = LedgerExcelWriter.write(rows, fields, sheetOf(bo));
        return new RenderOutput(bytes, rows.size(), fields.size(), name);
    }

    /** 生成文件名（含条件摘要，便于下载后辨认语境） */
    public String buildFileName(LedgerExportBo bo, LedgerQuery q) {
        String prefix = StringUtils.isNotBlank(bo.getFileNamePrefix())
            ? bo.getFileNamePrefix().trim()
            : "舆情台账";
        String tag = LedgerQuerySummary.toFileTag(q);
        return prefix + "_" + tag + "_" + LocalDateTime.now().format(STAMP) + ".xlsx";
    }

    /**
     * 执行一次异步导出（含状态流转与推送）。
     *
     * <p>由 SnailJob 执行器或进程内线程池调用。状态流转
     * {@code pending -> running -> success/failed} 全部落库，
     * 失败原因一并写入，绝不静默。</p>
     *
     * @param exportId 导出记录ID
     */
    public void runAsync(Long exportId) {
        YqLedgerExportLog record = exportLogMapper.selectById(exportId);
        if (record == null) {
            log.warn("[台账导出] 记录不存在，跳过: {}", exportId);
            return;
        }
        if ("success".equals(record.getStatus())) {
            log.info("[台账导出] #{} 已是成功状态，跳过重复执行", exportId);
            return;
        }

        markStatus(exportId, "running", null, null);
        try {
            /* 条件与字段从审计记录还原（异步执行时请求上下文已不存在） */
            LedgerExportBo bo = new LedgerExportBo();
            LedgerQuery q = org.dromara.common.json.utils.JsonUtils
                .parseObject(record.getQueryJson(), LedgerQuery.class);
            bo.setQuery(q == null ? new LedgerQuery() : q);
            bo.setExportScope(record.getExportScope());
            bo.setRowLimit(record.getRowCount() != null && record.getRowCount() > 0
                ? record.getRowCount() : null);
            if (StringUtils.isNotBlank(record.getColumnsJson())) {
                bo.setColumns(org.dromara.common.json.utils.JsonUtils
                    .parseArray(record.getColumnsJson(), String.class));
            }
            if (StringUtils.isNotBlank(record.getFileName())) {
                /* 复用已登记的文件名，保证「审计里的文件名 == 实际产物名」 */
                bo.setFileNamePrefix(stripExtension(record.getFileName()));
            }

            /* 关键：按发起人重新推导数据范围，不信任任何历史快照 */
            LedgerScope scope = ledgerService.scopeOfUser(record.getCreateBy());
            if (scope.isDenyAll()) {
                markStatus(exportId, "failed",
                    "发起人当前没有可导出的授权范围（可见 0 条），已终止导出", null);
                return;
            }

            RenderOutput out = render(bo, scope);

            /* 上传对象存储；失败不算任务失败 —— 数据已生成，
             * 但无法提供下载链接，因此记 failed 并说明原因。 */
            UploadResult up = upload(out);
            if (up == null || up.getUrl() == null) {
                markStatus(exportId, "failed",
                    "文件生成成功但上传对象存储失败，请检查 OSS 配置后重试", null);
                return;
            }
            markStatus(exportId, "success", null, up);
            log.info("[台账导出] #{} 完成，{} 行 / {} 列 -> {}", exportId, out.getRowCount(),
                out.getColumnCount(), up.getUrl());

            /* 验收标准 6：完成后推送下载链接（默认关闭，需显式开启且已配企微） */
            pushLinkQuietly(record, out, up);

        } catch (Exception e) {
            log.error("[台账导出] #{} 执行异常", exportId, e);
            markStatus(exportId, "failed", brief(e.getMessage()), null);
        }
    }

    /**
     * 提交异步执行：优先 SnailJob，未配置作业ID时退化为进程内线程池。
     *
     * @return 实际使用的执行方式描述（写入日志，便于排障）
     */
    public String submit(Long exportId) {
        Long jobId = props.getExportJobId();
        if (jobId != null) {
            try {
                Boolean ok = com.aizuda.snailjob.client.job.core.openapi.SnailJobOpenApi
                    .triggerClusterJob(jobId)
                    .addArgsStr("exportId", exportId)
                    .execute();
                if (Boolean.TRUE.equals(ok)) {
                    return "snailjob(jobId=" + jobId + ")";
                }
                log.warn("[台账导出] SnailJob 触发返回非成功，退化到进程内执行: #{}", exportId);
            } catch (Exception e) {
                log.warn("[台账导出] SnailJob 触发失败（{}），退化到进程内执行: #{}",
                    e.getMessage(), exportId);
            }
        }
        pool().execute(() -> runAsync(exportId));
        return "local-pool";
    }

    @PreDestroy
    public void shutdown() {
        ExecutorService p = localPool;
        if (p != null) {
            p.shutdown();
        }
    }

    /* ------------------------------------------------------------ 内部 */

    private ExecutorService pool() {
        ExecutorService p = localPool;
        if (p == null) {
            synchronized (this) {
                p = localPool;
                if (p == null) {
                    int n = Math.max(props.getExportPoolSize(), 1);
                    AtomicInteger seq = new AtomicInteger(1);
                    ThreadFactory tf = r -> {
                        Thread t = new Thread(r, "yq-ledger-export-" + seq.getAndIncrement());
                        t.setDaemon(true);
                        return t;
                    };
                    p = Executors.newFixedThreadPool(n, tf);
                    localPool = p;
                    log.info("[台账导出] 未配置 SnailJob 作业ID，已启用进程内导出线程池（并发 {}）", n);
                }
            }
        }
        return p;
    }

    private void markStatus(Long exportId, String status, String failReason, UploadResult up) {
        YqLedgerExportLog upd = new YqLedgerExportLog();
        upd.setExportId(exportId);
        upd.setStatus(status);
        if (failReason != null) {
            upd.setFailReason(failReason);
        }
        if (up != null) {
            upd.setFileUrl(up.getUrl());
            upd.setFileName(up.getFileName());
            upd.setFinishTime(LocalDateTime.now());
        }
        if ("failed".equals(status)) {
            upd.setFinishTime(LocalDateTime.now());
        }
        exportLogMapper.updateById(upd);
    }

    /**
     * 上传导出产物到对象存储。
     *
     * <p><b>为什么返回 null 而不抛异常：</b>同步导出路径由 Service 决定
     * 「拿不到链接就报错」，异步路径由 {@link #runAsync(Long)} 决定
     * 「拿不到链接就记 failed」—— 两条路的处理策略不同，
     * 因此这里只如实返回结果，把决策留给调用方。</p>
     *
     * @return 上传结果；失败返回 {@code null}（已记 warn 日志）
     */
    public UploadResult upload(RenderOutput out) {
        if (out == null || out.getBytes() == null || out.getBytes().length == 0) {
            return null;
        }
        try {
            OssClient client = OssFactory.instance();
            String pathKey = client.buildPathKey(out.getFileName());
            PutObjectResult result = client.upload(pathKey, out.getBytes(),
                Options.builder().setContentType(LedgerExcelWriter.MIME_XLSX));
            if (result == null) {
                return null;
            }
            return new UploadResult(out.getFileName(), result.url());
        } catch (Exception e) {
            log.warn("[台账导出] 上传对象存储失败 fileName={}", out.getFileName(), e);
            return null;
        }
    }

    /** 推送下载链接（默认关闭；失败只记日志，不影响导出结果） */
    private void pushLinkQuietly(YqLedgerExportLog record, RenderOutput out, UploadResult up) {
        if (!props.isExportPushEnabled()) {
            return;
        }
        try {
            /* 收件人默认是发起人；配置了固定收件人则以配置为准 */
            java.util.Set<Long> targets = new java.util.LinkedHashSet<>();
            if (props.getExportPushUserIds() != null && !props.getExportPushUserIds().isEmpty()) {
                targets.addAll(props.getExportPushUserIds());
            } else if (record.getCreateBy() != null) {
                targets.add(record.getCreateBy());
            }
            if (targets.isEmpty()) {
                log.warn("[台账导出] #{} 无有效推送对象，跳过推送", record.getExportId());
                return;
            }
            /* PushRequest 是 @Builder 形态（无 setter），必须走 builder —— 与 F-011 保持一致 */
            org.dromara.yuqing.push.PushRequest req = org.dromara.yuqing.push.PushRequest.builder()
                .scene(LedgerPushScene.EXPORT_READY)
                .pushLevel("scheduled")
                .msgType("text")
                .contentType("detail")
                .content("台账导出已完成，共 " + out.getRowCount() + " 条。下载链接：" + up.getUrl())
                .targetUserIds(targets)
                .quietStart(props.getPushQuietStart())
                .quietEnd(props.getPushQuietEnd())
                .now(LocalDateTime.now())
                .build();
            org.dromara.yuqing.push.PushOutcome outcome = pushDispatcher.dispatch(req);
            if (outcome == null) {
                log.warn("[台账导出] #{} 推送无返回", record.getExportId());
                return;
            }
            log.info("[台账导出] #{} 推送结果: {} {}", record.getExportId(),
                outcome.getKind(), outcome.getReason());
        } catch (Exception e) {
            log.warn("[台账导出] #{} 推送下载链接失败（不影响导出结果）", record.getExportId(), e);
        }
    }

    private org.dromara.yuqing.push.PushDispatcher pushDispatcher;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setPushDispatcher(org.dromara.yuqing.push.PushDispatcher d) {
        this.pushDispatcher = d;
    }

    private static String stripExtension(String name) {
        if (name == null) {
            return null;
        }
        return name.endsWith(".xlsx") ? name.substring(0, name.length() - 5) : name;
    }

    private static String brief(String msg) {
        if (msg == null) {
            return "未知错误";
        }
        String s = msg.replace('\r', ' ').replace('\n', ' ');
        return s.length() <= 500 ? s : s.substring(0, 500);
    }

    private static String sheetOf(LedgerExportBo bo) {
        return "cluster".equalsIgnoreCase(bo.getExportScope()) ? "事件聚合台账" : "舆情台账";
    }

    /** 渲染产物 */
    public static final class RenderOutput {
        private final byte[] bytes;
        private final int rowCount;
        private final int columnCount;
        private final String fileName;

        RenderOutput(byte[] bytes, int rowCount, int columnCount, String fileName) {
            this.bytes = bytes;
            this.rowCount = rowCount;
            this.columnCount = columnCount;
            this.fileName = fileName;
        }

        public byte[] getBytes() {
            return bytes;
        }

        public int getRowCount() {
            return rowCount;
        }

        public int getColumnCount() {
            return columnCount;
        }

        public String getFileName() {
            return fileName;
        }
    }

    /** 上传结果（不可变；{@code url} 即验收标准 6 所指的「下载链接」） */
    public static final class UploadResult {
        private final String fileName;
        private final String url;

        UploadResult(String fileName, String url) {
            this.fileName = fileName;
            this.url = url;
        }

        public String getFileName() {
            return fileName;
        }

        public String getUrl() {
            return url;
        }
    }
}
