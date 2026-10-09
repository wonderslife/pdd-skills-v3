package org.dromara.inspect.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

/**
 * 点位维度统计排名
 *
 * @author ruoyi
 */
@Data
public class StatsPointRankVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位ID */
    private Long pointId;

    /** 点位名称 */
    private String pointName;

    /** 机房ID */
    private Long roomId;

    /** 机房名称 */
    private String roomName;

    /** 巡检次数 */
    private Integer inspectCount;

    /** 异常次数 */
    private Integer abnormalCount;

    /** 异常率（%） */
    private BigDecimal abnormalRate;

}
