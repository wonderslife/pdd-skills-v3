# ZCCZ-1 股权转让 - 输出快照

> 本文件记录了 expert-testcases 技能生成 ZCCZ-1 测试用例集时的输出结果

---

## 一、生成摘要

| 属性 | 值 |
|------|-----|
| 生成时间 | 2026-04-17 |
| 总用例数 | 97 |
| 可运行pytest函数 | 63 |
| 文档文件 | 7 |
| 代码文件 | 12 |

---

## 二、各层级输出

### 2.1 API层 (Level 1)

| 文件 | 用例数 | pytest函数数 |
|------|--------|-------------|
| docs/01-api-testcases.md | 42 | - |
| 01-api-testcases/test_a01_a05_crud.py | - | 21 |
| 01-api-testcases/test_a06_a08_utils.py | - | 9 |
| 01-api-testcases/test_a09_approval.py | - | 15 |
| 01-api-testcases/test_a10_a13_export.py | - | 8 |

**用例分布**：
- CRUD操作: 21个 (A01-A05 × 正向+权限+异常)
- 工具API: 9个 (A06-A08 × 正向+异常)
- 审批操作: 15个 (A09 × 各角色+各动作)
- 查询导出: 8个 (A10-A13 × 正向+权限)

### 2.2 集成层 (Level 2)

| 文件 | 用例数 | pytest函数数 |
|------|--------|-------------|
| docs/02-integration-testcases.md | 10 | - |
| 02-integration-testcases/test_i001_i005_workflow.py | - | 5 |
| 02-integration-testcases/test_i006_i010_consistency.py | - | 5 |

**用例分布**：
- 工作流集成: 5个 (完整链路+驳回重提+终止+跨角色+文件上传)
- 数据一致性: 5个 (创建查询+权限隔离+状态一致+审批历史+文件关联)

### 2.3 E2E层 (Level 4)

| 文件 | 用例数 |
|------|--------|
| docs/04-e2e-testcases.md | 5 |

**用例列表**：
- E001: Happy Path - 完整审批通过
- E002: Rejection Path - 驳回重提
- E003: Termination Path - 终止流程
- E004: Cross-Dept Isolation - 跨部门数据隔离
- E005: Concurrent Approval - 并发审批竞态

### 2.4 边界异常层 (Level 5)

| 文件 | 用例数 |
|------|--------|
| docs/05-boundary-exception-testcases.md | 20 |

**用例分布**：
- 空值/Null: 3个
- 越界值: 3个
- 格式错误: 2个
- 权限边界: 2个
- 数据依赖: 2个
- 并发冲突: 3个
- 工作流异常: 3个
- 文件类型: 2个

### 2.5 性能层 (Level 6)

| 文件 | 用例数 |
|------|--------|
| docs/06-performance-testcases.md | 8 |

**用例分布**：
- 响应时间: 2个 (列表+详情)
- 并发测试: 2个 (并发查询+并发创建)
- 数据量: 2个 (大分页+大数据导出)
- 稳定性: 2个 (持续操作+混合负载)

### 2.6 UI层 (Level 3)

| 文件 | 用例数 |
|------|--------|
| docs/03-ui-testcases.md | 12 |

---

## 三、测试数据

| 数据类型 | 数量 |
|---------|------|
| 测试用户 | 5 |
| 表单数据变体 | 4 |
| 审批操作数据 | 3 |
| 文件数据 | 3 |
| 工作流节点 | 5 |
| 状态码 | 10 |
| API端点 | 13 |

---

## 四、覆盖率预估

| 维度 | 目标 | 预估 |
|------|------|------|
| API端点覆盖 | 100% | 100% (13/13) |
| 权限场景覆盖 | ≥95% | 95.4% (62/65) |
| 状态转移覆盖 | ≥90% | 91.7% (22/24) |
| 代码行覆盖 | ≥80% | 待运行 |
| 分支覆盖 | ≥70% | 待运行 |

---

## 五、优先级分布

| 优先级 | 用例数 | 占比 |
|--------|--------|------|
| P0 | 47 | 48.5% |
| P1 | 29 | 29.9% |
| P2 | 21 | 21.6% |

---

## 六、文件清单

```
asset-testcases/ZCCZ-1-equity-transfer/
├── test-data.yaml
├── README.md
├── docs/
│   ├── 01-api-testcases.md
│   ├── 02-integration-testcases.md
│   ├── 03-ui-testcases.md
│   ├── 04-e2e-testcases.md
│   ├── 05-boundary-exception-testcases.md
│   └── 06-performance-testcases.md
├── 01-api-testcases/
│   ├── conftest.py
│   ├── config.py
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── README.md
│   ├── test_a01_a05_crud.py
│   ├── test_a06_a08_utils.py
│   ├── test_a09_approval.py
│   └── test_a10_a13_export.py
└── 02-integration-testcases/
    ├── conftest.py
    ├── config.py
    ├── pytest.ini
    ├── requirements.txt
    ├── README.md
    ├── test_i001_i005_workflow.py
    └── test_i006_i010_consistency.py
```
