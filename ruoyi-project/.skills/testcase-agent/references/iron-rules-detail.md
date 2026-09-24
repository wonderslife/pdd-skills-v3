# Testcase Agent - 五条铁律完整实现细节

> **版本**: 1.0.1
> **最后更新**: 2026-05-08
> **用途**: testcase-agent 的详细规则参考文档

---

## 📖 目录

1. [铁律 1：状态感知优先](#铁律-1状态感知优先)
2. [铁律 2：原子化执行](#铁律-2原子化执行)
3. [铁律 3：深度网络校验](#铁律-3深度网络校验)
4. [铁律 4：自愈而非放弃](#铁律-4自愈而非放弃)
5. [铁律 5：报告完整性](#铁律-5报告完整性)

---

## 铁律 1：状态感知优先（Context Check First）

### 1.1 核心原则

**在执行任何 steps 之前，必须先检查当前浏览器状态。**

这是整个测试执行流程的第一道关卡，决定了后续步骤的执行策略。

### 1.2 执行流程

```
┌─────────────────────────────────────┐
│  1. 读取 YAML 的 context_check 配置   │
│     - login_url                     │
│     - home_indicator                │
│     - credentials                   │
│     - captcha_required              │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│  2. 获取当前浏览器状态               │
│     - 调用 mcp_Chrome_DevTools_MCP_  │
│       list_pages()                  │
│     - 获取当前页面 URL               │
│     - 调用 take_snapshot() 获取快照  │
└──────────────────┬──────────────────┘
                   ▼
┌─────────────────────────────────────┐
│  3. 状态判断逻辑                    │
│                                     │
│  IF 当前页面 URL 包含 login_url      │
│    OR 页面不包含 home_indicator:     │
│      → 判定为"未登录状态"            │
│      → 自动插入登录步骤              │
│      → 或跳转到登录流程             │
│                                     │
│  ELSE:                              │
│      → 判定为"已登录状态"           │
│      → 记录日志                      │
│      → 跳过登录步骤                 │
│      → 继续执行后续 steps           │
└─────────────────────────────────────┘
```

### 1.3 实现代码示例

```yaml
# 从 YAML 读取配置
context_check:
  login_url: "http://uniportal.sjjk.com.cn"
  home_indicator: "统一门户（新）"    # 关键特征文本
  credentials:
    username: "${TEST_USER}"
    password: "${TEST_PASS}"
  captcha_required: false

# Agent 执行伪代码
async function checkContext(yamlConfig) {
  const pages = await listPages();
  const currentPage = pages.find(p => p.selected);
  const snapshot = await take_snapshot();
  
  // 检查是否在登录页
  const isOnLoginPage = currentPage.url.includes(yamlConfig.context_check.login_url);
  
  // 检查是否已登录（通过特征文本）
  const isLoggedIn = snapshot.text.includes(yamlConfig.context_check.home_indicator);
  
  if (isOnLoginPage || !isLoggedIn) {
    log("[Context] 检测到未登录状态");
    
    if (yamlConfig.context_check.captcha_required) {
      log("[Context] ⚠️ 需要验证码，暂停等待人工干预");
      return { status: "NEEDS_LOGIN", requiresIntervention: true };
    }
    
    return { status: "NEEDS_LOGIN", action: "execute_login_flow" };
  } else {
    log(`[Context] ✓ 已检测到登录状态: ${yamlConfig.context_check.home_indicator}`);
    return { status: "LOGGED_IN", action: "skip_login_steps" };
  }
}
```

### 1.4 特殊场景处理

| 场景 | 检测方法 | 处理方式 | 日志记录 |
|------|---------|---------|---------|
| **Session 过期** | 中途发现页面跳转到登录页 | 停止当前测试，提示重新登录 | `[Context] ⚠️ Session 已过期，检测到跳转到登录页` |
| **多标签页** | 检查所有打开的标签页 | 找到符合 home_indicator 的页面 | `[Context] 在标签页 N 中找到已登录状态` |
| **SSO 单点登录** | 登录统一门户后自动跳转业务系统 | 等待跳转完成（最多10秒） | `[Context] SSO 跳转中... 等待业务系统加载` |
| **验证码拦截** | 检测到验证码元素（canvas/img） | 暂停执行，请求人工干预或使用测试环境 | `[Context] 🔒 检测到验证码，需要人工处理` |

### 1.5 强制要求清单

- [ ] 必须在执行第一个 step 前调用 `checkContext()`
- [ ] 必须记录状态检测结果到日志
- [ ] 未登录时必须自动执行登录流程（除非需要人工干预）
- [ ] 已登录时必须跳过登录相关步骤并记录原因
- [ ] Session 过期时必须立即停止并报告
- [ ] 多标签页时必须遍历所有页面查找登录状态

---

## 铁律 2：原子化执行（Atomic Execution）

### 2.1 核心原则

**每完成一个 step，必须立即进行三项操作：截图保存、记录响应数据、评估断言结果。**

确保每个步骤都是独立可追溯的单元，即使后续步骤失败也不影响已完成步骤的证据。

### 2.2 三项强制操作

#### 操作 1：截图保存（强制）

**截图时机**：
- ✅ 操作前截图（可选，用于对比）
- ✅ **操作后截图（强制）**
- ✅ 断言失败时额外截图（强制）

**截图命名规则**：
```bash
test-results/screenshots/{test_id}/step_{step_num}_{action}_{timestamp}.png

# 示例
test-results/screenshots/ASSET-EVAL-001/step_1_navigate_20260508_143052.png
test-results/screenshots/ASSET-EVAL-001/step_5_click_20260508_143105.png
test-results/screenshots/ASSET-EVAL-001/step_5_click_FAILED_20260508_143106.png
```

#### 操作 2：记录响应数据（强制）

```json
{
  "step": 3,
  "action": "fill",
  "target": "用户名输入框",
  "mcp_response": {
    "tool": "fill",
    "params": { "uid": "e_123", "value": "***" },
    "result": "success",
    "timestamp": "2026-05-08T14:30:52.123Z"
  },
  "duration_ms": 245,
  "screenshot": "step_3_fill_20260508_143052.png"
}
```

#### 操作 3：评估断言结果（强制）

```yaml
assertion_result:
  type: field_filled
  expected: "字段已填写"
  actual: "成功填入值 ***"
  passed: true
  confidence: 0.95
  evidence:
    - snapshot_element_found: true
    - value_matches: true
```

### 2.3 步骤执行伪代码

```javascript
async function executeStep(step, index) {
  const startTime = Date.now();
  
  try {
    // 1. 动作解析
    const actionDef = loadActionDefinition(step.action);
    validateParams(step, actionDef);
    
    // 2. 元素定位（铁律 4）
    const element = await locateElement(step.target, step.locator);
    
    // 3. 执行前截图（可选）
    if (config.screenshotBeforeAction) {
      await screenshot(`step_${index}_${step.action}_before.png`);
    }
    
    // 4. 执行动作
    const response = await invokeMcpTool(actionDef.mcp, params);
    
    // 5. 操作后截图（强制！）
    const screenshotName = `step_${index}_${step.action}_${timestamp()}.png`;
    await screenshot(screenshotName);
    
    // 6. 记录响应数据
    const duration = Date.now() - startTime;
    recordStepData(index, {
      action: step.action,
      target: step.target,
      mcp_response: response,
      duration_ms: duration,
      screenshot: screenshotName
    });
    
    // 7. 断言验证
    const assertionResult = await evaluateAssertions(step.assertions);
    
    // 8. 结果汇总
    return {
      status: assertionResult.passed ? 'PASS' : 'FAIL',
      duration_ms: duration,
      assertion_result: assertionResult,
      screenshot: screenshotName
    };
    
  } catch (error) {
    // 错误处理：截图 + 记录 + 继续或停止
    const errorScreenshot = `step_${index}_${step.action}_ERROR_${timestamp()}.png`;
    await screenshot(errorScreenshot);
    
    recordError(index, error, errorScreenshot);
    
    return {
      status: 'ERROR',
      error: error.message,
      screenshot: errorScreenshot
    };
  }
}
```

### 2.4 强制要求清单

- [ ] 每个 step 执行后**必须**立即截图（即使操作失败也要截图留证）
- [ ] **必须**记录完整的 MCP 工具调用参数和返回值
- [ ] **必须**记录操作耗时（用于性能分析）
- [ ] **必须**评估断言通过/失败状态
- [ ] 所有数据**必须**写入执行报告
- [ ] 截图命名规范且可追溯（包含 step 编号、动作类型、时间戳）
- [ ] 失败时的截图文件名包含 `_FAILED` 或 `_ERROR` 后缀

---

## 铁律 3：深度网络校验（Deep Network Verification）

### 3.1 核心原则

**凡是涉及提交/保存/删除等改变数据的操作，必须通过网络工具监控 API 调用。**

不只看 UI 层面的成功提示，还要验证底层 API 是否真正被调用并返回正确结果。

### 3.2 触发条件

以下操作类型**必须**触发网络校验：

| 操作类型 | 必须校验的 API | 校验要点 |
|---------|--------------|---------|
| **表单提交** | POST /api/save | 请求体、响应码、响应时间 |
| **删除操作** | DELETE /api/{id} | 确认资源被删除 |
| **文件上传** | POST /api/upload | 文件大小、上传进度、响应 |
| **导出下载** | GET /api/export | 文件内容、Content-Type |

### 3.3 校验实现方式

```yaml
# 在 step 的 assertion 中定义网络校验
- step: 13
  desc: "点击提交按钮"
  action: click
  target: "提交按钮"
  assertion:
    # UI 层面断言
    - type: toast_visible
      expected: "保存成功"
    
    # 🔴 网络层断言（强制！）
    - type: network_called
      url_pattern: "/api/asset-eval/apply*"
      method: POST
      response_code: 200
      # 可选深度校验
      response_body_contains:
        - '"code":0'
        - '"message":"成功"'
      max_response_time: 3000  # ms
```

### 3.4 校验失败处理（假阳性识别）

如果网络校验失败（即使 UI 显示"成功"）：

```
❌ Step 13: 网络校验失败！

📊 详细信息:
  • 期望: 接口 /api/asset-eval/apply 返回 200
  • 实际: 接口未被调用 OR 返回 500
  • UI 显示: "保存成功" ← 这是假阳性！
  
💡 诊断建议:
  1. 可能前端做了乐观更新（先显示成功再发送请求）
  2. 请求可能被拦截器阻止（CORS、认证失败等）
  3. 后端服务可能异常（超时、数据库错误等）
  4. 网络问题（DNS解析失败、连接超时）
  
📸 证据:
  - 截图: step_13_click_failed.png
  - 网络日志: network_log_step_13.json
  - 控制台错误: console_errors.json
  
🔧 下一步:
  1. 检查浏览器控制台 Network 面板确认请求是否发出
  2. 验证后端服务状态和日志
  3. 检查前端代码的网络请求逻辑
  4. 如果是乐观更新问题，增加 wait_for 网络完成的步骤
```

**结论**：该步骤标记为 **FAILED**，即使 UI 断言通过。

### 3.5 网络校验实现伪代码

```javascript
async function verifyNetworkCall(assertion) {
  const networkRequests = await listNetworkRequests({
    resourceTypes: ['xhr', 'fetch']
  });
  
  const matchingRequests = networkRequests.filter(req => 
    req.url.match(new RegExp(assertion.url_pattern)) &&
    req.method === assertion.method
  );
  
  if (matchingRequests.length === 0) {
    return {
      passed: false,
      error: `未找到匹配的网络请求: ${assertion.method} ${assertion.url_pattern}`,
      evidence: { requestCount: 0 }
    };
  }
  
  const lastRequest = matchingRequests[matchingRequests.length - 1];
  
  const checks = [];
  
  // 检查响应码
  if (assertion.response_code) {
    checks.push({
      name: 'response_code',
      expected: assertion.response_code,
      actual: lastRequest.response.status,
      passed: lastRequest.response.status === assertion.response_code
    });
  }
  
  // 检查响应体（如果配置了）
  if (assertion.response_body_contains) {
    const responseBody = await getNetworkRequest(lastRequest.reqId).response.body;
    for (const pattern of assertion.response_body_contains) {
      checks.push({
        name: 'body_contains',
        expected: pattern,
        actual: responseBody.includes(pattern) ? 'found' : 'not found',
        passed: responseBody.includes(pattern)
      });
    }
  }
  
  // 检查响应时间
  if (assertion.max_response_time) {
    const duration = lastRequest.response.responseTime - lastRequest.request.startTime;
    checks.push({
      name: 'response_time',
      expected: `<${assertion.max_response_time}ms`,
      actual: `${duration}ms`,
      passed: duration <= assertion.max_response_time
    });
  }
  
  const allPassed = checks.every(c => c.passed);
  
  return {
    passed: allPassed,
    checks: checks,
    evidence: {
      requestId: lastRequest.reqId,
      url: lastRequest.url,
      method: lastRequest.method,
      timestamp: new Date(lastRequest.request.startTime).toISOString()
    }
  };
}
```

### 3.6 强制要求清单

- [ ] 提交/保存/删除操作**必须**定义 `network_called` 类型断言
- [ ] **必须**验证 API 的 URL、HTTP 方法、响应码
- [ ] **应该**检查响应体内容（如适用）
- [ ] **应该**检查响应时间（设置合理阈值）
- [ ] UI 显示成功但 API 失败时**必须**标记为 FAILED 并给出诊断
- [ ] 网络校验结果**必须**记录到报告中，包括完整的请求/响应信息
- [ ] 校验失败时**必须**提供可能的诊断建议

---

## 铁律 4：自愈而非放弃（Self-Healing, Not Give Up）

> 详细的自愈机制实现见 [self-healing-strategy.md](./self-healing-strategy.md)

本节提供铁律4的核心摘要，完整实现请参考专门文档。

### 4.1 核心原则

**当按照 target 描述找不到元素时，禁止直接报错终止。必须启动自愈程序。**

### 4.2 自愈流程（4级降级策略）

```
[Step N] 尝试定位目标: "新增申请按钮"
│
├─ Level 1: UID 缓存查找（最快, <1ms）
│  ├─ 查找 uid_cache_key 对应的缓存 UID
│  ├─ 如果命中且元素存在 → 使用缓存的 UID 执行
│  └─ 如果未命中或元素已消失 → 降级到 Level 2
│
├─ Level 2: 精确语义匹配（精确, ~50ms）
│  ├─ 调用 take_snapshot() 获取完整 DOM 树
│  ├─ 按照 target 文本精确匹配元素
│  ├─ 匹配规则: text === target OR aria-label === target
│  └─ 如果找到唯一匹配 → 执行并更新缓存
│      如果找到多个匹配或无匹配 → 降级到 Level 3
│
├─ Level 3: 模糊匹配（宽松, ~100ms）
│  ├─ 使用包含关系: element.text.includes(target关键词)
│  ├─ 使用角色匹配: element.role === inferRole(target)
│  └─ 选择置信度最高的候选元素（confidence > 0.7）
│      如果仍无合适候选 → 降级到 Level 4
│
└─ Level 4: AI 辅助（最后手段, ~500ms-2s）
   ├─ 将快照和 target 描述发送给 LLM
   ├─ LLM 分析 DOM 结构，推荐最佳元素
   └─ 如果 confidence > 0.6 → 使用推荐结果
       否则 → 自愈失败，记录详细诊断信息
```

### 4.3 自愈成功率目标

| 级别 | 预期命中率 | 适用场景 |
|------|-----------|---------|
| Level 1: UID缓存 | ~95%（复用时） | 之前成功定位过的元素 |
| Level 2: 精确匹配 | ~80% | 文本明确的静态元素 |
| Level 3: 模糊匹配 | ~65% | 文案有变化的动态元素 |
| Level 4: AI辅助 | ~55% | 其他级别都失败时的兜底 |

**整体自愈成功率目标 > 65%**

### 4.4 强制要求清单

- [ ] 元素未找到时**禁止**直接报错终止
- [ ] **必须**按顺序尝试所有4级降级策略
- [ ] **必须**记录每级的尝试过程和结果
- [ ] 自愈成功后**必须**更新UID缓存
- [ ] 自愈失败时**必须**提供详细的诊断信息和可能原因
- [ ] 自愈失败**不应该**影响其他步骤的执行（非致命错误）
- [ ] 所有自愈过程**必须**写入报告

---

## 铁律 5：报告完整性（Report Completeness）

### 5.1 核心原则

**执行完毕后，必须生成完整的 HTML 测试报告。**

报告是测试执行的最终交付物，必须包含足够的信息供人类审查和归档。

### 5.2 报告必须包含的内容

##### 基本信息
- 用例 ID、标题、优先级
- 执行时间、总耗时
- 执行者（AI Agent 版本）
- 浏览器信息（User-Agent 等）

##### 执行摘要
- 总步骤数、通过数、失败数、跳过数
- 通过率百分比
- 整体状态（PASS/FAIL/PARTIAL）

##### 详细步骤记录（每个 step 一节）

```
┌─────────────────────────────────────────┐
│ Step 3: 输入用户名                       │
│ ─────────────────────────────────────── │
│                                         │
│ 📝 描述: 在用户名输入框中填入 ${TEST_USER} │
│ 🎬 动作: fill                           │
│ 🎯 目标: 用户名输入框 (uid: e_123)       │
│                                         │
│ ⏱️  耗时: 245ms                         │
│ ✅ 状态: PASS                            │
│                                         │
│ 📸 截图:                                │
│ [step_3_fill.png]                        │
│                                         │
│ 🔍 断言结果:                             │
│ • field_filled: ✓ 通过                  │
│   期望: 字段已填写                       │
│   实际: 成功填入值 ***                   │
│                                         │
│ 📊 MCP 响应:                            │
│ { tool: "fill", result: "success" }     │
│                                         │
│ 💡 备注: 无                              │
└─────────────────────────────────────────┘
```

##### 失败步骤详情（如果有）

对于失败的步骤，额外提供：

```
❌ Step 13: 点击提交按钮
   失败原因: 网络校验未通过
   
   📋 错误详情:
   • UI 断言: ✓ 通过 (显示"保存成功")
   • 网络断言: ✗ 失败 (接口未被调用)
   
   🔍 诊断信息:
   • 期望调用: POST /api/asset-eval/apply
   • 实际情况: 未监测到该接口请求
   
   💡 可能原因:
   1. 前端做了乐观更新
   2. 请求被 CORS 拦截
   3. 后端服务异常
   
   📸 证据截图:
   - 操作前: before_step_13.png
   - 操作后: after_step_13.png
   - 错误现场: error_step_13.png
   
   🔧 修复建议:
   1. 检查浏览器控制台 Network 面板
   2. 验证后端服务状态
   3. 检查前端代码的网络请求逻辑
```

##### 统计图表
- 步骤通过/失败饼图
- 操作耗时柱状图
- 断言类型分布图

##### 附录
- 完整的环境变量使用记录（脱敏后）
- 网络请求日志摘要
- 控制台错误/警告日志
- UID 缓存变更记录（如有自愈发生）

### 5.3 报告输出位置

```bash
# 默认输出目录
test-results/reports/

# 文件命名规则
{test_id}_report_{timestamp}.html

# 示例
test-results/reports/ASSET-EVAL-001-apply-normal_report_20260508_143500.html
```

### 5.4 报告模板参考

HTML 报告模板位于 `templates/report-template.html`，使用现代化设计：
- 响应式布局（支持移动端查看）
- CSS 变量驱动的主题系统
- 支持截图缩略图点击放大
- 支持折叠/展开详细信息
- 支持打印和 PDF 导出（未来增强）

### 5.5 强制要求清单

- [ ] HTML 报告**必须**包含基本信息（ID、标题、时间、版本）
- [ ] **必须**有清晰的执行摘要（总步骤、通过率、状态）
- [ ] 每个 step **必须有**详细记录（描述、动作、目标、耗时）
- [ ] 失败步骤**必须有**详细的错误分析和诊断建议
- [ ] **必须**包含截图证据（缩略图+点击放大）
- [ ] **应该**包含统计图表和数据可视化
- [ ] **应该**包含附录（环境变量使用、网络日志等）
- [ ] 报告文件**必须**保存到指定目录并可追溯

---

## 📚 相关文档

- [自愈机制详解](./self-healing-strategy.md) - 铁律4的完整实现
- [错误处理与重试](./error-handling.md) - 异常情况的处理策略
- [CLI命令参考](./cli-reference.md) - 命令行接口完整文档
- [Testcase Modeler SKILL](../testcase-modeler/SKILL.md) - 上游建模技能
- [设计文档 v1.0](../../../docs/superpowers/specs/2026-05-08-pdd-test-skill-design.md)

---

> **维护者**: PDD Team
> **最后更新**: 2026-05-08
> **版本**: 1.0.1
