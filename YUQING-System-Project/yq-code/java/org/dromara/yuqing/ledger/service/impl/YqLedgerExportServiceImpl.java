package org.dromara.yuqing.ledger.service.impl;

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
        String s = msg.replace('\r', ' ').replace('\n', ' ');
        return s.length() <= 300 ? s : s.substring(0, 300);
    }
}
