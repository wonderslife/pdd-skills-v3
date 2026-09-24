package org.dromara.inspect.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 统计趋势（按日/周/月）
 *
 * @author ruoyi
 */
@Data
public class StatsTrendVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 时间标签：日 yyyy-MM-dd / 周 yyyy-ww / 月 yyyy-MM */
    private String dateLabel;

    /** 巡检次数 */
    private Integer inspectCount;

    /** 异常次数 */
    private Integer abnormalCount;

    /** 逾期数 */
    private Integer overdueCount;

    /** 异常率（%） */
    private BigDecimal abnormalRate;

}
