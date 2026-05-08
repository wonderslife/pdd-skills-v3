# PDD Test Skill v1.0.1 - 试点验证指南

> **版本**: 1.0.1
> **日期**: 2026-05-08
> **目的**: 指导如何验证优化后的 testcase-modeler 和 testcase-agent

---

## 📋 验证目标

本次优化的主要改进点：

| 改进项 | 之前 | 之后 | 验证方法 |
|--------|------|------|---------|
| **触发词覆盖** | Modeler: 10个 / Agent: 8个 | Modeler: 30个 / Agent: 28个 | 测试各种口语化表达是否能正确触发 |
| **SKILL.md长度** | Agent: 774行 | Agent: 359行（主文件）+ references/ | 检查加载效率和可读性 |
| **文档结构** | 单一巨型文件 | 三层结构（主文件 + 4个参考文档） | 验证信息查找效率 |
| **示例质量** | 2个基础示例 | 3个真实业务场景（含元数据、变体） | 运行实际用例验证完整性 |

---

## 🚀 快速开始（5分钟上手）

### 前置条件检查

```bash
# 1. 确保Chrome DevTools MCP服务正在运行
# （通常在Trae IDE中自动启动）

# 2. 设置环境变量
# Windows PowerShell:
$env:TEST_USER = "yuanye"
$env:TEST_PASS = "yuanye"
$env:LOGIN_URL = "http://uniportal.sjjk.com.cn"

# Linux/Mac:
export TEST_USER="yuanye"
export TEST_PASS="yuanye"
export LOGIN_URL="http://uniportal.sjjk.com.cn"
```

### 场景 A：验证登录流程（简单，适合首次验证）

#### 方式 1：对话式执行（推荐新手）

在 Trae IDE 对话框中输入：

```
帮我执行 login-flow.yaml 这个测试用例，看看统一门户的登录流程是否正常
```

**预期行为**：
- ✅ Agent 自动识别到 YAML 文件路径
- ✅ 触发 testcase-agent 技能
- ✅ 按照 5 条铁律依次执行：
  1. 状态检测（检查是否已登录）
  2. 打开登录页面
  3. 输入用户名/密码
  4. 点击登录按钮
  5. 验证首页加载
- ✅ 实时显示每步进度和结果
- ✅ 最终生成 HTML 报告并提供预览链接

#### 方式 2：命令行执行（适合自动化）

```bash
# 执行登录流程测试用例
pdd test replay skills/expert/testcase-modeler/examples/login-flow.yaml --debug

# 观察输出：
# ✓ Test started: LOGIN-001-portal-normal
# [DEBUG] Step 1: Navigate to http://uniportal.sjjk.com.cn
# Press Enter to execute >
```

### 场景 B：验证复杂业务流程（中级）

在对话框中输入：

```
执行 asset-eval-approval-flow.yaml 用例，导航到资产评估核准的核准申请页面，告诉我有多少条记录
```

**预期行为**：
- ✅ 自动处理 SSO 单点登录跳转
- ✅ 成功完成三级菜单导航：资产评估 → 资产评估核准 → 核准申请
- ✅ 提取并报告列表记录数量
- ✅ 生成包含截图和详细诊断的报告

---

## 🔍 验证清单

### 1. 触发词覆盖验证

尝试以下表达，确认都能正确触发相应技能：

#### testcase-modeler 触发测试

| 输入表达式 | 预期触发的技能 | 预期行为 |
|----------|--------------|---------|
| "帮我录一个登录操作" | testcase-modeler | 开始建模对话 |
| "实习生不会写代码，怎么测试" | testcase-modeler | 引导零代码方案 |
| "把这个资产评估流程记下来" | testcase-modeler | 生成YAML用例 |
| "写个BDD风格的测试" | testcase-modeler | 使用Gherkin风格输出 |

#### testcase-agent 触发测试

| 输入表达式 | 预期触发的技能 | 预期行为 |
|----------|--------------|---------|
| "跑一下刚才那个yaml" | testcase-agent | 加载并执行YAML |
| "单步调试 login-flow.yaml" | testcase-agent | debug模式执行 |
| "批量执行 tests目录下所有用例" | testcase-agent | 批量执行模式 |
| "生成昨晚回归测试的报告" | testcase-agent | 从已有结果生成报告 |

### 2. 文档结构验证

```bash
# 检查文件结构
ls -la skills/expert/testcase-agent/
# 应该看到:
# SKILL.md (主文件, ~359行)
# _meta.json (元数据)
# templates/report-template.html
# evals/default-evals.json
# references/ (目录)
#   ├── iron-rules-detail.md (~600行)
#   ├── self-healing-strategy.md (~500行)
#   ├── error-handling.md (~450行)
#   └── cli-reference.md (~550行)

# 验证主文件行数
wc -l skills/expert/testcase-agent/SKILL.md
# 预期: ~359 行 (应该 < 400)

# 验证参考文档总行数
wc -l skills/expert/testcase-agent/references/*.md | tail -1
# 预期: ~2100 行 (详细信息都在这里)
```

### 3. 功能完整性验证

#### 登录流程验证点

- [ ] **铁律1**: 如果已登录，自动跳过登录步骤并记录日志
- [ ] **铁律2**: 每步都有截图保存（检查 test-results/screenshots/ 目录）
- [ ] **铁律3**: Step 4 (点击登录) 有网络校验断言
- [ ] **铁律4**: 元素定位失败时显示自愈过程（故意改错target测试）
- [ ] **铁律5**: 生成 HTML 报告（检查 test-results/reports/ 目录）

#### 资产评估流程验证点

- [ ] **SSO处理**: 正确处理从门户到业务系统的跳转
- [ ] **多级菜单**: 成功展开三级菜单并点击目标项
- [ ] **数据提取**: 正确读取表格记录数量
- [ ] **复杂断言**: 表单字段完整性、表头验证都正常工作
- [ ] **性能基准**: 总耗时 < 90s（参考 metadata.performance_baselines）

---

## 📊 结果收集模板

请将验证结果记录在下表中：

### 基本信息

| 项目 | 内容 |
|------|------|
| 验证日期 | _____________ |
| 验证人 | _____________ |
| 环境 | Windows / Mac / Linux |
| 浏览器 | Chrome / Edge / Chromium |
| Node.js 版本 | _____________ |

### 触发词测试结果

| 表达式 | 是否触发 | 响应时间 | 备注 |
|--------|---------|---------|------|
| "帮我录一个登录操作" | □ Yes □ No | ___ms | |
| "实习生不会写代码" | □ Yes □ No | ___ms | |
| "跑一下这个yaml" | □ Yes □ No | ___ms | |
| "单步调试" | □ Yes □ No | ___ms | |
| "批量执行测试" | □ Yes □ No | ___ms | |

### 用例执行结果

| 用例 | 总步骤 | 通过 | 失败 | 跳过 | 耗时 | 状态 |
|------|-------|------|------|------|------|------|
| login-flow.yaml | 5 | ___ | ___ | ___ | ___ms | □ PASS □ FAIL |
| asset-eval-approval-flow.yaml | 10 | ___ | ___ | ___ | ___ms | □ PASS □ FAIL |

### 质量评估（1-5分）

| 评估维度 | 分数 | 说明 |
|---------|------|------|
| **触发准确度** (能否正确识别意图) | ___/5 | |
| **执行稳定性** (是否经常失败) | ___/5 | |
| **报告质量** (HTML报告是否专业) | ___/5 | |
| **错误提示** (失败时的诊断是否有帮助) | ___/5 | |
| **易用性** (整体使用体验) | ___/5 | |
| **总分** | ___/25 | |

### 发现的问题和建议

**问题列表**：
1. 
2. 
3. 

**改进建议**：
1. 
2. 
3. 

---

## 🐛 常见问题排查

### Q1: 技能没有被触发？

**可能原因**：
- 表达式不够明确，AI认为可以直接处理而不需要技能
- _meta.json 的 triggers 列表没有覆盖该表达

**解决方案**：
```bash
# 检查当前触发词配置
cat skills/expert/testcase-modeler/_meta.json | grep -A 50 '"triggers"'
cat skills/expert/testcase-agent/_meta.json | grep -A 50 '"triggers"'

# 尝试更明确的表达
# ❌ "测试一下" (太模糊)
# ✅ "执行 login-flow.yaml 测试用例" (明确)
# ✅ "帮我生成资产评估申请的自动化测试脚本" (明确)
```

### Q2: 执行过程中元素找不到？

**可能原因**：
- 页面还没完全加载就开始查找元素
- target 描述与实际页面文案不一致
- 元素是动态渲染的（React/Vue组件）

**解决方案**：
1. 在对应 step 增加 `wait_after` 配置
2. 更新 target 描述为更精确的文本
3. 检查自愈日志（Level 2/3/4 的降级过程）

**查看自愈日志**：
```bash
# 在报告中找到失败步骤
# 查看详细的定位过程和候选元素
# 根据诊断建议更新 YAML 的 target
```

### Q3: 生成的报告打不开或样式错乱？

**可能原因**：
- 浏览器安全策略阻止了本地文件访问 CSS/JS
- 截图文件路径不正确

**解决方案**：
```bash
# 使用 HTTP 服务器打开报告（推荐）
cd test-results/reports
python -m http.server 8080
# 然后在浏览器访问 http://localhost:8080/xxx_report.html

# 或者直接用浏览器打开（部分功能受限）
start xxx_report.html  # Windows
open xxx_report.html   # Mac
```

### Q4: 网络校验总是失败？

**可能原因**：
- 测试环境的 API 接口与预期不同
- CORS 策略阻止了跨域请求检测
- 前端使用了 Service Worker 或其他缓存机制

**解决方案**：
1. 先手动在浏览器 DevTools Network 面板确认接口调用情况
2. 更新 `url_pattern` 为实际的接口地址
3. 如果确实无法监控网络请求，暂时将该断言标记为 `confidence: low`
4. 反馈给开发团队，考虑在网络层增加测试钩子

---

## 📝 下一步行动

### 如果验证全部通过 ✅

恭喜！v1.0.1 优化成功。建议：

1. **推广给团队**：分享试点验证结果，鼓励其他同事试用
2. **补充更多用例**：基于真实业务场景创建更多 YAML 测试用例
3. **集成到CI/CD**：参考 cli-reference.md 配置 Jenkins/GitHub Actions
4. **收集长期数据**：跟踪自愈成功率、平均耗时等指标

### 如果发现部分问题 ⚠️

1. **优先级排序**：按影响程度分类（阻断性/严重/一般/轻微）
2. **逐一修复**：
   - 触发问题 → 进一步增强 triggers 和 description
   - 执行问题 → 调整铁律实现或增加特殊处理
   - 报告问题 → 优化 report-template.html
3. **重新验证**：修复后再次运行本指南的验证流程
4. **迭代优化**：目标是在 v1.0.2 中解决所有发现的问题

### 如果需要重大调整 ❌

1. **召开评审会议**：讨论架构层面的改动
2. **更新设计文档**：同步修改 docs/superpowers/specs/ 下的设计文档
3. **制定 v2.0 计划**：如果改动较大，建议升级主版本号

---

## 📞 反馈渠道

请在验证完成后将结果反馈给：

- **方式 1**: 直接在本对话中粘贴上述结果收集模板的内容
- **方式 2**: 创建 Issue 到项目仓库，标签为 `pdd-test-feedback`
- **方式 3**: 发送邮件至团队邮箱（如有）

您的反馈对 PDD Test Skill 的持续改进至关重要！🙏

---

## 🎯 里程碑追踪

| 里程碑 | 目标日期 | 状态 | 备注 |
|--------|---------|------|------|
| v1.0.0 MVP 发布 | 2026-05-08 | ✅ 完成 | 基础功能可用 |
| v1.0.1 优化发布 | 2026-05-08 | ✅ 完成 | 本次优化的内容 |
| **试点验证完成** | **2026-05-09** | **⏳ 进行中** | **等待您的反馈** |
| v1.0.2 问题修复 | 2026-05-15 | 📋 计划中 | 基于反馈迭代 |
| v1.1.0 新增特性 | 2026-06-01 | 📋 计划中 | 人机协同模式等 |

---

> **祝验证顺利！如有任何问题，随时在对话中提问。**
>
> **PDD Team**
> **2026-05-08**
