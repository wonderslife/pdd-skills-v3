/**
 * F-014 日报生成 · 模板分片 2/5
 * 归属：日报正文构建（纯函数）+ 传输对象
 *
 * 产物：
 *   report/domain/DailyReportContext.java
 *   report/domain/DailyAlertRow.java
 *   report/domain/DailyHotRow.java
 *   report/build/DailyReportBuilder.java      ← 核心：正文组装（11 条验收标准之 2）
 *   report/build/ReportScopeResolver.java
 *   report/build/ReportFileName.java
 *
 * ⚠ 本分片全部为纯函数 / 不可变 DTO，不碰 Spring 容器，便于离线自测。
 */
export const REPORT_TPL2 = [
  /* ------------------------------------------------------------ 上下文 DTO */
  {
    rel: 'report/domain/DailyAlertRow.java',
    content: `package org.dromara.yuqing.report.domain;

import java.time.LocalDateTime;

/**
 * 日报「新增预警」章节的一行（不可变）
 *
 * @param alertId      预警ID
 * @param alertTitle   预警标题
 * @param alertLevel   预警等级
 * @param triggerScene 触发场景
 * @param triggerValue 触发值（关键词/数值）
 * @param channelName  来源渠道
 * @param triggerTime  触发时间
 * @param status       处置状态
 * @author ruoyi
 */
public record DailyAlertRow(Long alertId, String alertTitle, String alertLevel, String triggerScene,
                            String triggerValue, String channelName, LocalDateTime triggerTime, String status) {
}
`,
  },
  {
    rel: 'report/domain/DailyHotRow.java',
    content: `package org.dromara.yuqing.report.domain;

import java.time.LocalDateTime;

/**
 * 日报「重点舆情」章节的一行（不可变）
 *
 * @param opinionId   舆情ID
 * @param title       标题
 * @param channelName 平台/渠道
 * @param sentiAttr   情感属性
 * @param riskLevel   风险等级
 * @param heatScore   热度分
 * @param readCount   阅读数
 * @param shareCount  转发数
 * @param commentCount 评论数
 * @param opinionUrl  原文链接
 * @param publishTime 发布时间
 * @author ruoyi
 */
public record DailyHotRow(Long opinionId, String title, String channelName, String sentiAttr, String riskLevel,
                          Integer heatScore, Long readCount, Long shareCount, Long commentCount,
                          String opinionUrl, LocalDateTime publishTime) {
}
`,
  },
  {
    rel: 'report/domain/DailyReportContext.java',
    content: `package org.dromara.yuqing.report.domain;

import org.dromara.yuqing.analytics.ReportSection;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 日报生成的输入上下文（聚合了正文组装所需的全部素材）
 *
 * <p>把素材集中成一个对象而不是给 Builder 塞 8 个参数，
 * 是为了让 Builder 保持纯函数可测，同时让上层（ExtServiceImpl）
 * 只负责「取数」这一件事。</p>
 *
 * @author ruoyi
 */
public class DailyReportContext {

    /** 报告归属日期 */
    private LocalDate reportDate;

    /** 报告名称（可为空，Builder 会兜底生成） */
    private String reportName;

    /** 分析交接件（F-009 产出，含七节正文骨架） */
    private ReportSection section;

    /** 当日新增预警 */
    private List<DailyAlertRow> alerts = new ArrayList<>();

    /** 重点舆情 */
    private List<DailyHotRow> hotOpinions = new ArrayList<>();

    /** 模板要求的章节编码（按 order_num 排好；为空表示不做章节裁剪） */
    private List<String> requiredSections = new ArrayList<>();

    /** 数据截止时间文本（F-009 批次信息） */
    private String dataUntil;

    /** 取数时发生的降级说明（如分析批次缺失），会写进正文的提示区 */
    private List<String> notices = new ArrayList<>();

    public LocalDate getReportDate() {
        return reportDate;
    }

    public void setReportDate(LocalDate reportDate) {
        this.reportDate = reportDate;
    }

    public String getReportName() {
        return reportName;
    }

    public void setReportName(String reportName) {
        this.reportName = reportName;
    }

    public ReportSection getSection() {
        return section;
    }

    public void setSection(ReportSection section) {
        this.section = section;
    }

    public List<DailyAlertRow> getAlerts() {
        return alerts;
    }

    public void setAlerts(List<DailyAlertRow> alerts) {
        this.alerts = alerts == null ? new ArrayList<>() : alerts;
    }

    public List<DailyHotRow> getHotOpinions() {
        return hotOpinions;
    }

    public void setHotOpinions(List<DailyHotRow> hotOpinions) {
        this.hotOpinions = hotOpinions == null ? new ArrayList<>() : hotOpinions;
    }

    public List<String> getRequiredSections() {
        return requiredSections;
    }

    public void setRequiredSections(List<String> requiredSections) {
        this.requiredSections = requiredSections == null ? new ArrayList<>() : requiredSections;
    }

    public String getDataUntil() {
        return dataUntil;
    }

    public void setDataUntil(String dataUntil) {
        this.dataUntil = dataUntil;
    }

    public List<String> getNotices() {
        return notices;
    }

    public void setNotices(List<String> notices) {
        this.notices = notices == null ? new ArrayList<>() : notices;
    }
}
`,
  },

  /* ------------------------------------------------------------ 文件名 */
  {
    rel: 'report/build/ReportFileName.java',
    content: `package org.dromara.yuqing.report.build;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * 报告文件名生成（纯函数）
 *
 * <p>企业微信 file 消息的 fileName 会直接显示给接收人，
 * 因此不允许出现路径分隔符与制表符等；这里统一做白名单清洗。</p>
 *
 * @author ruoyi
 */
public final class ReportFileName {

    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyyMMdd");

    /** 文件名里不允许出现的字符（含 Windows 保留字符与路径分隔符） */
    private static final String ILLEGAL = "[\\\\\\\\/:*?\\"<>|\\\\r\\\\n\\\\t]";

    /**
     * 生成报告文件名
     *
     * @param type       报告类型 daily / monthly
     * @param date       归属日期
     * @param reportName 报告名称（可空）
     * @param ext        扩展名（不含点）
     */
    public static String of(String type, LocalDate date, String reportName, String ext) {
        String base;
        if (reportName == null || reportName.isBlank()) {
            String prefix = "monthly".equalsIgnoreCase(type) ? "舆情月报" : "舆情日报";
            base = prefix + "-" + (date == null ? "unknown" : date.format(YMD));
        } else {
            base = sanitize(reportName);
        }
        String suffix = (ext == null || ext.isBlank()) ? "md" : ext.replace(".", "");
        if (base.isBlank()) {
            base = "舆情报告";
        }
        return base + "." + suffix;
    }

    /** 清洗非法字符并按 UTF-8 字节截断到 120 —— 企微 fileName 过长会发不出去 */
    public static String sanitize(String s) {
        if (s == null) {
            return "";
        }
        String cleaned = s.replaceAll(ILLEGAL, "_").trim();
        byte[] bytes = cleaned.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (bytes.length <= 120) {
            return cleaned;
        }
        StringBuilder sb = new StringBuilder();
        int used = 0;
        for (int i = 0; i < cleaned.length(); i++) {
            String c = String.valueOf(cleaned.charAt(i));
            int len = c.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
            if (used + len > 120) {
                break;
            }
            sb.append(c);
            used += len;
        }
        return sb.toString();
    }

    private ReportFileName() {
    }
}
`,
  },

  /* ------------------------------------------------------------ 范围解析 */
  {
    rel: 'report/build/ReportScopeResolver.java',
    content: `package org.dromara.yuqing.report.build;

import org.dromara.yuqing.analytics.AggregateScope;

import java.time.LocalDate;

/**
 * 报告统计范围解析（纯函数）
 *
 * <p><b>为什么日报的区间是「当日 00:00 至当日 24:00」而不是滚动 24 小时：</b>
 * 报送场景对「某某日舆情」的口径必须与日历日一致，否则同一份日报
 * 在上午看和下午看数字不一样，无法对外报送。</p>
 *
 * @author ruoyi
 */
public final class ReportScopeResolver {

    /**
     * 构造日报范围
     *
     * @param date 报告归属日期；为空则取昨天（凌晨生成时今天的数还没采完）
     */
    public static AggregateScope daily(LocalDate date) {
        LocalDate d = date == null ? LocalDate.now().minusDays(1) : date;
        AggregateScope scope = new AggregateScope();
        scope.setDateFrom(d);
        scope.setDateTo(d);
        return scope;
    }

    /**
     * 构造月报范围
     *
     * @param year  年
     * @param month 月（1-12）
     */
    public static AggregateScope monthly(int year, int month) {
        LocalDate first = LocalDate.of(year, month, 1);
        AggregateScope scope = new AggregateScope();
        scope.setDateFrom(first);
        scope.setDateTo(first.withDayOfMonth(first.lengthOfMonth()));
        return scope;
    }

    /** 昨天（定时任务默认口径） */
    public static LocalDate defaultDate() {
        return LocalDate.now().minusDays(1);
    }

    private ReportScopeResolver() {
    }
}
`,
  },

  /* ------------------------------------------------------------ 正文构建器 */
  {
    rel: 'report/build/DailyReportBuilder.java',
    content: `package org.dromara.yuqing.report.build;

import org.dromara.yuqing.analytics.ReportSection;
import org.dromara.yuqing.report.domain.DailyAlertRow;
import org.dromara.yuqing.report.domain.DailyHotRow;
import org.dromara.yuqing.report.domain.DailyReportContext;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 日报正文构建器（纯函数，F-014 验收标准 2）
 *
 * <p><b>与 F-009 的关系：</b>正文骨架直接复用 {@link ReportSection} 的 markdown
 * ——那是 F-009 已经产出的七节分析报告（总体态势 / 平台 / 地域 / 话题 /
 * 传播趋势 / 热点 TOP / 分析结论）。本构建器在此之上**补两节**：
 * 「当日新增预警」与「重点舆情详情」，并把整体包成日报的收尾结构
 * （数据截止 + 生成说明 + 免责提示）。</p>
 *
 * <p><b>确定性：</b>不读时钟、不读数据库、不依赖随机数。同一份 context
 * 在任何时刻都产出完全相同的字符串，这样才可做快照式单元测试，
 * 也才能让「重新生成」的结果与首次生成可比对。</p>
 *
 * @author ruoyi
 */
public final class DailyReportBuilder {

    private static final String NL = "\\n";
    private static final DateTimeFormatter YMD = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter YMD_HM = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /**
     * 组装日报正文（Markdown）
     *
     * @param ctx 输入上下文
     * @return 完整正文
     */
    public static String build(DailyReportContext ctx) {
        DailyReportContext c = ctx == null ? new DailyReportContext() : ctx;
        LocalDate d = c.getReportDate() == null ? LocalDate.now() : c.getReportDate();

        StringBuilder sb = new StringBuilder(4096);
        sb.append("# ").append(title(c, d)).append(NL).append(NL);
        sb.append("统计日期：").append(d.format(YMD)).append(NL);
        if (c.getDataUntil() != null && !c.getDataUntil().isBlank()) {
            sb.append("数据截止：").append(c.getDataUntil()).append(NL);
        }
        sb.append(NL);

        appendNotices(sb, c);

        /* 骨架：F-009 交接件 */
        ReportSection section = c.getSection();
        if (section == null || section.getMarkdown() == null || section.getMarkdown().isBlank()) {
            sb.append("## 数据分析").append(NL).append(NL);
            sb.append("> 未取到当日分析批次数据，本节为空。请确认多维分析任务（yuqingStatsAggregate）已执行。").append(NL).append(NL);
        } else {
            sb.append(stripLeadingTitle(section.getMarkdown())).append(NL);
        }

        /* 补充一：当日新增预警 */
        appendAlerts(sb, c.getAlerts(), c.getRequiredSections());

        /* 补充二：重点舆情详情 */
        appendHot(sb, c.getHotOpinions(), c.getRequiredSections());

        /* 收尾 */
        sb.append("---").append(NL).append(NL);
        sb.append("> 本报告由舆情监测平台自动生成，共纳入舆情 ")
            .append(c.getHotOpinions() == null ? 0 : c.getHotOpinions().size())
            .append(" 条、预警 ").append(c.getAlerts() == null ? 0 : c.getAlerts().size())
            .append(" 条。报送前请人工校对。").append(NL);
        return sb.toString();
    }

    /**
     * 标题：优先用配置的报告名，否则用「舆情日报 YYYY-MM-DD」
     */
    public static String title(DailyReportContext c, LocalDate date) {
        if (c != null && c.getReportName() != null && !c.getReportName().isBlank()) {
            return c.getReportName();
        }
        LocalDate d = date == null ? LocalDate.now() : date;
        return "舆情日报 " + d.format(YMD);
    }

    /* ------------------------------------------------------------------ 内部 */

    /** 去掉交接件自带的一级标题，避免日报出现两个 H1 */
    private static String stripLeadingTitle(String md) {
        if (md == null) {
            return "";
        }
        String s = md.stripLeading();
        if (s.startsWith("# ")) {
            int idx = s.indexOf(NL);
            return idx < 0 ? "" : s.substring(idx + 1).stripLeading();
        }
        return s;
    }

    private static void appendNotices(StringBuilder sb, DailyReportContext c) {
        if (c.getNotices() == null || c.getNotices().isEmpty()) {
            return;
        }
        sb.append("> **生成提示**").append(NL);
        for (String n : c.getNotices()) {
            if (n != null && !n.isBlank()) {
                sb.append("> - ").append(n).append(NL);
            }
        }
        sb.append(NL);
    }

    /**
     * 当日新增预警
     *
     * <p>表头固定四列而非把 triggerValue 塞进标题：报送员扫一眼要的是
     * 「什么等级、什么场景、什么时候」，细节去系统里看。</p>
     */
    private static void appendAlerts(StringBuilder sb, List<DailyAlertRow> rows, List<String> requiredSections) {
        if (skip("alert", requiredSections)) {
            return;
        }
        sb.append("### 八、当日新增预警").append(NL).append(NL);
        if (rows == null || rows.isEmpty()) {
            sb.append("当日无新增预警。").append(NL).append(NL);
            return;
        }
        sb.append("| 序号 | 预警等级 | 触发场景 | 预警内容 | 来源渠道 | 触发时间 | 状态 |").append(NL);
        sb.append("| --- | --- | --- | --- | --- | --- | --- |").append(NL);
        int i = 1;
        for (DailyAlertRow r : rows) {
            sb.append("| ").append(i++).append(" | ")
                .append(levelText(r.alertLevel())).append(" | ")
                .append(sceneText(r.triggerScene())).append(" | ")
                .append(cell(r.alertTitle())).append(" | ")
                .append(cell(r.channelName())).append(" | ")
                .append(cell(fmt(r.triggerTime()))).append(" | ")
                .append(statusText(r.status())).append(" |").append(NL);
        }
        sb.append(NL);
    }

    /**
     * 重点舆情详情
     *
     * <p>用列表而非表格：正文里要点开原文链接，表格单元格塞 URL 会溢出一行。
     * 只列 TOP N，完整清单在系统里看。</p>
     */
    private static void appendHot(StringBuilder sb, List<DailyHotRow> rows, List<String> requiredSections) {
        if (skip("hot", requiredSections)) {
            return;
        }
        sb.append("### 九、重点舆情详情").append(NL).append(NL);
        if (rows == null || rows.isEmpty()) {
            sb.append("当日无重点舆情。").append(NL).append(NL);
            return;
        }
        int i = 1;
        for (DailyHotRow r : rows) {
            sb.append(i++).append(". **").append(inlineBoldSafe(r.title())).append("**").append(NL);
            sb.append("   - 平台：").append(or(r.channelName(), "—"))
                .append("　属性：").append(or(r.sentiAttr(), "—"))
                .append("　风险：").append(or(riskText(r.riskLevel()), "—"))
                .append("　热度：").append(r.heatScore() == null ? 0 : r.heatScore()).append(NL);
            sb.append("   - 阅读 ").append(nz(r.readCount()))
                .append(" / 转发 ").append(nz(r.shareCount()))
                .append(" / 评论 ").append(nz(r.commentCount()))
                .append("　发布时间：").append(or(fmt(r.publishTime()), "—")).append(NL);
            if (r.opinionUrl() != null && !r.opinionUrl().isBlank()) {
                sb.append("   - 原文：").append(safeUrl(r.opinionUrl())).append(NL);
            }
            sb.append(NL);
        }
    }

    /**
     * 模板章节裁剪：模板里没勾选的章节直接不输出。
     *
     * <p>空清单视为「未配置模板」→ 全出。这是刻意的：宁可多出，
     * 不可因为一次配置失误产出缺章节的报告。</p>
     */
    private static boolean skip(String code, List<String> requiredSections) {
        if (requiredSections == null || requiredSections.isEmpty()) {
            return false;
        }
        return !requiredSections.contains(code);
    }

    /* ------------------------------------------------------------- 字段格式化 */

    /** 标题里的 ** 会破坏加粗配平，先摘掉 */
    private static String inlineBoldSafe(String s) {
        if (s == null || s.isBlank()) {
            return "（无标题）";
        }
        String t = s.replace("**", "").replace("\\r", " ").replace("\\n", " ").trim();
        return t.length() > 60 ? t.substring(0, 60) + "…" : t;
    }

    /** 表格单元格：竖线与换行会整行错列 */
    private static String cell(String s) {
        if (s == null || s.isBlank()) {
            return "—";
        }
        String t = s.replace("|", "/").replace("\\r", " ").replace("\\n", " ").trim();
        return t.length() > 50 ? t.substring(0, 50) + "…" : t;
    }

    private static String safeUrl(String url) {
        String u = url.trim();
        if (u.startsWith("http://") || u.startsWith("https://")) {
            return u;
        }
        return "（链接格式异常，已隐藏）";
    }

    private static String or(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : cell(v);
    }

    private static String fmt(LocalDateTime t) {
        return t == null ? null : t.format(YMD_HM);
    }

    private static long nz(Long v) {
        return v == null ? 0L : v;
    }

    private static String levelText(String v) {
        if (v == null) {
            return "—";
        }
        return switch (v) {
            case "urgent" -> "紧急";
            case "warning" -> "重要";
            case "notice" -> "提示";
            default -> v;
        };
    }

    private static String sceneText(String v) {
        if (v == null) {
            return "—";
        }
        return switch (v) {
            case "keyword" -> "关键词命中";
            case "heat" -> "热度阈值";
            case "negative" -> "负面聚集";
            case "special_topic" -> "专项话题";
            case "manual" -> "人工触发";
            default -> v;
        };
    }

    private static String statusText(String v) {
        if (v == null) {
            return "—";
        }
        return switch (v) {
            case "pending" -> "未处置";
            case "processing" -> "处置中";
            case "processed" -> "已处置";
            case "ignored" -> "已忽略";
            default -> v;
        };
    }

    private static String riskText(String v) {
        if (v == null) {
            return null;
        }
        return switch (v) {
            case "high" -> "高";
            case "medium" -> "中";
            case "low" -> "低";
            default -> v;
        };
    }

    private DailyReportBuilder() {
    }
}
`,
  },
];
