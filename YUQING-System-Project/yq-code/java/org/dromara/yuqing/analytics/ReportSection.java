package org.dromara.yuqing.analytics;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 报告章节交接包（F-009 验收标准 7）
 *
 * <p>「一键带入报告生成流程」的实现方式不是让 F-009 去调 F-014 的接口，
 * 而是由 F-009 产出一个自描述的数据包：<b>报告模块只依赖本类，不反向依赖分析模块</b>。
 * 这样 F-014 可以晚于 F-009 落地，也可以在报告模板里挑着用（只要「总体态势」一节也行）。</p>
 *
 * @author ruoyi
 */
@Data
public class ReportSection {

    /** 章节编码（F-014 按此匹配模板占位） */
    private String sectionCode = "data_analysis";

    /** 章节标题 */
    private String title = "数据分析";

    /** 正文（Markdown 片段，无代码块、无内联样式，保证能直接进 Word 与微信） */
    private String markdown;

    /** 结构化指标（键值对，供模板做可配置的字段级引用） */
    private Map<String, Object> metrics = new LinkedHashMap<>();

    /** 结构化结论（前端渲染卡片 / 模板取数） */
    private AnalysisConclusion conclusion;

    /** 生效范围描述 */
    private String scopeText;

    /** 数据截止时间 */
    private LocalDateTime dataUntil;

    /** 来源批次号 */
    private String sourceBatch;

    /** 生成时间 */
    private LocalDateTime generatedAt;

    /** 明细行（供报告里的数据表章节） */
    private List<DimItem> platform;

    /** 趋势行 */
    private List<DimItem> trend;

    /** 热点行 */
    private List<HotItem> hot;
}
