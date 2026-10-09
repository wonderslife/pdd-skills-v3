package org.dromara.yuqing.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.io.Serial;

/**
 * 采集渠道对象 yq_channel
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("yq_channel")
@ExcelIgnoreUnannotated
public class YqChannel extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 渠道ID,主键 */
    @TableId(value = "channel_id")
    private Long channelId;

    /** 渠道名称 */
    @ExcelProperty(value = "渠道名称")
    private String channelName;

    /** 渠道类别 */
    @ExcelProperty(value = "渠道类别")
    private String channelCategory;

    /** 域名或平台标识 */
    @ExcelProperty(value = "域名或平台标识")
    private String channelDomain;

    /** 站点适配器标识（YAML 配置键） */
    @ExcelProperty(value = "站点适配器标识（YAML 配置键）")
    private String adapterClass;

    /** 绑定采集器ID */
    private Long collectorId;

    /** 渠道级频率覆盖（秒） */
    private Integer intervalOverride;

    /** 请求间隔（毫秒） */
    private Integer requestInterval;

    /** 并发上限 */
    private Integer concurrencyLimit;

    /** 代理池分组ID */
    private Long proxyGroupId;

    /** UA 池ID */
    private Long uaPoolId;

    /** 失败率告警阈值（%） */
    private Integer failRateThreshold;

    /** 最近采集时间 */
    @ExcelProperty(value = "最近采集时间")
    private LocalDateTime lastCollectTime;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    @TableLogic
    private String delFlag;

    /** 备注 */
    private String remark;

    /**
     * 扩展请求参数（beginTime / endTime 等），不映射数据库字段
     */
    @TableField(exist = false)
    private Map<String, Object> params = new HashMap<>();
}
