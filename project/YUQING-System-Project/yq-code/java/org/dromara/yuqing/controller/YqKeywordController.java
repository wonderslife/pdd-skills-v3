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
import org.dromara.yuqing.domain.YqKeyword;
import org.dromara.yuqing.service.IYqKeywordService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 关键词Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/keyword")
public class YqKeywordController extends BaseController {

    private final IYqKeywordService keywordService;

    /**
     * 查询关键词列表
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/list")
    public R<PageResult<YqKeyword>> list(YqKeyword bo, PageQuery pageQuery) {
        return R.ok(keywordService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出关键词列表
     */
    @SaCheckPermission("yuqing:keyword:export")
    @Log(title = "关键词", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqKeyword bo, HttpServletResponse response) {
        List<YqKeyword> list = keywordService.queryList(bo);
        ExcelBuilder.of(list, YqKeyword.class).sheetName("关键词").toResponse(response);
    }

    /**
     * 查询关键词下拉选项（PRD §4.5；必须声明在 /{keywordId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:keyword:list")
    @GetMapping("/optionselect")
    public R<List<YqKeyword>> optionselect(YqKeyword bo) {
        return R.ok(keywordService.queryList(bo));
    }

    /**
     * 获取关键词详细信息
     */
    @SaCheckPermission("yuqing:keyword:query")
    @GetMapping("/{keywordId}")
    public R<YqKeyword> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long keywordId) {
        return R.ok(keywordService.queryById(keywordId));
    }

    /**
     * 新增关键词
     */
    @SaCheckPermission("yuqing:keyword:add")
    @Log(title = "关键词", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqKeyword bo) {
        return toAjax(keywordService.insertByBo(bo));
    }

    /**
     * 修改关键词
     */
    @SaCheckPermission("yuqing:keyword:edit")
    @Log(title = "关键词", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqKeyword bo) {
        return toAjax(keywordService.updateByBo(bo));
    }

    /**
     * 删除关键词
     */
    @SaCheckPermission("yuqing:keyword:remove")
    @Log(title = "关键词", businessType = BusinessType.DELETE)
    @DeleteMapping("/{keywordIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] keywordIds) {
        return toAjax(keywordService.deleteWithValidByIds(List.of(keywordIds), true));
    }
}
