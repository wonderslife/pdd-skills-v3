package org.dromara.yuqing.controller;

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
            String msg = r.message() == null ? "导出失败" : r.message().replace("\"", "'");
            response.getWriter().write("{\"code\":500,\"msg\":\"" + msg + "\"}");
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
