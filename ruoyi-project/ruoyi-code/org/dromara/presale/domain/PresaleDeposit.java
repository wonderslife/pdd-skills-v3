package org.dromara.presale.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.io.Serial;

/**
 * 定金支付对象 presale-deposit
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("presale_deposit")
@ExcelIgnoreUnannotated
public class PresaleDeposit extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId
    private Long id;

    @ExcelProperty(value = "订单号")
    /** 订单号 */
    private String orderNo;

    /** 商品ID */
    private Long goodsId;

    /** 买家ID */
    private Long buyerId;

    @ExcelProperty(value = "定金金额")
    /** 定金金额 */
    private BigDecimal depositAmount;

    @ExcelProperty(value = "支付时间")
    /** 支付时间 */
    private LocalDateTime payTime;

    /** 状态（0正常 1停用 / 业务状态机） */
    private String status;
}
