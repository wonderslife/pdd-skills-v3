package org.dromara.yuqing.report.domain;

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
