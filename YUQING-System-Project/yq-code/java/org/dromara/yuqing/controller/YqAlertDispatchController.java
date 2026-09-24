package org.dromara.yuqing.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.domain.YqAlert;
import org.dromara.yuqing.push.PushStats;
import org.dromara.yuqing.service.IYqAlertDispatchService;
import org.dromara.yuqing.service.IYqPushDispatchService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 预警调度Controller（F-010）
 *
 * <p><b>安全：</b>所有端点带 {@code @SaCheckPermission}；处置人身份只从 Sa-Token 取
 * （{@link LoginHelper#getUserId()}），请求体里即使带了 userId 也一律忽略，杜绝越权冒名处置。</p>
 *
 * @author ruoyi
 */
@Slf4j
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/yuqing/alert")
public class YqAlertDispatchController {

    private final IYqAlertDispatchService alertDispatchService;
    private final IYqPushDispatchService pushDispatchService;

    /** 手动触发一次预警扫描（落库） */
    @SaCheckPermission("yuqing:alert:list")
    @Log(title = "预警扫描", businessType = BusinessType.OTHER)
    @PostMapping("/scan")
    public R<AlertScanStats> scan(@RequestBody(required = false) AlertScanRequest request) {
        try {
            return R.ok(alertDispatchService.scan(request));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 预览：只看会命中哪些，不落库 */
    @SaCheckPermission("yuqing:alert:list")
    @PostMapping("/preview")
    public R<AlertScanStats> preview(@RequestBody(required = false) AlertScanRequest request) {
        try {
            return R.ok(alertDispatchService.preview(request));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 处置预警（已处置 / 已忽略必须填说明，服务端强制校验） */
    @SaCheckPermission("yuqing:alert:process")
    @Log(title = "预警处置", businessType = BusinessType.UPDATE)
    @PostMapping("/process")
    public R<Void> process(@RequestBody YqAlert bo) {
        try {
            return alertDispatchService.process(bo, LoginHelper.getUserId()) ? R.ok() : R.fail("处置失败");
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 未处置计数（台账与列表红标用） */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/pendingCount")
    public R<Map<String, Object>> pendingCount() {
        return R.ok(alertDispatchService.pendingCount());
    }

    /** 按时间与级别统计 */
    @SaCheckPermission("yuqing:alert:list")
    @GetMapping("/statistics")
    public R<Map<String, Object>> statistics(@RequestParam(required = false) String beginDate,
                                             @RequestParam(required = false) String endDate) {
        try {
            return R.ok(alertDispatchService.statistics(parseDate(beginDate), parseDate(endDate)));
        } catch (ServiceException e) {
            return R.fail(e.getMessage());
        }
    }

    /** 手动把指定预警推送到企业微信 */
    @SaCheckPermission("yuqing:push:edit")
    @Log(title = "预警推送", businessType = BusinessType.OTHER)
    @PostMapping("/push")
    public R<PushStats> push(@RequestBody List<Long> alertIds) {
        try {
            return R.ok(pushDispatchService.pushAlerts(alertIds));
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
