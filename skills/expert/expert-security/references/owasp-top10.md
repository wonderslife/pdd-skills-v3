# OWASP Top 10 2021 合规检查

> 本文件为 expert-security 的参考资料，按需加载。完整覆盖规则见 SKILL.md。

## OWASP Top 10 2021 完整覆盖

| # | 类别 | 中文描述 | 检测方法 | 修复优先级 |
|---|------|---------|---------|-----------|
| A01 | Broken Access Control | 访问控制失效 | 权限矩阵审查 | CRITICAL |
| A02 | Cryptographic Failures | 加密机制失效 | 密钥轮换检查 | CRITICAL |
| A03 | Injection | 注入攻击 | SAST/DAST扫描 | CRITICAL |
| A04 | Insecure Design | 不安全设计 | 威胁建模 | HIGH |
| A05 | Security Misconfiguration | 安全配置错误 | 配置基线检查 | HIGH |
| A06 | Vulnerable Components | 过时组件 | 依赖扫描 | HIGH |
| A07 | Auth Failures | 身份认证失效 | 认证流程审计 | CRITICAL |
| A08 | Software/Data Integrity | 软件/数据完整性 | 签名验证 | MEDIUM |
| A09 | Logging/Monitoring Failures | 日志/监控不足 | 日志覆盖检查 | MEDIUM |
| A10 | SSRF | 服务端请求伪造 | 网络访问控制 | HIGH |

## A01: Broken Access Control / 访问控制失效

代码示例见 `code-examples.md`。核心要点：所有敏感接口必须完整权限控制链（@PreAuthorize注解 + 数据范围校验 + 业务逻辑校验 + 敏感字段脱敏）。

## A02: Cryptographic Failures / 加密机制失效

**检查清单:**
- [ ] 敏感数据使用AES-256-GCM加密存储
- [ ] 传输层强制TLS 1.2+
- [ ] 密码使用BCrypt/Argon2哈希
- [ ] 密钥定期轮换（建议90天）
- [ ] 禁用弱加密算法（MD5、SHA1、DES、RC4）

## A03: Injection / 注入攻击

**全面注入防护矩阵:**

| 注入类型 | 危险函数/API | 防护措施 | 检测工具 |
|---------|-------------|---------|---------|
| SQL注入 | Statement.executeQuery() | PreparedStatement | SQLMap |
| NoSQL注入 | BasicQuery.where() | 参数化查询 | NoSQLMap |
| OS命令注入 | Runtime.exec() | 白名单验证 | Commix |
| LDAP注入 | SearchControls() | LDAP转义 | Ldapmap |
| XPath注入 | XPath.evaluate() | 参数化XPath | XPathInjector |
| XXE | XMLReader.parse() | 禁用外部实体 | XXEinjector |

## A07: Authentication Failures / 身份认证失效

**安全认证流程代码见 `code-examples.md`。** 核心要点：验证码校验 → 登录尝试次数限制(防暴力破解) → 用户认证 → 清除失败计数 → 生成JWT → 记录登录安全事件。