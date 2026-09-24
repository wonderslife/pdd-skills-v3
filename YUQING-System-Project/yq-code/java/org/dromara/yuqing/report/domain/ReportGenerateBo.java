package org.dromara.yuqing.report.domain;

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
