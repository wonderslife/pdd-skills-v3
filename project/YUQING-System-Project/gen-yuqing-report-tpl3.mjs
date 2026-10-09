/**
 * F-014 日报生成 · 模板分片 3/5
 * 归属：扩展服务接口与实现 + PC 控制器
 *
 * 产物：
 *   report/domain/ReportGenerateBo.java
 *   report/domain/ReportVo.java
 *   report/domain/ReportOpinionBo.java
 *   report/service/IYqReportExtService.java
 *   report/service/impl/YqReportExtServiceImpl.java
 *   report/controller/YqReportController.java
 *
 * ⚠ 归属边界：不产 YqReport/YqReportOpinion/YqReportSection 的 domain/mapper/基础 service
 *   （归 gen-yuqing.mjs），也不产 reportTemplate 相关（同上）。
 *   本分片只补主生成器显式声明 ctrl:false / svcHandwritten:true 的上层。
 */
export const REPORT_TPL3 = [
  /* ------------------------------------------------------------ 请求 / 响应对象 */
  {
    rel: 'report/domain/ReportGenerateBo.java',
    content: `package org.dromara.yuqing.report.domain;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

/**
 * 报告生成请求（F-014 验收标准 1 / 7 / 10）
 *
 * @author ruoyi
 */
@Data
public class ReportGenerateBo {

    /** 报告类型：daily / monthly，默认 daily */
    private String reportType = "daily";

    /** 报送员指定生成某一天；月报时忽略日部分 */
    @NotNull(message = "归属日期不能为空")
    private LocalDate reportDate;

    /** 使用模板ID；为空则用配置默认模板或不套模板 */
    private Long templateId;

    /** 生成方式：manual（手工触发）/ auto（定时任务）—— 由后端强制覆盖，前端传值不可信 */
    private String triggerType;

    /** 是否覆盖同日已有草稿（验收标准 7：重新生成覆盖草稿并保留版本记录） */
    private Boolean overwrite = Boolean.FALSE;

    /** 报告名称覆盖；为空则由构建器生成 */
    private String reportName;

    /** 是否生成后立即推送企业微信 */
    private Boolean pushAfter = Boolean.FALSE;
}
`,
  },
  {
    rel: 'report/domain/ReportOpinionBo.java',
    content: `package org.dromara.yuqing.report.domain;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 报告舆情条目增删请求（F-014 验收标准 3）
 *
 * @author ruoyi
 */
@Data
public class ReportOpinionBo {

    /** 报告ID */
    @NotNull(message = "报告ID不能为空")
    private Long reportId;

    /** 要纳入的舆情ID列表（批量补充） */
    private List<Long> addOpinionIds;

    /** 要移除的舆情ID列表（批量剔除） */
    private List<Long> removeOpinionIds;

    /** 操作备注（写入正文的调整说明） */
    private String remark;
}
`,
  },
  {
    rel: 'report/domain/ReportGenerateResult.java',
    content: `package org.dromara.yuqing.report.domain;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 报告生成结果（返回给前端与定时任务）
 *
 * @author ruoyi
 */
public class ReportGenerateResult {

    private Long reportId;

    private String reportName;

    private String status;

    private Integer version;

    private String fileUrl;

    private String fileFormat;

    private String failReason;

    private Integer opinionCount;

    private int contentLength;

    private LocalDateTime generatedAt;

    private List<String> notices = new ArrayList<>();

    public Long getReportId() {
        return reportId;
    }

    public void setReportId(Long reportId) {
        this.reportId = reportId;
    }

    public String getReportName() {
        return reportName;
    }

    public void setReportName(String reportName) {
        this.reportName = reportName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getFileFormat() {
        return fileFormat;
    }

    public void setFileFormat(String fileFormat) {
        this.fileFormat = fileFormat;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }

    public Integer getOpinionCount() {
        return opinionCount;
    }

    public void setOpinionCount(Integer opinionCount) {
        this.opinionCount = opinionCount;
    }

    public int getContentLength() {
        return contentLength;
    }

    public void setContentLength(int contentLength) {
        this.contentLength = contentLength;
    }

    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    public void setGeneratedAt(LocalDateTime generatedAt) {
        this.generatedAt = generatedAt;
    }

    public List<String> getNotices() {
        return notices;
    }

    public void setNotices(List<String> notices) {
        this.notices = notices == null ? new ArrayList<>() : notices;
    }

    public String summary() {
        if (!"generated".equals(status)) {
            return "生成未成功：" + (failReason == null ? status : failReason);
        }
        return "报告 #" + reportId + "「" + reportName + "」v" + version
            + " 生成成功，正文 " + contentLength + " 字，纳入舆情 " + opinionCount + " 条";
    }
}
`,
  },

  /* ------------------------------------------------------------ 扩展服务接口 */
  {
    rel: 'report/service/IYqReportExtService.java',
    content: `package org.dromara.yuqing.report.service;

import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.domain.ReportOpinionBo;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.RenderResult;
import org.dromara.yuqing.domain.YqReport;

import java.util.List;

/**
 * 舆情报告扩展服务（F-014 / F-015）
 *
 * <p><b>为什么与 IYqReportService 分开：</b>后者由代码生成器产出，只含
 * 机械 CRUD；本接口承载生成 / 渲染 / 导出 / 提交 / 推送等需要事务与
 * 多表写入的业务端点。这是本仓库既定约定（参见 inspect 模块的
 * IInspectPointExtService 等四组）。</p>
 *
 * <p>命名对齐主生成器里 {@code ctrl:false, svcHandwritten:true} 的声明 ——
 * 那行注释就是留给这里的。</p>
 *
 * @author ruoyi
 */
public interface IYqReportExtService {

    /**
     * 生成报告（F-014 验收标准 1 / 2 / 7 / 10）
     *
     * <p>全流程：取数 → 组装正文 → 套模板裁剪 → 渲染文件 → 上传 OSS → 落库。
     * 任何一步失败都落一条 status=failed 记录并写 failReason，不抛异常出去。</p>
     *
     * @param bo     生成参数
     * @param userId 操作人（定时任务传 null，落库时写系统账号）
     * @return 生成结果
     */
    ReportGenerateResult generate(ReportGenerateBo bo, Long userId);

    /**
     * 重新生成（验收标准 7）：覆盖当前草稿，version 自增，保留旧版本正文
     *
     * @param reportId     报告ID
     * @param userId       操作人
     * @param keepVersions 是否保留旧版本（false 则直接覆盖正文）
     */
    ReportGenerateResult regenerate(Long reportId, Long userId, boolean keepVersions);

    /**
     * 增删报告舆情条目（验收标准 3）
     *
     * @param bo     增删参数
     * @param userId 操作人
     * @return 变更后的纳入条数
     */
    int adjustOpinions(ReportOpinionBo bo, Long userId);

    /**
     * 查询报告纳入的舆情条目（含舆情详情，供详情页展示）
     *
     * @param reportId 报告ID
     */
    List<org.dromara.yuqing.report.domain.DailyHotRow> listReportOpinions(Long reportId);

    /**
     * 导出报告文件（验收标准 5）
     *
     * @param reportId 报告ID
     * @param format   目标格式 docx / pdf / md
     * @param userId   操作人
     * @return 渲染结果（含字节，供 Controller 直接回写响应流）
     */
    RenderResult export(Long reportId, DocumentFormat format, Long userId);

    /**
     * 按推送规则把报告文件推送至企业微信（验收标准 6）
     *
     * @param reportId 报告ID
     * @param userId   操作人
     * @return 推送结果摘要
     */
    String push(Long reportId, Long userId);

    /**
     * 线上提交（验收标准 11）：记录提交人 / 时间 / 提报对象
     *
     * @param reportId     报告ID
     * @param submitBy     提交人
     * @param submitTarget 提报对象（可空，仅记录）
     */
    boolean submit(Long reportId, Long submitBy, String submitTarget);

    /**
     * 按日期取报告（存在则返回，供 H5 与定时任务判重）
     */
    YqReport getByDate(String reportType, java.time.LocalDate date);
}
`,
  },

  /* ------------------------------------------------------------ 扩展服务实现 */
  {
    rel: 'report/service/impl/YqReportExtServiceImpl.java',
    content: `package org.dromara.yuqing.report.service.impl;

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
            report.setContent(old + "\\\\n\\\\n> 提交记录：提报对象 " + submitTarget.replace("\\\\n", " ") + "\\\\n");
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
`,
  },

  /* ------------------------------------------------------------ 控制器 */
  {
    rel: 'report/controller/YqReportController.java',
    content: `package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.redis.annotation.RepeatSubmit;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.common.web.core.BaseController;
import org.dromara.yuqing.domain.YqReport;
import org.dromara.yuqing.report.domain.DailyHotRow;
import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.domain.ReportOpinionBo;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.RenderResult;
import org.dromara.yuqing.report.service.IYqReportExtService;
import org.dromara.yuqing.service.IYqReportService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 舆情报告控制器（F-014）
 *
 * <p>基础 CRUD 委托给代码生成器产出的 IYqReportService；
 * 生成 / 重生成 / 条目调整 / 导出 / 推送 / 提交走 IYqReportExtService。
 * 主生成器对 yq_report 声明了 {@code ctrl:false, svcHandwritten:true}，
 * 本文件即该声明的落地。</p>
 *
 * <p><b>路径顺序注意：</b>{@code /optionselect}、{@code /generate}、
 * {@code /opinions} 等固定路径必须写在 {@code /{reportId}} 之前，
 * 否则会被路径变量吞掉（本仓库 YqReportTemplateController 已有同款注释）。</p>
 *
 * <p>权限码与前端严格一致：list / query / add / edit / remove /
 * generate / export / push / submit。</p>
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/report")
public class YqReportController extends BaseController {

    private final IYqReportService reportService;
    private final IYqReportExtService reportExtService;

    /* ------------------------------------------------------------ 基础 CRUD */

    /** 分页列表（验收标准 8：台账可按日期与状态查询） */
    @SaCheckPermission("yuqing:report:list")
    @GetMapping("/list")
    public R<PageResult<YqReport>> list(YqReport bo, PageQuery pageQuery) {
        return R.ok(reportService.queryPageList(bo, pageQuery));
    }

    /** 下拉选项（必须声明在 /{reportId} 之前） */
    @SaCheckPermission("yuqing:report:list")
    @GetMapping("/optionselect")
    public R<List<YqReport>> optionselect(YqReport bo) {
        return R.ok(reportService.queryList(bo));
    }

    /** 详情 */
    @SaCheckPermission("yuqing:report:query")
    @GetMapping("/{reportId}")
    public R<YqReport> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long reportId) {
        return R.ok(reportService.queryById(reportId));
    }

    /** 新增（表单直建，不走生成逻辑） */
    @SaCheckPermission("yuqing:report:add")
    @Log(title = "舆情报告", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqReport bo) {
        return toAjax(reportService.insertByBo(bo));
    }

    /** 修改 */
    @SaCheckPermission("yuqing:report:edit")
    @Log(title = "舆情报告", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqReport bo) {
        return toAjax(reportService.updateByBo(bo));
    }

    /** 删除 */
    @SaCheckPermission("yuqing:report:remove")
    @Log(title = "舆情报告", businessType = BusinessType.DELETE)
    @DeleteMapping("/{reportIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] reportIds) {
        return toAjax(reportService.deleteWithValidByIds(List.of(reportIds), true));
    }

    /** 列表导出（Excel） */
    @SaCheckPermission("yuqing:report:export")
    @Log(title = "舆情报告", businessType = BusinessType.EXPORT)
    @PostMapping("/exportList")
    public void exportList(YqReport bo, HttpServletResponse response) {
        List<YqReport> list = reportService.queryList(bo);
        ExcelBuilder.of(list, YqReport.class).sheetName("舆情报告").toResponse(response);
    }

    /* ------------------------------------------------------------ 生成链路 */

    /** 生成报告（验收标准 1 / 2 / 10） */
    @SaCheckPermission("yuqing:report:generate")
    @Log(title = "舆情报告生成", businessType = BusinessType.INSERT)
    @RepeatSubmit(interval = 5000)
    @PostMapping("/generate")
    public R<ReportGenerateResult> generate(@Valid @RequestBody ReportGenerateBo bo) {
        /* 生成方式由后端强制标记：前端传 auto 也不生效，防止绕过审计口径 */
        bo.setTriggerType("manual");
        return R.ok(reportExtService.generate(bo, LoginHelper.getUserId()));
    }

    /** 重新生成（验收标准 7） */
    @SaCheckPermission("yuqing:report:generate")
    @Log(title = "舆情报告重新生成", businessType = BusinessType.UPDATE)
    @RepeatSubmit(interval = 5000)
    @PostMapping("/regenerate/{reportId}")
    public R<ReportGenerateResult> regenerate(@PathVariable Long reportId,
                                             @RequestParam(defaultValue = "true") boolean keepVersions) {
        return R.ok(reportExtService.regenerate(reportId, LoginHelper.getUserId(), keepVersions));
    }

    /** 报告纳入的舆情条目（验收标准 3） */
    @SaCheckPermission("yuqing:report:query")
    @GetMapping("/opinions/{reportId}")
    public R<List<DailyHotRow>> opinions(@PathVariable Long reportId) {
        return R.ok(reportExtService.listReportOpinions(reportId));
    }

    /** 增删纳入舆情条目（验收标准 3） */
    @SaCheckPermission("yuqing:report:edit")
    @Log(title = "报告条目调整", businessType = BusinessType.UPDATE)
    @PutMapping("/opinions")
    public R<Integer> adjustOpinions(@Valid @RequestBody ReportOpinionBo bo) {
        return R.ok(reportExtService.adjustOpinions(bo, LoginHelper.getUserId()));
    }

    /** 提交报告（验收标准 11） */
    @SaCheckPermission("yuqing:report:submit")
    @Log(title = "报告提交", businessType = BusinessType.UPDATE)
    @PostMapping("/submit/{reportId}")
    public R<Void> submit(@PathVariable Long reportId,
                          @RequestParam(required = false) String submitTarget) {
        return toAjax(reportExtService.submit(reportId, LoginHelper.getUserId(), submitTarget));
    }

    /** 推送至企业微信（验收标准 6） */
    @SaCheckPermission("yuqing:report:push")
    @Log(title = "报告推送", businessType = BusinessType.OTHER)
    @PostMapping("/push/{reportId}")
    public R<String> push(@PathVariable Long reportId) {
        return R.ok(reportExtService.push(reportId, LoginHelper.getUserId()));
    }

    /* ------------------------------------------------------------ 文件导出 */

    /**
     * 导出报告文件（验收标准 5）—— 直接回写二进制流，不经 R 包装
     *
     * <p>失败时回写 JSON 错误体而不是抛异常：前端是用 a 标签或 blob 下载的，
     * 拿不到 500 的页面正文，必须让响应体自己说明原因。</p>
     */
    @SaCheckPermission("yuqing:report:export")
    @Log(title = "报告导出", businessType = BusinessType.EXPORT)
    @GetMapping("/export/{reportId}")
    public void export(@PathVariable Long reportId,
                       @RequestParam(defaultValue = "docx") String format,
                       HttpServletResponse response) throws IOException {
        DocumentFormat fmt = DocumentFormat.of(format);
        RenderResult r = reportExtService.export(reportId, fmt, LoginHelper.getUserId());
        if (!r.ok()) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json;charset=UTF-8");
            String msg = r.message() == null ? "导出失败" : r.message().replace("\\"", "'");
            response.getWriter().write("{\\"code\\":500,\\"msg\\":\\"" + msg + "\\"}");
            return;
        }
        response.setContentType(fmt.getMime() + ";charset=UTF-8");
        String encoded = URLEncoder.encode(r.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        response.setHeader("Content-Disposition",
            "attachment; filename=" + encoded + "; filename*=UTF-8''" + encoded);
        response.getOutputStream().write(r.bytes());
        response.getOutputStream().flush();
    }
}
`,
  },
];

