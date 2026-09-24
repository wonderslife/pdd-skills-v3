package org.dromara.inspect.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.inspect.domain.InspectPoint;
import org.dromara.inspect.domain.bo.InspectPointImportBo;
import org.dromara.inspect.domain.vo.PointImportRowVo;
import org.dromara.inspect.domain.vo.ScanPointVo;
import org.dromara.inspect.service.IInspectPointExtService;
import org.dromara.inspect.service.IInspectPointService;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 点位管理 Controller（PRD 模块 3/4/5）
 * <p>
 * 路由顺序遵循 PRD 6.3：固定路径（/list、/optionselect、/importTemplate …）
 * 必须声明在 /{pointId} 之前，否则会被路径变量吞掉。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/point")
public class InspectPointController extends BaseController {

    private final IInspectPointService pointService;
    private final IInspectPointExtService pointExtService;

    /**
     * 查询点位列表（分页 + 按机房/区域/名称/状态筛选）
     */
    @SaCheckPermission("inspect:point:list")
    @GetMapping("/list")
    public R<PageResult<InspectPoint>> list(InspectPoint bo, PageQuery pageQuery) {
        return R.ok(pointService.queryPageList(bo, pageQuery));
    }

    /**
     * 点位下拉选项（PRD 4.5；必须在 /{pointId} 之前）
     */
    @SaCheckPermission("inspect:point:list")
    @GetMapping("/optionselect")
    public R<List<InspectPoint>> optionselect(InspectPoint bo) {
        return R.ok(pointService.queryList(bo));
    }

    /**
     * 下载 Excel 导入模板
     */
    @GetMapping("/importTemplate")
    public void importTemplate(HttpServletResponse response) {
        ExcelBuilder.of(pointExtService.importTemplateSample(), InspectPointImportBo.class)
            .sheetName("点位导入模板")
            .toResponse(response);
    }

    /**
     * 上传 Excel 并逐行校验（不落库），返回每行结果
     */
    @SaCheckPermission("inspect:point:import")
    @Log(title = "点位导入校验", businessType = BusinessType.IMPORT)
    @PostMapping(value = "/importData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public R<List<PointImportRowVo>> importData(@RequestPart("file") MultipartFile file) {
        return R.ok(pointExtService.importData(file));
    }

    /**
     * 确认导入（仅落库校验通过的行）
     */
    @SaCheckPermission("inspect:point:import")
    @Log(title = "点位导入", businessType = BusinessType.IMPORT)
    @PostMapping("/importConfirm")
    public R<Integer> importConfirm(@RequestBody List<PointImportRowVo> rows) {
        return R.ok(pointExtService.importConfirm(rows));
    }

    /**
     * 批量导出二维码 ZIP（PRD 模块 5）
     */
    @SaCheckPermission("inspect:point:qrcode")
    @Log(title = "点位二维码批量导出", businessType = BusinessType.EXPORT)
    @PostMapping("/qrcode/batchExport")
    public void batchExportQrCode(@RequestBody List<Long> pointIds, HttpServletResponse response) throws IOException {
        byte[] zip = pointExtService.batchExportQrCodeZip(pointIds);
        response.setContentType("application/zip");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String fileName = URLEncoder.encode("点位二维码_" + System.currentTimeMillis() + ".zip", StandardCharsets.UTF_8);
        response.setHeader("Content-Disposition", "attachment;filename=" + fileName);
        response.setContentLength(zip.length);
        response.getOutputStream().write(zip);
        response.getOutputStream().flush();
    }

    /**
     * 单点位二维码 PNG
     */
    @SaCheckPermission("inspect:point:qrcode")
    @GetMapping("/{pointId}/qrcode")
    public void qrcode(@NotNull(message = "主键不能为空") @PathVariable Long pointId,
                       HttpServletResponse response) throws IOException {
        byte[] png = pointExtService.generateQrCodePng(pointId);
        response.setContentType("image/png");
        response.setContentLength(png.length);
        response.getOutputStream().write(png);
        response.getOutputStream().flush();
    }

    /**
     * 点位详情（含巡检项清单）
     */
    @SaCheckPermission("inspect:point:query")
    @GetMapping("/{pointId}")
    public R<ScanPointVo> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long pointId) {
        return R.ok(pointExtService.queryDetailWithItems(pointId));
    }

    /**
     * 新增点位（含巡检项，返回点位ID 与二维码 URL）
     */
    @SaCheckPermission("inspect:point:add")
    @Log(title = "点位", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Long> add(@Validated @RequestBody InspectPoint bo) {
        return R.ok(pointExtService.insertPoint(bo));
    }

    /**
     * 修改点位（巡检项全量覆盖）
     */
    @SaCheckPermission("inspect:point:edit")
    @Log(title = "点位", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody InspectPoint bo) {
        return toAjax(pointExtService.updatePoint(bo));
    }

    /**
     * 批量软删点位
     */
    @SaCheckPermission("inspect:point:remove")
    @Log(title = "点位", businessType = BusinessType.DELETE)
    @DeleteMapping("/{pointIds}")
    public R<Void> remove(@PathVariable Long[] pointIds) {
        return toAjax(pointService.deleteWithValidByIds(List.of(pointIds), true));
    }

}
