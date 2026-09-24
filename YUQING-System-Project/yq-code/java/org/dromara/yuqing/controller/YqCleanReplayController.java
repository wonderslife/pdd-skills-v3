package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.yuqing.collect.clean.CleanBatchScope;
import org.dromara.yuqing.collect.clean.CleanBatchStats;
import org.dromara.yuqing.collect.clean.NoiseEngine;
import org.dromara.yuqing.collect.clean.NoiseRuleCompiler;
import org.dromara.yuqing.collect.model.RawOpinion;
import org.dromara.yuqing.service.IYqCleanReplayService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 净化重跑Controller（F-006 验收标准 2 / 9）。
 *
 * <p>写操作一律 {@code @SaCheckPermission}；身份只从 Sa-Token 取，不信请求体里的任何用户标识。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/clean")
public class YqCleanReplayController {

    private final IYqCleanReplayService replayService;

    private final NoiseRuleCompiler ruleCompiler;

    private final NoiseEngine noiseEngine;

    /**
     * 预览影响条数（不落库）
     */
    @SaCheckPermission("yuqing:clean:replay")
    @PostMapping("/preview")
    public R<CleanBatchStats> preview(@RequestBody CleanBatchScope scope) {
        try {
            return R.ok(replayService.preview(scope));
        } catch (IllegalArgumentException e) {
            return R.fail(e.getMessage());
        }
    }

    /**
     * 执行重跑（落库并留批次记录）
     */
    @SaCheckPermission("yuqing:clean:replay")
    @Log(title = "净化重跑", businessType = BusinessType.UPDATE)
    @PostMapping("/execute")
    public R<CleanBatchStats> execute(@RequestBody CleanBatchScope scope) {
        try {
            return R.ok(replayService.execute(scope));
        } catch (IllegalArgumentException e) {
            return R.fail(e.getMessage());
        }
    }

    /**
     * 强制刷新降噪规则缓存（后台改完规则点一下，不等缓存过期）
     */
    @SaCheckPermission("yuqing:clean:list")
    @PostMapping("/rules/refresh")
    public R<Void> refreshRules() {
        ruleCompiler.refresh();
        return R.ok();
    }

    /**
     * 规则试跑：用一段样本文本验证新写的规则会不会误杀。
     *
     * @param title   样本标题
     * @param content 样本正文
     * @return true 表示按当前规则会被剔除
     */
    @SaCheckPermission("yuqing:clean:list")
    @PostMapping("/rules/try")
    public R<Boolean> tryRules(@RequestParam(required = false) String title,
                               @RequestParam(required = false) String content) {
        RawOpinion probe = new RawOpinion();
        probe.setTitle(title == null ? "" : title);
        probe.setContent(content == null ? "" : content);
        return R.ok(noiseEngine.evaluate(probe).isRejected());
    }
}
