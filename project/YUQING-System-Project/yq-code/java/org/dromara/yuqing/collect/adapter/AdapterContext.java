package org.dromara.yuqing.collect.adapter;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 适配器运行上下文。
 *
 * @author ruoyi
 */
@Data
@AllArgsConstructor
public class AdapterContext {

    /** 采集批次号 */
    private String batchNo;

    /** 单批次最大产出条数 */
    private int maxRecords;

    /** 单批次最大翻页数 */
    private int maxPages;

    /** 增量水位线（早于该时间的内容停止翻页） */
    private java.time.LocalDateTime watermark;
}
