# 输出规范与 YAML 格式速查

> 本文件为 testcase-modeler 的参考资料，按需加载。

## 文件命名规则

```
testcases/{module}/{scene}.yaml          # 测试用例
testcases/{module}/{scene}.env           # 配套环境变量（必选！）

示例:
testcases/login/portal-login.yaml
testcases/login/portal-login.env
testcases/asset-eval/apply-normal.yaml
testcases/asset-eval/apply-normal.env
```

## 目录组织建议

```
testcases/
├── README.md                      # 格式指南
├── examples/
│   ├── yaml-format-guide.md       # 完整格式参考
│   ├── asset-eval-apply.yaml      # 资产评估申请示例
│   ├── asset-eval-apply.env
│   ├── login-flow.yaml            # 登录流程示例
│   └── login-flow.env
├── login/
│   ├── portal-login.yaml
│   └── portal-login.env
├── asset-eval/
│   ├── apply-normal.yaml
│   ├── apply-normal.env
│   ├── apply-error.yaml
│   └── approve-flow.yaml
└── system-manage/
    ├── user-crud.yaml
    └── user-crud.env
```

## YAML 格式速查

```yaml
# 必填字段（规则 1）
test_id: "MODULE-NNN-scene-name"
title: "清晰的人类可读标题"
priority: "P0"
tags: ["标签"]

# 前置状态（规则 1 + 5）
context_check:
  login_url: "http://..."
  home_indicator: "首页特征"
  credentials:
    username: "${ENV_VAR}"
    password: "${ENV_VAR}"

# 步骤数组（规则 2 + 3 + 4 + 6）
steps:
  - step: 1
    desc: "步骤描述"
    action: "动作类型"
    target: "语义化描述"
    value: "值或${ENV_VAR}"        # fill 时使用
    option: "中文显示名"            # select_option 时使用
    locator:
      uid_cache_key: "key"         # 可选（P0 缓存）
    wait_after:                     # 可选
      type: navigation | time
      timeout: 5000
    assertion:                       # 规则 4（必填！）
      type: "断言类型"
      expected: "期望值"

# 后置清理（可选）
teardown:
  - action: screenshot
    name: "result.png"
```

## 与其他 Skill 的协作

### 下游：testcase-agent

生成的 YAML + .env 用例可直接交给 **testcase-agent** 执行：

```bash
# 方式 1：在对话中直接委托
"将这个用例交给 testcase-agent 执行"

# 方式 2：通过命令行
python tests/testcase-ai.py testcases/examples/asset-eval-apply.yaml
```

### 工具链关系

```
testcase-modeler (建模) → 生成 YAML + .env → testcase-agent (执行)
    → 调用 MCP Chrome DevTools → 操作页面 → 目标业务系统
```

### 最佳实践

- 每个 YAML 必须配对同名 .env 文件
- el-select 使用 select_option + 中文 option 名
- 数字输入框用 fill + placeholder 精确匹配
- 多次操作的同一元素务必用 uid_cache_key
- 重要业务流程准备正反两个用例（正常路径 + 异常路径）
- 用例控制在 5-15 步以内（过长考虑拆分）

## 常见问题 FAQ

**Q1: 下拉框选不上怎么办？**
A: 使用 `action: select_option` + 中文 option 名称（如 "市场法"）。框架会自动检测 readonly 并使用 JS DOM click 方式处理 Vue Element UI 的 el-select 组件。

**Q2: 数字输入框填不进去？**
A: 确保 target 使用的是 placeholder 文本（如 "请输入报送评估值"），而不是泛泛的 "金额输入框"。spinbutton 是独立的交互角色，需要精确匹配。

**Q3: 环境变量在哪里设置？**
A: 在与 YAML 同目录的 `.env` 文件中设置。执行时框架会自动加载。不再需要在代码中硬编码默认值。

**Q4: 如何处理动态元素（如验证码）？**
A: 在 context_check 中标记 `captcha_required: true`，Agent 执行时会提示人工干预。

**Q5: 生成的用例执行失败怎么办？**
A: 查看截图确认实际效果，检查 target 文本是否与页面一致，调整后重新执行。