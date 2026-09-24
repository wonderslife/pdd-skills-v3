package org.dromara.yuqing.wecom.domain;

import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * 企微 H5 首页聚合视图（F-012 验收标准 2）
 *
 * <p>把「待处置预警数 / 当日采集概况 / 最近研判结论 / 待办报告入口」一次返回，
 * 避免 H5 首屏并发调 4 个列表接口 —— 移动网络下并发请求更容易出现「有的卡片有数、有的空白」。</p>
 *
 * @author ruoyi
 */
@Data
public class WecomHomeVo {

    /** 待处置预警数 */
    private long pendingAlertCount;

    /** 当日采集概况（采集量 / 去重量 / 降噪量 等） */
    private Map<String, Object> todayCollect;

    /** 待办报告列表 */
    private List<Map<String, Object>> todoReports;

    /** 最近研判结论 */
    private List<Map<String, Object>> recentAnalysis;

    /** 数据生成时间戳（毫秒） */
    private long generatedAt;
}
