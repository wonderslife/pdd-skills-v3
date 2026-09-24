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
import org.dromara.inspect.domain.InspectRecord;
import org.dromara.inspect.domain.bo.InspectRecordSubmitBo;
import org.dromara.inspect.domain.vo.ScanPointVo;
import org.dromara.inspect.service.IInspectPointExtService;
import org.dromara.inspect.service.IInspectRecordExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 巡检记录 Controller（PRD 模块 8/9/10）
 * <p>
 * 说明：PRD 6.3 列出了 `POST /inspect/record/draft`（保存草稿），但 PRD 模块 8 验收标准 9
 * 明确「草稿存于 H5 本地存储，非离线巡检」，且数据模型中没有草稿表。
 * 为避免引入无谓的表结构，服务端不实现草稿落库，草稿由 H5 端本地保存。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/record")
public class InspectRecordController extends BaseController {

    private final IInspectRecordExtService recordExtService;
    private final IInspectPointExtService pointExtService;

    /**
     * 巡检记录列表（PC，多维筛选、异常置顶）
     */
    @SaCheckPermission("inspect:record:list")
    @GetMapping("/list")
    public R<PageResult<InspectRecord>> list(InspectRecord bo, PageQuery pageQuery) {
        return R.ok(recordExtService.queryPageListWithNames(bo, pageQuery));
    }

    /**
     * 本人所属机房的点位列表（PRD 6.3；H5 手动输码兜底数据源）
     */
    @GetMapping("/myPointList")
    public R<List<ScanPointVo>> myPointList() {
        return R.ok(pointExtService.myPointList());
    }

    /**
     * 本人巡检记录（H5「我的记录」）
     */
    @GetMapping("/my")
    public R<PageResult<InspectRecord>> my(InspectRecord bo, PageQuery pageQuery) {
        return R.ok(recordExtService.queryMyRecords(bo, pageQuery));
    }

    /**
     * 提交巡检记录（H5 现场扫码提交）
     */
    @Log(title = "巡检记录提交", businessType = BusinessType.INSERT)
    @PostMapping("/submit")
    public R<Long> submit(@RequestBody InspectRecordSubmitBo bo) {
        return R.ok(recordExtService.submitRecord(bo, false));
    }

    /**
     * PC 逾期补录（专属账号，巡检时间可选）
     */
    @SaCheckPermission("inspect:record:supplement")
    @Log(title = "巡检逾期补录", businessType = BusinessType.INSERT)
    @PostMapping("/supplement")
    public R<Long> supplement(@RequestBody InspectRecordSubmitBo bo) {
        return R.ok(recordExtService.submitRecord(bo, true));
    }

    /**
     * 导出巡检记录
     */
    @SaCheckPermission("inspect:record:export")
    @Log(title = "巡检记录", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectRecord bo, HttpServletResponse response) {
        List<InspectRecord> list = recordExtService.queryExportList(bo);
        ExcelBuilder.of(list, InspectRecord.class).sheetName("巡检记录").toResponse(response);
    }

    /**
     * 记录详情（含巡检项结果、照片 URL）
     */
    @SaCheckPermission("inspect:record:query")
    @GetMapping("/{recordId}")
    public R<InspectRecord> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long recordId) {
        return R.ok(recordExtService.queryDetail(recordId));
    }

    /**
     * 追加管理员备注（已提交记录不可修改，仅可追加）
     */
    @SaCheckPermission("inspect:record:remark")
    @Log(title = "巡检记录备注", businessType = BusinessType.UPDATE)
    @PutMapping("/{recordId}/remark")
    public R<Void> remark(@NotNull(message = "主键不能为空") @PathVariable Long recordId,
                          @RequestBody InspectRecord bo) {
        return toAjax(recordExtService.appendAdminRemark(recordId, bo.getAdminRemark()));
    }

}
