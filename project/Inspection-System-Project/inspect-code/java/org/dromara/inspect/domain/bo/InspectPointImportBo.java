package org.dromara.inspect.domain.bo;

import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelProperty;

import java.io.Serial;
import java.io.Serializable;

/**
 * 点位 Excel 导入行（PRD 模块 4：模板列定义）
 *
 * @author ruoyi
 */
@Data
public class InspectPointImportBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位名称（必填，同机房内唯一） */
    @ExcelProperty(value = "点位名称")
    private String pointName;

    /** 机房编码（必填，需已存在） */
    @ExcelProperty(value = "机房编码")
    private String roomCode;

    /** 区域名称（可空，需属于该机房） */
    @ExcelProperty(value = "区域名称")
    private String areaName;

    /** 点位编码（可空，留空时由系统按 PT-{机房编码}-{序号} 生成） */
    @ExcelProperty(value = "点位编码")
    private String pointCode;

    /** 位置描述 */
    @ExcelProperty(value = "位置描述")
    private String location;

    /** 巡检周期：daily/weekly/monthly/custom */
    @ExcelProperty(value = "巡检周期")
    private String cycleType;

    /** 自定义间隔天数（cycleType=custom 时必填，1-365） */
    @ExcelProperty(value = "间隔天数")
    private Integer cycleValue;

    /** 巡检项名称，多个用逗号分隔 */
    @ExcelProperty(value = "巡检项(逗号分隔)")
    private String itemNames;

}
