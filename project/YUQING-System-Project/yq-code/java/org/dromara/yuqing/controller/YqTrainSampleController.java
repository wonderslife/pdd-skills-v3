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
import org.dromara.yuqing.domain.YqTrainSample;
import org.dromara.yuqing.service.IYqTrainSampleService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 训练样本Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/trainSample")
public class YqTrainSampleController extends BaseController {

    private final IYqTrainSampleService trainSampleService;

    /**
     * 查询训练样本列表
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/list")
    public R<PageResult<YqTrainSample>> list(YqTrainSample bo, PageQuery pageQuery) {
        return R.ok(trainSampleService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出训练样本列表
     */
    @SaCheckPermission("yuqing:knowledge:export")
    @Log(title = "训练样本", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqTrainSample bo, HttpServletResponse response) {
        List<YqTrainSample> list = trainSampleService.queryList(bo);
        ExcelBuilder.of(list, YqTrainSample.class).sheetName("训练样本").toResponse(response);
    }

    /**
     * 查询训练样本下拉选项（PRD §4.5；必须声明在 /{sampleId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/optionselect")
    public R<List<YqTrainSample>> optionselect(YqTrainSample bo) {
        return R.ok(trainSampleService.queryList(bo));
    }

    /**
     * 获取训练样本详细信息
     */
    @SaCheckPermission("yuqing:knowledge:query")
    @GetMapping("/{sampleId}")
    public R<YqTrainSample> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long sampleId) {
        return R.ok(trainSampleService.queryById(sampleId));
    }

    /**
     * 新增训练样本
     */
    @SaCheckPermission("yuqing:knowledge:add")
    @Log(title = "训练样本", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqTrainSample bo) {
        return toAjax(trainSampleService.insertByBo(bo));
    }

    /**
     * 修改训练样本
     */
    @SaCheckPermission("yuqing:knowledge:edit")
    @Log(title = "训练样本", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqTrainSample bo) {
        return toAjax(trainSampleService.updateByBo(bo));
    }

    /**
     * 删除训练样本
     */
    @SaCheckPermission("yuqing:knowledge:remove")
    @Log(title = "训练样本", businessType = BusinessType.DELETE)
    @DeleteMapping("/{sampleIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] sampleIds) {
        return toAjax(trainSampleService.deleteWithValidByIds(List.of(sampleIds), true));
    }
}
