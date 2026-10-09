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
import org.dromara.inspect.domain.InspectAbnormal;
import org.dromara.inspect.service.IInspectAbnormalExtService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 异常项管理 Controller（PRD 模块 12）
 * <p>
 * 路由顺序遵循 PRD 6.3：/list 与 /export 必须声明在 /{abnormalId} 之前。
 * 异常项由 H5 提交巡检记录时自动生成，PC 端只负责查询与「标记已处理」。
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/abnormal")
public class InspectAbnormalController extends BaseController {

    private final IInspectAbnormalExtService abnormalExtService;

    /**
     * 异常项列表（含点位/机房/巡检项名称，支持按 status 筛选）
     */
    @SaCheckPermission("inspect:abnormal:list")
    @GetMapping("/list")
    public R<PageResult<InspectAbnormal>> list(InspectAbnormal bo, PageQuery pageQuery) {
        return R.ok(abnormalExtService.queryPageListWithNames(bo, pageQuery));
    }

    /**
     * 导出异常项
     */
    @SaCheckPermission("inspect:abnormal:export")
    @Log(title = "异常项", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectAbnormal bo, HttpServletResponse response) {
        List<InspectAbnormal> list = abnormalExtService.queryExportList(bo);
        ExcelBuilder.of(list, InspectAbnormal.class).sheetName("异常项").toResponse(response);
    }

    /**
     * 异常项详情（含关联记录与现场照片 URL）
     */
    @SaCheckPermission("inspect:abnormal:query")
    @GetMapping("/{abnormalId}")
    public R<InspectAbnormal> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long abnormalId) {
        return R.ok(abnormalExtService.queryDetail(abnormalId));
    }

    /**
     * 标记已处理（处理说明必填，处理人/处理时间取当前登录用户）
     */
    @SaCheckPermission("inspect:abnormal:process")
    @Log(title = "异常项处理", businessType = BusinessType.UPDATE)
    @PutMapping("/{abnormalId}/process")
    public R<Void> process(@NotNull(message = "主键不能为空") @PathVariable Long abnormalId,
                           @RequestBody InspectAbnormal bo) {
        return toAjax(abnormalExtService.process(abnormalId, bo.getProcessRemark()));
    }

}
