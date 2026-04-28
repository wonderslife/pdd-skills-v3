---
name: expert-springcloud
description: "Spring Cloud 微服务架构专家。当项目涉及服务注册与发现、配置中心、网关路由、熔断降级、链路追踪等微服务组件时自动触发。支持中文触发：微服务、网关配置、服务注册、熔断器、链路追踪。"
license: MIT
compatibility: Spring Cloud / Spring Cloud Alibaba 微服务项目
metadata:
  author: "neuqik@hotmail.com"
  version: "1.0"
  triggers:
    - "/springcloud" | "/微服务"
    - "微服务" | "网关" | "服务注册" | "Nacos" | "Gateway"
    - "熔断" | "Sentinel" | "链路追踪" | "Feign" | "OpenFeign"
---

# Spring Cloud 微服务专家 / Spring Cloud Microservice Expert

## 1. 技能概述 / Overview

### 🇨🇳 定位
为基于 Spring Cloud / Spring Cloud Alibaba 的微服务架构项目提供专家级指导，包括：服务治理、配置管理、API 网关、熔断降级、分布式事务、链路追踪等。

**核心能力**:
- 服务注册与发现（Nacos/Eureka/Consul）
- 配置中心管理（Nacos Config/Spring Cloud Config）
- API 网关路由（Spring Cloud Gateway/Zuul）
- 服务间调用（OpenFeign/RestTemplate）
- 熔断与降级（Sentinel/Hystrix/Resilience4j）
- 链路追踪（Sleuth + Zipkin/SkyWalking）
- 分布式事务（Seata）

### 🇺🇸 Positioning
Provides expert-level guidance for Spring Cloud / Spring Cloud Alibaba microservice architecture projects, including: service governance, config management, API gateway, circuit breaking, distributed transactions, and distributed tracing.

---

## 2. 微服务架构规范 / Microservice Architecture Standards

### 🇨🇳

#### 2.1 服务拆分原则
- 按业务域拆分，每个服务对应一个限界上下文
- 服务间禁止直接数据库访问，必须通过 API 调用
- 共享代码通过公共模块（common）发布为 Maven 包

#### 2.2 接口设计规范
- 服务间调用统一使用 OpenFeign 客户端
- Feign 接口定义放在独立的 `xxx-api` 模块中
- 返回值统一使用 `R<T>` 包装类
- 版本管理通过 URL 路径（`/v1/`, `/v2/`）实现

#### 2.3 配置管理规范
- 所有配置统一由 Nacos Config 管理
- 配置文件按环境分离：`xxx-dev.yml`, `xxx-prod.yml`
- 敏感配置（DB密码、密钥）必须加密存储
- 配置变更必须记录变更日志

#### 2.4 网关路由规范
- 所有外部请求必须经过 Gateway 网关
- 路由配置放在 Nacos Config 中，支持动态刷新
- 网关层统一处理：鉴权、限流、日志、跨域

#### 2.5 熔断与降级规范
- 所有 Feign 调用必须配置 Sentinel 降级规则
- 核心业务流必须有降级兜底方案
- 慢调用/异常比例达到阈值时自动熔断

### 🇺🇸

#### 2.1 Service Split Principles
- Split by business domain, each service maps to a bounded context
- Direct database access between services is forbidden; must use API calls
- Shared code published as Maven packages through common modules

#### 2.2 API Design Standards
- Service-to-service calls use OpenFeign clients uniformly
- Feign interface definitions in separate `xxx-api` modules
- Return values wrapped uniformly in `R<T>` wrapper class
- Version management through URL paths (`/v1/`, `/v2/`)

#### 2.3 Config Management Standards
- All configurations managed by Nacos Config centrally
- Config files separated by environment: `xxx-dev.yml`, `xxx-prod.yml`
- Sensitive configs (DB passwords, keys) must be encrypted
- Config changes must have change logs

---

## 3. 常见问题模式 / Common Issue Patterns

### 🇨🇳

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Feign 调用 404 | 服务名拼写错误或未注册到 Nacos | 检查 `spring.application.name` 和 Nacos 控制台 |
| 配置不生效 | 未添加 `@RefreshScope` 或 Group 不匹配 | 检查注解和 Nacos 配置分组 |
| Gateway 路由失败 | 路由谓词配置错误 | 检查 `predicates` 和 `filters` 配置 |
| 分布式事务不回滚 | 未配置 Seata 全局事务管理器 | 添加 `@GlobalTransactional` 注解 |
| 链路追踪断裂 | 异步线程未传递 Trace Context | 使用 `TraceableExecutorService` 包装线程池 |

### 🇺🇸

| Issue | Cause | Solution |
|-------|-------|----------|
| Feign call 404 | Service name typo or not registered in Nacos | Check `spring.application.name` and Nacos console |
| Config not effective | Missing `@RefreshScope` or Group mismatch | Check annotation and Nacos config group |
| Gateway route failure | Route predicate misconfigured | Check `predicates` and `filters` configuration |
| Distributed TX no rollback | Seata global TX manager not configured | Add `@GlobalTransactional` annotation |
| Trace chain broken | Async threads not passing Trace Context | Wrap thread pools with `TraceableExecutorService` |

---

## 4. Guardrails

### 🇨🇳 必须遵守
- [ ] 服务间调用必须使用 OpenFeign，禁止 RestTemplate 硬编码 URL
- [ ] 所有 Feign 客户端必须配置降级 Fallback
- [ ] 配置变更必须先在 dev 环境验证
- [ ] 网关路由变更必须配合限流规则
- [ ] 分布式事务方法必须标注 `@GlobalTransactional`

### 🇺🇸 Must Follow
- [ ] Service-to-service calls must use OpenFeign; hardcoded RestTemplate URLs are forbidden
- [ ] All Feign clients must have Fallback configured
- [ ] Config changes must be verified in dev environment first
- [ ] Gateway route changes must include rate limiting rules
- [ ] Distributed transaction methods must be annotated with `@GlobalTransactional`

---

## 5. 版本历史 / Version History

| 版本 / Version | 日期 / Date | 变更内容 / Changes |
|------|------|---------|
| 1.0 | 2026-04-28 | 初始版本 / Initial version |
