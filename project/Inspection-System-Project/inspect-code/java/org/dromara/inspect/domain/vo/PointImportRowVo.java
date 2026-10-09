package org.dromara.inspect.domain.vo;

import lombok.Data;

import java.io.Serial;
import java.io.Serializable;

/**
 * 点位 Excel 导入逐行校验结果（PRD 模块 4 验收标准 2/4）
 *
 * @author ruoyi
 */
@Data
public class PointImportRowVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** Excel 行号（从 2 开始，1 为表头） */
    private Integer rowNum;

    /** 是否校验通过 */
    private Boolean success;

    /** 失败原因；成功时为空 */
    private String message;

    /** 点位名称 */
    private String pointName;

    /** 点位编码 */
    private String pointCode;

    /** 机房名称 */
    private String roomName;

    /** 校验通过时携带的可用数据（供 importConfirm 直接回传） */
    private Long roomId;

    /** 区域ID */
    private Long areaId;

    /** 巡检周期类型 */
    private String cycleType;

    /** 自定义间隔天数 */
    private Integer cycleValue;

    /** 位置描述 */
    private String location;

    /** 巡检项（逗号分隔的名称串） */
    private String itemNames;

}
