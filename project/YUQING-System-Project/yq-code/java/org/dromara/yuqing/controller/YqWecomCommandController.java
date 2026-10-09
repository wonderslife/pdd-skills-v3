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
import org.dromara.yuqing.domain.YqWecomCommand;
import org.dromara.yuqing.service.IYqWecomCommandService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 企业微信指令Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/wecomCommand")
public class YqWecomCommandController extends BaseController {

    private final IYqWecomCommandService wecomCommandService;

    /**
     * 查询企业微信指令列表
     */
    @SaCheckPermission("yuqing:wecom:list")
    @GetMapping("/list")
    public R<PageResult<YqWecomCommand>> list(YqWecomCommand bo, PageQuery pageQuery) {
        return R.ok(wecomCommandService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出企业微信指令列表
     */
    @SaCheckPermission("yuqing:wecom:export")
    @Log(title = "企业微信指令", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqWecomCommand bo, HttpServletResponse response) {
        List<YqWecomCommand> list = wecomCommandService.queryList(bo);
        ExcelBuilder.of(list, YqWecomCommand.class).sheetName("企业微信指令").toResponse(response);
    }

    /**
     * 查询企业微信指令下拉选项（PRD §4.5；必须声明在 /{commandId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:wecom:list")
    @GetMapping("/optionselect")
    public R<List<YqWecomCommand>> optionselect(YqWecomCommand bo) {
        return R.ok(wecomCommandService.queryList(bo));
    }

    /**
     * 获取企业微信指令详细信息
     */
    @SaCheckPermission("yuqing:wecom:query")
    @GetMapping("/{commandId}")
    public R<YqWecomCommand> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long commandId) {
        return R.ok(wecomCommandService.queryById(commandId));
    }

    /**
     * 新增企业微信指令
     */
    @SaCheckPermission("yuqing:wecom:add")
    @Log(title = "企业微信指令", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqWecomCommand bo) {
        return toAjax(wecomCommandService.insertByBo(bo));
    }

    /**
     * 修改企业微信指令
     */
    @SaCheckPermission("yuqing:wecom:edit")
    @Log(title = "企业微信指令", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqWecomCommand bo) {
        return toAjax(wecomCommandService.updateByBo(bo));
    }

    /**
     * 删除企业微信指令
     */
    @SaCheckPermission("yuqing:wecom:remove")
    @Log(title = "企业微信指令", businessType = BusinessType.DELETE)
    @DeleteMapping("/{commandIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] commandIds) {
        return toAjax(wecomCommandService.deleteWithValidByIds(List.of(commandIds), true));
    }
}
