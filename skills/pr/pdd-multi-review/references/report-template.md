# 多轮审查报告模板 (Review Report Template)

## 审查报告模板

```markdown
# 多轮审查报告

## 审查概要
| 项目 | 内容 |
|------|------|
| 功能点ID | FP-ZCCZ1-001 |
| 功能名称 | 国有产权转让申请 |
| 审查时间 | 2026-03-31 11:00:00 - 11:30:00 |
| 审查范围 | 15个文件 |

## 问题统计
| 轮次 | Critical | Warning | Suggestion | 合计 |
|------|----------|---------|------------|------|
| 第一轮：规则检查 | 0 | 5 | 10 | 15 |
| 第二轮：AI审查 | 2 | 8 | 15 | 25 |
| 第三轮：交叉验证 | 1 | 3 | 5 | 9 |
| **合计** | **3** | **16** | **30** | **49** |

## Critical问题详情
### ISS-001: 转让底价验证逻辑错误
| 属性 | 内容 |
|------|------|
| 来源 | 第二轮：AI审查 |
| 类别 | 业务逻辑 |
| 文件 | EquityTransferApplyServiceImpl.java |
| 行号 | 45-50 |
| 描述 | 转让底价验证逻辑错误，应该大于等于评估价值 |
| 预期 | 转让底价 >= 评估价值 |
| 实际 | 转让底价 > 评估价值（缺少等于的情况） |
| 建议 | 修改为 >= 判断 |

**代码片段**：
```java
// 当前代码
if (transferFloorPrice > evaluationValue) {
    throw new BusinessException("转让底价不得低于评估价值");
}
// 建议修改
if (transferFloorPrice < evaluationValue) {
    throw new BusinessException("转让底价不得低于评估价值");
}
```

## Warning问题列表
| ID | 来源 | 类别 | 文件 | 描述 |
|----|------|------|------|------|
| W-001 | 第一轮 | 代码风格 | Entity.java | 变量名不符合驼峰命名规范 |
| W-002 | 第二轮 | 代码质量 | ServiceImpl.java | 方法过长，建议拆分 |

## Suggestion问题列表
| ID | 来源 | 类别 | 文件 | 描述 |
|----|------|------|------|------|
| S-001 | 第一轮 | 代码风格 | Controller.java | 建议添加接口注释 |

## 验证结果
### 接口完整性验证
| 接口 | 规格 | 实现 | 状态 |
|------|------|------|------|
| POST /equity-transfer | 新增申请 | ✅ 已实现 | 通过 |
| GET /equity-transfer/{id} | 查询详情 | ✅ 已实现 | ⚠️ 返回值不完整 |

### 数据模型一致性验证
| 字段 | 数据库 | 实体类 | 状态 |
|------|--------|--------|------|
| id | bigint | Long | 通过 |
| remark | varchar | - | ⚠️ 缺失 |

### 业务规则正确性验证
| 规则ID | 规则描述 | 实现状态 | 验证结果 |
|--------|---------|---------|---------|
| BR-001 | 转让底价 >= 评估价值 | ✅ 已实现 | ❌ 逻辑错误 |

## 审查结论
| 结论 | 内容 |
|------|------|
| 是否通过 | ❌ 不通过 |
| 原因 | 存在3个Critical问题需要修复 |
| 下一步 | 修复Critical问题后重新审查 |

## 修复建议
1. **ISS-001**: 修改转让底价验证逻辑
2. **ISS-002**: 添加权限注解
3. **ISS-003**: 补充附件列表返回
```

## 问题记录格式

```yaml
id: ISS-001
round: 2  # 审查轮次
level: Critical
category: 业务逻辑
location: { file: EquityTransferApplyServiceImpl.java, line: 45-50 }
description: 转让底价验证逻辑错误，应该大于等于评估价值
expected: 转让底价 >= 评估价值
actual: 转让底价 > 评估价值（缺少等于的情况）
suggestion: 修改为 >= 判断
status: open
assignee: AI
history: [{ action: created, timestamp: ... }, { action: assigned, timestamp: ... }]
```

## 反馈循环流程

```
发现问题 → 问题分类与优先级排序(Critical优先) → 问题分配(自动/AI/人工修复)
→ 执行修复(记录过程/更新代码/标记状态) → 验证修复(重跑检查/确认解决/查新问题)
→ 所有问题解决 → 关闭问题(更新状态/记录历史/生成最终报告)
```

## 问题修复记录模板

```yaml
问题修复记录:
  问题ID: ISS-001
  修复人: AI
  修复时间: 2026-03-31T12:00:00Z
  修复前代码: |
    if (transferFloorPrice > evaluationValue) {
        throw new BusinessException("转让底价不得低于评估价值");
    }
  修复后代码: |
    if (transferFloorPrice < evaluationValue) {
        throw new BusinessException("转让底价不得低于评估价值");
    }
  验证结果: 通过
  验证人: AI
  验证时间: 2026-03-31T12:05:00Z
  备注: 修改判断条件为正确的逻辑
```