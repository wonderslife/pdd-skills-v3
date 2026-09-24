package org.dromara.yuqing.service;

import org.dromara.yuqing.alert.AlertScanRequest;
import org.dromara.yuqing.alert.AlertScanStats;
import org.dromara.yuqing.domain.YqAlert;

import java.time.LocalDate;
import java.util.Map;

/**
 * 预警调度服务（F-010）
 *
 * @author ruoyi
 */
public interface IYqAlertDispatchService {

    /** 执行一次预警扫描（落库） */
    AlertScanStats scan(AlertScanRequest request);

    /** 仅预览，不落库 */
    AlertScanStats preview(AlertScanRequest request);

    /**
     * 处置一条预警（F-010 验收标准 5 / 6）
     *
     * @param bo         仅取 alertId / status / processRemark
     * @param operatorId 处置人（由 Controller 从 Sa-Token 取，不信请求体）
     * @return 是否更新成功
     */
    boolean process(YqAlert bo, Long operatorId);

    /** 未处置计数（含需醒目提示的条数，F-010 验收标准 8） */
    Map<String, Object> pendingCount();

    /** 按时间与级别统计（F-010 验收标准 10） */
    Map<String, Object> statistics(LocalDate from, LocalDate to);
}
