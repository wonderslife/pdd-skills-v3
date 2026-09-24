---
name: expert-mysql
description: MySQL数据库专家提供SQL优化、索引设计和表结构分析服务。当用户需要SQL优化或数据库设计时调用此技能。支持中文触发：SQL优化、数据库设计、索引优化、慢查询分析。
license: MIT
author: "neuqik@hotmail.com"
version: "2.0"
---

# MySQL 数据库专家

## 概述

本技能提供专业的 MySQL 数据库相关服务，包括 SQL 查询优化、数据库表结构设计、索引优化、存储过程编写等。基于 MySQL 官方文档提供权威的技术支持。

## 目录结构

```
expert-mysql/
├── SKILL.md              # 技能定义文件
├── LICENSE               # MIT 许可证
├── README.md             # 说明文档
└── references/           # 参考文档
    ├── sql-optimization.md  # SQL优化/索引设计/表结构/性能优化
    ├── advanced.md          # 高级特性/事务/复制/备份/分区
    └── examples.md          # 使用示例
```

## 触发条件

**自动触发**: 用户询问 SQL 查询优化 | 需要设计或修改数据库表结构 | 索引相关问题 | 存储过程编写 | 数据库性能问题分析
**手动触发**: 用户输入 `/mysql`、`/sql`、`/database` 等命令

## 核心能力

### 1. SQL 查询优化
- **EXPLAIN 分析**: `EXPLAIN SELECT ...` | `EXPLAIN ANALYZE`（MySQL 8.0.18+）
- 关注点: type=ref,range,index | key=命中索引 | rows=越少越好 | Extra=避免Using filesort/temporary
- 常见场景: 避免SELECT * | JOIN加索引 | 子查询用JOIN替代 | 分页用索引子查询替代OFFSET

详细见 `references/sql-optimization.md`。

### 2. 索引设计
- 索引类型: PRIMARY KEY | UNIQUE | INDEX | FULLTEXT | SPATIAL
- 原则: 选择性高的列优先 | 最左前缀匹配 | 覆盖索引
- 失效场景: 函数包裹 | 隐式转换 | LIKE左模糊 | OR条件 | NOT条件

详细见 `references/sql-optimization.md`。

### 3. 表结构设计
- 数据类型: TINYINT/SMALLINT/INT/BIGINT/VARCHAR/TEXT/DATETIME/TIMESTAMP
- 范式: 1NF(字段不可分割) | 2NF(消除部分依赖) | 3NF(消除传递依赖)
- 反范式: 适当冗余提升查询性能

详细见 `references/sql-optimization.md`。

### 4. 性能优化
- 慢查询日志: `SET GLOBAL slow_query_log='ON'; SET GLOBAL long_query_time=2;`
- 连接池(HikariCP): maximum-pool-size=20, minimum-idle=5
- 缓存: MySQL 8.0已移除查询缓存，用Redis等应用层缓存

详细见 `references/sql-optimization.md`。

### 5. 高级特性
- 窗口函数(8.0+): RANK/DENSE_RANK/ROW_NUMBER/OVER(PARTITION BY)
- CTE(8.0+): WITH非递归 + WITH RECURSIVE层级查询
- JSON(5.7+): `->>`取值 | JSON_EXTRACT/SET/REMOVE

详细见 `references/advanced.md`。

### 6. 事务管理
- 隔离级别: READ UNCOMMITTED | READ COMMITTED | REPEATABLE READ(默认) | SERIALIZABLE
- 锁: 共享锁(S) | 排他锁(X) | 意向锁 | 间隙锁
- 死锁: `SHOW ENGINE INNODB STATUS`；避免建议=同顺序访问表/避免长事务/低隔离级别/合理索引
- 分布式事务: XA START/END/PREPARE/COMMIT

详细见 `references/advanced.md`。

### 7. 主从复制
- 主库: server-id=1, log-bin, binlog-format=ROW；创建`repl`复制用户
- 从库: server-id=2, relay-log, read-only；`CHANGE MASTER TO` + `START SLAVE`
- 读写分离: Spring Boot 多数据源 + RoutingDataSource
- 监控: `SHOW MASTER/SLAVE STATUS`；关键=Slave_IO_Running/Slave_SQL_Running=Yes, Seconds_Behind_Master=0

详细见 `references/advanced.md`。

### 8. 备份与恢复
- 逻辑备份: `mysqldump`（单库/多库/全库/只表结构/只数据）
- 物理备份: `xtrabackup`（全量/增量/恢复）
- 策略: 全量(每周) + 增量(每天) + 二进制日志 + 混合(生产)
- 时间点恢复: `mysqlbinlog` 应用日志

详细见 `references/advanced.md`。

### 9. 分区表
- 类型: RANGE | LIST | HASH | KEY
- 管理: ADD/DROP/REORGANIZE PARTITION，`information_schema.PARTITIONS` 查看

详细见 `references/advanced.md`。

## 使用示例

完整咨询示例（查询优化/索引设计/表结构优化）见 `references/examples.md`。

## Guardrails

- 必须基于 MySQL 官方文档提供建议
- 优化方案需考虑版本兼容性
- 提供的 SQL 需经过语法验证
- 大表操作需提供分批处理建议
- 不确定的问题需明确说明

## 相关资源

- **MySQL 8.0 文档**: https://dev.mysql.com/doc/refman/8.0/en/
- **MySQL 9.4 文档**: https://dev.mysql.com/doc/refman/9.4/en/
- **Context7 Library ID**: `/websites/dev_mysql_doc_refman_8_0_en`