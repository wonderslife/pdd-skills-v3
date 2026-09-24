/**
 * PresaleGoods 查询
 */
export interface PresaleGoodsQuery extends PageQuery {
  /** 商品标题 */
  title?: string;
  /** 售价 */
  price?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 预售截止时间 */
  presaleEndTime?: string;
  /** 限购数量 */
  limitQuantity?: number;
  /** 库存 */
  stock?: number;
}

/**
 * PresaleGoods 表单
 */
export interface PresaleGoodsForm {
  /** 主键 */
  id?: number;
  /** 商品标题 */
  title?: string;
  /** 售价 */
  price?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 预售截止时间 */
  presaleEndTime?: string;
  /** 限购数量 */
  limitQuantity?: number;
  /** 库存 */
  stock?: number;
}

/**
 * PresaleGoods 视图
 */
export interface PresaleGoodsVO {
  /** 主键 */
  id?: number;
  /** 商品标题 */
  title?: string;
  /** 售价 */
  price?: number;
  /** 定金金额 */
  depositAmount?: number;
  /** 尾款金额 */
  tailAmount?: number;
  /** 预售截止时间 */
  presaleEndTime?: string;
  /** 限购数量 */
  limitQuantity?: number;
  /** 库存 */
  stock?: number;
}
