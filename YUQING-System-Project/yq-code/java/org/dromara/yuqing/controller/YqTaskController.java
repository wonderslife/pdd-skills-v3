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
import org.dromara.yuqing.domain.YqTask;
import org.dromara.yuqing.service.IYqTaskService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 监测任务Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/task")
public class YqTaskController extends BaseController {

    private final IYqTaskService taskService;

    /**
     * 查询监测任务列表
     */
    @SaCheckPermission("yuqing:task:list")
    @GetMapping("/list")
    public R<PageResult<YqTask>> list(YqTask bo, PageQuery pageQuery) {
        return R.ok(taskService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出监测任务列表
     */
    @SaCheckPermission("yuqing:task:export")
    @Log(title = "监测任务", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqTask bo, HttpServletResponse response) {
        List<YqTask> list = taskService.queryList(bo);
        ExcelBuilder.of(list, YqTask.class).sheetName("监测任务").toResponse(response);
    }

    /**
     * 查询监测任务下拉选项（PRD §4.5；必须声明在 /{taskId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:task:list")
    @GetMapping("/optionselect")
    public R<List<YqTask>> optionselect(YqTask bo) {
        return R.ok(taskService.queryList(bo));
    }

    /**
     * 获取监测任务详细信息
     */
    @SaCheckPermission("yuqing:task:query")
    @GetMapping("/{taskId}")
    public R<YqTask> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long taskId) {
        return R.ok(taskService.queryById(taskId));
    }

    /**
     * 新增监测任务
     */
    @SaCheckPermission("yuqing:task:add")
    @Log(title = "监测任务", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqTask bo) {
        return toAjax(taskService.insertByBo(bo));
    }

    /**
     * 修改监测任务
     */
    @SaCheckPermission("yuqing:task:edit")
    @Log(title = "监测任务", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqTask bo) {
        return toAjax(taskService.updateByBo(bo));
    }

    /**
     * 删除监测任务
     */
    @SaCheckPermission("yuqing:task:remove")
    @Log(title = "监测任务", businessType = BusinessType.DELETE)
    @DeleteMapping("/{taskIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] taskIds) {
        return toAjax(taskService.deleteWithValidByIds(List.of(taskIds), true));
    }
}
