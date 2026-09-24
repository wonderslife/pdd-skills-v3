package com.ruoyi.presale.domain;

import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import org.apache.commons.lang3.builder.ToStringBuilder;
import org.apache.commons.lang3.builder.ToStringStyle;
import com.ruoyi.common.annotation.Excel;
import com.ruoyi.common.core.domain.BaseEntity;
import java.math.BigDecimal;

/**
 * 预售商品管理对象 presale-goods
 *
 * @author ruoyi
 */
public class PresaleGoods extends BaseEntity
{
    private static final long serialVersionUID = 1L;

    /** 主键 */
    private Long id;

    @Excel(name = "商品标题")
    /** 商品标题 */
    private String title;

    @Excel(name = "售价")
    /** 售价 */
    private BigDecimal price;

    @Excel(name = "定金金额")
    /** 定金金额 */
    private BigDecimal depositAmount;

    @Excel(name = "尾款金额")
    /** 尾款金额 */
    private BigDecimal tailAmount;

    @Excel(name = "预售截止时间")
    /** 预售截止时间 */
    private Date presaleEndTime;

    @Excel(name = "限购数量")
    /** 限购数量 */
    private Integer limitQuantity;

    @Excel(name = "库存")
    /** 库存 */
    private Integer stock;

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

    public void setTitle(String title)
    {
        this.title = title;
    }

    public String getTitle()
    {
        return title;
    }

    public void setPrice(BigDecimal price)
    {
        this.price = price;
    }

    public BigDecimal getPrice()
    {
        return price;
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

    public void setPresaleEndTime(Date presaleEndTime)
    {
        this.presaleEndTime = presaleEndTime;
    }

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    public Date getPresaleEndTime()
    {
        return presaleEndTime;
    }

    public void setLimitQuantity(Integer limitQuantity)
    {
        this.limitQuantity = limitQuantity;
    }

    public Integer getLimitQuantity()
    {
        return limitQuantity;
    }

    public void setStock(Integer stock)
    {
        this.stock = stock;
    }

    public Integer getStock()
    {
        return stock;
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
            .append("title", getTitle())
            .append("price", getPrice())
            .append("depositAmount", getDepositAmount())
            .append("tailAmount", getTailAmount())
            .append("presaleEndTime", getPresaleEndTime())
            .append("limitQuantity", getLimitQuantity())
            .append("stock", getStock())
            .append("status", getStatus())
            .append("delFlag", getDelFlag())
            .append("remark", getRemark())
            .toString();
    }
}
