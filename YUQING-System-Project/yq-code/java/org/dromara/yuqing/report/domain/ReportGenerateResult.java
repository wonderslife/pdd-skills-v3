package org.dromara.yuqing.report.domain;

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
