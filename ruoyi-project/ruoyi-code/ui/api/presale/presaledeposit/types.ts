/**
 * PresaleDeposit 查询
 */
export interface PresaleDepositQuery extends PageQuery {
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleDeposit 表单
 */
export interface PresaleDepositForm {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 支付时间 */
  payTime?: string;
}

/**
 * PresaleDeposit 视图
 */
export interface PresaleDepositVO {
  /** 主键 */
  id?: number;
  /** 订单号 */
  orderNo?: string;
  /** 商品ID */
  goodsId?: number;
  /** 买家ID */
  buyerId?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 支付时间 */
  payTime?: string;
}
