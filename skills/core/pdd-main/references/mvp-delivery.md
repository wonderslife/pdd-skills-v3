# MVP 分层交付策略（Phase 3.5）

> 本文件为 pdd-main 的参考资料，按需加载。核心流程见 SKILL.md。

## 核心理念

不要等所有功能点全部完成才交付，而是按 MVP 层级递进交付，每层都可独立运行和验证。避免"黑盒开发"导致的返工。

## 三层 MVP 模型

| 层级 | 内容 | 交付标准 | 典型耗时 |
|------|------|---------|---------|
| **MVP-1 骨架层** | 数据模型+基础CRUD接口+种子数据 | 后端API可调通、Swagger可访问、种子数据可查询 | 1-2小时 |
| **MVP-2 功能层** | 业务逻辑+状态流转+表单校验 | 核心业务流程可走通、异常处理完整 | 2-4小时 |
| **MVP-3 体验层** | UX优化+权限控制+Options API+样式打磨 | 前后端联调完成、权限生效、UI一致 | 2-3小时 |

## MVP-1 骨架层实现清单

- [ ] Model定义(含审计字段、BaseAuditModel继承)
- [ ] Schema定义(含OptionSchema、ResponseSchema)
- [ ] 基础CRUD API(含/options端点)
- [ ] 路由注册(/options在/{id}之前)
- [ ] 种子数据SQL
- [ ] 微验证通过(后端启动+API可达)

## MVP-2 功能层实现清单

- [ ] 业务逻辑Service实现
- [ ] 状态流转/审批流程
- [ ] 参数校验(@Validated/@Xss)
- [ ] 异常处理(try-catch+safeAlert)
- [ ] 微验证通过(Schema序列化+业务流程)

## MVP-3 体验层实现清单

- [ ] 前端页面(列表/表单/详情)
- [ ] Options API下拉数据加载
- [ ] 权限控制(@PreAuthorize/v-hasPermi)
- [ ] CSS布局(global-reset.css基线)
- [ ] 微验证通过(前端编译+联调)

## 交付节奏

每完成一个 MVP 层级，向用户展示成果并获取反馈，再进入下一层级。