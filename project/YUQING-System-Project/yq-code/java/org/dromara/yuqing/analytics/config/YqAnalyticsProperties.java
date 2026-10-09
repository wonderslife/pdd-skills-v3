package org.dromara.yuqing.analytics.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 多维分析引擎配置（前缀 {@code yuqing.analytics}）
 *
 * <p>样例见 {@code config/yq_analytics.yml}。</p>
 *
 * @author ruoyi
 */
@Data
@Component
@ConfigurationProperties(prefix = "yuqing.analytics")
public class YqAnalyticsProperties {

    /** 引擎总开关；关闭时聚合任务直接返回 */
    private boolean enabled = true;

    /** 单次聚合允许的最大统计跨度（天） */
    private int maxScopeDays = 366;

    /** 单次聚合允许读入内存的明细条数（保护性上限，命中即截断并记提示） */
    private int maxSourceRecords = 200000;

    /** 定时任务的回看天数（含当天）；补算任意历史区间走手动重算接口 */
    private int jobLookbackDays = 2;

    /** 分布类维度每类保留的取值个数 */
    private int dimTopN = 50;

    /** 热点排行 TopN */
    private int hotTopN = 20;

    /** 小时级趋势只回算最近多少天（小时桶行数增长快，必须封顶） */
    private int hourTrendDays = 30;

    /** 结论里保留的核心事件条数 */
    private int conclusionTopEvents = 5;

    /** 触发「负面占比偏高」风险的阈值（%） */
    private double riskNegativeRate = 30D;

    /** 触发器「高风险占比偏高」风险的阈值（%） */
    private double riskSevereRate = 10D;

    /** 趋势曲线是否按发布时间归属（false 则按采集时间） */
    private boolean trendByPublishTime = true;

    /** 下钻明细单页最大条数 */
    private int maxDrilldownPageSize = 200;

    /** 导出 Excel 的最大行数 */
    private int exportMaxRows = 20000;
}
