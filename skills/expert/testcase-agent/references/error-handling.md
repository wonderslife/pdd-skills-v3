# Testcase Agent - 错误处理与重试策略

> **版本**: 1.0.1
> **最后更新**: 2026-05-08
> **用途**: 定义测试执行过程中的错误分类、重试策略和处理流程

---

## 📖 目录

1. [错误分类体系](#错误分类体系)
2. [重试策略配置](#重试策略配置)
3. [各类错误的处理流程](#各类错误的处理流程)
4. [错误日志与报告](#错误日志与报告)
5. [最佳实践与反模式](#最佳实践与反模式)

---

## 错误分类体系

### 错误严重程度定义

| 严重程度 | 图标 | 默认行为 | 对测试结果的影响 | 可配置？ |
|---------|------|---------|----------------|--------|
| **致命 (Fatal)** | 💀 | 立即停止执行 | 整个测试标记为 ERROR | ❌ 不可覆盖 |
| **高 (High)** | 🔴 | 记录错误，继续下一步 | 该步骤标记为 FAIL | ⚠️ 可改为停止 |
| **中 (Medium)** | 🟡 | 重试（最多N次） | 重试成功则 PASS，否则 FAIL | ✅ 可调整重试次数 |
| **低 (Low)** | 🟢 | 记录警告，继续执行 | 该步骤标记为 WARN | ✅ 可忽略 |

### 错误类型详细说明

#### 1. 元素定位错误 (ElementNotFoundError)

**严重程度**: High

**触发条件**：
- 4级自愈策略全部失败
- 目标元素在页面中不存在

**示例**：
```
❌ Element not found: "提交按钮"
   Searched: Level 1 (cache miss) → Level 2 (no match) → 
            Level 3 (best similarity 32%) → Level 4 (AI confidence 0.42)
   Page: http://example.com/form
   Snapshot: snapshot_step_13.json
```

**默认行为**：
- 记录完整的自愈过程日志
- 截取当前页面截图
- 标记步骤为 FAILED
- **继续执行后续步骤**（非致命错误）

**可配置选项**：
```yaml
# cdp-test-config.yaml
error_handling:
  element_not_found:
    severity: "high"  # high | fatal
    continue_on_error: true  # true: 继续执行 | false: 停止
    auto_screenshot: true  # 自动截取错误现场
```

---

#### 2. 操作超时错误 (TimeoutError)

**严重程度**: Medium

**触发条件**：
- MCP工具调用超过配置的超时时间
- 页面加载/导航超时
- 等待元素出现超时

**示例**：
```
⏰ Timeout: click operation exceeded 10000ms
   Target: "提交按钮" (uid: e_789)
   Started: 2026-05-08T14:30:52.123Z
   Timeout: 10000ms
   Possible causes:
     - Page was unresponsive
     - Modal dialog blocking interaction
     - Network latency
```

**默认行为**：
- 自动重试（最多3次，指数退避）
- 每次重试前重新定位元素
- 重试全部失败后标记为 FAIL

**重试配置**：
```yaml
retry:
  max_attempts: 3
  backoff_strategy: "exponential"  # linear | exponential | fixed
  initial_delay: 1000ms  # 首次重试延迟
  max_delay: 10000ms     # 最大延迟
  multiplier: 2          # 指数退避倍数
  retryable_errors:
    - TimeoutError
    - ElementNotFoundError
    - NetworkError
  non_retryable_errors:
    - YAMLParseError
    - PermissionDeniedError
    - AssertionError  # 断言失败通常不重试
```

---

#### 3. 断言失败错误 (AssertionError)

**严重程度**: High

**触发条件**：
- UI层断言未通过
- 网络层断言未通过
- 自定义断言未通过

**示例**：
```
❌ Assertion failed: network_called
   Expected: POST /api/asset-eval/apply returns 200
   Actual: Request not made or returned 500
   
   UI Assertion: ✓ PASSED (toast visible: "保存成功")
   Network Assertion: ✗ FAILED (no matching request)
   
   Diagnosis: Possible optimistic update in frontend code
```

**默认行为**：
- **不重试**（断言失败通常意味着真实的问题）
- 记录详细的断言对比信息
- 如果是网络校验失败但UI通过，特别标注"假阳性"
- 标记步骤为 FAILED

**特殊处理**：
```yaml
# 对于某些可恢复的断言失败，可以启用重试
assertion_retry:
  enabled: false  # 默认关闭
  retryable_types:
    - text_contains  # 文本可能异步加载
    - element_visible  # 元素可能延迟渲染
  max_retries: 2
  delay_between_retries: 1500ms
```

---

#### 4. 网络异常错误 (NetworkError)

**严重程度**: Medium

**触发条件**：
- API请求失败（HTTP 5xx, 4xx）
- DNS解析失败
- 连接超时
- CORS错误

**示例**：
```
🌐 Network Error: Failed to fetch resource
   URL: http://api.example.com/data
   Status: 503 Service Unavailable
   Error: ERR_CONNECTION_REFUSED
   
   Impact: This may affect subsequent API-dependent steps
```

**默认行为**：
- 重试（最多3次）
- 每次重试间隔递增
- 记录完整的网络日志（请求头、响应头、响应体）
- 如果是与当前步骤无关的后台错误，仅记录警告

---

#### 5. MCP工具错误 (MCPToolError)

**严重程度**: High

**触发条件**：
- Chrome DevTools MCP工具调用失败
- 工具返回错误响应
- 参数验证失败

**示例**：
```
🔧 MCP Tool Error: fill failed
   Tool: mcp_Chrome_DevTools_MCP_fill
   Parameters: { uid: "e_123", value: "test" }
   Error: Element is not editable
   UID: e_123
   Suggestion: Verify the element is an input field, not a static text
```

**默认行为**：
- 不重试（通常是参数问题或工具限制）
- 记录完整的工具调用信息
- 尝试使用备用方案（如有）
- 标记步骤为 FAILED

**备用方案**：
```javascript
async function executeWithFallback(action, params) {
  try {
    return await primaryTool[action](params);
  } catch (primaryError) {
    log(`Primary tool failed: ${primaryError.message}`);
    
    if (fallbackTools[action]) {
      log("Trying fallback tool...");
      try {
        return await fallbackTools[action](params);
      } catch (fallbackError) {
        throw new CombinedError(primaryError, fallbackError);
      }
    }
    
    throw primaryError;
  }
}
```

---

#### 6. YAML格式错误 (YAMLParseError)

**严重程度**: Fatal

**触发条件**：
- YAML语法错误
- 必填字段缺失
- 字段格式不正确
- 循环引用

**示例**：
```
💀 Fatal: YAML Parse Error
   File: tests/login/portal-login.yaml
   Line: 15
   Error: Missing required field 'action' in step 3
   Context:
     steps:
       - step: 3
         desc: "输入用户名"
         target: "用户名输入框"
         # ↑ 缺少 'action' 字段
```

**默认行为**：
- **立即停止执行**
- 不执行任何步骤
- 输出详细的错误位置和修复建议
- 返回退出码 1（表示配置错误）

**预防措施**：
```javascript
function validateYAML(yamlContent) {
  const errors = [];
  
  // 检查必填字段
  if (!yamlContent.test_id) errors.push({ line: 1, error: "Missing 'test_id'" });
  if (!yamlContent.steps || yamlContent.steps.length === 0) errors.push({ line: 1, error: "Steps array is empty" });
  
  // 检查每个步骤
  yamlContent.steps.forEach((step, index) => {
    if (!step.action) errors.push({ line: step._lineNumber, error: `Step ${index}: Missing 'action'` });
    if (!step.desc) errors.push({ line: step._lineNumber, error: `Step ${index}: Missing 'desc'` });
    if (!step.assertion && !step.assertions) {
      errors.push({ warning: true, line: step._lineNumber, error: `Step ${index}: No assertion defined` });
    }
  });
  
  // 检查安全合规
  const sensitivePattern = /(password|token|secret)\s*:\s*"[^${]/i;
  if (sensitivePattern.test(yamlContent)) {
    errors.push({ severity: 'security', error: "Possible hardcoded sensitive data detected" });
  }
  
  return {
    valid: errors.filter(e => !e.warning && e.severity !== 'security').length === 0,
    errors
  };
}
```

---

## 重试策略配置

### 全局配置

```yaml
# cdp-test-config.yaml
retry:
  enabled: true
  max_attempts: 3
  backoff_strategy: "exponential"
  initial_delay: 1000ms
  max_delay: 10000ms
  multiplier: 2
  jitter: true  # 添加随机抖动避免惊群效应
  
  self_heal_before_retry: true  # 重试前先尝试自愈
  
  retryable_errors:
    - TimeoutError
    - ElementNotFoundError
    - NetworkError
    - ConnectionResetError
    
  non_retryable_errors:
    - YAMLParseError
    - PermissionDeniedError
    - AssertionError
    - AuthenticationError
    
  on_retry:
    log_level: "debug"  # 记录每次重试的详细信息
    screenshot: true     # 每次重试前截图
    wait_before: 500ms   # 重试前等待
```

### 重试执行流程

```
[Step N] 执行动作: click
│
├─ 尝试 1/3
│  ├─ 定位元素... ✓
│  ├─ 执行动作... ✗ TimeoutError (10000ms exceeded)
│  ├─ 记录错误日志
│  ├─ 截图: step_N_click_retry_1_ERROR.png
│  └─ 等待 1000ms (initial_delay)
│
├─ 尝试 2/3 (重试前自愈: true)
│  ├─ 重新定位元素 (缓存可能已失效)... ✓
│  ├─ 执行动作... ✗ TimeoutError (10000ms exceeded)
│  ├─ 记录错误日志
│  ├─ 截图: step_N_click_retry_2_ERROR.png
│  └─ 等待 2000ms (initial_delay × multiplier)
│
├─ 尝试 3/3
│  ├─ 重新定位元素... ✓
│  ├─ 执行动作... ✓ Success!
│  └─ 记录成功日志
│
└─ 结果: ✓ PASSED (第3次重试成功, 总耗时: 13500ms)
```

---

## 各类错误的处理流程

### 致命错误处理流程

```
Fatal Error Detected
       ↓
[立即停止执行]
       ↓
[清理资源]
  ├── 关闭打开的对话框/弹窗
  ├── 保存已执行的步骤数据
  └── 生成部分报告（标记为 ERROR）
       ↓
[输出错误摘要]
  ├── 错误类型和消息
  ├── 发生位置（文件名、行号、步骤号）
  ├── 修复建议
  └── 退出码: 1
```

### 高严重程度错误处理流程

```
High Severity Error Detected
       ↓
[记录错误详情]
  ├── 错误类型、消息、堆栈
  ├── 执行上下文（URL、快照、截图）
  └── 影响范围分析
       ↓
[判断: continue_on_error?]
  ├── YES → 标记步骤为 FAIL，继续下一步
  │         └── 在报告中突出显示失败步骤
  └── NO  → 停止执行，生成报告
              └── 类似致命错误处理
```

### 中严重程度错误处理流程（带重试）

```
Medium Severity Error Detected
       ↓
[判断: 是可重试错误?]
  ├── NO → 按高严重程度错误处理
  └── YES ↓
      
[开始重试循环]
  │
  ├─ for attempt = 1 to max_attempts:
  │   ├─ [可选] 重试前自愈
  │   ├─ [可选] 重试前截图
  │   ├─ [可选] 等待 delay 时间
  │   ├─ 重新执行动作
  │   │
  │   ├─ 成功 → ✓ 记录成功，跳出循环
  │   └─ 失败 → 记录错误，继续下一次尝试
  │
  ├─ [全部重试失败]
  │   ├─ 标记步骤为 FAIL
  │   ├─ 记录重试历史（每次的结果）
  │   └─ 继续或停止（根据配置）
  │
  └─ [任一重试成功]
      ├─ 标记步骤为 PASS（带注释：重试N次后成功）
      └─ 继续下一步
```

---

## 错误日志与报告

### 日志格式

```json
{
  "timestamp": "2026-05-08T14:30:52.123Z",
  "level": "ERROR",
  "test_id": "ASSET-EVAL-001-apply-normal",
  "step": 13,
  "action": "click",
  "error": {
    "type": "TimeoutError",
    "message": "Operation timed out after 10000ms",
    "code": "TIMEOUT",
    "stack": "..."
  },
  "context": {
    "url": "http://example.com/form",
    "target": "提交按钮",
    "uid": "e_789",
    "attempt": 2,
    "maxAttempts": 3
  },
  "evidence": {
    "screenshots": [
      "step_13_click_retry_2_ERROR.png"
    ],
    "snapshot": "snapshot_step_13_retry_2.json",
    "networkLog": "network_step_13.json"
  },
  "diagnosis": {
    "possibleCauses": [
      "Page unresponsive",
      "Modal dialog blocking",
      "Network latency"
    ],
    "suggestions": [
      "Check browser console for JavaScript errors",
      "Verify no modal dialogs are open",
      "Try increasing timeout for slow operations"
    ]
  }
}
```

### 报告中的错误展示

在 HTML 报告中，错误步骤会有特殊的视觉标识：

```
┌─────────────────────────────────────────┐
│ ❌ Step 13: 点击提交按钮                │
│    状态: FAILED (重试3次后仍失败)         │
│                                         │
│ 📋 错误摘要                             │
│ 类型: TimeoutError                      │
│ 消息: Operation timed out after 10000ms  │
│                                         │
│ 📊 重试历史                             │
│ 尝试 1: ✗ 失败 (10000ms)               │
│ 尝试 2: ✗ 失败 (10000ms)               │
│ 尝试 3: ✗ 失败 (10000ms)               │
│                                         │
│ 🔍 诊断信息                             │
│ • 可能原因 1: 页面无响应               │
│ • 可能原因 2: 弹窗阻挡交互             │
│ • 可能原因 3: 网络延迟                │
│                                         │
│ 📸 错误截图                             │
│ [step_13_click_RETRY3_ERROR.png]        │
│                                         │
│ 🔧 修复建议                             │
│ 1. 检查浏览器控制台的JavaScript错误      │
│ 2. 确认是否有弹窗或模态框开启          │
│ 3. 尝试增加超时时间或添加等待步骤       │
└─────────────────────────────────────────┘
```

---

## 最佳实践与反模式

### ✅ 最佳实践

1. **合理的超时设置**
   ```yaml
   # 好：根据操作类型设置不同超时
   navigate: { timeout: 30000 }  # 页面加载可能较慢
   fill: { timeout: 5000 }       # 表单填写通常很快
   click: { timeout: 10000 }     # 点击可能有动画延迟
   ```

2. **精准的错误分类**
   ```yaml
   # 好：区分不同类型的超时
   - type: navigation_timeout  # 页面导航超时
   - type: element_wait_timeout # 等待元素超时
   - type: action_timeout      # 动作执行超时
   ```

3. **有意义的重试策略**
   ```yaml
   # 好：只对临时性错误重试
   retryable:
     - TimeoutError      # 网络波动
     - NetworkError      # 服务暂时不可用
     - RateLimitError    # 限流（等待后可恢复）
   
   non_retryable:
     - AssertionError     # 业务逻辑错误
     - AuthError         # 认证失败（重试也没用）
   ```

4. **完善的错误证据**
   ```yaml
   # 好：每次错误都有完整的证据链
   evidence:
     screenshots: [before.png, after.png, error.png]
     snapshot: dom_tree.json
     console_logs: console.json
     network_logs: network.json
   ```

### ❌ 反模式

1. **无限重试**
   ```yaml
   # 差：max_attempts: -1 或很大的数字
   # 这会导致测试长时间卡住
   max_attempts: 100  # ❌ 太多了
   ```

2. **对所有错误都重试**
   ```yaml
   # 差：对AssertionError也重试
   # 这会掩盖真实的bug
   retryable_errors:
     - AssertionError  # ❌ 不要重试断言失败
   ```

3. **忽略错误继续执行**
   ```yaml
   # 差：continue_on_error: true 对所有错误
   # 这会导致报告不准确，无法发现问题
   error_handling:
     default: 
       continue_on_error: true  # ❌ 太宽松
   ```

4. **不记录错误上下文**
   ```
   // 差：只记录错误消息，没有上下文
   log.error("Click failed");  // ❌ 信息不足
   
   // 好：记录完整的执行上下文
   log.error({
     message: "Click failed",
     step: 13,
     target: "提交按钮",
     uid: "e_789",
     attempt: 2,
     url: currentPage.url,
     screenshot: "error.png"
   });  // ✅ 信息充分
   ```

---

## 📚 相关文档

- [铁律完整实现](./iron-rules-detail.md) - 铁律2（原子化执行）有相关内容
- [自愈机制详解](./self-healing-strategy.md) - 元素定位失败的处理
- [CLI命令参考](./cli-reference.md) - debug模式的错误排查命令

---

> **维护者**: PDD Team
> **最后更新**: 2026-05-08
> **版本**: 1.0.1
