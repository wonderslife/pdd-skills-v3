package org.dromara.yuqing.report.service;

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
