package org.dromara.yuqing.controller;

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
import org.dromara.yuqing.domain.YqCleanBatch;
import org.dromara.yuqing.service.IYqCleanBatchService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 净化批次Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/cleanBatch")
public class YqCleanBatchController extends BaseController {

    private final IYqCleanBatchService cleanBatchService;

    /**
     * 查询净化批次列表
     */
    @SaCheckPermission("yuqing:clean:list")
    @GetMapping("/list")
    public R<PageResult<YqCleanBatch>> list(YqCleanBatch bo, PageQuery pageQuery) {
        return R.ok(cleanBatchService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出净化批次列表
     */
    @SaCheckPermission("yuqing:clean:export")
    @Log(title = "净化批次", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqCleanBatch bo, HttpServletResponse response) {
        List<YqCleanBatch> list = cleanBatchService.queryList(bo);
        ExcelBuilder.of(list, YqCleanBatch.class).sheetName("净化批次").toResponse(response);
    }

    /**
     * 查询净化批次下拉选项（PRD §4.5；必须声明在 /{batchId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:clean:list")
    @GetMapping("/optionselect")
    public R<List<YqCleanBatch>> optionselect(YqCleanBatch bo) {
        return R.ok(cleanBatchService.queryList(bo));
    }

    /**
     * 获取净化批次详细信息
     */
    @SaCheckPermission("yuqing:clean:query")
    @GetMapping("/{batchId}")
    public R<YqCleanBatch> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long batchId) {
        return R.ok(cleanBatchService.queryById(batchId));
    }

    /**
     * 新增净化批次
     */
    @SaCheckPermission("yuqing:clean:add")
    @Log(title = "净化批次", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqCleanBatch bo) {
        return toAjax(cleanBatchService.insertByBo(bo));
    }

    /**
     * 修改净化批次
     */
    @SaCheckPermission("yuqing:clean:edit")
    @Log(title = "净化批次", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqCleanBatch bo) {
        return toAjax(cleanBatchService.updateByBo(bo));
    }

    /**
     * 删除净化批次
     */
    @SaCheckPermission("yuqing:clean:remove")
    @Log(title = "净化批次", businessType = BusinessType.DELETE)
    @DeleteMapping("/{batchIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] batchIds) {
        return toAjax(cleanBatchService.deleteWithValidByIds(List.of(batchIds), true));
    }
}
