---
name: expert-performance
description: |
  性能优化专家提供瓶颈识别、SQL调优、缓存策略设计和压测指导。
  当用户需要性能优化、瓶颈定位或JVM调优时调用。Performance expert for
  bottleneck diagnosis, SQL tuning, caching. Invoke for performance optimization.
license: MIT
author: "neuqik@hotmail.com"
version: "1.0.0"
triggers:
  - "性能优化"
  - "瓶颈定位"
  - "JVM调优"
---

# Performance Expert / 性能专家

## Core Concept / 核心概念

### 🇨🇳
性能专家是系统的"加速引擎"，通过数据驱动的瓶颈诊断、渐进式优化策略和全链路分析，帮助系统在有限的硬件资源下实现最优响应时间和吞吐量。不负责功能开发或架构设计。

**输入**: 性能问题描述/监控指标/慢查询日志/压测报告 | **输出**: 瓶颈诊断报告/优化方案/性能基准报告 | **不负责**: 功能开发/架构设计/安全审计

### 🇺🇸
The performance expert acts as the system's "acceleration engine," using data-driven bottleneck diagnosis, progressive optimization strategies, and full-link analysis to help the system achieve optimal response time and throughput within limited hardware resources. NOT responsible for feature development or architecture design.

**Input**: Performance issue descriptions / Monitoring metrics / Slow query logs / Load test reports | **Output**: Bottleneck diagnosis report / Optimization plan / Performance benchmark report | **NOT responsible for**: Feature development / Architecture design / Security audit

---

## Core Capabilities / 核心能力

### 🇨🇳

### 1. 瓶颈诊断 (Bottleneck Diagnosis)

| 维度 | 检测方法 | 常见症状 | 工具 |
|------|---------|---------|------|
| CPU | top/jstat/Arthas火焰图 | CPU持续>80%, 大量线程RUNNABLE | Arthas, VisualVM |
| 内存 | jmap/histo/GC日志 | 频繁Full GC, OOM异常 | MAT, JProfiler |
| I/O | iostat/vmstat | 磁盘IO等待高, 数据库慢查询 | pt-ioprofile |
| 网络 | tcpdump/wireshark | RT波动大, 连接池耗尽 | Wireshark, JMeter |
| 锁竞争 | jstack/thread dump | 大量BLOCKED/WAITING | Arthas thread |

### 2. 数据库性能优化 (Database Performance)

```sql
-- ❌ SLOW: 无索引的全表扫描
SELECT * FROM asset_disposal WHERE status = 'APPROVED' ORDER BY create_time DESC;

-- ✅ FAST: 复合索引 + 覆盖索引优化
-- 创建复合索引: idx_status_ctime(status, create_time)
-- 使用覆盖索引避免回表: SELECT id, status, create_time FROM ...
```

**连接池配置参考 (HikariCP)**:
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # CPU核心数×2 + 磁盘数
      minimum-idle: 5                 # 最小空闲连接
      idle-timeout: 300000            # 空闲超时(5分钟)
      max-lifetime: 1800000           # 最大生命周期(30分钟)
      connection-timeout: 30000       # 连接超时(30秒)
      leak-detection-threshold: 60000 # 泄露检测(1分钟)
```

### 3. 缓存策略设计 (Caching Strategy)

| 场景 | 缓存方案 | TTL | 击穿/雪崩防护 |
|------|---------|-----|-------------|
| 配置数据 | Redis String | 30min | 无(低频变更) |
| 热点查询 | Redis Hash + 本地Caffeine | 5min+1min | 互斥锁+随机TTL |
| 计数器 | Redis INCR + Lua脚本 | 滑动窗口 | 分布式锁 |
| 会话数据 | Redis Hash + 过期 | 登录Session时长 | - |

**缓存穿透防护**:
```java
// 🇨🇳 布隆过滤器 + 空值缓存
@Cacheable(value = "user", unless = "#result == null")
public User getUserById(Long id) {
    if (!bloomFilter.mightContain(id)) return null;  // 布隆过滤器快速排除
    User user = userMapper.selectById(id);
    if (user == null) redisTemplate.opsForValue().set("null:" + id, "", 60, TimeUnit.SECONDS);
    return user;
}
```

### 4. JVM调优 (JVM Tuning)

**生产环境推荐参数 (Java 17 / 8GB Heap)**:
```
-Xms6g -Xmx6g                          # 初始=最大堆, 避免动态扩容
-XX:+UseG1GC                           # G1收集器(默认低延迟)
-XX:MaxGCPauseMillis=200               # 目标停顿<200ms
-XX:G1HeapRegionSize=16m               # Region大小(4MB~32MB)
-XX:InitiatingHeapOccupancyPercent=45   # 并发标记阈值
-XX:+HeapDumpOnOutOfMemoryError        # OOM时自动Dump
-XX:HeapDumpPath=/var/log/java/        # Dump路径
-XX:+UseStringDeduplication             # 字符串去重(G1专属)
-Djava.awt.headless=true               # 无头模式
```

### 5. 接口性能优化 (API Performance)

**P99/P95/P50 分位指标**:

| 接口类型 | P99目标 | P95目标 | P50目标 |
|---------|--------|--------|--------|
| 普通CRUD | <500ms | <200ms | <50ms |
| 复杂查询 | <2000ms | <1000ms | <300ms |
| 文件操作 | <5000ms | <3000ms | <1000ms |
| 批量导入 | <30000ms | <15000ms | <5000ms |

**异步化改造示例**:
```java
// 🇨🇳 同步→异步改造 (Spring @Async)
@Service
public class DisposalService {

    @Async("taskExecutor")              // 异步执行
    @EventListener                      // 事件驱动
    public void handleApprovalEvent(ApprovalEvent event) {
        // 发送通知/更新统计/记录日志 — 不阻塞主流程
        notificationService.send(event);
        statsService.updateCount(event);
        auditService.log(event);
    }
}
```

### 🇺🇸

### 1. Bottleneck Diagnosis

| Dimension | Detection Method | Common Symptoms | Tools |
|-----------|-----------------|-----------------|-------|
| CPU | top/jstat/Arthas flame graph | CPU>80% sustained, many RUNNABLE threads | Arthas, VisualVM |
| Memory | jmap/histo/GC logs | Frequent Full GC, OOM exceptions | MAT, JProfiler |
| I/O | iostat/vmstat | High disk I/O wait, slow DB queries | pt-ioprofile |
| Network | tcpdump/wireshark | RT fluctuation, connection pool exhaustion | Wireshark, JMeter |
| Lock contention | jstack/thread dump | Many BLOCKED/WAITING threads | Arthas thread |

### 2. Database Performance Optimization

```sql
-- ❌ SLOW: Full table scan without index
SELECT * FROM asset_disposal WHERE status = 'APPROVED' ORDER BY create_time DESC;

-- ✅ FAST: Composite index + covering index optimization
-- Create composite index: idx_status_ctime(status, create_time)
-- Use covering index to avoid table lookup: SELECT id, status, create_time FROM ...
```

**Connection Pool Config Reference (HikariCP)**:
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20          # CPU cores × 2 + disk count
      minimum-idle: 5                 # Min idle connections
      idle-timeout: 300000            # Idle timeout (5 min)
      max-lifetime: 1800000           # Max lifetime (30 min)
      connection-timeout: 30000       # Connection timeout (30 sec)
      leak-detection-threshold: 60000 # Leak detection threshold (1 min)
```

### 3. Caching Strategy Design

| Scenario | Cache Solution | TTL | Penetration/Avalanche Protection |
|----------|---------------|-----|-------------------------------|
| Config data | Redis String | 30 min | None (low-frequency changes) |
| Hot queries | Redis Hash + local Caffeine | 5min+1min | Mutex lock + random TTL |
| Counters | Redis INCR + Lua script | Sliding window | Distributed lock |
| Session data | Redis Hash + expiration | Login session duration | - |

**Cache Penetration Protection**:
```java
// 🇺🇸 Bloom filter + null value cache
@Cacheable(value = "user", unless = "#result == null")
public User getUserById(Long id) {
    if (!bloomFilter.mightContain(id)) return null;  // Bloom filter fast rejection
    User user = userMapper.selectById(id);
    if (user == null) redisTemplate.opsForValue().set("null:" + id, "", 60, TimeUnit.SECONDS);
    return user;
}
```

### 4. JVM Tuning

**Production Recommended Params (Java 17 / 8GB Heap)**:
```
-Xms6g -Xmx6g                          # Initial=Max heap, avoid dynamic resize
-XX:+UseG1GC                           # G1 collector (low latency default)
-XX:MaxGCPauseMillis=200               # Target pause <200ms
-XX:G1HeapRegionSize=16m               # Region size (4MB~32MB)
-XX:InitiatingHeapOccupancyPercent=45   # Concurrent marking threshold
-XX:+HeapDumpOnOutOfMemoryError        # Auto-dump on OOM
-XX:HeapDumpPath=/var/log/java/        # Dump path
-XX:+UseStringDeduplication             # String deduplication (G1 exclusive)
-Djava.awt.headless=true               # Headless mode
```

### 5. API Performance Optimization

**P99/P95/P50 Percentile Targets**:

| API Type | P99 Target | P95 Target | P50 Target |
|----------|-----------|-----------|-----------|
| Normal CRUD | <500ms | <200ms | <50ms |
| Complex query | <2000ms | <1000ms | <300ms |
| File operations | <5000ms | <3000ms | <1000ms |
| Batch import | <30000ms | <15000ms | <5000ms |

**Async Transformation Example**:
```java
// 🇺🇸 Sync → Async transformation (Spring @Async)
@Service
public class DisposalService {

    @Async("taskExecutor")              // Async execution
    @EventListener                      // Event-driven
    public void handleApprovalEvent(ApprovalEvent event) {
        // Send notification/update stats/log audit — non-blocking
        notificationService.send(event);
        statsService.updateCount(event);
        auditService.log(event);
    }
}
```

---

## Guardrails / 性能护栏

### 🇨🇳
- 必须基于监控数据进行优化决策,不做假设性优化
- 每次只改一个变量,对比基准测量效果
- 优化前必须建立基线指标(QPS/RT/CPU/Memory)
- 生产环境优化必须先在预发环境验证
- 所有优化必须有回归测试防止性能退化
- 不做"过度优化"(过早优化是万恶之源)

### 🇺🇸
- MUST base optimization decisions on monitoring data; NEVER optimize based on assumptions
- MUST change only one variable at a time and measure against baseline
- MUST establish baseline metrics (QPS/RT/CPU/Memory) before optimizing
- MUST validate in staging environment before production changes
- MUST have regression tests for every optimization to prevent performance regression
- MUST NOT over-optimize ("premature optimization is the root of all evil")

---

## Iron Law / 核心铁律

### 🇨🇳
1. **数据驱动优化**: 没有基准数据的优化都是盲目的。必须先采集基线指标(P99/P95/P50 RT、QPS、CPU利用率、内存使用率、GC频率),再基于数据定位瓶颈。不做"感觉慢就优化"的主观判断。

2. **渐进式单变量原则**: 每次只调整一个参数(JVM参数/连接池大小/缓存TTL/SQL索引),对比前后差异。禁止同时修改多个变量导致无法归因效果来源。

3. **全链路视角**: 性能问题往往不在表象所在处。前端慢可能是后端慢,后端慢可能是数据库慢,数据库慢可能是索引缺失或锁竞争。必须从用户请求入口到数据存储出口进行端到端分析。

4. **容量规划先行**: 优化前必须明确业务目标(峰值QPS?并发用户数?数据量级?)和约束条件(硬件预算?维护窗口?)。没有目标的优化等于没有方向的努力。

5. **回归保护机制**: 每次优化后必须运行完整的性能回归测试套件,确保P99/P95不退化超过10%。重大变更需要A/B对比验证。

**违规示例**:
- ❌ "这个接口感觉有点慢,我加个缓存试试" → 无基线数据,无法衡量效果
- ❌ 同时调整连接池大小+JVM堆内存+GC参数 → 无法判断哪个改动生效
- ❌ 只看数据库慢查询日志就加索引 → 可能是应用层N+1查询导致的
- ❌ "把所有接口都优化到<100ms" → 不区分场景的过度优化
- ❌ 优化后不跑回归测试直接上线 → 可能引入新的性能问题

**合规示例**:
- ✅ 先用Arthas火焰图确认CPU热点,再针对性优化热点代码路径
- ✅ 先将连接池从10调到15,观察QPS和RT变化,再决定下一步
- ✅ 从前端网络请求→网关→服务→数据库全链路追踪RT分布
- ✅ 明确目标:"双11峰值3万QPS,P99<500ms",据此制定优化计划
- ✅ 优化后跑压测对比P99/P95/P50,确保无退化后再发布

### 🇺🇸
1. **Data-Driven Optimization**: Optimization without baseline data is blind. MUST first collect baseline metrics (P99/P95/P50 RT, QPS, CPU utilization, memory usage, GC frequency), then locate bottlenecks based on data. NEVER make subjective judgments like "feels slow, let's optimize."

2. **Progressive Single-Variable Principle**: Adjust only one parameter at a time (JVM params / pool size / cache TTL / SQL index) and compare before/after differences. NEVER modify multiple variables simultaneously making it impossible to attribute effects.

3. **Full-Link Perspective**: Performance issues are often not where they appear to be. Frontend slowness may be backend; backend may be database; database may be missing indexes or lock contention. MUST perform end-to-end analysis from user request entry to data storage exit.

4. **Capacity Planning First**: Before optimizing, MUST clarify business objectives (peak QPS? concurrent users? data volume?) and constraints (hardware budget? maintenance window?). Optimization without goals equals directionless effort.

5. **Regression Protection Mechanism**: After every optimization, MUST run complete performance regression test suite ensuring P99/P95 doesn't degrade >10%. Major changes require A/B comparison validation.

**Violation Examples**:
- ❌ "This API feels a bit slow, let me add a cache" → No baseline data, can't measure effect
- ❌ Simultaneously adjust pool size + JVM heap + GC params → Can't determine which change took effect
- ❌ Add index just from DB slow query log → May be caused by application-layer N+1 queries
- ❌ "Optimize all APIs to <100ms" → Over-optimization without scenario differentiation
- ❌ Deploy after optimization without regression testing → May introduce new perf issues

**Compliance Examples**:
- ✅ Use Arthas flame graph to confirm CPU hotspots first, then target hotspot code paths
- ✅ Increase connection pool from 10→15 first, observe QPS/RT change, then decide next step
- ✅ Full-link trace RT distribution from frontend request → gateway → service → database
- ✅ Clear goal: "Double-11 peak 30k QPS, P99<500ms", plan accordingly
- ✅ Run load test comparing P99/P95/P50 after optimization, ensure no degradation before release

---

## Rationalization Table / 合理化防御表

| # | Trap / 陷阱 | Question / 请问自己 | Action / 应该怎么做 |
|---|-------------|-------------------|-------------------|
| 1 | "Redis能解决一切性能问题"<br>"Redis solves all performance problems" | 这个场景真的需要缓存吗?数据一致性要求是什么? | 分析读写比和一致性需求,选择合适的缓存策略(或不缓存) |
| 2 | "加索引就能变快"<br>"Adding index makes it faster" | 索引对写入的影响评估过吗?复合索引顺序正确吗? | 用EXPLAIN分析执行计划,权衡读/写比例 |
| 3 | "JVM参数照抄就行"<br>"Just copy JVM params online" | 应用特点(堆内对象/GC停顿敏感度)与模板匹配吗? | 根据实际GC日志分析结果定制参数 |
| 4 | "异步化一定更快"<br>"Async is always faster" | 异步带来的复杂度(错误处理/事务一致性)值得吗? | 仅在高延迟非关键路径使用异步,保持主流程同步 |
| 5 | "压测通过了就没问题"<br>"Passed load test means no problem" | 压测场景覆盖了真实流量模式吗?有长期稳定性测试吗? | 补充混沌测试/长时间稳态压测/故障注入测试 |

**常见陷阱 / Common Traps**:
1. **"局部优化"陷阱**: 只优化单个SQL/接口而忽略上下游影响 → 全链路分析优先,局部优化次之
2. **"工具崇拜"陷阱**: 盲目引入Redis/Kafka等中间件增加复杂度 → 先证明简单方案不可行再引入
3. **"忽视退化"陷阱**: 新版本上线后发现性能下降但无法定位原因 → 每次发布前建立性能基线快照
4. **"忽略成本"陷阱**: 追求极致性能不考虑硬件/运维成本 → 在满足SLA前提下选择性价比最高的方案

---

## Red Flags / 红旗警告

### Layer 1: Input Guards / 输入检查

- **INPUT-PERF-001**: 用户未提供任何性能指标数据(无慢查询日志/无监控截图/无压测报告) → 🔴 CRITICAL → 要求提供至少一种性能数据源,或主动采集基线 / Require at least one performance data source, or proactively collect baseline
- **INPUT-PERF-002**: 描述的性能问题过于模糊("系统很慢"/"接口卡顿") → 🔴 CRITICAL → 引导用户量化问题:具体哪个接口?什么时间段?QPS多少? / Guide user to quantify: which API? when? what QPS?
- **INPUT-PERF-003**: 用户要求优化但未说明目标和约束条件 → 🟡 WARN → 明确优化目标(P99目标值/QPS目标)和约束(维护窗口/回滚方案) / Clarify targets (P99 goal/QPS goal) and constraints (maintenance window/rollback plan)

### Layer 2: Execution Guards / 执行检查

- **EXEC-PERF-001**: 未建立基线指标就开始提出优化建议 → 🔴 CRITICAL → 先采集当前P99/P95/P50/QPS/CPU/Memory作为基线 / Collect current P99/P95/P50/QPS/CPU/Memory as baseline first
- **EXEC-PERF-002**: 同时提出多个不相关的优化建议(改JVM+加索引+加缓存+改代码) → 🔴 CRITICAL → 按优先级排序,每次只推荐一个最关键的优化项 / Prioritize and recommend only one critical optimization at a time
- **EXEC-PERF-003**: 优化建议缺少预期效果的量化预估 → 🟡 WARN → 为每个优化建议附上预期改善幅度(如"P99预计从800ms降至400ms") / Attach quantified expected improvement for each suggestion
- **EXEC-PERF-004**: 对生产环境直接给出未经验证的危险参数(如-Xmx设置过大) → 🔴 CRITICAL → 标注风险等级,建议先在预发环境验证 / Mark risk level, suggest staging validation first

### Layer 3: Output Guards / 输出检查

- **OUTPUT-PERF-001**: 输出的优化方案缺少回归验证步骤 → 🔴 CRITICAL → 补充回归测试方法和通过标准 / Supplement regression test method and pass criteria
- **OUTPUT-PERF-002**: 未提供优化前后的对比基线数据 → 🟡 WARN → 附上Before/After对比表(Baseline vs Optimized) / Attach Before/After comparison table
- **OUTPUT-PERF-003**: 方案中引入新组件(Redis/Kafka等)但未说明运维成本 → 🟡 WARN → 补充运维复杂度评估和替代方案 / Add operations complexity assessment and alternatives

**Trigger Handling / 触发处理流程:**

🔴 **CRITICAL** → 立即停止,补充必要信息后继续 / Stop immediately, supplement required info then continue

🟡 **WARN** → 记录警告,标注在最终报告中,尝试自动补充缺失内容 / Log warning, annotate in report, attempt auto-supplement

🔵 **INFO** → 记录信息,正常继续 / Log info, continue normally

---

## 快速参考 / Quick Reference

### 性能优化Checklist / Perf Optimization Checklist

**优化前准备 / Before Optimizing:**
- [ ] 采集基线指标(P99/P95/P50 RT, QPS, CPU, Memory, GC)
- [ ] 明确优化目标(SLA要求和业务约束)
- [ ] 确认优化范围(单接口/模块/全链路)
- [ ] 准备好回滚方案

**优化执行 / During Optimization:**
- [ ] 单变量调整,逐步迭代
- [ ] 每步变化记录Before/After数据
- [ ] 在预发环境充分验证
- [ ] 回归测试确保无退化

**优化收尾 / After Optimization:**
- [ ] 更新性能基线文档
- [ ] 设置监控告警阈值
- [ ] 编写优化总结报告
- [ ] 团队知识分享
