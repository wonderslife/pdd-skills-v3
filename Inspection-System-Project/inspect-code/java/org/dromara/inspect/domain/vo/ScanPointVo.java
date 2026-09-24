package org.dromara.inspect.domain.vo;

import lombok.Data;
import org.dromara.inspect.domain.InspectPointItem;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 扫码解析结果 / 巡检执行页所需点位视图
 *
 * @author ruoyi
 */
@Data
public class ScanPointVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 点位ID */
    private Long pointId;

    /** 点位名称 */
    private String pointName;

    /** 点位编码 */
    private String pointCode;

    /** 机房ID */
    private Long roomId;

    /** 机房名称 */
    private String roomName;

    /** 区域ID */
    private Long areaId;

    /** 区域名称 */
    private String areaName;

    /** 位置描述 */
    private String location;

    /** 巡检周期类型 */
    private String cycleType;

    /** 自定义间隔天数 */
    private Integer cycleValue;

    /** GPS校验（0关 1开） */
    private String gpsEnabled;

    /** 点位状态 active/inactive/maintenance */
    private String status;

    /** 上次巡检时间 */
    private LocalDateTime lastInspectTime;

    /** 巡检项清单（H5 巡检执行页据此动态渲染） */
    private List<InspectPointItem> itemList;

    /** 本周期是否已巡检（true 时 H5 禁止重复提交） */
    private Boolean inspectedInCycle;

    /** 点位状态提示语（维护中/已停用等） */
    private String statusTip;

}
