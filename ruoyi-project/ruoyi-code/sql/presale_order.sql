-- 预售订单管理建表语句（RuoYi-Vue-Plus v6，BaseEntity 审计字段）
DROP TABLE IF EXISTS presale_order;
CREATE TABLE presale_order (
  id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  order_no        VARCHAR(32) NOT NULL COMMENT '订单号',
  goods_id        BIGINT COMMENT '商品ID',
  goods_title        VARCHAR(100) COMMENT '商品标题',
  buyer_id        BIGINT COMMENT '买家ID',
  deposit_amount        DECIMAL(10,2) COMMENT '定金金额',
  tail_amount        DECIMAL(10,2) COMMENT '尾款金额',
  total_amount        DECIMAL(10,2) COMMENT '总金额',
  shipping_no        VARCHAR(64) COMMENT '物流单号',
  pay_time        DATETIME COMMENT '支付时间',
  status        VARCHAR(20)  DEFAULT '0' COMMENT '状态（订单类: pending_tail/paid/shipped/closed/refunded；通用: 0正常 1停用）',
  create_dept   BIGINT       DEFAULT NULL COMMENT '创建部门',
  create_by     BIGINT       DEFAULT NULL COMMENT '创建人',
  create_time   DATETIME     DEFAULT NULL COMMENT '创建时间',
  update_by     BIGINT       DEFAULT NULL COMMENT '更新人',
  update_time   DATETIME     DEFAULT NULL COMMENT '更新时间',
  remark        VARCHAR(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (id)
) ENGINE=InnoDB AUTO_INCREMENT=1 COMMENT='预售订单管理';
