package org.dromara.yuqing.ledger.domain;

import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 台账列表行（F-016 验收标准 2、5）
 *
 * <p>验收标准 2 要求列表展示：标题、来源渠道、发布时间、发布作者、舆情属性、
 * 风险等级、热度、采集时间、研判状态。PRD §4.3 的列定义在此基础上补了
 * 舆情分级、采集来源与操作列所需的主键/链接，本类一并承载。</p>
 *
 * <p><b>为什么单独定义行对象而不直接返回 YqOpinion：</b>
 * 台账要展示 taskName / channelName / clusterTitle 三个跨表字段，
 * 而 YqOpinion 上这三个是 {@code @TableField(exist=false)} 的派生字段；
 * 直接复用会让「能写回数据库」的错觉扩散到只读接口上。</p>
 *
 * <p><b>本类同时充当 Excel 导出载体（验收标准 5）：</b>
 * 带 {@code @ExcelProperty} 的字段就是「可导出字段白名单」，
 * 前端传入的 columns 只能取白名单内的子集（见 LedgerColumnCatalog），
 * 再由 {@code ExcelBuilder.includeFields(...)} 裁剪列 —— 因此不存在
 * 「用户自选任意字段把不该导的列导出去」的越权面。</p>
 *
 * <p><b>注意 annotation 必须用 Fesod 版</b>（{@code org.apache.fesod.sheet.*}），
 * 不是旧的 EasyExcel 包名 —— v6 已切到 Fesod，混用会导致导出静默无表头。</p>
 *
 * @author ruoyi
 */
@Data
@ExcelIgnoreUnannotated
public class LedgerRow implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 舆情ID（导出列名「编号」） */
    @ExcelProperty(value = "编号")
    private Long opinionId;

    /** 舆情标题 */
    @ExcelProperty(value = "舆情标题")
    private String title;

    /** 来源渠道 */
    @ExcelProperty(value = "来源渠道")
    private String channelName;

    /** 所属任务 */
    @ExcelProperty(value = "所属任务")
    private String taskName;

    /** 发布时间 */
    @ExcelProperty(value = "发布时间")
    private LocalDateTime publishTime;

    /** 发布作者/主体 */
    @ExcelProperty(value = "发布作者")
    private String author;

    /** 舆情属性 */
    @ExcelProperty(value = "舆情属性")
    private String sentiAttr;

    /** 风险等级 */
    @ExcelProperty(value = "风险等级")
    private String riskLevel;

    /** 舆情分级 */
    @ExcelProperty(value = "舆情分级")
    private String opinionLevel;

    /** 综合热度分值 */
    @ExcelProperty(value = "热度")
    private Integer heatScore;

    /** 采集来源（auto / manual_import） */
    @ExcelProperty(value = "采集来源")
    private String collectSource;

    /** 采集时间 */
    @ExcelProperty(value = "采集时间")
    private LocalDateTime collectTime;

    /** 研判状态 */
    @ExcelProperty(value = "研判状态")
    private String analyzeStatus;

    /** 清洗状态 */
    @ExcelProperty(value = "清洗状态")
    private String cleanStatus;

    /** 发布地域 */
    @ExcelProperty(value = "发布地域")
    private String region;

    /** 事件聚合标题 */
    @ExcelProperty(value = "关联事件")
    private String clusterTitle;

    /** 原文链接 */
    @ExcelProperty(value = "原文链接")
    private String opinionUrl;

    /* ---------------- 以下为不导出字段（无 @ExcelProperty） ---------------- */

    /** 是否已预警（0否 1是） */
    private String alertFlag;

    /** 是否已推送（0否 1是） */
    private String pushFlag;

    /** 事件聚合ID */
    private Long clusterId;

    /**
     * 命中片段（仅全文检索场景填充，验收标准 7）。
     *
     * <p>非检索场景为 null，前端据此决定是否展示高亮行。
     * 刻意不导出：片段里的 {@code <em>} 标记在 Excel 里只会变成乱码。</p>
     */
    private List<String> fragments;
}
