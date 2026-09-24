package org.dromara.yuqing.analytics;

import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;

/**
 * 看板导出的一行（F-009 验收标准 10）
 *
 * <p><b>为什么导出用「长表」而不是「七个 sheet」：</b>
 * 当前框架的导出构造器一次只写一个 sheet，要拼多 sheet 得走模板导出；
 * 长表（区块 / 维度 / 取值 / 数值 / 占比）用一份数据就能承载七类指标，
 * 下游做透视表反而比多 sheet 更顺手。真要拆 sheet 时，按「区块」列过滤即可。</p>
 *
 * @author ruoyi
 */
@Data
@ExcelIgnoreUnannotated
public class StatsExportRow {

    /** 指标区块：总量 / 平台分布 / 地域分布 / 话题分布 / 属性分布 / 趋势 / 热点排行 */
    @ExcelProperty(value = "指标区块")
    private String block;

    /** 维度（长表内再分一层，如「互动量」下有阅读/评论/转发/点赞） */
    @ExcelProperty(value = "维度")
    private String dimension;

    /** 取值 */
    @ExcelProperty(value = "取值")
    private String itemKey;

    /** 数值 */
    @ExcelProperty(value = "数值")
    private Long value;

    /** 占比（%），无占比语义时为空 */
    @ExcelProperty(value = "占比(%)")
    private Double share;

    /** 附加说明 */
    @ExcelProperty(value = "说明")
    private String remark;
}
