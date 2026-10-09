package org.dromara.inspect.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.web.core.BaseController;
import org.dromara.inspect.domain.InspectStatsDaily;
import org.dromara.inspect.service.IInspectStatsDailyService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 统计预聚合Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/inspect/statsDaily")
public class InspectStatsDailyController extends BaseController {

    private final IInspectStatsDailyService statsDailyService;

    /**
     * 查询统计预聚合列表
     */
    @SaCheckPermission("inspect:stats:list")
    @GetMapping("/list")
    public R<PageResult<InspectStatsDaily>> list(InspectStatsDaily bo, PageQuery pageQuery) {
        return R.ok(statsDailyService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出统计预聚合列表
     */
    @SaCheckPermission("inspect:stats:export")
    @Log(title = "统计预聚合", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(InspectStatsDaily bo, HttpServletResponse response) {
        List<InspectStatsDaily> list = statsDailyService.queryList(bo);
        ExcelBuilder.of(list, InspectStatsDaily.class).sheetName("统计预聚合").toResponse(response);
    }

    /**
     * 查询统计预聚合下拉选项（PRD 4.5；必须声明在 /{statsId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("inspect:stats:list")
    @GetMapping("/optionselect")
    public R<List<InspectStatsDaily>> optionselect(InspectStatsDaily bo) {
        return R.ok(statsDailyService.queryList(bo));
    }

    /**
     * 获取统计预聚合详细信息
     */
    @SaCheckPermission("inspect:stats:query")
    @GetMapping("/{statsId}")
    public R<InspectStatsDaily> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long statsId) {
        return R.ok(statsDailyService.queryById(statsId));
    }

    /**
     * 新增统计预聚合
     */
    @SaCheckPermission("inspect:stats:add")
    @Log(title = "统计预聚合", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody InspectStatsDaily bo) {
        return toAjax(statsDailyService.insertByBo(bo));
    }

    /**
     * 修改统计预聚合
     */
    @SaCheckPermission("inspect:stats:edit")
    @Log(title = "统计预聚合", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody InspectStatsDaily bo) {
        return toAjax(statsDailyService.updateByBo(bo));
    }

    /**
     * 删除统计预聚合
     */
    @SaCheckPermission("inspect:stats:remove")
    @Log(title = "统计预聚合", businessType = BusinessType.DELETE)
    @DeleteMapping("/{statsIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] statsIds) {
        return toAjax(statsDailyService.deleteWithValidByIds(List.of(statsIds), true));
    }
}
