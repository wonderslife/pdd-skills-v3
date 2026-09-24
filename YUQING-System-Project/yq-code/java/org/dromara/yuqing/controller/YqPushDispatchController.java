package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;

/**
 * 推送调度Controller（F-011）
 *
 * <p>本控制器只暴露「运维动作」——重发失败记录、刷出顺延批量、查统计。
 * 推送规则 / 模板 / 记录列表仍走代码生成器产出的标准 CRUD 端点。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/push")
public class YqPushDispatchController {

    private final IYqPushDispatchService pushDispatchService;

    /** 重发一条失败记录 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送重发", businessType = BusinessType.UPDATE)
    @PostMapping("/retry/{recordId}")
    public R<PushStats> retry(@PathVariable Long recordId) {
        try {
            return R.ok(pushDispatchService.retry(recordId));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 刷出免打扰顺延的定时批量 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "推送刷出", businessType = BusinessType.OTHER)
    @PostMapping("/flush")
    public R<Integer> flush() {
        return R.ok(pushDispatchService.flushScheduled());
    }

    /** 推送量与成功率统计 */
    @SaCheckPermission("yuqing:push:list")
    @GetMapping("/statistics")
    public R<Map<String, Object>> statistics(@RequestParam(required = false) String beginDate,
                                             @RequestParam(required = false) String endDate) {
        try {
            return R.ok(pushDispatchService.statistics(parseDate(beginDate), parseDate(endDate)));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    private static LocalDate parseDate(String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(v.trim());
        } catch (Exception e) {
            throw new ServiceException("日期格式应为 yyyy-MM-dd: " + v);
        }
    }
}
