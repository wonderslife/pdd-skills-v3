# MySQL 使用示例

> 由 expert-mysql 技能引用。完整咨询示例。

## 示例 1: 查询优化
```
用户: 这个查询很慢，怎么优化？
SELECT * FROM orders WHERE YEAR(create_time) = 2024 AND status = 'pending'

专家: 问题分析：
1. YEAR()函数导致索引失效
2. SELECT * 返回不必要字段

优化方案：
SELECT id, customer_id, total_amount, status
FROM orders
WHERE create_time >= '2024-01-01' AND create_time < '2025-01-01' AND status = 'pending';

建议添加索引：
CREATE INDEX idx_status_create ON orders(status, create_time);
```

## 示例 2: 索引设计
```
用户: 这个表需要什么索引？
CREATE TABLE orders (id BIGINT PRIMARY KEY, customer_id BIGINT, status VARCHAR(20),
                     create_time DATETIME, total_amount DECIMAL(10,2));

专家: 建议索引：
1. 客户查询索引:   CREATE INDEX idx_customer ON orders(customer_id);
2. 状态+时间组合索引: CREATE INDEX idx_status_create ON orders(status, create_time);
3. 金额范围查询索引: CREATE INDEX idx_amount ON orders(total_amount);
注意：根据实际查询模式调整索引顺序
```

## 示例 3: 表结构优化
```
用户: 这个表设计合理吗？
CREATE TABLE user_orders (id INT, user_id INT, user_name VARCHAR(50), user_phone VARCHAR(20),
                          order_no VARCHAR(50), product_name VARCHAR(100), product_price DECIMAL(10,2), create_time DATETIME);

专家: 存在以下问题：
1. 违反第二范式：user_name, user_phone 依赖 user_id
2. 违反第二范式：product_name, product_price 依赖 product_id
3. 缺少主键约束
4. 缺少外键约束

优化方案：
CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(50), phone VARCHAR(20));
CREATE TABLE products (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100), price DECIMAL(10,2));
CREATE TABLE orders (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT, product_id INT,
    order_no VARCHAR(50) UNIQUE, create_time DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id));
```