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
import org.dromara.yuqing.domain.YqTag;
import org.dromara.yuqing.service.IYqTagService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 标签Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/tag")
public class YqTagController extends BaseController {

    private final IYqTagService tagService;

    /**
     * 查询标签列表
     */
    @SaCheckPermission("yuqing:tag:list")
    @GetMapping("/list")
    public R<PageResult<YqTag>> list(YqTag bo, PageQuery pageQuery) {
        return R.ok(tagService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出标签列表
     */
    @SaCheckPermission("yuqing:tag:export")
    @Log(title = "标签", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqTag bo, HttpServletResponse response) {
        List<YqTag> list = tagService.queryList(bo);
        ExcelBuilder.of(list, YqTag.class).sheetName("标签").toResponse(response);
    }

    /**
     * 查询标签下拉选项（PRD §4.5；必须声明在 /{tagId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:tag:list")
    @GetMapping("/optionselect")
    public R<List<YqTag>> optionselect(YqTag bo) {
        return R.ok(tagService.queryList(bo));
    }

    /**
     * 获取标签详细信息
     */
    @SaCheckPermission("yuqing:tag:query")
    @GetMapping("/{tagId}")
    public R<YqTag> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long tagId) {
        return R.ok(tagService.queryById(tagId));
    }

    /**
     * 新增标签
     */
    @SaCheckPermission("yuqing:tag:add")
    @Log(title = "标签", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqTag bo) {
        return toAjax(tagService.insertByBo(bo));
    }

    /**
     * 修改标签
     */
    @SaCheckPermission("yuqing:tag:edit")
    @Log(title = "标签", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqTag bo) {
        return toAjax(tagService.updateByBo(bo));
    }

    /**
     * 删除标签
     */
    @SaCheckPermission("yuqing:tag:remove")
    @Log(title = "标签", businessType = BusinessType.DELETE)
    @DeleteMapping("/{tagIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] tagIds) {
        return toAjax(tagService.deleteWithValidByIds(List.of(tagIds), true));
    }
}
