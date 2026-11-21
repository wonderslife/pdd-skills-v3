# MySQL 高级特性、事务、复制、备份与分区

> 由 expert-mysql 技能引用。基于 MySQL 官方文档。

## 5. 高级特性

### 5.1 窗口函数（MySQL 8.0+）
```sql
SELECT name, score,
    RANK() OVER (ORDER BY score DESC) as rank,
    DENSE_RANK() OVER (ORDER BY score DESC) as dense_rank,
    ROW_NUMBER() OVER (ORDER BY score DESC) as row_num
FROM students;
-- 分组聚合
SELECT department, name, salary,
    AVG(salary) OVER (PARTITION BY department) as dept_avg,
    salary - AVG(salary) OVER (PARTITION BY department) as diff
FROM employees;
```

### 5.2 CTE 公用表表达式（MySQL 8.0+）
```sql
-- 非递归CTE
WITH monthly_sales AS (
    SELECT DATE_FORMAT(order_date, '%Y-%m') as month, SUM(amount) as total
    FROM orders GROUP BY month
)
SELECT * FROM monthly_sales WHERE total > 10000;
-- 递归CTE（层级查询）
WITH RECURSIVE org_tree AS (
    SELECT id, name, manager_id, 1 as level FROM employees WHERE manager_id IS NULL
    UNION ALL
    SELECT e.id, e.name, e.manager_id, t.level + 1
    FROM employees e JOIN org_tree t ON e.manager_id = t.id
)
SELECT * FROM org_tree;
```

### 5.3 JSON 支持（MySQL 5.7+）
```sql
CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(100), attributes JSON);
INSERT INTO products VALUES (1, 'iPhone', '{"color": "black", "storage": 128}');
SELECT name, attributes->>'$.color' as color FROM products;
SELECT JSON_EXTRACT(attributes, '$.storage') as storage,
       JSON_SET(attributes, '$.price', 999) as with_price,
       JSON_REMOVE(attributes, '$.color') as no_color
FROM products;
```

## 6. 事务管理

### 6.1 事务隔离级别
| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|------|-----------|------|
| READ UNCOMMITTED | ✗ | ✗ | ✗ |
| READ COMMITTED | ✓ | ✗ | ✗ |
| REPEATABLE READ（默认） | ✓ | ✓ | ✗ |
| SERIALIZABLE | ✓ | ✓ | ✓ |

```sql
SELECT @@transaction_isolation;
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

### 6.2 锁机制
| 锁类型 | 说明 | 适用场景 |
|--------|------|---------|
| 共享锁（S锁） | 允许读阻止写 | SELECT ... LOCK IN SHARE MODE |
| 排他锁（X锁） | 阻止读写 | SELECT ... FOR UPDATE |
| 意向锁 | 表级锁标识行锁意图 | 自动添加 |
| 间隙锁 | 锁定范围防止幻读 | REPEATABLE READ |

```sql
SELECT * FROM orders WHERE id = 1 LOCK IN SHARE MODE;
SELECT * FROM orders WHERE id = 1 FOR UPDATE;
SELECT * FROM information_schema.INNODB_LOCK_WAITS;
```

### 6.3 死锁处理
```sql
SHOW ENGINE INNODB STATUS;
-- 查看锁等待
SELECT r.trx_id waiting_trx_id, r.trx_mysql_thread_id waiting_thread,
       b.trx_id blocking_trx_id, b.trx_mysql_thread_id blocking_thread
FROM information_schema.INNODB_LOCK_WAITS w
JOIN information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id
JOIN information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id;
```
**避免死锁建议**: 按相同顺序访问表 | 避免长事务 | 使用较低隔离级别 | 合理设计索引

### 6.4 分布式事务（XA）
```sql
XA START 'xid1';
INSERT INTO orders VALUES (1, 'order1');
XA END 'xid1';
XA PREPARE 'xid1';
XA COMMIT 'xid1';
```

## 7. 主从复制

### 7.1 主库配置（my.cnf）
```ini
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog-format = ROW
binlog-do-db = mydb
```
```sql
CREATE USER 'repl'@'%' IDENTIFIED BY 'password';
GRANT REPLICATION SLAVE ON *.* TO 'repl'@'%';
FLUSH PRIVILEGES;
```

### 7.2 从库配置（my.cnf）
```ini
[mysqld]
server-id = 2
relay-log = mysql-relay-bin
read-only = 1
```
```sql
CHANGE MASTER TO
    MASTER_HOST='master_ip', MASTER_USER='repl', MASTER_PASSWORD='password',
    MASTER_LOG_FILE='mysql-bin.000001', MASTER_LOG_POS=154;
START SLAVE;
```

### 7.3 读写分离（Spring Boot 配置）
```java
@Configuration
public class DataSourceConfig {
    @Bean @Primary
    public DataSource masterDataSource() {
        return DataSourceBuilder.create().url("jdbc:mysql://master:3306/mydb").build();
    }
    @Bean
    public DataSource slaveDataSource() {
        return DataSourceBuilder.create().url("jdbc:mysql://slave:3306/mydb").build();
    }
    @Bean
    public RoutingDataSource routingDataSource() {
        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("master", masterDataSource());
        targetDataSources.put("slave", slaveDataSource());
        RoutingDataSource routingDataSource = new RoutingDataSource();
        routingDataSource.setTargetDataSources(targetDataSources);
        routingDataSource.setDefaultTargetDataSource(masterDataSource());
        return routingDataSource;
    }
}
```

### 7.4 复制状态监控
```sql
SHOW MASTER STATUS;
SHOW SLAVE STATUS\G;
-- 关键指标: Slave_IO_Running: Yes / Slave_SQL_Running: Yes / Seconds_Behind_Master: 0
```

## 8. 备份与恢复

### 8.1 逻辑备份（mysqldump）
```bash
mysqldump -u root -p mydb > mydb_backup.sql                       # 单库
mysqldump -u root -p --databases db1 db2 > multi_db_backup.sql    # 多库
mysqldump -u root -p --all-databases > all_db_backup.sql          # 全库
mysqldump -u root -p --no-data mydb > schema.sql                  # 只表结构
mysqldump -u root -p --no-create-info mydb > data.sql             # 只数据
mysql -u root -p mydb < mydb_backup.sql                           # 恢复
```

### 8.2 物理备份（Percona XtraBackup）
```bash
xtrabackup --backup --target-dir=/backup/full
xtrabackup --backup --target-dir=/backup/inc1 --incremental-basedir=/backup/full
xtrabackup --prepare --target-dir=/backup/full
xtrabackup --copy-back --target-dir=/backup/full
```

### 8.3 备份策略
| 策略 | 说明 | 适用场景 |
|------|------|---------|
| 全量备份 | 完整备份所有数据 | 每周一次 |
| 增量备份 | 只备份变化数据 | 每天一次 |
| 二进制日志备份 | 备份操作日志 | 实时备份 |
| 混合备份 | 全量+增量+日志 | 生产环境推荐 |

### 8.4 时间点恢复
```bash
mysql -u root -p < full_backup.sql
mysqlbinlog --start-datetime="2024-01-01 00:00:00" --stop-datetime="2024-01-01 12:00:00" mysql-bin.000001 | mysql -u root -p
```

### 8.5 自动备份脚本示例
```bash
#!/bin/bash
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mydb"; DB_USER="backup"; DB_PASS="password"
mkdir -p $BACKUP_DIR
mysqldump -u$DB_USER -p$DB_PASS --single-transaction --routines --triggers --events $DB_NAME \
    | gzip > $BACKUP_DIR/${DB_NAME}_${DATE}.sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "Backup completed: ${DB_NAME}_${DATE}.sql.gz" >> $BACKUP_DIR/backup.log
```

## 9. 分区表

### 9.1 分区类型
| 类型 | 说明 | 适用场景 |
|------|------|---------|
| RANGE | 范围分区 | 日期范围、数值范围 |
| LIST | 列表分区 | 离散值、地区分类 |
| HASH | 哈希分区 | 均匀分布数据 |
| KEY | 键分区 | 类似HASH，支持多列 |

### 9.2 分区表示例
```sql
-- RANGE 分区
CREATE TABLE orders (id BIGINT, order_date DATE, customer_id INT, amount DECIMAL(10,2), PRIMARY KEY (id, order_date))
PARTITION BY RANGE (YEAR(order_date)) (
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
-- LIST 分区
CREATE TABLE customers (id INT, name VARCHAR(100), region VARCHAR(50), PRIMARY KEY (id, region))
PARTITION BY LIST (region) (
    PARTITION p_north VALUES IN ('北京', '天津', '河北'),
    PARTITION p_south VALUES IN ('广东', '广西', '海南')
);
-- HASH 分区
CREATE TABLE logs (id BIGINT AUTO_INCREMENT, user_id INT, action VARCHAR(50), created_at DATETIME, PRIMARY KEY (id))
PARTITION BY HASH(user_id) PARTITIONS 10;
```

### 9.3 分区管理
```sql
ALTER TABLE orders ADD PARTITION (PARTITION p2025 VALUES LESS THAN (2026));
ALTER TABLE orders DROP PARTITION p2022;
ALTER TABLE orders REORGANIZE PARTITION p2023, p2024 INTO (PARTITION p2023_2024 VALUES LESS THAN (2025));
SELECT * FROM information_schema.PARTITIONS WHERE TABLE_NAME = 'orders';
```