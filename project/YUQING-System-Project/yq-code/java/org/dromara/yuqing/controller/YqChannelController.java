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
import org.dromara.yuqing.domain.YqChannel;
import org.dromara.yuqing.service.IYqChannelService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 采集渠道Controller
 *
 * @author ruoyi
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/channel")
public class YqChannelController extends BaseController {

    private final IYqChannelService channelService;

    /**
     * 查询采集渠道列表
     */
    @SaCheckPermission("yuqing:channel:list")
    @GetMapping("/list")
    public R<PageResult<YqChannel>> list(YqChannel bo, PageQuery pageQuery) {
        return R.ok(channelService.queryPageList(bo, pageQuery));
    }

    /**
     * 导出采集渠道列表
     */
    @SaCheckPermission("yuqing:channel:export")
    @Log(title = "采集渠道", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(YqChannel bo, HttpServletResponse response) {
        List<YqChannel> list = channelService.queryList(bo);
        ExcelBuilder.of(list, YqChannel.class).sheetName("采集渠道").toResponse(response);
    }

    /**
     * 查询采集渠道下拉选项（PRD §4.5；必须声明在 /{channelId} 之前，避免被路径变量吞掉）
     */
    @SaCheckPermission("yuqing:channel:list")
    @GetMapping("/optionselect")
    public R<List<YqChannel>> optionselect(YqChannel bo) {
        return R.ok(channelService.queryList(bo));
    }

    /**
     * 获取采集渠道详细信息
     */
    @SaCheckPermission("yuqing:channel:query")
    @GetMapping("/{channelId}")
    public R<YqChannel> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long channelId) {
        return R.ok(channelService.queryById(channelId));
    }

    /**
     * 新增采集渠道
     */
    @SaCheckPermission("yuqing:channel:add")
    @Log(title = "采集渠道", businessType = BusinessType.INSERT)
    @PostMapping()
    public R<Void> add(@Validated @RequestBody YqChannel bo) {
        return toAjax(channelService.insertByBo(bo));
    }

    /**
     * 修改采集渠道
     */
    @SaCheckPermission("yuqing:channel:edit")
    @Log(title = "采集渠道", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated @RequestBody YqChannel bo) {
        return toAjax(channelService.updateByBo(bo));
    }

    /**
     * 删除采集渠道
     */
    @SaCheckPermission("yuqing:channel:remove")
    @Log(title = "采集渠道", businessType = BusinessType.DELETE)
    @DeleteMapping("/{channelIds}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] channelIds) {
        return toAjax(channelService.deleteWithValidByIds(List.of(channelIds), true));
    }
}
