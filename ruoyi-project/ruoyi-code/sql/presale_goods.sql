-- 预售商品管理建表语句（RuoYi-Vue-Plus v6，BaseEntity 审计字段）
DROP TABLE IF EXISTS presale_goods;
CREATE TABLE presale_goods (
  id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  title        VARCHAR(100) NOT NULL COMMENT '商品标题',
  price        DECIMAL(10,2) COMMENT '售价',
  deposit_amount        DECIMAL(10,2) COMMENT '定金金额',
  tail_amount        DECIMAL(10,2) COMMENT '尾款金额',
  presale_end_time        DATETIME COMMENT '预售截止时间',
  limit_quantity        INT COMMENT '限购数量',
  stock        INT COMMENT '库存',
  status        VARCHAR(20)  DEFAULT '0' COMMENT '状态（订单类: pending_tail/paid/shipped/closed/refunded；通用: 0正常 1停用）',
  create_dept   BIGINT       DEFAULT NULL COMMENT '创建部门',
  create_by     BIGINT       DEFAULT NULL COMMENT '创建人',
  create_time   DATETIME     DEFAULT NULL COMMENT '创建时间',
  update_by     BIGINT       DEFAULT NULL COMMENT '更新人',
  update_time   DATETIME     DEFAULT NULL COMMENT '更新时间',
  remark        VARCHAR(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (id)
) ENGINE=InnoDB AUTO_INCREMENT=1 COMMENT='预售商品管理';
