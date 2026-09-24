package com.ruoyi.presale.domain;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.apache.commons.lang3.builder.ToStringStyle;
import com.ruoyi.common.annotation.Excel;
import com.ruoyi.common.core.domain.BaseEntity;
import java.math.BigDecimal;

/**
 * 预售订单管理对象 presale-order
 *
 * @author ruoyi
 */
public class PresaleOrder extends BaseEntity
{
    private static final long serialVersionUID = 1L;

    /** 主键 */
    private Long id;

    @Excel(name = "订单号")
    /** 订单号 */
    private String orderNo;

    /** 商品ID */
    private Long goodsId;

    @Excel(name = "商品标题")
    /** 商品标题 */
    private String goodsTitle;

    /** 买家ID */
    private Long buyerId;

    @Excel(name = "定金金额")
    /** 定金金额 */
    private BigDecimal depositAmount;

    @Excel(name = "尾款金额")
    /** 尾款金额 */
    private BigDecimal tailAmount;

    @Excel(name = "总金额")
    /** 总金额 */
    private BigDecimal totalAmount;

    /** 物流单号 */
    private String shippingNo;

    @Excel(name = "支付时间")
    /** 支付时间 */
    private Date payTime;

    /** 状态（0正常 1停用） */
    private String status;

    /** 删除标志（0存在 2删除） */
    private String delFlag;

    /** 备注 */
    private String remark;

    public void setId(Long id)
    {
        this.id = id;
    }

    public Long getId()
    {
        return id;
    }

    public void setOrderNo(String orderNo)
    {
        this.orderNo = orderNo;
    }

    public String getOrderNo()
    {
        return orderNo;
    }

    public void setGoodsId(Long goodsId)
    {
        this.goodsId = goodsId;
    }

    public Long getGoodsId()
    {
        return goodsId;
    }

    public void setGoodsTitle(String goodsTitle)
    {
        this.goodsTitle = goodsTitle;
    }

    public String getGoodsTitle()
    {
        return goodsTitle;
    }

    public void setBuyerId(Long buyerId)
    {
        this.buyerId = buyerId;
    }

    public Long getBuyerId()
    {
        return buyerId;
    }

    public void setDepositAmount(BigDecimal depositAmount)
    {
        this.depositAmount = depositAmount;
    }

    public BigDecimal getDepositAmount()
    {
        return depositAmount;
    }

    public void setTailAmount(BigDecimal tailAmount)
    {
        this.tailAmount = tailAmount;
    }

    public BigDecimal getTailAmount()
    {
        return tailAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount)
    {
        this.totalAmount = totalAmount;
    }

    public BigDecimal getTotalAmount()
    {
        return totalAmount;
    }

    public void setShippingNo(String shippingNo)
    {
        this.shippingNo = shippingNo;
    }

    public String getShippingNo()
    {
        return shippingNo;
    }

    public void setPayTime(Date payTime)
    {
        this.payTime = payTime;
    }

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public Date getPayTime()
    {
        return payTime;
    }

    public void setStatus(String status)
    {
        this.status = status;
    }

    public String getStatus()
    {
        return status;
    }

    public void setDelFlag(String delFlag)
    {
        this.delFlag = delFlag;
    }

    public String getDelFlag()
    {
        return delFlag;
    }

    public void setRemark(String remark)
    {
        this.remark = remark;
    }

    public String getRemark()
    {
        return remark;
    }

    @Override
    public String toString() {
        return new ToStringBuilder(this,ToStringStyle.MULTI_LINE_STYLE)
            .append("id", getId())
            .append("orderNo", getOrderNo())
            .append("goodsId", getGoodsId())
            .append("goodsTitle", getGoodsTitle())
            .append("buyerId", getBuyerId())
            .append("depositAmount", getDepositAmount())
            .append("tailAmount", getTailAmount())
            .append("totalAmount", getTotalAmount())
            .append("shippingNo", getShippingNo())
            .append("payTime", getPayTime())
            .append("status", getStatus())
            .append("delFlag", getDelFlag())
            .append("remark", getRemark())
            .toString();
    }
}
