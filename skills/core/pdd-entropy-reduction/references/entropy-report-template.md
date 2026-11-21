# 熵减报告模板

> 本模板用于标准化 PDD 熵减机制的审计报告输出

---

## 报告元信息

```yaml
report_id: ER-YYYYMMDD-HHMMSS
generated_at: YYYY-MM-DD HH:MM:SS
project: 项目名称
branch: 当前分支
commit: 当前提交哈希
auditor: pdd-entropy-reduction
```

---

## 一、评分总览

> 评分口径：**0-100，100 = 最有秩序**（高分 = 健康），与 SKILL.md 一致。

### 1.1 综合评分

| 维度 | 评分 (0-100) | 状态 | 趋势 |
|------|-------------|------|------|
| 文档一致性 | XX | 🟢/🟡/🟠/🔴 | ↑/↓/→ |
| 架构合规性 | XX | 🟢/🟡/🟠/🔴 | ↑/↓/→ |
| 代码质量 | XX | 🟢/🟡/🟠/🔴 | ↑/↓/→ |
| 技术债务 | XX | 🟢/🟡/🟠/🔴 | ↑/↓/→ |
| **综合评分** | **XX** | | |

### 1.2 评分状态说明

- 🟢 **优秀 (90-100)**: 维持现状，继续小额还贷
- 🟢 **良好 (70-89)**: 小幅改进即可
- 🟡 **一般 (50-69)**: 按计划清理
- 🟠 **警告 (30-49)**: 优先处理
- 🔴 **危急 (0-29)**: 紧急重构

### 1.3 评分计算公式

```
综合评分 = (文档评分 × 0.25) + (架构评分 × 0.30) + (代码评分 × 0.25) + (债务评分 × 0.20)

维度评分 = 100 - 100 × sqrt( min(1, 该维度扣分/KLOC ÷ 容忍密度) )
KLOC     = max(1, 参与扫描的代码总行数 / 1000)      # 1 KLOC 地板，防极小项目被放大

容忍密度（每 KLOC 扣分达到该值即归 0 分）：
  文档 6.0 / 架构 10.0 / 代码 45.0 / 债务 10.0
```

**为什么按规模归一化**：直接 `100 - 扣分累计` 会让中大型项目必然撞底——十几万行的项目里几十个长函数就扣满 100 分，「代码质量」恒为 0，既无区分度，也看不出「改一处能涨多少分」。归一化后表达的是**问题密度**：同样的问题密度，大项目不会比小项目更差；小项目里 1 处问题的影响则被如实放大。

**为什么用 sqrt 而不是线性**：线性在低密度区斜率过陡（密度 10/KLOC 就掉到 78 分），区分度全挤在高分区。sqrt 让整段区间都能拉开差距，同时保留「密度达到容忍值即归 0」的上界语义。

**校准依据**：容忍密度由三个真实项目的实测扣分密度标定（若依 v6 131 KLOC / pdd-test-system 16 KLOC / pdd-skills-v3 195 KLOC，code 密度分别为 37.6 / 41.1 / 26.7 分每 KLOC），使三者落在「一般 ~ 良好」档，与实际观感一致；密度需再翻 1~2 倍（问题密集成灾）才归 0 分。

---

## 二、文档一致性审计 (pdd-doc-gardener)

### 2.1 文档-代码不一致项

| 文档路径 | 代码路径 | 不一致类型 | 严重程度 | 建议操作 |
|---------|---------|-----------|---------|---------|
| docs/xxx.md | src/xxx.ts | API签名变更 | High | 更新文档 |
| ... | ... | ... | ... | ... |

### 2.2 过期TODO项

```markdown
- [ ] TODO: xxx (docs/api.md:45) - 创建于 2025-01-15，已过期 60 天
- [ ] FIXME: xxx (src/service.ts:120) - 创建于 2025-02-01，已过期 45 天
```

### 2.3 孤立文档

| 文档路径 | 原因 | 建议操作 |
|---------|------|---------|
| docs/deprecated/xxx.md | 对应代码已删除 | 归档或删除 |
| ... | ... | ... |

---

## 三、架构合规性审计 (expert-arch-enforcer)

### 3.1 依赖方向违规

```
违规: Service 层直接引用 UI 层
  - src/service/UserService.ts → src/ui/components/UserForm.tsx
  - 违反六层模型: Types → Config → Repo → Service → Runtime → UI
  - 建议: 通过事件或接口解耦
```

### 3.2 边界穿透

| 违规类型 | 位置 | 描述 | 修复建议 |
|---------|------|------|---------|
| 跨层调用 | UserService.ts:45 | Service直接访问UI组件 | 使用事件机制 |
| 循环依赖 | A.ts ↔ B.ts | 模块间循环引用 | 引入接口层 |

### 3.3 架构约束检查结果

```yaml
constraints_checked:
  - name: 六层依赖模型
    status: PASS/FAIL
    violations: X
  
  - name: 单向数据流
    status: PASS/FAIL
    violations: X
  
  - name: 接口隔离
    status: PASS/FAIL
    violations: X
```

---

## 四、熵增审计 (expert-entropy-auditor)

### 4.1 PRD-代码一致性

| PRD需求 | 实现状态 | 偏差描述 | 优先级 |
|--------|---------|---------|--------|
| 用户登录功能 | ✅ 已实现 | - | - |
| 数据导出功能 | ⚠️ 部分实现 | 缺少PDF导出 | Medium |
| 权限管理 | ❌ 未实现 | 需要补充 | High |

### 4.2 AI残渣检测

| 类型 | 位置 | 描述 | 清理建议 |
|------|------|------|---------|
| 猜测的数据结构 | types/guess.d.ts | 未使用的类型定义 | 删除 |
| 重复的辅助函数 | utils/helper.ts | 与 common/utils.ts 重复 | 合并 |
| 硬编码配置 | config.ts:23 | 应提取到配置文件 | 重构 |

### 4.3 重复代码检测

```
重复代码块 #1 (相似度: 95%)
  - src/service/UserService.ts:100-150
  - src/service/AdminService.ts:80-130
  - 建议: 提取公共方法 handleEntityList()
```

---

## 五、技术债务统计 (expert-auto-refactor)

### 5.1 债务清单

| ID | 类型 | 位置 | 预估工时 | 利息率 | 状态 |
|----|------|------|---------|--------|------|
| TD-001 | 代码重复 | UserService.ts | 2h | High | 待处理 |
| TD-002 | 复杂度过高 | DataProcessor.ts | 4h | Medium | 待处理 |
| TD-003 | 命名不规范 | legacy/*.ts | 1h | Low | 待处理 |

### 5.2 债务存量趋势（存量越低越好，与 1.1 的评分方向相反）

```
技术债务趋势 (近30天)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Week 1: ████████░░░░░░░░░░░░ 40 (新增 5, 偿还 2)
Week 2: ██████████░░░░░░░░░░ 50 (新增 8, 偿还 3)
Week 3: ████████░░░░░░░░░░░░ 42 (新增 2, 偿还 10)
Week 4: ██████░░░░░░░░░░░░░░ 35 (新增 1, 偿还 8)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
趋势: 📉 下降 (良好)
```

### 5.3 建议的"小额还贷"任务

```markdown
### 本周建议偿还任务 (预计 4 小时)

1. **TD-001**: 提取 UserService 和 AdminService 的公共方法
   - 预计时间: 2h
   - 影响: 减少 50 行重复代码
   - 风险: 低

2. **TD-003**: 重命名 legacy 目录中的不规范变量
   - 预计时间: 1h
   - 影响: 提高代码可读性
   - 风险: 低 (仅重命名)

3. **新增**: 将硬编码配置提取到配置文件
   - 预计时间: 1h
   - 影响: 提高可维护性
   - 风险: 低
```

---

## 六、改进建议

### 6.1 立即处理 (Critical)

```markdown
1. [架构] 修复 Service → UI 的直接依赖
   - 违规位置: UserService.ts:45
   - 修复方案: 引入事件总线
   - 预计时间: 2h

2. [文档] 更新 API 文档中的签名变更
   - 影响范围: 3 个接口
   - 预计时间: 1h
```

### 6.2 本周处理 (High)

```markdown
1. [债务] 提取重复代码
   - 影响: UserService, AdminService
   - 预计时间: 2h

2. [AI残渣] 清理未使用的类型定义
   - 文件: types/guess.d.ts
   - 预计时间: 0.5h
```

### 6.3 持续改进 (Medium)

```markdown
1. 建立定期熵减审计机制 (每周一次)
2. 将评分指标纳入代码评审流程
3. 为新功能开发添加评分预检
```

---

## 七、附录

### 7.1 审计范围

```
扫描目录:
  - docs/ (文档目录)
  - src/ (源代码目录)
  - tests/ (测试目录)
  - .trae/ (配置目录)

排除目录:
  - node_modules/
  - dist/
  - .git/
  - .venv/ venv/ site-packages/   (虚拟环境与第三方依赖)
  - target/                        (Maven 构建产物)
```

### 7.2 审计配置

```yaml
score_bands:            # 综合评分 0-100，100 = 最有秩序
  excellent: 90         # >= 90  🟢 优秀
  good: 70              # >= 70  🟢 良好
  fair: 50              # >= 50  🟡 一般
  warning: 30           # >= 30  🟠 警告
                        # <  30  🔴 危急

scale_tolerance:        # 每 KLOC 扣分达到该值即该维度归 0（见 1.3）
  doc: 6.0
  arch: 10.0
  code: 45.0
  debt: 10.0

min_kloc: 1.0           # 规模地板，防极小项目被放大

scan_frequency: weekly

auto_fix_enabled: false

notification:
  channels:
    - email
    - slack
  recipients:
    - tech-lead@company.com
```

### 7.3 历史对比

| 报告日期 | 综合评分 | 变化 | 主要改进 |
|---------|---------|------|---------|
| 2025-03-01 | 45 | - | 基线报告 |
| 2025-03-08 | 48 | ↑3 | 清理AI残渣 |
| 2025-03-15 | 52 | ↑4 | 重构重复代码 |
| 2025-03-22 | XX | ? | 本次报告 |

---

## 八、报告生成信息

```yaml
generator: pdd-entropy-reduction v2.0
sub_skills_used:
  - pdd-doc-gardener
  - expert-arch-enforcer
  - expert-entropy-auditor
  - expert-auto-refactor

execution_time: XX seconds
files_scanned: XXX
issues_found: XX

next_audit: YYYY-MM-DD
```

---

> 📌 **备注**: 本报告由 PDD 熵减机制自动生成，建议在团队周会上讨论关键问题并分配改进任务。
