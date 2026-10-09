/**
 * F-014 日报生成 · 模板分片 4/5
 * 归属：PDF 渲染器 + 报告推送器 + 定时任务
 *
 * 产物：
 *   report/render/PdfRenderer.java
 *   report/push/ReportPusher.java
 *   job/YqDailyReportJobExecutor.java
 *   config/yq_report.yml
 *
 * ⚠ job/ 包下只有 YqDailyReportJobExecutor 归本分片；
 *   YqAlertScanJobExecutor / YqCollectJobExecutor / YqStatsAggregateJobExecutor
 *   分别归 alert / collect / analytics 生成器，本分片不得触碰。
 */
export const REPORT_TPL4 = [
  /* ------------------------------------------------------------ PDF 渲染 */
  {
    rel: 'report/render/PdfRenderer.java',
    content: `package org.dromara.yuqing.report.render;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.dromara.yuqing.report.config.YqReportProperties;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * PDF 渲染器（openhtmltopdf，F-014 验收标准 5）
 *
 * <p><b>渲染链路：</b>Markdown →（{@link MarkdownToHtml}）→ XHTML 片段
 * →（本类套壳 + CSS）→ PDF 字节。</p>
 *
 * <p><b>字体：</b>必须内嵌中文字体，否则 PDF 里全是方框。
 * openhtmltopdf 走的是 PDFBox 的字体加载，Windows 上的 msyh.ttc 是 TTC 集合、
 * Linux 上常见的是 Noto Sans CJK。本类按「配置路径 → 常见系统路径」顺序探测，
 * 都找不到时**返回明确失败**而不是产出乱码 PDF ——
 * 一份满屏方框的日报发到领导手机上，比生成失败严重得多。</p>
 *
 * @author ruoyi
 */
@Component
public class PdfRenderer {

    /** 常见中文字体路径（按优先级；TTC 与 TTF 混排） */
    private static final String[] FONT_CANDIDATES = {
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/PingFang.ttc"
    };

    private final YqReportProperties props;

    public PdfRenderer(YqReportProperties props) {
        this.props = props;
        if (props.isRenderSelfCheck()) {
            String f = resolveFont();
            if (f == null) {
                org.slf4j.LoggerFactory.getLogger(PdfRenderer.class).warn(
                    "[报告] 未找到中文字体，PDF 导出将不可用；请配置 yuqing.report.pdf-font-path");
            }
        }
    }

    /**
     * 渲染 PDF
     *
     * @param title    文档标题
     * @param markdown 正文
     * @param fileName 输出文件名
     */
    public RenderResult render(String title, String markdown, String fileName) {
        String font = resolveFont();
        if (font == null) {
            return RenderResult.fail(DocumentFormat.PDF, fileName,
                "未找到可用的中文字体，无法生成 PDF。请在服务器安装 Noto Sans CJK 或配置字体路径。");
        }
        try {
            String html = wrap(title, markdown);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.useFont(new java.io.File(font), "cjk");
            builder.toStream(bos);
            builder.run();
            byte[] bytes = bos.toByteArray();
            if (bytes.length == 0) {
                return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染产出 0 字节");
            }
            return RenderResult.ok(DocumentFormat.PDF, fileName, bytes);
        } catch (IOException e) {
            return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染失败: " + e.getMessage());
        } catch (RuntimeException e) {
            return RenderResult.fail(DocumentFormat.PDF, fileName, "PDF 渲染异常: " + e.getMessage());
        }
    }

    /**
     * 套 XHTML 外壳 + 基础排版样式。
     *
     * <p>XHTML 而非 HTML4：openhtmltopdf 严格按 XML 解析，标签必须闭合，
     * {@link MarkdownToHtml} 的输出已满足这一约束。</p>
     */
    private String wrap(String title, String markdown) {
        String body = MarkdownToHtml.toBody(markdown);
        String t = MarkdownToHtml.escape(title == null ? "舆情报告" : title);
        return """
            <!DOCTYPE html>
            <html xmlns="http://www.w3.org/1999/xhtml">
            <head>
            <meta charset="UTF-8"/>
            <style>
              @page { size: A4; margin: 20mm 18mm; }
              body { font-family: "cjk", sans-serif; font-size: 10.5pt; line-height: 1.65; color: #1a1a1a; }
              h1 { font-size: 19pt; text-align: center; margin: 0 0 14pt 0; color: #0f2c4d; }
              h2 { font-size: 14pt; margin: 16pt 0 8pt 0; color: #14446f; border-bottom: 1px solid #cfd8e3; padding-bottom: 3pt; }
              h3 { font-size: 12pt; margin: 12pt 0 6pt 0; color: #1c5580; }
              p { margin: 5pt 0; }
              ul { margin: 5pt 0 5pt 16pt; padding: 0; }
              li { margin: 3pt 0; }
              table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9.5pt; }
              th, td { border: 0.6pt solid #b9c4d0; padding: 4pt 6pt; text-align: left; }
              th { background: #eef3f8; font-weight: bold; }
              blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #f6f8fa; border-left: 3pt solid #7aa3c9; color: #444; font-size: 9.5pt; }
              .empty { color: #888; font-style: italic; }
              strong { font-weight: bold; }
            </style>
            </head>
            <body>
            <h1>%s</h1>
            %s
            </body>
            </html>""".formatted(t, body);
    }

    /** 按配置路径 → 常见系统路径顺序探测 */
    private String resolveFont() {
        if (props != null && props.getPdfFontPath() != null && !props.getPdfFontPath().isBlank()) {
            java.io.File f = new java.io.File(props.getPdfFontPath());
            if (f.isFile()) {
                return f.getAbsolutePath();
            }
        }
        for (String p : FONT_CANDIDATES) {
            java.io.File f = new java.io.File(p);
            if (f.isFile()) {
                return f.getAbsolutePath();
            }
        }
        return null;
    }

    /** 供启动自检与运维接口查询 */
    public String fontPath() {
        return resolveFont();
    }

    /** 未使用的占位保持 —— StandardCharsets 供后续文本写出 */
    @SuppressWarnings("unused")
    private static final java.nio.charset.Charset UTF8 = StandardCharsets.UTF_8;
}
`,
  },

  /* ------------------------------------------------------------ 报告推送器 */
  {
    rel: 'report/push/ReportPusher.java',
    content: `package org.dromara.yuqing.report.push;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.yuqing.domain.YqPushRule;
import org.dromara.yuqing.domain.YqReport;
import org.dromara.yuqing.mapper.YqPushRuleMapper;
import org.dromara.yuqing.push.PushDispatcher;
import org.dromara.yuqing.push.PushOutcome;
import org.dromara.yuqing.push.PushRequest;
import org.dromara.yuqing.push.PushScene;
import org.dromara.yuqing.push.PushTargetResolver;
import org.dromara.yuqing.report.build.ReportFileName;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.RenderResult;
import org.dromara.yuqing.report.render.WordRenderer;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 报告推送器（F-014 验收标准 6）
 *
 * <p>完全复用 F-011 的推送基建：推送规则取自 {@code yq_push_rule} 中
 * scene={@link PushScene#REPORT_READY} 的记录，目标解析走
 * {@link PushTargetResolver}，发送 / 静默时段 / 重试 / 落 push_record 全部
 * 交给 {@link PushDispatcher}。本类只做三件事：取规则、渲染文件、拼请求。</p>
 *
 * <p><b>文件类型：</b>企微应用消息的 file 类型只支持 doc/docx/xls/xlsx/ppt/pptx/pdf，
 * 因此推送用 {@link WordRenderer} 产出的 docx 字节。渲染失败则降级为
 * 发送 Markdown 正文摘要（msgType=text）—— 宁可收到正文也好过收不到。</p>
 *
 * <p><b>不静默失败：</b>没有配置 report_ready 规则、或规则解析不出接收人时，
 * 返回的是明确的「跳过原因」文本，而不是空字符串。上层会把它写进报告的
 * 生成提示区，让报送员看得见。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReportPusher {

    private final WordRenderer wordRenderer;
    private final PushTargetResolver targetResolver;
    private final PushDispatcher pushDispatcher;
    private final YqPushRuleMapper pushRuleMapper;

    /**
     * 推送报告
     *
     * @param report 报告实体
     * @param userId 操作人（手工推送时非空，定时任务为 null）
     * @return 结果摘要（写入报告正文的生成提示区）
     */
    public String push(YqReport report, Long userId) {
        if (report == null || report.getReportId() == null) {
            return "推送跳过：报告不存在";
        }
        if (StringUtils.isBlank(report.getContent())) {
            return "推送跳过：报告正文为空";
        }

        List<YqPushRule> rules = loadRules();
        if (rules.isEmpty()) {
            log.warn("[报告推送] #{} 未找到 report_ready 场景的启用规则", report.getReportId());
            return "推送跳过：未配置「报告生成完成」场景的推送规则";
        }

        /* 渲染文件：成功推文件，失败降级推正文 */
        byte[] fileBytes = null;
        String fileName = null;
        RenderResult rendered = wordRenderer.render(report.getReportName(), report.getContent(),
            ReportFileName.of(report.getReportType(), report.getReportDate(),
                report.getReportName(), DocumentFormat.DOCX.getExt()));
        if (rendered.ok() && rendered.size() > 0) {
            fileBytes = rendered.bytes();
            fileName = rendered.fileName();
        } else {
            log.warn("[报告推送] #{} Word 渲染失败，降级为正文推送: {}", report.getReportId(), rendered.message());
        }

        int sent = 0;
        int failed = 0;
        int skipped = 0;
        int unmappedTotal = 0;
        StringBuilder details = new StringBuilder();

        for (YqPushRule rule : rules) {
            Set<Long> userIds = resolveTargets(rule);
            if (userIds.isEmpty()) {
                skipped++;
                details.append("规则「").append(rule.getRuleName()).append("」未解析到接收人；");
                continue;
            }
            PushTargetResolver.WecomTargets wecom = targetResolver.toWecom(userIds);
            unmappedTotal += (wecom.getTotal() - wecom.getMapped());
            if (wecom.isEmpty()) {
                skipped++;
                details.append("规则「").append(rule.getRuleName()).append("」全部接收人未绑定企业微信；");
                continue;
            }

            PushRequest req = PushRequest.builder()
                .scene(PushScene.REPORT_READY)
                .pushLevel(rule.getPushLevel())
                .ruleId(rule.getRuleId())
                .ruleName(rule.getRuleName())
                .msgType(fileBytes == null ? "text" : "file")
                .contentType("detail")
                .content(fileBytes == null ? summary(report.getContent()) : null)
                .fileName(fileName)
                .fileBytes(fileBytes)
                .targetUserIds(userIds)
                .quietStart(rule.getQuietStart())
                .quietEnd(rule.getQuietEnd())
                .maxRetry(rule.getMaxRetry() == null ? 2 : rule.getMaxRetry())
                .reportId(report.getReportId())
                .highPriority("immediate".equals(rule.getPushLevel()))
                .now(LocalDateTime.now())
                .build();

            PushOutcome outcome = pushDispatcher.dispatch(req);
            if (outcome == null) {
                failed++;
                details.append("规则「").append(rule.getRuleName()).append("」无返回；");
                continue;
            }
            if (outcome.isSuccess()) {
                sent++;
            } else {
                failed++;
                details.append("规则「").append(rule.getRuleName()).append("」")
                    .append(outcome.getSendStatus()).append("：")
                    .append(outcome.getReason() == null ? "无原因" : outcome.getReason()).append("；");
            }
        }

        StringBuilder msg = new StringBuilder();
        msg.append("已推送 ").append(fileBytes != null ? "文件 " + fileName : "正文摘要");
        msg.append("，成功 ").append(sent).append(" 条规则");
        if (failed > 0) {
            msg.append("，失败 ").append(failed).append(" 条");
        }
        if (skipped > 0) {
            msg.append("，跳过 ").append(skipped).append(" 条");
        }
        if (unmappedTotal > 0) {
            msg.append("；").append(unmappedTotal).append(" 名接收人未绑定企业微信");
        }
        if (details.length() > 0) {
            msg.append("。明细：").append(details);
        }
        log.info("[报告推送] #{} {}", report.getReportId(), msg);
        return msg.toString();
    }

    /**
     * 取含 report_ready 场景的启用规则。
     *
     * <p>{@code yq_push_rule.push_scenes} 是逗号分隔的多场景串（一条规则可覆盖
     * 多个场景），因此不能用 eq 精确匹配，必须取全量后在内存里按
     * {@link PushScene#contains} 过滤 —— 这是 F-011 表结构决定的，
     * 用 eq 会漏掉「同时配了 high_risk 和 report_ready」的规则。</p>
     */
    private List<YqPushRule> loadRules() {
        try {
            List<YqPushRule> all = pushRuleMapper.selectList(new LambdaQueryWrapper<YqPushRule>()
                .eq(YqPushRule::getStatus, "0"));
            List<YqPushRule> out = new ArrayList<>();
            if (all == null) {
                return out;
            }
            for (YqPushRule r : all) {
                if (PushScene.contains(r.getPushScenes(), PushScene.REPORT_READY)) {
                    out.add(r);
                }
            }
            if (out.isEmpty()) {
                log.info("[报告推送] 无启用中的 report_ready 规则，候选规则 {} 条", all.size());
            }
            return out;
        } catch (Exception e) {
            log.warn("[报告推送] 查询推送规则失败", e);
            return new ArrayList<>();
        }
    }

    /**
     * 按规则的 targetType / targetIds 解析接收人。
     *
     * <p>一条规则可能同时配了角色、部门、用户三类目标，用分号分隔：
     * {@code role:1,2;dept:103;user:5}。逐段解析后并集去重。</p>
     */
    private Set<Long> resolveTargets(YqPushRule rule) {
        Set<Long> out = new LinkedHashSet<>();
        String targets = rule.getTargetIds();
        if (StringUtils.isBlank(targets)) {
            return out;
        }
        for (String seg : targets.split("[;；]")) {
            String s = seg.trim();
            if (s.isEmpty()) {
                continue;
            }
            int idx = s.indexOf(':');
            if (idx > 0) {
                String type = s.substring(0, idx).trim().toLowerCase();
                String ids = s.substring(idx + 1).trim();
                out.addAll(targetResolver.resolve(type, ids));
            } else {
                /* 未带类型前缀时按用户ID理解 —— 兼容运维手工填的简单写法 */
                out.addAll(targetResolver.resolve("user", s));
            }
        }
        return out;
    }

    /** 降级推正文时只取尾部（结论区），避免超长被企微截断 */
    private String summary(String content) {
        if (content.length() <= 1800) {
            return content;
        }
        return content.substring(0, 1800) + "\\n\\n> （正文过长已截断，完整内容请到系统查看）";
    }
}
`,
  },

  /* ------------------------------------------------------------ 定时任务 */
  {
    rel: 'job/YqDailyReportJobExecutor.java',
    content: `package org.dromara.yuqing.job;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import lombok.RequiredArgsConstructor;
import org.dromara.yuqing.report.build.ReportScopeResolver;
import org.dromara.yuqing.report.config.YqReportProperties;
import org.dromara.yuqing.report.domain.ReportGenerateBo;
import org.dromara.yuqing.report.domain.ReportGenerateResult;
import org.dromara.yuqing.report.service.IYqReportExtService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * 舆情日报 / 月报自动生成定时任务（SnailJob，F-014 验收标准 1）
 *
 * <p><b>控制台配置：</b>执行器名 {@code yuqingDailyReport}。建议日报每日 07:30 执行
 * （早于上班，报送员到岗即有初稿可校对），月报每月 1 日 07:40 执行。</p>
 *
 * <p><b>为什么默认生成「昨天」：</b>舆情数据的采集有迟到（补采、跨天发布），
 * 07:30 生成当天的报告必然缺数据。生成昨天的报告，配合 02:10 的多维分析预聚合，
 * 正文里的统计口径是完整闭合的。</p>
 *
 * <p><b>幂等性：</b>{@code YqReportExtServiceImpl.generate} 内部按
 * {@code (reportType, reportDate)} 判重，已存在且非 failed 的记录不会重复生成。
 * 因此本任务重复执行是安全的 —— SnailJob 的补偿重试不会产出两份日报。</p>
 *
 * <p><b>失败隔离：</b>与采集 / 研判 / 预警完全解耦。生成失败只体现为一条
 * status=failed 的报告记录与返回的失败结果，不影响主流程。</p>
 *
 * @author ruoyi
 */
@Component
@RequiredArgsConstructor
@JobExecutor(name = "yuqingDailyReport")
public class YqDailyReportJobExecutor {

    private final IYqReportExtService reportExtService;

    private final YqReportProperties props;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        if (!props.isEnabled()) {
            return ExecuteResult.success("报告生成引擎已关闭，跳过");
        }
        if (!props.isAutoGenerate()) {
            return ExecuteResult.success("定时自动生成未启用（yuqing.report.auto-generate=false），跳过");
        }
        String type = props.getAutoType() == null ? "daily" : props.getAutoType();
        LocalDate date = "monthly".equalsIgnoreCase(type)
            ? LocalDate.now().withDayOfMonth(1).minusDays(1)
            : ReportScopeResolver.defaultDate();
        try {
            ReportGenerateBo bo = new ReportGenerateBo();
            bo.setReportType(type);
            bo.setReportDate(date);
            bo.setTemplateId(props.getDefaultTemplateId());
            bo.setTriggerType("auto");
            bo.setOverwrite(Boolean.FALSE);
            bo.setPushAfter(props.isPushAfterGenerate());

            ReportGenerateResult r = reportExtService.generate(bo, null);
            SnailJobLog.LOCAL.info("[报告] {}", r.summary());
            if ("failed".equals(r.getStatus())) {
                return ExecuteResult.failure("报告生成失败：" + r.getFailReason());
            }
            return ExecuteResult.success(r.summary());
        } catch (Exception e) {
            SnailJobLog.LOCAL.error("[报告] 执行异常", e);
            return ExecuteResult.failure("报告生成异常: " + e.getMessage());
        }
    }
}
`,
  },

  /* ------------------------------------------------------------ 配置样例 */
  {
    rel: 'config/yq_report.yml',
    content: `# 舆情报告生成配置（F-014 日报 / F-015 月报）
#
# 将此片段并入 ruoyi-admin 的 application-*.yml。
# 所有开关默认保守：auto-generate 默认 false —— 定时任务依赖 SnailJob 控制台
# 创建执行器，在运维配置前不自动跑，避免半夜给全公司推送空日报。
yuqing:
  report:
    # 报告生成引擎总开关（关闭后所有生成端返回明确的"已关闭"而非静默失败）
    enabled: true

    # 是否启用定时自动生成。启用前请先在 SnailJob 控制台创建执行器 yuqingDailyReport
    auto-generate: false

    # 自动生成的报告类型：daily / monthly
    auto-type: daily

    # 自动生成时使用的默认模板ID；留空则按全章节输出、不套模板
    default-template-id:

    # 正文纳入的重点舆情条数上限
    hot-opinion-limit: 10

    # 正文纳入的预警条数上限
    alert-limit: 20

    # 生成后是否自动推送至企业微信（日报一般开、月报建议手工确认后再推）
    push-after-generate: false

    # 启动时自检中文字体可用性（PDF 导出依赖；缺失时打 warn 不阻断启动）
    render-self-check: true

    # PDF 中文字体路径。留空则按以下顺序自动探测：
    #   C:/Windows/Fonts/msyh.ttc
    #   C:/Windows/Fonts/simhei.ttf
    #   C:/Windows/Fonts/simsun.ttc
    #   /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc
    # Linux 服务器推荐：apt install fonts-noto-cjk
    pdf-font-path:
`,
  },
];
