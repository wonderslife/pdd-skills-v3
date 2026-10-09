package org.dromara.yuqing.alert;

import lombok.Data;

/**
 * 预警扫描请求（手动扫描 / 预览共用）
 *
 * @author ruoyi
 */
@Data
public class AlertScanRequest {

    /** 任务过滤，为空表示全部任务 */
    private Long taskId;

    /** 覆盖扫描窗口长度（分钟），为空取配置值 */
    private Integer windowMinutes;

    /** 仅预览不落库 */
    private boolean dryRun;

    /** 命中的预警是否需要立即推送（默认 true） */
    private boolean pushAfterCreate = true;
}
