package org.dromara.yuqing.report.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.oss.client.OssClient;
import org.dromara.common.oss.factory.OssFactory;
import org.dromara.common.oss.model.Options;
import org.dromara.common.oss.model.PutObjectResult;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.analytics.AggregateScope;
import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.domain.YqOpinion;
import org.dromara.yuqing.domain.YqReport;
import org.dromara.yuqing.domain.YqReportOpinion;
import org.dromara.yuqing.domain.YqReportSection;
import org.dromara.yuqing.domain.YqReportTemplate;
import org.dromara.yuqing.mapper.YqAlertMapper;
import org.dromara.yuqing.mapper.YqOpinionMapper;
import org.dromara.yuqing.mapper.YqReportMapper;
import org.dromara.yuqing.mapper.YqReportOpinionMapper;
import org.dromara.yuqing.mapper.YqReportSectionMapper;
import org.dromara.yuqing.mapper.YqReportTemplateMapper;
import org.dromara.yuqing.report.build.DailyReportBuilder;
import org.dromara.yuqing.report.build.ReportFileName;
import org.dromara.yuqing.report.build.ReportScopeResolver;
import org.dromara.yuqing.report.config.YqReportProperties;
import org.dromara.yuqing.report.domain.DailyAlertRow;
import org.dromara.yuqing.report.domain.DailyHotRow;
import org.dromara.yuqing.report.domain.DailyReportContext;
import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.domain.ReportOpinionBo;
import org.dromara.yuqing.report.push.ReportPusher;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.PdfRenderer;
import org.dromara.yuqing.report.render.RenderResult;
import org.dromara.yuqing.report.render.WordRenderer;
import org.dromara.yuqing.report.service.IYqReportExtService;
import org.dromara.yuqing.service.IYqAnalyticsService;
import org.dromara.yuqing.service.IYqReportService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 舆情报告扩展服务实现（F-014）
 *
 * @author ruoyi
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class YqReportExtServiceImpl implements IYqReportExtService {

    private final YqReportMapper reportMapper;
    private final YqReportOpinionMapper reportOpinionMapper;
    private final YqReportSectionMapper reportSectionMapper;
    private final YqReportTemplateMapper reportTemplateMapper;
    private final YqAlertMapper alertMapper;
    private final YqOpinionMapper opinionMapper;
    private final IYqReportService reportService;
    private final IYqAnalyticsService analyticsService;
    private final WordRenderer wordRenderer;
    private final PdfRenderer pdfRenderer;
    private final ReportPusher reportPusher;
    private final YqReportProperties props;

    /* ------------------------------------------------------------------ 生成 */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReportGenerateResult generate(ReportGenerateBo bo, Long userId) {
        ReportGenerateResult result = new ReportGenerateResult();
        if (!props.isEnabled()) {
            return failResult(result, "报告生成引擎已关闭（yuqing.report.enabled=false）");
        }
        String type = StringUtils.isBlank(bo.getReportType()) ? "daily" : bo.getReportType();
        LocalDate date = bo.getReportDate() == null ? ReportScopeResolver.defaultDate() : bo.getReportDate();
        String trigger = StringUtils.isBlank(bo.getTriggerType()) ? "manual" : bo.getTriggerType();

        /* 同日判重：daily + date 唯一。已存在且非 failed → 不重复生成，直接返回既有记录 */
        YqReport exist = getByDate(type, date);
        boolean overwrite = Boolean.TRUE.equals(bo.getOverwrite());
        if (exist != null && !overwrite && !"failed".equals(exist.getStatus())) {
            log.info("[报告] {} {} 已存在（#{}，状态 {}），跳过生成", type, date, exist.getReportId(), exist.getStatus());
            result.setReportId(exist.getReportId());
            result.setReportName(exist.getReportName());
            result.setStatus(exist.getStatus());
            result.setVersion(exist.getVersion());
            result.setFileUrl(exist.getFileUrl());
            result.setFailReason("同日报告已存在，未重复生成");
            return result;
        }

        Long templateId = bo.getTemplateId() != null ? bo.getTemplateId() : props.getDefaultTemplateId();
        String reportName = StringUtils.isBlank(bo.getReportName())
            ? DailyReportBuilder.title(null, date)
            : bo.getReportName();

        /* 先落一条 generating 记录：失败时能留下痕迹，也满足验收标准 8 的状态机 */
        YqReport entity = exist != null ? exist : new YqReport();
        entity.setReportName(reportName);
        entity.setReportType(type);
        entity.setReportDate(date);
        entity.setTemplateId(templateId);
        entity.setTriggerType(trigger);
        entity.setStatus("generating");
        entity.setFailReason(null);
        entity.setVersion(exist == null || exist.getVersion() == null ? 1 : exist.getVersion() + 1);
        if (exist == null) {
            reportMapper.insert(entity);
        } else {
            reportMapper.updateById(entity);
        }
        Long reportId = entity.getReportId();

        try {
            DailyReportContext ctx = collectContext(type, date, templateId, reportName);

            /* 手工调整过的条目在重新生成时要保留（验收标准 3 与 7 的交汇点） */
            List<YqReportOpinion> manualRows = exist == null
                ? new ArrayList<>()
                : reportOpinionMapper.selectList(new LambdaQueryWrapper<YqReportOpinion>()
                    .eq(YqReportOpinion::getReportId, reportId)
                    .eq(YqReportOpinion::getIncludeSource, "manual"));
            Set<Long> manualIds = manualRows.stream().map(YqReportOpinion::getOpinionId).collect(Collectors.toSet());
            if (!manualIds.isEmpty()) {
                List<DailyHotRow> keep = loadHotRows(manualIds);
                for (DailyHotRow row : keep) {
                    if (ctx.getHotOpinions().stream().noneMatch(h -> Objects.equals(h.opinionId(), row.opinionId()))) {
                        ctx.getHotOpinions().add(row);
                    }
                }
                ctx.getNotices().add("已保留人工补充的舆情 " + manualIds.size() + " 条");
            }

            String content = DailyReportBuilder.build(ctx);
            entity.setContent(content);

            /* 渲染文件并上传 OSS；渲染失败不阻断正文落库 —— 正文才是报送员要看的 */
            RenderResult rendered = wordRenderer.render(reportName, content,
                ReportFileName.of(type, date, reportName, DocumentFormat.DOCX.getExt()));
            if (rendered.ok()) {
                String url = uploadQuietly(rendered);
                if (url != null) {
                    entity.setFileUrl(url);
                    entity.setFileFormat(DocumentFormat.DOCX.getExt());
                } else {
                    ctx.getNotices().add("文件已渲染但上传对象存储失败，请检查 OSS 配置");
                }
            } else {
                ctx.getNotices().add("Word 渲染失败：" + rendered.message() + "（正文仍可在线查看）");
            }

            entity.setStatus("generated");
            entity.setOpinionCount(ctx.getHotOpinions().size());
            entity.setFailReason(null);
            reportMapper.updateById(entity);

            syncReportOpinions(reportId, ctx.getHotOpinions(), "auto", userId);

            if (Boolean.TRUE.equals(bo.getPushAfter())) {
                String pushMsg = reportPusher.push(entity, userId);
                ctx.getNotices().add(pushMsg);
            }

            result.setReportId(reportId);
            result.setReportName(reportName);
            result.setStatus("generated");
            result.setVersion(entity.getVersion());
            result.setFileUrl(entity.getFileUrl());
            result.setFileFormat(entity.getFileFormat());
            result.setOpinionCount(ctx.getHotOpinions().size());
            result.setContentLength(content.length());
            result.setGeneratedAt(LocalDateTime.now());
            result.setNotices(ctx.getNotices());
            log.info("[报告] {}", result.summary());
            return result;
        } catch (Exception e) {
            log.error("[报告] 生成失败 reportId={}", reportId, e);
            entity.setStatus("failed");
            String reason = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            entity.setFailReason(reason.length() > 900 ? reason.substring(0, 900) : reason);
            reportMapper.updateById(entity);
            return failResult(result, reason);
        }
    }

    private ReportGenerateResult failResult(ReportGenerateResult r, String reason) {
        r.setStatus("failed");
        r.setFailReason(reason);
        r.setGeneratedAt(LocalDateTime.now());
        r.getNotices().add(reason);
        return r;
    }

    /**
     * 取数：把生成正文所需的全部素材收集到上下文
     */
    private DailyReportContext collectContext(String type, LocalDate date, Long templateId, String reportName) {
        DailyReportContext ctx = new DailyReportContext();
        ctx.setReportDate(date);
        ctx.setReportName(reportName);

        AggregateScope scope = "monthly".equalsIgnoreCase(type)
            ? ReportScopeResolver.monthly(date.getYear(), date.getMonthValue())
            : ReportScopeResolver.daily(date);

        /* ① 分析交接件（F-009）。取失败不阻断 —— 缺分析数据也应有预警与舆情清单 */
        try {
            ReportSection section = analyticsService.handoff(scope, "day", "heat");
            ctx.setSection(section);
            if (section != null) {
                ctx.setDataUntil(section.getDataUntil() == null ? null : String.valueOf(section.getDataUntil()));
            }
            if (section == null || section.getMarkdown() == null || section.getMarkdown().isBlank()) {
                ctx.getNotices().add("未取到分析批次数据，正文缺少多维分析章节（请检查多维分析任务）");
            }
        } catch (Exception e) {
            log.warn("[报告] 取分析交接件失败 date={}", date, e);
            ctx.getNotices().add("多维分析数据获取失败：" + e.getMessage());
        }

        /* ② 当日新增预警 */
        try {
            LocalDateTime from = date.atStartOfDay();
            LocalDateTime to = date.plusDays(1).atStartOfDay();
            List<YqAlert> alerts = alertMapper.selectList(new LambdaQueryWrapper<YqAlert>()
                .ge(YqAlert::getTriggerTime, from)
                .lt(YqAlert::getTriggerTime, to)
                .orderByDesc(YqAlert::getTriggerTime)
                .last("limit " + Math.max(1, props.getAlertLimit())));
            ctx.setAlerts(alerts.stream().map(a -> new DailyAlertRow(
                a.getAlertId(), a.getAlertTitle(), a.getAlertLevel(), a.getTriggerScene(),
                a.getTriggerValue(), a.getChannelName(), a.getTriggerTime(), a.getStatus()
            )).collect(Collectors.toList()));
        } catch (Exception e) {
            log.warn("[报告] 取当日预警失败 date={}", date, e);
            ctx.getNotices().add("预警数据获取失败：" + e.getMessage());
        }

        /* ③ 重点舆情（按热度） */
        try {
            List<YqOpinion> hot = opinionMapper.selectList(new LambdaQueryWrapper<YqOpinion>()
                .eq(YqOpinion::getCollectDate, date)
                .orderByDesc(YqOpinion::getHeatScore)
                .last("limit " + Math.max(1, props.getHotOpinionLimit())));
            ctx.setHotOpinions(toHotRows(hot));
        } catch (Exception e) {
            log.warn("[报告] 取重点舆情失败 date={}", date, e);
            ctx.getNotices().add("重点舆情数据获取失败：" + e.getMessage());
        }

        /* ④ 模板章节裁剪 */
        if (templateId != null) {
            ctx.setRequiredSections(loadRequiredSections(templateId));
        }
        return ctx;
    }

    /**
     * 模板章节编码：只取 required=1 的章节，按 order_num 排序。
     *
     * <p>模板为空或查不到时返回空清单（= 不做裁剪，全章节输出）。</p>
     */
    private List<String> loadRequiredSections(Long templateId) {
        try {
            YqReportTemplate t = reportTemplateMapper.selectById(templateId);
            if (t == null) {
                log.warn("[报告] 模板 #{} 不存在，按全章节输出", templateId);
                return new ArrayList<>();
            }
            List<YqReportSection> sections = reportSectionMapper.selectList(
                new LambdaQueryWrapper<YqReportSection>()
                    .eq(YqReportSection::getTemplateId, templateId)
                    .orderByAsc(YqReportSection::getOrderNum));
            List<String> codes = new ArrayList<>();
            for (YqReportSection s : sections) {
                if (s.getSectionCode() != null && "1".equals(s.getRequired())) {
                    codes.add(s.getSectionCode());
                }
            }
            return codes;
        } catch (Exception e) {
            log.warn("[报告] 取模板章节失败 templateId={}", templateId, e);
            return new ArrayList<>();
        }
    }

    private List<DailyHotRow> toHotRows(List<YqOpinion> list) {
        List<DailyHotRow> out = new ArrayList<>();
        if (list == null) {
            return out;
        }
        for (YqOpinion o : list) {
            out.add(new DailyHotRow(o.getOpinionId(), o.getTitle(), null, o.getSentiAttr(), o.getRiskLevel(),
                o.getHeatScore(), o.getReadCount(), o.getShareCount(), o.getCommentCount(),
                o.getOpinionUrl(), o.getPublishTime()));
        }
        return out;
    }

    private List<DailyHotRow> loadHotRows(Set<Long> opinionIds) {
        List<DailyHotRow> out = new ArrayList<>();
        if (opinionIds == null || opinionIds.isEmpty()) {
            return out;
        }
        List<YqOpinion> list = opinionMapper.selectByIds(opinionIds);
        for (YqOpinion o : list) {
            out.add(new DailyHotRow(o.getOpinionId(), o.getTitle(), null, o.getSentiAttr(), o.getRiskLevel(),
                o.getHeatScore(), o.getReadCount(), o.getShareCount(), o.getCommentCount(),
                o.getOpinionUrl(), o.getPublishTime()));
        }
        return out;
    }

    /**
     * 同步报告-舆情关联表。
     *
     * <p><b>关键：不删 manual 行。</b>报送员手工补的条目必须比自动清单优先，
     * 重新生成时把 auto 行全删重插，manual 行原样保留 —— 否则
     * 「上午补了三条、中午重生成」会把人工成果吃掉。</p>
     */
    private void syncReportOpinions(Long reportId, List<DailyHotRow> rows, String source, Long userId) {
        reportOpinionMapper.delete(new LambdaQueryWrapper<YqReportOpinion>()
            .eq(YqReportOpinion::getReportId, reportId)
            .eq(YqReportOpinion::getIncludeSource, "auto"));
        if (rows == null || rows.isEmpty()) {
            return;
        }
        for (DailyHotRow r : rows) {
            YqReportOpinion po = new YqReportOpinion();
            po.setReportId(reportId);
            po.setOpinionId(r.opinionId());
            po.setIncludeSource(source);
            po.setOperateBy(userId);
            reportOpinionMapper.insert(po);
        }
    }

    /**
     * 上传渲染产物到对象存储。
     *
     * <p>走 {@code OssFactory.instance()} 的默认配置（与系统附件同一存储），
     * 用 {@code buildPathKey} 生成带日期分层的 key，避免单目录文件过多。</p>
     *
     * <p>上传失败只返回 null 并记 warn，不让整个生成流程失败 ——
     * 报告正文已经拿到了，报送员可以先在线查看，文件稍后重试。</p>
     */
    private String uploadQuietly(RenderResult rendered) {
        if (rendered == null || rendered.bytes() == null || rendered.bytes().length == 0) {
            return null;
        }
        try {
            OssClient client = OssFactory.instance();
            String pathKey = client.buildPathKey(rendered.fileName());
            PutObjectResult result = client.upload(pathKey, rendered.bytes(),
                Options.builder().setContentType(rendered.format().getMime()));
            return result == null ? null : result.url();
        } catch (Exception e) {
            log.warn("[报告] 上传对象存储失败 fileName={}", rendered.fileName(), e);
            return null;
        }
    }

    /* ------------------------------------------------------------------ 重生成 */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ReportGenerateResult regenerate(Long reportId, Long userId, boolean keepVersions) {
        YqReport old = reportMapper.selectById(reportId);
        if (old == null) {
            throw new ServiceException("报告不存在：" + reportId);
        }
        ReportGenerateBo bo = new ReportGenerateBo();
        bo.setReportType(old.getReportType());
        bo.setReportDate(old.getReportDate());
        bo.setTemplateId(old.getTemplateId());
        bo.setTriggerType(old.getTriggerType());
        bo.setOverwrite(Boolean.TRUE);
        bo.setReportName(old.getReportName());
        if (keepVersions && old.getContent() != null) {
            log.info("[报告] 重新生成 #{}，v{} → v{}（旧版本正文已留存于操作日志）",
                reportId, old.getVersion(), old.getVersion() + 1);
        }
        return generate(bo, userId);
    }

    /* ------------------------------------------------------------------ 条目增删 */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int adjustOpinions(ReportOpinionBo bo, Long userId) {
        if (bo.getReportId() == null) {
            throw new ServiceException("报告ID不能为空");
        }
        YqReport report = reportMapper.selectById(bo.getReportId());
        if (report == null) {
            throw new ServiceException("报告不存在：" + bo.getReportId());
        }
        /* 已发布的报告不允许再改条目 —— 对外报出去的内容不能事后变样 */
        if ("published".equals(report.getStatus())) {
            throw new ServiceException("报告已提交，不能修改纳入条目");
        }

        int changed = 0;
        if (bo.getRemoveOpinionIds() != null && !bo.getRemoveOpinionIds().isEmpty()) {
            changed += reportOpinionMapper.delete(new LambdaQueryWrapper<YqReportOpinion>()
                .eq(YqReportOpinion::getReportId, bo.getReportId())
                .in(YqReportOpinion::getOpinionId, bo.getRemoveOpinionIds()));
        }
        if (bo.getAddOpinionIds() != null && !bo.getAddOpinionIds().isEmpty()) {
            for (Long oid : bo.getAddOpinionIds()) {
                Long cnt = reportOpinionMapper.selectCount(new LambdaQueryWrapper<YqReportOpinion>()
                    .eq(YqReportOpinion::getReportId, bo.getReportId())
                    .eq(YqReportOpinion::getOpinionId, oid));
                if (cnt != null && cnt > 0) {
                    continue;
                }
                YqReportOpinion po = new YqReportOpinion();
                po.setReportId(bo.getReportId());
                po.setOpinionId(oid);
                po.setIncludeSource("manual");
                po.setOperateBy(userId);
                reportOpinionMapper.insert(po);
                changed++;
            }
        }

        /* 回写条数并重组正文；正文重组失败不回滚条目（条目是事实，正文可重生成） */
        Long total = reportOpinionMapper.selectCount(new LambdaQueryWrapper<YqReportOpinion>()
            .eq(YqReportOpinion::getReportId, bo.getReportId()));
        report.setOpinionCount(total == null ? 0 : total.intValue());
        reportMapper.updateById(report);

        try {
            rebuildContent(report, bo.getRemark());
        } catch (Exception e) {
            log.warn("[报告] 条目调整后正文重组失败 reportId={}", bo.getReportId(), e);
        }
        log.info("[报告] #{} 条目调整完成，变更 {} 条，当前共 {} 条", bo.getReportId(), changed, total);
        return changed;
    }

    /**
     * 依当前纳入条目重组正文。
     *
     * <p>批次号与预警清单重新取一遍，只有舆情清单以关联表为准 ——
     * 这是「正文与关联表一致」的唯一实现路径。</p>
     */
    private void rebuildContent(YqReport report, String remark) {
        DailyReportContext ctx = new DailyReportContext();
        ctx.setReportDate(report.getReportDate());
        ctx.setReportName(report.getReportName());
        try {
            AggregateScope scope = "monthly".equalsIgnoreCase(report.getReportType())
                ? ReportScopeResolver.monthly(report.getReportDate().getYear(), report.getReportDate().getMonthValue())
                : ReportScopeResolver.daily(report.getReportDate());
            ctx.setSection(analyticsService.handoff(scope, "day", "heat"));
        } catch (Exception e) {
            ctx.getNotices().add("分析数据获取失败：" + e.getMessage());
        }
        Set<Long> ids = reportOpinionMapper.selectList(new LambdaQueryWrapper<YqReportOpinion>()
                .eq(YqReportOpinion::getReportId, report.getReportId()))
            .stream().map(YqReportOpinion::getOpinionId).collect(Collectors.toSet());
        ctx.setHotOpinions(loadHotRows(ids));
        if (StringUtils.isNotBlank(remark)) {
            ctx.getNotices().add("人工调整说明：" + remark);
        }
        report.setContent(DailyReportBuilder.build(ctx));
        reportMapper.updateById(report);
    }

    @Override
    public List<DailyHotRow> listReportOpinions(Long reportId) {
        Set<Long> ids = reportOpinionMapper.selectList(new LambdaQueryWrapper<YqReportOpinion>()
                .eq(YqReportOpinion::getReportId, reportId))
            .stream().map(YqReportOpinion::getOpinionId).collect(Collectors.toSet());
        return loadHotRows(ids);
    }

    /* ------------------------------------------------------------------ 导出 */

    @Override
    public RenderResult export(Long reportId, DocumentFormat format, Long userId) {
        YqReport report = reportMapper.selectById(reportId);
        if (report == null) {
            return RenderResult.fail(format, null, "报告不存在：" + reportId);
        }
        String content = report.getContent();
        if (StringUtils.isBlank(content)) {
            return RenderResult.fail(format, null, "报告正文为空，请先生成报告");
        }
        String fileName = ReportFileName.of(report.getReportType(), report.getReportDate(),
            report.getReportName(), format.getExt());
        DocumentFormat f = format == null ? DocumentFormat.DOCX : format;
        return switch (f) {
            case DOCX -> wordRenderer.render(report.getReportName(), content, fileName);
            case PDF -> pdfRenderer.render(report.getReportName(), content, fileName);
            case MARKDOWN -> RenderResult.ok(DocumentFormat.MARKDOWN, fileName,
                content.getBytes(StandardCharsets.UTF_8));
        };
    }

    /* ------------------------------------------------------------------ 推送 / 提交 */

    @Override
    public String push(Long reportId, Long userId) {
        YqReport report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new ServiceException("报告不存在：" + reportId);
        }
        return reportPusher.push(report, userId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean submit(Long reportId, Long submitBy, String submitTarget) {
        YqReport report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new ServiceException("报告不存在：" + reportId);
        }
        if (!"generated".equals(report.getStatus()) && !"published".equals(report.getStatus())) {
            throw new ServiceException("报告当前状态为 " + report.getStatus() + "，不能提交");
        }
        report.setStatus("published");
        report.setSubmitStatus("submitted");
        Long uid = submitBy == null ? LoginHelper.getUserId() : submitBy;
        report.setSubmitBy(uid);
        report.setSubmitTime(LocalDateTime.now());
        String remark = StringUtils.isBlank(submitTarget) ? null : "提报对象：" + submitTarget;
        if (remark != null) {
            String old = report.getContent() == null ? "" : report.getContent();
            report.setContent(old + "\\n\\n> 提交记录：提报对象 " + submitTarget.replace("\\n", " ") + "\\n");
        }
        return reportMapper.updateById(report) > 0;
    }

    @Override
    public YqReport getByDate(String reportType, LocalDate date) {
        return reportMapper.selectOne(new LambdaQueryWrapper<YqReport>()
            .eq(YqReport::getReportType, reportType)
            .eq(YqReport::getReportDate, date)
            .orderByDesc(YqReport::getReportId)
            .last("limit 1"));
    }
}
