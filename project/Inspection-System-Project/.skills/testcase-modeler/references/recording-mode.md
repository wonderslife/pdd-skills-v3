# 交互式录制模式与工作流程（v2.0）

> 本文件为 testcase-modeler 的参考资料，按需加载。

## 交互式录制模式

除了自然语言描述→YAML 的建模方式，testcase-modeler 还支持浏览器操作录制→YAML 模式。

### 使用方式

```bash
# 方式1：录制到默认路径
python tests/testcase-ai.py --record

# 方式2：录制到指定路径
python tests/testcase-ai.py --record testcases/01-系统状况/my-test.yaml
```

### 录制流程

```
1. 启动录制器: python testcase-ai.py --record
   [1/4] 连接浏览器 ✅ → [2/4] 注入事件监听器 ✅
2. 用户在浏览器中操作（点击/输入/导航）
   终端实时显示操作步骤:
     [01] 点击'用户名输入框'
     [02] 填写'用户名输入框'为'test_user'
     [03] 填写'密码输入框'为'******'
3. 按 Enter 停止录制
   自动生成: testcases/recorded/testcase.yaml + testcase.env
```

### 录制能力

| 可录制的事件 | 转换结果 | 说明 |
|------------|---------|------|
| **点击** (click) | `action: click` + `target` | 按钮、链接、菜单项 |
| **输入** (input/change) | `action: fill` + `target` + `value` | 文本框、数字框 |
| **导航** (pushState) | `action: navigate` + `url` | 页面跳转 |
| **Enter 键** | 忽略（通常伴随 submit） | 表单提交 |

### 技术原理

```
1. evaluate_script 注入 JS 事件监听器到页面
   → document.addEventListener('click'/'input', ...)
   → history.pushState 劫持（捕获导航）
2. 每 1.5 秒轮询 POLL_JS 提取新事件 → 实时显示到终端
3. 用户按 Enter 触发 STOP_JS → 收集事件 → _event_to_step() 转换
   → yaml.dump() 写入文件 + .env 配对生成
```

### 适用场景

| 场景 | 推荐方式 |
|------|---------|
| 已知业务流程，快速生成用例 | 自然语言描述（Modeler） |
| **未知流程，边操作边记录** | **🎬 录制模式（推荐）** |
| 复杂多步操作，难以文字描述 | **🎬 录制模式（推荐）** |
| 首次接触的新功能探索性测试 | **🎬 录制模式（推荐）** |
| 需要精确元素定位信息 | **🎬 录制模式（推荐）** |

### 录制后优化建议

1. **补充断言**：每个关键步骤添加 `assertion`
2. **优化 target 文本**：录制的 target 可能不够语义化，改为业务语言
3. **添加 wait_after**：导航和提交后添加等待策略
4. **环境变量化**：将硬编码值替换为 `${VAR}` 引用
5. **添加 context_check**：补全前置状态感知配置
6. **拆分长用例**：超过 15 步考虑拆分为多个用例

## 完整交互流程

```
1. 用户发起 → 2. 信息收集(Clarification: 确认模块/起始状态/测试数据/预期结果)
   → 3. 意图分析(Intent Analysis: 解析操作序列→匹配动作类型→识别实体→推断隐含步骤→识别特殊组件)
   → 4. YAML + .env 生成(遵循7条规则)
   → 5. 确认与导出(展示摘要→用户确认/修改→导出到 testcases/ 目录)
```

## 对话示例

**示例 1：简单场景**
> 用户: 帮我写一个登录统一门户的测试用例
> AI: 确认信息（登录URL/账号/页面特征）→ 生成 login-flow.yaml + login-flow.env → 询问是否查看或导出

**示例 2：复杂场景（含特殊组件）**
> 用户: 我要测试资产评估核准的申请流程: 登录→进入资产评估系统→核准申请→填表→选评估方法"市场法"→提交验证
> AI: 分析后给出用例结构预览（模块/场景/步骤数/关键校验点/注意事项）→ 生成完整 YAML + .env