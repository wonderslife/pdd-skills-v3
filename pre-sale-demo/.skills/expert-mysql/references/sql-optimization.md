# MySQL SQL优化、索引设计与表结构设计

> 由 expert-mysql 技能引用。基于 MySQL 官方文档。

## 1. SQL 查询优化

### 1.1 查询分析工具
```sql
-- 基本用法
EXPLAIN SELECT * FROM users WHERE name = 'John';
-- 详细分析（MySQL 8.0.18+）
EXPLAIN ANALYZE SELECT * FROM users WHERE name = 'John';
```
**EXPLAIN 输出解读**（关注点）: id=查询标识/子查询顺序 | select_type=避免DEPENDENT SUBQUERY | table=关联表顺序 | type=目标ref,range,index | key=是否命中索引 | key_len=越短越好 | rows=越少越好 | Extra=避免Using filesort,Using temporary

### 1.2 常见优化场景
```sql
-- 场景1：避免 SELECT *
-- 不推荐: SELECT * FROM orders WHERE status = 'pending';
-- 推荐:   SELECT id, customer_id, total_amount FROM orders WHERE status = 'pending';

-- 场景2：优化 JOIN（确保关联字段有索引 + INNER JOIN 替代 WHERE 关联）
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
SELECT o.*, c.name FROM orders o
INNER JOIN customers c ON o.customer_id = c.id WHERE o.status = 'pending';

-- 场景3：子查询优化（用 JOIN + 子查询 替代相关子查询）
SELECT o.* FROM orders o
JOIN (SELECT customer_id, AVG(total_amount) as avg_amount FROM orders GROUP BY customer_id) avg
  ON o.customer_id = avg.customer_id
WHERE o.total_amount > avg.avg_amount;

-- 场景4：分页优化（用索引子查询替代 OFFSET）
-- 传统: SELECT * FROM orders ORDER BY id LIMIT 10000, 20;
SELECT o.* FROM orders o
JOIN (SELECT id FROM orders ORDER BY id LIMIT 10000, 20) t ON o.id = t.id;
```

## 2. 索引设计

### 2.1 索引类型
| 类型 | 说明 | 适用场景 |
|------|------|---------|
| PRIMARY KEY | 主键索引 | 唯一标识 |
| UNIQUE | 唯一索引 | 唯一约束 |
| INDEX | 普通索引 | 加速查询 |
| FULLTEXT | 全文索引 | 文本搜索 |
| SPATIAL | 空间索引 | 地理位置 |

### 2.2 索引设计原则
1. **选择性原则**: 选择性高的列优先。`SELECT COUNT(DISTINCT column_name) / COUNT(*) FROM table_name;`（越接近1越高）
2. **最左前缀原则**: 复合索引从左匹配。`CREATE INDEX idx_name_status_create ON orders(customer_name, status, create_time);` 命中`WHERE customer_name='John'`/`customer_name+status`，不命中`WHERE status='pending'`
3. **覆盖索引原则**: 查询字段都在索引中。`CREATE INDEX idx_covering ON orders(status, total_amount);` 查询 `SELECT status, total_amount FROM orders WHERE status='pending';`

### 2.3 索引失效场景
| 场景 | 示例 | 解决方案 |
|------|------|---------|
| 使用函数 | `WHERE YEAR(create_time)=2024` | 改用范围查询 |
| 隐式转换 | `WHERE phone=13800138000`(字符串字段) | 加引号 |
| LIKE 左模糊 | `WHERE name LIKE '%John'` | 使用全文索引 |
| OR 条件 | `WHERE name='John' OR age=20` | 使用UNION |
| NOT 条件 | `WHERE status!='deleted'` | 改用IN |

## 3. 表结构设计

### 3.1 数据类型选择
| 类型 | 存储 | 范围 | 适用场景 |
|------|------|------|---------|
| TINYINT | 1字节 | -128~127 | 状态、标志 |
| SMALLINT | 2字节 | -32768~32767 | 计数、数量 |
| INT | 4字节 | -21亿~21亿 | 主键、ID |
| BIGINT | 8字节 | 非常大 | 大数据量主键 |
| VARCHAR(n) | 可变 | n字符 | 字符串 |
| TEXT | 可变 | 64KB | 长文本 |
| DATETIME | 8字节 | 1000~9999年 | 时间 |
| TIMESTAMP | 4字节 | 1970~2038年 | 时间戳 |

### 3.2 范式设计
- **1NF**: 字段不可分割
- **2NF**: 消除部分依赖（避免 customer_name 依赖 customer_id 等冗余，拆分为独立表）
- **3NF**: 消除传递依赖

### 3.3 反范式设计
适当冗余提升查询性能（如订单表冗余 customer_name 字段）。

## 4. 性能优化

### 4.1 慢查询分析
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- 2秒以上
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```
### 4.2 连接池优化（HikariCP）
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.idle-timeout=300000
spring.datasource.hikari.connection-timeout=30000
```
### 4.3 缓存优化
MySQL 8.0 已移除查询缓存，使用 Redis 等应用层缓存热点数据。