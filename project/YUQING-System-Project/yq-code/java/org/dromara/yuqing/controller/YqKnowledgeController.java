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
import org.dromara.yuqing.domain.YqKnowledge;
import org.dromara.yuqing.service.IYqKnowledgeService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 知识库案例Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/knowledge")
public class YqKnowledgeController extends BaseController {

    private final IYqKnowledgeService knowledgeService;

    /**
     * 查询知识库案例列表
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/list")
    public R<PageResult<YqKnowledge>> list(YqKnowledge bo, PageQuery pageQuery) {
        return R.ok(knowledgeService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出知识库案例列表
     */
    @SaCheckPermission("yuqing:knowledge:export")
    @Log(title = "知识库案例", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqKnowledge bo, HttpServletResponse response) {
        List<YqKnowledge> list = knowledgeService.queryList(bo);
        ExcelBuilder.of(list, YqKnowledge.class).sheetName("知识库案例").toResponse(response);
    }

    /**
     * 查询知识库案例下拉选项（PRD §4.5；必须声明在 /{knowledgeId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:knowledge:list")
    @GetMapping("/optionselect")
    public R<List<YqKnowledge>> optionselect(YqKnowledge bo) {
        return R.ok(knowledgeService.queryList(bo));
    }

    /**
     * 获取知识库案例详细信息
     */
    @SaCheckPermission("yuqing:knowledge:query")
    @GetMapping("/{knowledgeId}")
    public R<YqKnowledge> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long knowledgeId) {
        return R.ok(knowledgeService.queryById(knowledgeId));
    }

    /**
     * 新增知识库案例
     */
    @SaCheckPermission("yuqing:knowledge:add")
    @Log(title = "知识库案例", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqKnowledge bo) {
        return toAjax(knowledgeService.insertByBo(bo));
    }

    /**
     * 修改知识库案例
     */
    @SaCheckPermission("yuqing:knowledge:edit")
    @Log(title = "知识库案例", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqKnowledge bo) {
        return toAjax(knowledgeService.updateByBo(bo));
    }

    /**
     * 删除知识库案例
     */
    @SaCheckPermission("yuqing:knowledge:remove")
    @Log(title = "知识库案例", businessType = BusinessType.DELETE)
    @DeleteMapping("/{knowledgeIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] knowledgeIds) {
        return toAjax(knowledgeService.deleteWithValidByIds(List.of(knowledgeIds), true));
    }
}
