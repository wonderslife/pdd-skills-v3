# 测试用例 (Test Cases)

本目录存放 YAML 格式的测试用例文件，由 `tests/testcase-ai.py` 引擎驱动执行。

## 文件列表

| 文件 | 说明 | 步骤数 |
|------|------|--------|
| `login-flow.yaml` | 统一门户登录流程 | 4 |
| `asset-eval-apply.yaml` | 资产评估申请提交流程 | 13 |
| `asset-eval-approval-flow.yaml` | 资产评估审批流程 | - |

## 目录结构

```
testcases/
├── login-flow.yaml              # 登录用例
├── asset-eval-apply.yaml       # 申请用例
├── asset-eval-approval-flow.yaml # 审批用例
├── examples/                    # 样例与格式文档
│   └── yaml-format-guide.md    # YAML 字段详解
└── README.md                   # 本文件
```

## 执行方式

```bash
cd tests
python testcase-ai.py ../testcases/login-flow.yaml
python testcase-ai.py ../testcases/asset-eval-apply.yaml
```

## YAML 格式规范

每个测试用例文件是一个 YAML 文档，包含以下顶层字段：

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `test_id` | string | 唯一标识符，如 `"ASSET-EVAL-001-apply-normal"` |
| `title` | string | 测试用例标题 |
| `steps` | list | 测试步骤列表（核心） |

### 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `priority` | string | `"P1"` | 优先级: P0/P1/P2/P3 |
| `tags` | list | `[]` | 标签，用于分类筛选 |
| `author` | string | `""` | 作者 |
| `smart_skip` | bool | `true` | 是否启用智能登录跳过 |
| `context_check` | dict | `{}` | 前置状态感知配置 |
| `teardown` | list | `[]` | 后置清理操作 |

### 步骤 (step) 结构

每个 step 是一个操作单元：

```yaml
- step: 1                    # 步骤编号（从1开始）
  desc: "打开登录页面"        # 步骤描述
  action: navigate          # 操作类型
  url: "http://..."         # 操作参数（因action而异）
  wait_after:               # 操作后等待
    type: navigation
    timeout: 5000
  assertion:                # 断言验证
    type: text_contains
    expected: "欢迎登录"
```

详细格式说明请参阅 [examples/yaml-format-guide.md](examples/yaml-format-guide.md)。
