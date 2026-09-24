/**
 * PresaleTailPay 查询
 */
export interface PresaleTailPayQuery extends PageQuery {
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleTailPay 表单
 */
export interface PresaleTailPayForm {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleTailPay 视图
 */
export interface PresaleTailPayVO {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 支付时间 */
  payTime?: string;
}
