/**
 * PresaleOrder 查询
 */
export interface PresaleOrderQuery extends PageQuery {
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 商品标题 */
  goodsTitle?: string;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 总金额 */
  totalAmount?: number;
  /** 物流单号 */
  shippingNo?: string;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleOrder 表单
 */
export interface PresaleOrderForm {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 商品标题 */
  goodsTitle?: string;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 总金额 */
  totalAmount?: number;
  /** 物流单号 */
  shippingNo?: string;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleOrder 视图
 */
export interface PresaleOrderVO {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 商品标题 */
  goodsTitle?: string;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 总金额 */
  totalAmount?: number;
  /** 物流单号 */
  shippingNo?: string;
  /** 支付时间 */
  payTime?: string;
}
