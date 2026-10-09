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
import org.dromara.yuqing.domain.YqKeywordGroup;
import org.dromara.yuqing.service.IYqKeywordGroupService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 关键词分组Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/keywordGroup")
public class YqKeywordGroupController extends BaseController {

    private final IYqKeywordGroupService keywordGroupService;

    /**
     * 查询关键词分组列表
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/list")
    public R<PageResult<YqKeywordGroup>> list(YqKeywordGroup bo, PageQuery pageQuery) {
        return R.ok(keywordGroupService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出关键词分组列表
     */
    @SaCheckPermission("yuqing:keyword:export")
    @Log(title = "关键词分组", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqKeywordGroup bo, HttpServletResponse response) {
        List<YqKeywordGroup> list = keywordGroupService.queryList(bo);
        ExcelBuilder.of(list, YqKeywordGroup.class).sheetName("关键词分组").toResponse(response);
    }

    /**
     * 查询关键词分组下拉选项（PRD §4.5；必须声明在 /{groupId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/optionselect")
    public R<List<YqKeywordGroup>> optionselect(YqKeywordGroup bo) {
        return R.ok(keywordGroupService.queryList(bo));
    }

    /**
     * 获取关键词分组详细信息
     */
    @SaCheckPermission("yuqing:keyword:query")
    @GetMapping("/{groupId}")
    public R<YqKeywordGroup> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long groupId) {
        return R.ok(keywordGroupService.queryById(groupId));
    }

    /**
     * 新增关键词分组
     */
    @SaCheckPermission("yuqing:keyword:add")
    @Log(title = "关键词分组", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqKeywordGroup bo) {
        return toAjax(keywordGroupService.insertByBo(bo));
    }

    /**
     * 修改关键词分组
     */
    @SaCheckPermission("yuqing:keyword:edit")
    @Log(title = "关键词分组", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqKeywordGroup bo) {
        return toAjax(keywordGroupService.updateByBo(bo));
    }

    /**
     * 删除关键词分组
     */
    @SaCheckPermission("yuqing:keyword:remove")
    @Log(title = "关键词分组", businessType = BusinessType.DELETE)
    @DeleteMapping("/{groupIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] groupIds) {
        return toAjax(keywordGroupService.deleteWithValidByIds(List.of(groupIds), true));
    }
}
