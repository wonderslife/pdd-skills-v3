package org.dromara.yuqing.alert;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 预警扫描结果（F-010 验收标准 3 / 10）
 *
 * @author ruoyi
 */
@Data
public class AlertScanStats {

    /** 扫描窗口（分钟） */
    private int windowMinutes;

    /** 是否仅预览 */
    private boolean dryRun;

    /** 启用的规则数 */
    private int ruleCount;

    /** 窗口内载入的候选舆情数 */
    private int scanned;

    /** 因「已预警过 / 冷却期内」被抑制的条数 */
    private int suppressed;

    /** 判定出的预警条数 */
    private int decisionCount;

    /** 实际落库的预警条数 */
    private int created;

    /** 新建预警 ID */
    private List<Long> alertIds = new ArrayList<>();

    /** 说明信息 */
    private String message;

    /** 逐条判定摘要（预览时给人看） */
    private List<String> details = new ArrayList<>();
}
