package org.dromara.yuqing.report.domain;

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
