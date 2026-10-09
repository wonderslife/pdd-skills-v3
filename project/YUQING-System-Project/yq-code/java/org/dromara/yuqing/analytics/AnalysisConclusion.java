package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 结构化分析结论（F-009 验收标准 5）
 *
 * <p>「结构化」不是把一段文字拆成几行 —— 四类结论各自是对象列表，
 * 前端可以按卡片渲染，F-014 报告生成也可以按章节取用，
 * 文字版只是它们的投影（{@link #narrative}）。</p>
 *
 * @author ruoyi
 */
@Data
public class AnalysisConclusion {

    /** 是否基于事件聚类（false 说明 clusterId 缺失，退化为标题分组） */
    private boolean clusterBased;

    /** 核心舆情事件 */
    private List<CoreEvent> coreEvents = new ArrayList<>();

    /** 传播路径 */
    private List<PropagationStage> propagation = new ArrayList<>();

    /** 舆论焦点 */
    private List<FocusPoint> focusPoints = new ArrayList<>();

    /** 潜在风险点 */
    private List<RiskPoint> riskPoints = new ArrayList<>();

    /** 主题文字版结论（每行一条，供报告直接引用） */
    private List<String> narrative = new ArrayList<>();

    /** 最早发布时间 */
    private LocalDateTime firstTime;

    /** 最晚发布时间 */
    private LocalDateTime lastTime;

    /** 跨度小时数（不足 1 小时按 1 计，避免除零） */
    private Long durationHours;

    /** 传播速度（条/小时） */
    private Double speedPerHour;

    /** 峰值时间桶（dim_key） */
    private String peakBucket;

    /** 峰值条数 */
    private Integer peakCount;

    /** 结论生成时间 */
    private LocalDateTime generatedAt;
}
