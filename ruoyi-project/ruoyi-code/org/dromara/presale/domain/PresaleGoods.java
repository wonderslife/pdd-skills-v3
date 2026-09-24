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
 * 预售商品管理对象 presale-goods
 *
 * @author ruoyi
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("presale_goods")
@ExcelIgnoreUnannotated
public class PresaleGoods extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId
    private Long id;

    @ExcelProperty(value = "商品标题")
    /** 商品标题 */
    private String title;

    @ExcelProperty(value = "售价")
    /** 售价 */
    private BigDecimal price;

    @ExcelProperty(value = "定金金额")
    /** 定金金额 */
    private BigDecimal depositAmount;

    @ExcelProperty(value = "尾款金额")
    /** 尾款金额 */
    private BigDecimal tailAmount;

    @ExcelProperty(value = "预售截止时间")
    /** 预售截止时间 */
    private LocalDateTime presaleEndTime;

    @ExcelProperty(value = "限购数量")
    /** 限购数量 */
    private Integer limitQuantity;

    @ExcelProperty(value = "库存")
    /** 库存 */
    private Integer stock;

    /** 状态（0正常 1停用 / 业务状态机） */
    private String status;
}
