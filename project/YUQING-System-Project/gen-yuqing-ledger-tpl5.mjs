/**
 * F-016 台账 · 模板 5：导出链路（同步 / 异步 / 审计）+ 台账控制器 + 定时任务 + 配置样例
 *
 * 产物：
 *   ledger/domain/LedgerExportBo.java             导出请求
 *   ledger/domain/LedgerExportResult.java         导出结果 / 异步任务状态
 *   ledger/export/LedgerExcelWriter.java          xlsx 字节生成（纯函数，可离线自测）
 *   ledger/export/LedgerExportRunner.java         导出执行器（同步与异步共用同一实现）
 *   ledger/export/LedgerPushScene.java            导出完成推送场景常量
 *   ledger/service/IYqLedgerExportService.java    导出服务接口
 *   ledger/service/impl/YqLedgerExportServiceImpl.java  导出分流 + 审计落库
 *   job/YqLedgerExportJobExecutor.java            SnailJob 执行器（②A）
 *   controller/YqOpinionController.java           /yuqing/opinion（台账 + 检索 + 导出 + 审计）
 *   controller/YqClusterController.java           /yuqing/cluster（事件聚合视图）
 *   config/yq_ledger.yml                          配置样例
 *
 * 覆盖验收标准：5（导出 Excel，条数与字段可配）、6（超限转异步 + 下载链接）、10（导出审计）
 */
export const LEDGER_TPL5 = [

  /* ==================================================== 导出请求 */
  {
    rel: 'ledger/domain/LedgerExportBo.java',
    content: `package org.dromara.yuqing.ledger.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 台账导出请求（F-016 验收标准 5、6）
 *
 * <p>验收标准 5 要求「按当前筛选条件导出 Excel，导出条数与字段范围可配置」。因此请求体携带：
 * 完整筛选条件（{@code query}）、要导出的字段（{@code columns}）、
 * 以及是否强制异步（{@code async}）。</p>
 *
 * <p><b>为什么 {@code columns} 允许为空：</b>空 = 导出全部可导出字段。
 * 真正的裁剪与白名单过滤在 {@code LedgerColumnCatalog.resolve} 完成 ——
 * 前端传什么都只是「意向」，最终列集合由服务端目录决定。</p>
 *
 * <p><b>{@code rowLimit} 的定位：</b>它不是「导出多少条」的授权手段，
 * 而是给用户在导出对话框里选择「只要前 N 条」的便利项。
 * 真正的硬上限（{@code maxExportRows}）与同步上限（{@code syncExportLimit}）
 * 由服务端配置控制，前端无法放宽。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerExportBo implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 筛选条件（与台账列表完全一致）。
     *
     * <p>刻意与列表共用 {@link LedgerQuery}：验收标准 5 要求「按当前筛选条件导出」，
     * 若两者字段集合不一致，「所见即所得」的导出就无从保证。</p>
     */
    @Valid
    @NotNull(message = "导出条件不能为空")
    private LedgerQuery query;

    /** 导出字段（空 = 全部可导出字段） */
    private List<String> columns;

    /** 是否强制走异步（用户在大数据量时可主动选异步，不等同步超时） */
    private Boolean async;

    /** 用户选择的「只导前 N 条」，空 = 不限制（仍受服务端硬上限约束） */
    private Integer rowLimit;

    /** 自定义文件名前缀（可选，服务端会再拼时间戳） */
    private String fileNamePrefix;

    /** 导出范围标识：ledger（台账）/ cluster（事件聚合），用于审计分类 */
    private String exportScope;
}
`,
  },

  /* ==================================================== 导出结果 */
  {
    rel: 'ledger/domain/LedgerExportResult.java',
    content: `package org.dromara.yuqing.ledger.domain;

import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 导出结果 / 异步任务状态（F-016 验收标准 6、10）
 *
 * <p>同步导出时不返回本对象（直接把 xlsx 写进响应流），
 * 异步导出时作为 JSON 返回，并被状态查询接口复用 ——
 * 这样前端只需一套类型即可同时处理「刚提交」与「轮询中」。</p>
 *
 * @author ruoyi
 */
@Data
public class LedgerExportResult implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 导出记录ID（异步任务凭此轮询） */
    private Long exportId;

    /** 导出方式：sync / async */
    private String mode;

    /** 任务状态：pending / running / success / failed */
    private String status;

    /** 导出条数（异步任务提交时为预估条数，完成后为实际条数） */
    private Integer rowCount;

    /** 导出字段数 */
    private Integer columnCount;

    /** 导出文件名 */
    private String fileName;

    /** 下载地址（异步任务完成后回填；同步导出为 null） */
    private String fileUrl;

    /** 完成时间 */
    private LocalDateTime finishTime;

    /** 失败原因 */
    private String failReason;

    /** 给用户看的说明（同步上限、转异步原因、下一步操作） */
    private String message;

    /** 本次生效的同步导出上限（前端用来解释「为什么转异步了」） */
    private Integer syncLimit;

    /** 数据范围说明（审计与提示用） */
    private String scopeDesc;
}
`,
  },

  /* ==================================================== Excel 写出 */
  {
    rel: 'ledger/export/LedgerExcelWriter.java',
    content: `package org.dromara.yuqing.ledger.export;

import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.yuqing.ledger.domain.LedgerRow;

import java.io.ByteArrayOutputStream;
import java.util.List;

/**
 * 台账 Excel 字节生成（F-016 验收标准 5）
 *
 * <p><b>为什么单独抽出来：</b>它没有数据库依赖、没有 Spring 依赖，
 * 因此可以在离线自测里真跑一遍（F016LedgerTest 会生成 xlsx 并断言
 * 文件头与列裁剪生效）。Excel 写出是最容易「改了一行没人发现」的地方 ——
 * 比如误用 EasyExcel 的注解包名，导出会静默变成没有表头的空表。</p>
 *
 * <p><b>列裁剪走 {@code ExcelBuilder.includeFields}：</b>入参 fields 已在
 * {@code LedgerColumnCatalog} 里过滤过白名单，这里只负责传给底层。
 * 同时开启 {@code orderByIncludeColumn}，让输出列顺序与目录声明顺序一致，
 * 而不是随机的字段反射顺序 —— 用户两次导出同样条件应得到同样列序。</p>
 *
 * @author ruoyi
 */
public final class LedgerExcelWriter {

    /** xlsx 的 MIME（异步上传到对象存储时作为 contentType） */
    public static final String MIME_XLSX =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private LedgerExcelWriter() {
    }

    /**
     * 生成 xlsx 字节。
     *
     * @param rows   数据行（可为空列表，此时产出一张只有表头的表 —— 这是刻意的：
     *               用户点了导出却得到 0 字节文件会更困惑）
     * @param fields 要导出的字段名（已过白名单）；为空则导出全部注解字段
     * @param sheetName 工作表名
     * @return xlsx 字节
     */
    public static byte[] write(List<LedgerRow> rows, List<String> fields, String sheetName) {
        ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
        String sheet = sheetName == null || sheetName.isBlank() ? "舆情台账" : sheetName;
        ExcelBuilder<LedgerRow> builder = ExcelBuilder
            .of(rows == null ? List.of() : rows, LedgerRow.class)
            .sheetName(sheet);
        if (fields != null && !fields.isEmpty()) {
            builder.includeFields(fields).orderByIncludeColumn(true);
        }
        builder.toStream(bos);
        return bos.toByteArray();
    }
}
`,
  },

  /* ==================================================== 推送场景常量 */
  {
    rel: 'ledger/export/LedgerPushScene.java',
    content: `package org.dromara.yuqing.ledger.export;

/**
 * 台账导出完成推送场景（F-016 验收标准 6）
 *
 * <p>验收标准 6 要求异步导出「完成后推送下载链接」。推送链路复用 F-011 的
 * {@code PushDispatcher}，但场景取值必须是 {@code yq_push_scene} 字典里的成员，
 * 否则推送记录列表会显示裸编码。</p>
 *
 * <p><b>为什么不直接加在 F-011 的 {@code PushScene} 里：</b>那个文件归
 * {@code gen-yuqing-alert.mjs} 所有，F-016 从自己包里定义常量不构成归属抢占；
 * 字典取值本身已在 {@code gen-yuqing.mjs} 的 {@code yq_push_scene} 中登记。</p>
 *
 * @author ruoyi
 */
public final class LedgerPushScene {

    /** 台账导出完成 */
    public static final String EXPORT_READY = "ledger_export_ready";

    private LedgerPushScene() {
    }
}
`,
  },

  /* ==================================================== 导出执行器 */
  {
    rel: 'ledger/export/LedgerExportRunner.java',
    content: `package org.dromara.yuqing.ledger.export;

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
        String s = msg.replace('\\r', ' ').replace('\\n', ' ');
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
`,
  },

  /* ==================================================== 导出服务接口 */
  {
    rel: 'ledger/service/IYqLedgerExportService.java',
    content: `package org.dromara.yuqing.ledger.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerExportResult;

/**
 * 台账导出服务（F-016 验收标准 5、6、10）
 *
 * <p><b>为什么同步与异步共用一个入口：</b>验收标准 6 要求「超过配置上限时转为异步」——
 * 「是否转异步」是服务端依据条数上限做出的判断，不该由前端猜。若拆成
 * {@code /export} 与 {@code /exportAsync} 两个端点，前端就得先知道条数
 * （多一次请求）或猜错（要么白等同步超时、要么小数据量也走异步）。
 * 因此只留一个入口，响应体里的 {@code mode} 告诉前端走哪条路。</p>
 *
 * <p><b>下载方式统一为对象存储链接：</b>同步与异步都返回 {@code fileUrl}，
 * 前端只需「有链接就打开」这一套逻辑。同时导出文件不落应用服务器磁盘，
 * 天然规避了临时目录堆积与多实例部署下的「下载 404」。</p>
 *
 * @author ruoyi
 */
public interface IYqLedgerExportService {

    /**
     * 执行导出：小数据量同步返回下载链接，超限自动转异步任务。
     *
     * @param bo 导出请求（含筛选条件、字段范围、条数上限）
     * @return 导出结果；{@code mode} 为 {@code sync} 或 {@code async}
     */
    LedgerExportResult export(LedgerExportBo bo);

    /**
     * 查询异步导出任务状态（验收标准 6）
     *
     * <p>只允许查看自己发起的导出 —— 导出文件可能包含他人无权查看的筛选结果
     * 与下载链接，凭 exportId 就能取别人的文件属于越权。</p>
     */
    LedgerExportResult status(Long exportId);

    /**
     * 导出操作记录分页查询（验收标准 10）
     *
     * @param exportScope 按导出范围过滤（ledger / cluster），空则不过滤
     */
    PageResult<YqLedgerExportLog> logPage(PageQuery pageQuery, String exportScope);
}
`,
  },

  /* ==================================================== 导出服务实现 */
  {
    rel: 'ledger/service/impl/YqLedgerExportServiceImpl.java',
    content: `package org.dromara.yuqing.ledger.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.ServletUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.json.utils.JsonUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.config.YqLedgerProperties;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerExportResult;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.export.LedgerExportRunner;
import org.dromara.yuqing.ledger.service.IYqLedgerExportService;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.dromara.yuqing.ledger.support.LedgerColumnCatalog;
import org.dromara.yuqing.ledger.support.LedgerQuerySummary;
import org.dromara.yuqing.ledger.support.LedgerScope;
import org.dromara.yuqing.mapper.YqLedgerExportLogMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 台账导出服务实现（F-016 验收标准 5、6、10）
 *
 * <p><b>分流规则：</b>先按当前条件计数，再决定同步还是异步：</p>
 * <ol>
 *   <li>用户显式 {@code async=true} → 直接异步（大数量时用户可主动避开同步等待）；</li>
 *   <li>条数 &gt; {@code syncExportLimit} → 自动转异步（验收标准 6）；</li>
 *   <li>否则同步生成并上传，立即返回下载链接。</li>
 * </ol>
 *
 * <p><b>为什么先计数而不是「先生成再看多大」：</b>同步生成超限数据会把
 * N 行装配进内存再序列化，峰值内存约等于整份 xlsx —— 这是要避免的。
 * 计数走 {@code select count(1)}，代价远低于生成。</p>
 *
 * <p><b>硬上限的处理：</b>超过 {@code maxExportRows} 直接拒绝而不是静默截断。
 * 台账导出的产物是要拿去汇报与审计的，静默截断会让「导出 20000 条」
 * 变成「实际 5000 条」却无人知晓 —— 这比报错危险得多。</p>
 *
 * <p><b>数据权限（验收标准 8 / 决策 ③A）：</b>范围一律取自
 * {@code IYqLedgerService.currentScope()}（内部从 Sa-Token 推导），
 * 请求参数只能影响筛选条件，无法扩大可见范围。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqLedgerExportServiceImpl implements IYqLedgerExportService {

    /** 导出方式：同步 */
    private static final String MODE_SYNC = "sync";
    /** 导出方式：异步 */
    private static final String MODE_ASYNC = "async";

    private final IYqLedgerService ledgerService;
    private final YqLedgerExportLogMapper exportLogMapper;
    private final LedgerExportRunner runner;
    private final YqLedgerProperties props;

    @Override
    public LedgerExportResult export(LedgerExportBo bo) {
        if (bo == null || bo.getQuery() == null) {
            throw new ServiceException("导出条件不能为空");
        }
        LedgerQuery q = bo.getQuery();
        LedgerScope scope = ledgerService.currentScope();

        List<String> fields = LedgerColumnCatalog.resolve(bo.getColumns());
        long total = ledgerService.countFor(q, scope);

        /* 「只导前 N 条」与硬上限取小；用户选了 N 就不该因为总量超限被拒 */
        long wanted = total;
        if (bo.getRowLimit() != null && bo.getRowLimit() > 0 && bo.getRowLimit() < total) {
            wanted = bo.getRowLimit();
        }
        int maxRows = props.getMaxExportRows();
        if (wanted > maxRows) {
            throw new ServiceException("本次导出 " + wanted + " 条，超过单次上限 " + maxRows
                + " 条。请缩小时间范围或补充筛选条件后重试。");
        }

        boolean forceAsync = Boolean.TRUE.equals(bo.getAsync());
        int syncLimit = props.getSyncExportLimit();
        boolean overLimit = total > syncLimit;

        if (!forceAsync && !overLimit) {
            return doSync(bo, q, scope, fields, (int) wanted);
        }
        return doAsync(bo, q, scope, fields, (int) wanted, overLimit, forceAsync);
    }

    @Override
    public LedgerExportResult status(Long exportId) {
        YqLedgerExportLog record = exportLogMapper.selectById(exportId);
        if (record == null) {
            throw new ServiceException("导出任务不存在或已删除");
        }
        assertVisible(record);
        LedgerExportResult r = new LedgerExportResult();
        r.setExportId(record.getExportId());
        r.setMode(record.getExportMode());
        r.setStatus(record.getStatus());
        r.setRowCount(record.getRowCount());
        r.setColumnCount(record.getColumnCount());
        r.setFileName(record.getFileName());
        r.setFileUrl(record.getFileUrl());
        r.setFinishTime(record.getFinishTime());
        r.setFailReason(record.getFailReason());
        r.setMessage(describeStatus(record));
        r.setSyncLimit(props.getSyncExportLimit());
        return r;
    }

    @Override
    public PageResult<YqLedgerExportLog> logPage(PageQuery pageQuery, String exportScope) {
        LambdaQueryWrapper<YqLedgerExportLog> lqw = new LambdaQueryWrapper<>();
        if (StringUtils.isNotBlank(exportScope)) {
            lqw.eq(YqLedgerExportLog::getExportScope, exportScope);
        }
        /* 验收标准 10 的审计列表同样受数据权限约束（③A 的顺延）：
         * 非全量可见角色只能看到自己的导出记录，否则可从审计列表
         * 反推出他人导出了什么条件、并拿到他人的下载链接。 */
        if (!ledgerService.currentScope().isUnrestricted()) {
            lqw.eq(YqLedgerExportLog::getCreateBy, LoginHelper.getUserId());
        }
        lqw.orderByDesc(YqLedgerExportLog::getCreateTime);
        Page<YqLedgerExportLog> page = exportLogMapper.selectPage(pageQuery.build(), lqw);
        return PageResult.build(page.getRecords(), page.getTotal());
    }

    /* ================================================================ 同步 */

    private LedgerExportResult doSync(LedgerExportBo bo, LedgerQuery q, LedgerScope scope,
                                      List<String> fields, int wanted) {
        LedgerExportRunner.RenderOutput out = runner.render(bo, scope);
        LedgerExportRunner.UploadResult up = runner.upload(out);
        if (up == null || up.getUrl() == null) {
            /* 同步导出拿不到链接就等于没交付 —— 必须显式失败，
             * 不能让用户以为「导出成功」却没有任何可下载的东西。 */
            throw new ServiceException("导出文件生成后上传对象存储失败，请检查 OSS 配置或稍后重试");
        }

        /* 验收标准 10：同步导出同样要留审计。异步导出的任务记录本身
         * 即是审计（结构上必需），因此本开关只影响同步路径。 */
        if (props.isExportAuditEnabled()) {
            YqLedgerExportLog rec = newLog(bo, q, fields, MODE_SYNC, "success", (int) wanted);
            rec.setFileName(up.getFileName());
            rec.setFileUrl(up.getUrl());
            rec.setFinishTime(LocalDateTime.now());
            exportLogMapper.insert(rec);
        }

        LedgerExportResult r = new LedgerExportResult();
        r.setMode(MODE_SYNC);
        r.setStatus("success");
        r.setRowCount(out.getRowCount());
        r.setColumnCount(out.getColumnCount());
        r.setFileName(up.getFileName());
        r.setFileUrl(up.getUrl());
        r.setFinishTime(LocalDateTime.now());
        r.setSyncLimit(props.getSyncExportLimit());
        r.setScopeDesc(scope.describe());
        r.setMessage("导出完成，共 " + out.getRowCount() + " 条 / " + out.getColumnCount() + " 列。");
        return r;
    }

    /* ================================================================ 异步 */

    private LedgerExportResult doAsync(LedgerExportBo bo, LedgerQuery q, LedgerScope scope,
                                       List<String> fields, int wanted,
                                       boolean overLimit, boolean forceAsync) {
        YqLedgerExportLog rec = newLog(bo, q, fields, MODE_ASYNC, "pending", wanted);
        rec.setFileName(runner.buildFileName(bo, q));
        /* 先落库拿到 exportId，再提交执行 —— 顺序反了的话任务可能在
         * 记录写入前就跑完，导致状态永远停在 pending。 */
        exportLogMapper.insert(rec);
        Long exportId = rec.getExportId();
        if (exportId == null) {
            throw new ServiceException("导出任务记录创建失败，请稍后重试");
        }

        String how;
        try {
            how = runner.submit(exportId);
        } catch (Exception e) {
            log.error("[台账导出] #{} 提交异步执行失败", exportId, e);
            markFailed(exportId, "提交异步导出任务失败：" + brief(e.getMessage()));
            throw new ServiceException("提交异步导出任务失败，请稍后重试");
        }

        LedgerExportResult r = new LedgerExportResult();
        r.setExportId(exportId);
        r.setMode(MODE_ASYNC);
        r.setStatus("pending");
        r.setRowCount(wanted);
        r.setColumnCount(fields.size());
        r.setFileName(rec.getFileName());
        r.setSyncLimit(props.getSyncExportLimit());
        r.setScopeDesc(scope.describe());
        r.setMessage(forceAsync
            ? "已按你的选择转为后台导出任务，完成后可在导出记录中下载。"
            : "本次导出 " + wanted + " 条，超过同步上限 " + props.getSyncExportLimit()
                + " 条，已自动转为后台导出任务，完成后可在导出记录中下载。");
        log.info("[台账导出] #{} 已提交（{}），预计 {} 条 / {} 列", exportId, how, wanted, fields.size());
        return r;
    }

    /* ================================================================ 辅助 */

    private YqLedgerExportLog newLog(LedgerExportBo bo, LedgerQuery q, List<String> fields,
                                     String mode, String status, int wanted) {
        YqLedgerExportLog rec = new YqLedgerExportLog();
        rec.setExportScope(StringUtils.isNotBlank(bo.getExportScope())
            ? bo.getExportScope().trim() : "ledger");
        /* 可读摘要便于审计人员不解析 JSON 就能看懂「导出了什么」 */
        rec.setQuerySummary(LedgerQuerySummary.summarize(q));
        rec.setQueryJson(JsonUtils.toJsonString(q));
        rec.setColumnsJson(JsonUtils.toJsonString(fields));
        rec.setRowCount(wanted);
        rec.setColumnCount(fields.size());
        rec.setExportMode(mode);
        rec.setStatus(status);
        rec.setOperIp(ServletUtils.getClientIP());
        return rec;
    }

    private void markFailed(Long exportId, String reason) {
        YqLedgerExportLog upd = new YqLedgerExportLog();
        upd.setExportId(exportId);
        upd.setStatus("failed");
        upd.setFailReason(reason);
        upd.setFinishTime(LocalDateTime.now());
        exportLogMapper.updateById(upd);
    }

    /** 越权访问防护：非全量可见角色只能查看自己发起的导出 */
    private void assertVisible(YqLedgerExportLog record) {
        if (ledgerService.currentScope().isUnrestricted()) {
            return;
        }
        Long me = LoginHelper.getUserId();
        if (me == null || !me.equals(record.getCreateBy())) {
            /* 与详情接口同一话术：不区分「不存在」与「无权」，避免探测存在性 */
            throw new ServiceException("无权查看该导出任务，或该任务已不存在");
        }
    }

    private String describeStatus(YqLedgerExportLog record) {
        String status = record.getStatus();
        if ("success".equals(status)) {
            return "导出完成，共 " + nvl(record.getRowCount()) + " 条，可点击下载。";
        }
        if ("failed".equals(status)) {
            return "导出失败：" + (StringUtils.isBlank(record.getFailReason())
                ? "未知原因" : record.getFailReason());
        }
        if ("running".equals(status)) {
            return "正在导出中，请稍后刷新。";
        }
        return "任务已排队，请稍后刷新。";
    }

    private static int nvl(Integer v) {
        return v == null ? 0 : v;
    }

    private static String brief(String msg) {
        if (msg == null) {
            return "未知错误";
        }
        String s = msg.replace('\\r', ' ').replace('\\n', ' ');
        return s.length() <= 300 ? s : s.substring(0, 300);
    }
}
`,
  },

  /* ==================================================== SnailJob 执行器 */
  {
    rel: 'job/YqLedgerExportJobExecutor.java',
    content: `package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.ledger.config.YqLedgerProperties;
import org.dromara.yuqing.ledger.export.LedgerExportRunner;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 台账异步导出定时任务（SnailJob，F-016 验收标准 6 / 决策 ②A）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingLedgerExport}。
 * 触发方式选「手动触发 / API 触发」，因为每次导出都由用户操作驱动，
 * 不需要 Cron。作业ID 填到 {@code yuqing.ledger.export-job-id}，
 * 服务端才能通过 OpenAPI 触发它。</p>
 *
 * <p><b>为什么必须能在控制台被触发：</b>验收标准 6 要求「完成后推送下载链接」——
 * 若导出跑在 Web 进程的临时线程里，应用重启就丢了，且无法观测与重试。
 * 交给调度中心后，任务有执行记录、可人工补偿、可重跑。</p>
 *
 * <p><b>幂等性：</b>{@code LedgerExportRunner.runAsync} 开头检查
 * 记录状态为 {@code success} 时直接跳过 —— 调度中心的补偿重试
 * 不会重复生成与重复推送。</p>
 *
 * <p><b>参数来源：</b>服务端提交时用 {@code addArgsStr("exportId", id)} 传参，
 * 这里从 {@code jobArgs.getJobParams()} 取回（为 {@code Map} 形态）。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingLedgerExport")
public class YqLedgerExportJobExecutor {

    private final LedgerExportRunner runner;

    private final YqLedgerProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        Long exportId = resolveExportId(jobArgs);
        if (exportId == null) {
            /* 无 exportId 说明作业被误配成 Cron 定时跑 —— 直接失败并说清原因，
             * 而不是「什么都不做地成功」，否则问题会一直藏着。 */
            return ExecuteResult.failure(
                "缺少参数 exportId：本作业需由台账导出接口触发（yuqing.ledger.export-job-id="
                    + props.getExportJobId() + "），不应配置为定时执行");
        }
        try {
            runner.runAsync(exportId);
            SnailJobLog.LOCAL.info("[台账导出] #{} 执行结束", exportId);
            return ExecuteResult.success("台账导出 #" + exportId + " 执行结束");
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[台账导出] #" + exportId + " 执行异常", e);
            return ExecuteResult.failure("台账导出异常: " + e.getMessage());
        }
    }

    /** 从作业参数中取出 exportId（兼容 String / 数字 / Map 三种承载形态） */
    private Long resolveExportId(JobArgs jobArgs) {
        if (jobArgs == null) {
            return null;
        }
        Object params = jobArgs.getJobParams();
        Object raw = params;
        if (params instanceof Map<?, ?> map) {
            raw = map.get("exportId");
            if (raw == null) {
                raw = map.get("export_id");
            }
        }
        if (raw == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(raw).trim());
        } catch (NumberFormatException e) {
            SnailJobLog.LOCAL.warn("[台账导出] exportId 参数非法: {}", raw);
            return null;
        }
    }
}
`,
  },

  /* ==================================================== 台账控制器 */
  {
    rel: 'controller/YqOpinionController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.domain.YqLedgerExportLog;
import org.dromara.yuqing.ledger.domain.LedgerDetail;
import org.dromara.yuqing.ledger.domain.LedgerExportBo;
import org.dromara.yuqing.ledger.domain.LedgerExportResult;
import org.dromara.yuqing.ledger.domain.LedgerPage;
import org.dromara.yuqing.ledger.domain.LedgerQuery;
import org.dromara.yuqing.ledger.domain.LedgerSearchResult;
import org.dromara.yuqing.ledger.service.IYqLedgerExportService;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 舆情台账控制器（F-016）
 *
 * <p><b>端点总览（PRD §6.3）：</b></p>
 * <ul>
 *   <li>{@code GET  /yuqing/opinion/list}            台账组合筛选分页（标准 1、2）</li>
 *   <li>{@code GET  /yuqing/opinion/{opinionId}}     舆情详情（标准 3）</li>
 *   <li>{@code GET  /yuqing/opinion/search}          全文检索 + 高亮（标准 7）</li>
 *   <li>{@code POST /yuqing/opinion/export}          导出（标准 5、6）</li>
 *   <li>{@code GET  /yuqing/opinion/export/{id}}     异步导出状态（标准 6）</li>
 *   <li>{@code GET  /yuqing/opinion/exportLog/list}  导出审计记录（标准 10）</li>
 * </ul>
 *
 * <p><b>路径顺序（重要）：</b>固定路径（{@code /search}、{@code /export}、
 * {@code /exportLog/list}）必须在 {@code /{opinionId}} 之前声明。Spring MVC
 * 的路径匹配虽能区分「字面量」与「变量」，但 {@code /{opinionId}} 用
 * {@code Long} 绑定，误命中时会抛类型转换 400；显式前置可让路由意图
 * 在代码里一目了然，也避免后续有人把某个固定路径挪到后面时踩坑。</p>
 *
 * <p><b>权限：</b>沿用菜单已有的 {@code yuqing:opinion:*} 权限码
 * （list / query / export）—— F-016 不引入新菜单，因此不新增权限码。
 * 前端必须使用同一枚权限码控制按钮显隐，否则会出现「按钮看得见、点了 403」。</p>
 *
 * <p><b>安全：</b>所有查询条件来自请求参数，但「可见范围」一律由
 * Service 内部从 Sa-Token 推导（决策 ③A 按任务归属隔离），
 * 请求体无法扩大可见范围。</p>
 *
 * @author ruoyi
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/opinion")
public class YqOpinionController extends BaseController {

    private final IYqLedgerService ledgerService;
    private final IYqLedgerExportService exportService;

    /**
     * 台账组合筛选分页（验收标准 1、2、8、9）
     *
     * <p>把 11 个筛选维度直接铺开成方法参数（而非用一个 {@code @ModelAttribute}
     * 对象）：GET 参数与前端查询表单一一对应，且 {@code LedgerQuery} 是
     * 业务对象、不携带 Web 层关注点。时间类参数用 String 接收，
     * 由 {@code LedgerTimeParser} 容错解析（非法值忽略而不是 400）。</p>
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/list")
    public R<LedgerPage> list(
        @RequestParam(required = false) String collectBeginTime,
        @RequestParam(required = false) String collectEndTime,
        @RequestParam(required = false) String publishBeginTime,
        @RequestParam(required = false) String publishEndTime,
        @RequestParam(required = false) Long taskId,
        @RequestParam(required = false) Long channelId,
        @RequestParam(required = false) String sentiAttr,
        @RequestParam(required = false) String riskLevel,
        @RequestParam(required = false) String opinionLevel,
        @RequestParam(required = false) String spreadLevel,
        @RequestParam(required = false) String collectSource,
        @RequestParam(required = false) String cleanStatus,
        @RequestParam(required = false) String analyzeStatus,
        @RequestParam(required = false) String alertFlag,
        @RequestParam(required = false) java.util.List<Long> tagIds,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String keywordScope,
        @RequestParam(required = false) Long clusterId,
        @RequestParam(required = false) String orderBy,
        @RequestParam(required = false) Boolean orderDesc,
        PageQuery pageQuery) {
        LedgerQuery q = new LedgerQuery();
        q.setCollectBeginTime(collectBeginTime);
        q.setCollectEndTime(collectEndTime);
        q.setPublishBeginTime(publishBeginTime);
        q.setPublishEndTime(publishEndTime);
        q.setTaskId(taskId);
        q.setChannelId(channelId);
        q.setSentiAttr(sentiAttr);
        q.setRiskLevel(riskLevel);
        q.setOpinionLevel(opinionLevel);
        q.setSpreadLevel(spreadLevel);
        q.setCollectSource(collectSource);
        q.setCleanStatus(cleanStatus);
        q.setAnalyzeStatus(analyzeStatus);
        q.setAlertFlag(alertFlag);
        q.setTagIds(tagIds);
        q.setKeyword(keyword);
        q.setKeywordScope(keywordScope);
        q.setClusterId(clusterId);
        q.setOrderBy(orderBy);
        q.setOrderDesc(orderDesc);
        return R.ok(ledgerService.queryPage(q, pageQuery));
    }

    /**
     * 舆情详情（验收标准 3）
     *
     * <p>不在可见范围内时返回统一话术「无权查看该舆情，或该舆情已不存在」，
     * 不区分两者 —— 避免通过响应差异探测他人数据的 ID 是否存在。</p>
     */
    @SaCheckPermission("yuqing:opinion:query")
    @GetMapping("/{opinionId}")
    public R<LedgerDetail> detail(@PathVariable Long opinionId) {
        return R.ok(ledgerService.detail(opinionId));
    }

    /**
     * 全文检索（验收标准 7）
     *
     * <p>返回命中片段（已做 HTML 转义 + 命中标记），前端直接 {@code v-html}
     * 渲染即安全 —— 转义在服务端 {@code LedgerHighlighter} 里完成。</p>
     *
     * @param keyword 检索词
     * @param scope   检索范围 title / content / both，空则 both
     * @param limit   命中条数上限，空则用配置值
     */
    @SaCheckPermission("yuqing:opinion:list")
    @GetMapping("/search")
    public R<LedgerSearchResult> search(
        @RequestParam String keyword,
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) Integer limit) {
        return R.ok(ledgerService.search(keyword, scope, limit));
    }

    /**
     * 导出（验收标准 5、6）
     *
     * <p>返回体 {@code mode} 决定前端行为：{@code sync} 直接打开
     * {@code fileUrl}；{@code async} 提示已在后台导出并轮询
     * {@code /export/{exportId}}。</p>
     */
    @SaCheckPermission("yuqing:opinion:export")
    @PostMapping("/export")
    public R<LedgerExportResult> export(@Valid @RequestBody LedgerExportBo bo) {
        return R.ok(exportService.export(bo));
    }

    /** 异步导出任务状态（验收标准 6） */
    @SaCheckPermission("yuqing:opinion:export")
    @GetMapping("/export/{exportId}")
    public R<LedgerExportResult> exportStatus(@PathVariable Long exportId) {
        return R.ok(exportService.status(exportId));
    }

    /**
     * 导出审计记录（验收标准 10）
     *
     * <p>返回结构与本模块其它列表页一致（{@code R<PageResult<T>>}），
     * 前端复用同一套表格分页封装。</p>
     */
    @SaCheckPermission("yuqing:opinion:export")
    @GetMapping("/exportLog/list")
    public R<PageResult<YqLedgerExportLog>> exportLogList(
        PageQuery pageQuery,
        @RequestParam(required = false) String exportScope) {
        return R.ok(exportService.logPage(pageQuery, exportScope));
    }
}
`,
  },

  /* ==================================================== 事件聚合控制器 */
  {
    rel: 'controller/YqClusterController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.R;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.ledger.domain.ClusterView;
import org.dromara.yuqing.ledger.service.IYqLedgerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 事件聚合视图控制器（F-016 验收标准 4）
 *
 * <p>验收标准 4 要求「按聚合事件查看关联的全部舆情，并在时间轴上展示传播脉络」。
 * 这是一个**视角**而非新资源 —— 聚合事件本身由 F-006 的聚类链路产出，
 * 台账只负责按事件把关联舆情与时间轴组装出来。因此本控制器不提供
 * 事件的新增/修改/删除，只有两个只读端点。</p>
 *
 * <p><b>权限复用 {@code yuqing:opinion:*}：</b>菜单体系里没有
 * {@code yuqing:cluster:*} —— 事件聚合是台账（{@code yuqing:opinion}）的
 * 一个视图，独立建菜单会增加运维配置负担（多一个菜单 + 多一套角色授权），
 * 收益却为零。若将来事件聚合要独立授权，再加菜单与权限码即可，
 * 届时把这里的两枚权限码换掉即可，不影响调用方。</p>
 *
 * @author ruoyi
 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/yuqing/cluster")
public class YqClusterController extends BaseController {

    private final IYqLedgerService ledgerService;

    /**
     * 事件聚合视图：事件概要 + 传播时间轴 + 关联舆情分页（验收标准 4）
     *
     * @param clusterId 聚合事件ID
     * @param nodeLimit 时间轴节点上限，空则用配置值（防热点事件万级节点卡死前端）
     */
    @SaCheckPermission("yuqing:opinion:query")
    @GetMapping("/{clusterId}")
    public R<ClusterView> detail(
        @PathVariable Long clusterId,
        @RequestParam(required = false) Integer nodeLimit,
        PageQuery pageQuery) {
        return R.ok(ledgerService.cluster(clusterId, nodeLimit, pageQuery));
    }
}
`,
  },

  /* ==================================================== 配置样例 */
  {
    rel: 'config/yq_ledger.yml',
    content: `# ============================================================================
# F-016 舆情台账 配置样例
# ----------------------------------------------------------------------------
# 使用方式：把 yuqing.ledger 段并入 ruoyi-admin 的 application-{profile}.yml。
# 全部项都有代码默认值，本文件仅列出「生产建议显式配置」的项与原因。
# ============================================================================
yuqing:
  ledger:
    # ---- 查询与检索 ----
    # 台账单页最大条数。防住 pageSize=999999 这类拖库请求；默认 200 足够表格展示。
    max-page-size: 200
    # 全文检索返回命中条数上限。检索是「先看有没有、再进详情」的用法，200 条够用。
    search-hit-limit: 200
    # 每条命中最多展示几个高亮片段（正文很长时只展示命中附近的片段）
    search-fragment-limit: 3
    # 每个高亮片段的上下文半径（命中词左右各取多少字符）
    search-fragment-radius: 40

    # ---- 导出 ----
    # 同步导出条数上限；超过则自动转异步（验收标准 6）。调大 = 同步请求更久。
    sync-export-limit: 5000
    # 单次导出硬上限；超过直接拒绝（不静默截断——台账产物要用于汇报与审计）
    max-export-rows: 200000
    # 导出审计落库开关（验收标准 10）。生产必须为 true。
    export-audit-enabled: true
    # 异步导出的 SnailJob 作业ID。留空则退化为应用进程内线程池执行（开发环境用）。
    # 生产建议在调度控制台建好作业后把 ID 填在这里，以获得执行记录与人工补偿能力。
    export-job-id:
    # 未配置 export-job-id 时的进程内线程池并发度（避免同时导出把数据库压满）
    export-pool-size: 2

    # ---- 数据权限（决策 ③A：按 yq_task.create_by 任务归属隔离）----
    # 具备「全量数据可见」的角色键列表。
    #   ⚠ 默认空 = 只有超级管理员看全量，其余角色只能看到自己名下任务的舆情。
    #   这是最保守的默认值：漏配的后果是「少看」而不是「多看」。
    #   各环境角色键不同（PRD §7.3 只规定了「舆情主管」的语义，未规定 key），
    #   因此必须在部署时按实际角色键配置，例如：
    #     all-data-role-keys:
    #       - yuqing_manager
    all-data-role-keys:

    # ---- 事件聚合 ----
    # 传播时间轴最多返回的节点数。热点事件可能有上万条关联舆情，
    # 全量塞进时间轴会卡死前端；超出部分只在计数里体现。
    timeline-node-limit: 200

    # ---- 异步导出完成推送（验收标准 6）----
    # 是否推送下载链接。默认 false：推送依赖 F-011 企微通道，
    # 通道是否就绪是部署期才知道的事；关掉只是「需要自己回导出记录里取」。
    export-push-enabled: false
    # 固定收件人用户ID列表。留空 = 推给导出发起人本人（最不容易搞错的默认）。
    export-push-user-ids:
    # 免打扰时段（HH:mm）。大夜里的导出完成通知没有价值。
    # 只配起始不配结束 = 整天免打扰（几乎肯定是配漏了，但宁可少推不误推）。
    push-quiet-start:
    push-quiet-end:
`,
  },
];
