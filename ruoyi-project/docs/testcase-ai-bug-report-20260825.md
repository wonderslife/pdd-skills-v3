# testcase-ai.py 缺陷排查报告（全组件表单压测）

> 报告日期：2026-08-25 | 状态：**已修复并验证** | 触发场景：PRESALE-200 全组件表单 E2E 压测

---

## 一、测试背景与总体结果

**测试对象**：`plus-ui/src/views/presale/presalegoods/form.vue`（16 类 Element Plus 控件测试表单）

**执行工具**：`tests/testcase-ai.py`（Python MCP 客户端 + chrome-devtools-mcp）

**用例**：`PRESALE-200-form-components.yaml`（31 步：登录 → 16 类控件操作 → 提交 → 列表验证）

**最终结果**：`通过 30 / 失败 0 / 通过率 100%`，数据库落库验证通过（`E2E全组件表单压测-0825`，定金 20 / 尾款 80 / 限购 5 / 库存 10）

**过程对比**：

| 阶段 | 通过率 | 说明 |
|------|--------|------|
| 首次运行（修复前） | 69%（20/9/1） | 登录失败连锁 + 多组件操作失败，且**部分失败被吞为假通过** |
| 修复 A/B/C 后 | 93% | 断言如实反映，暴露真实失败（提交未成功、列表验证假通过） |
| 修复 D/E/F/G + 页面 H/I 后 | 100% | 全链路真实通过，数据库确凿验证 |

---

## 二、Bug 清单总览

| # | 层级 | 严重度 | Bug 简述 |
|---|------|--------|---------|
| A | testcase-ai.py | 🔴 高 | uid 定位失败时直接调 MCP → 报 `-32602 Required at uid`（错误不可读） |
| B | testcase-ai.py | 🔴 高 | `wait_for` 只读 `text` 字段不读 `target` → 空文本立即匹配，**列表验证假通过** |
| C | testcase-ai.py | 🔴 高 | 断言失败被吞为 success（toast_visible 不属关键断言）→ **假通过** |
| D | testcase-ai.py | 🟡 中 | el-checkbox/el-switch 的 input 是 0×0+透明，MCP 判"不可交互"点不动 |
| E | testcase-ai.py | 🟡 中 | el-select picker 选项找不到时仍返回成功（假成功） |
| F | testcase-ai.py | 🔴 高 | select_option fallback"取第一个控件"→ **把品牌"华为"填进商品标题框**（数据污染） |
| G | testcase-ai.py | 🟡 中 | `_handle_wait` 1s 硬截断 → wait_after 2s+ 不生效（列表刷新未等到） |
| H | gen-ruoyi.mjs / form.vue | 🔴 高 | form.vue 模板 ref（`presalegoodsRef`）与 script ref（`formRef`）**名不匹配** → 提交静默无反应 |
| I | gen-ruoyi.mjs | 🔴 高 | 列表表格缺业务列（只有编号/创建时间）→ 商品标题不显示，**列表验证一直是假通过** |

---

## 三、详细 Bug 分析（现象 / 根因 / 修复 / 验证）

### Bug A：uid 定位失败报 MCP 参数错误

- **现象**：定位不到目标元素时（如 radio/checkbox/switch 语义不匹配），控制台报 `MCP error -32602: Input validation error: Invalid arguments for tool click: Required at uid`，无法判断是"找不到元素"还是"调用错误"。
- **根因**：`execute()` 对 `needs_uid` 动作，`arg_builder` 未返回 `uid` 时仍调用 MCP 工具 → MCP 参数校验失败。
- **修复**（tests/testcase-ai.py，`execute` 内）：uid 缺失时直接构造 `StepResult(FAILED)`，错误信息 `未定位到目标元素: target='xxx'（快照中无匹配，请检查页面结构或 target 文案）`，附当前快照。
- **验证**：定位失败场景错误可读、带快照可排查。

### Bug B：wait_for 空文本假通过（**核心假通过源**）

- **现象**：`wait_for` 步骤参数显示 `"text": [""]`，`Element matching one of [""] found` 立即返回——任何页面都"找到"，步骤 30 列表验证实际没验证任何东西。
- **根因**：`_build_wait_for_args` 只读 `step.get("text")`，而 YAML 规范用 `target:` 字段 → 空文本。
- **修复**：text 读取加 target 兜底：`step.get("text", step.get("target", ""))`。
- **验证**：`"text": ["E2E全组件表单压测-0825"]` 正确传递，真正等待目标出现。

### Bug C：断言失败被吞为 success

- **现象**：步骤 28 提交后 toast「新增成功」断言失败（`Toast '新增成功' not visible`），但步骤仍标记 success，报告显示"100% 通过"——**纯假象**。
- **根因**：`critical_fail` 只认 `confidence=high` 且类型限 text_contains/url_contains/element_visible，**toast_visible 不在列**；非关键断言失败仅 log 不改变步骤状态。
- **修复**：
  1. `toast_visible` 加入关键断言类型；
  2. 任何断言失败 → 步骤标记 `FAILED_ASSERT`（流程继续，但如实反映）。
- **验证**：提交失败/列表未出现时报告如实显示 failed_assert。

### Bug D：el-checkbox / el-switch 点击不可交互

- **现象**：`click` 定位到 checkbox/switch 的 uid，但 MCP 报 `Failed to interact with the element ... did not become interactive`，重试 3 次全失败。
- **根因**：Element Plus 的 checkbox/switch 真实 input 是 `0×0 + opacity:0` 的隐藏元素（已用 JS 验证 `getBoundingClientRect() = {width:0, height:0}`），MCP 判定不可交互。
- **修复**（execute 内新增降级）：MCP click 失败且错误含 "did not become interactive" 时，用 `evaluate_script` 执行 DOM 原生点击，三策略：
  1. `.el-form-item` 的 label 精确匹配 → 点内部 `.el-switch/.el-checkbox/.el-radio/.el-rate/.el-slider/button`；
  2. 控件自身文本匹配（`.el-checkbox` 等 innerText 含目标）；
  3. 任意叶子文本元素精确匹配。
- **验证**：checkbox「正品保障」、switch「上架状态」等点击降级成功（日志 `[dom-fallback] clicked-*`）。

### Bug E：el-select picker 选项未找到仍假成功

- **现象**：picker JS 找不到选项（返回 `ok:false`）时，`_execute_readonly_picker_select` 仍返回"picker selected"成功样式 → 假成功。
- **根因**：JS 结果未解析，无论成败都 return 成功列表。
- **修复**：解析 JS 返回 JSON（`_parse_json_from_mcp_response`），`ok:false` 时返回 None → 走 MCP fill 兜底（不再假成功）。
- **验证**：选项缺失时正确降级。

### Bug F：select_option 危险 fallback 数据污染（**最危险 bug**）

- **现象**：提交后快照显示 `textbox "* 商品标题" value="华为"`——**品牌"华为"被填进了商品标题框**，标题被覆盖导致提交数据错误。
- **根因**：`_build_select_option_args` 定位失败后 fallback `find_all_by_role(textbox/combobox)` 取**第一个**控件——弹窗里第一个 textbox 正是"商品标题"。
- **修复**：
  1. 删除"取第一个控件"fallback，改为 combobox 精确匹配 → 无角色精确匹配；
  2. el-select（combobox）统一走 JS picker（不再仅限 is_readonly）。
- **验证**：提交后快照 `商品标题 value="E2E全组件表单压测-0825"` 正确（不再被污染）。

### Bug G：wait_after 1s 硬截断

- **现象**：YAML `wait_after: {duration: 2000}` 只等 1s（步骤总时长 339ms，等待未生效），列表刷新未完成断言就执行。
- **根因**：`_handle_wait` 对 duration 做 `min(duration, 1.0)`。
- **修复**：上限放开到 10s（默认 1000ms 不变）。
- **验证**：wait_after 2s 真实生效。

### Bug H：form.vue ref 名不匹配 → 提交静默失败（**页面级根因**）

- **现象**：点击「确 定」完全无反应（无校验、无 toast、弹窗不关）；PRESALE-200 多轮提交失败，但 PRESALE-001（内联表单）正常。
- **根因**：模板 `<el-form ref="presalegoodsRef">` 与 script `const formRef = ref()` **不是同一个 ref** → `formRef.value` 为 undefined → `?.validate` 静默跳过 → 不 emit → 父组件不提交。此 bug 源自 gen-ruoyi.mjs 子组件模式模板（`${varName}Ref` vs `formRef`）。
- **修复**：4 个模块 form.vue 统一 ref 名（script 声明与模板一致），并修进生成器模板。
- **验证**：点击「确 定」→ 触发校验（toast「定金金额不能为空」）→ 填全后提交成功。

### Bug I：列表表格缺业务列（**列表验证假通过源**）

- **现象**：商品创建成功（数据库有记录、列表"共 7 条"），但**列表页不显示商品标题**（a11y 快照表格只有编号/创建时间列），wait_for 匹配到的其实是弹窗输入框残留文本。
- **根因**：gen-ruoyi.mjs 的 index.vue 模板表格列写死为"编号 + 创建时间"，未按 FIELD_MAP 生成业务列。
- **修复**：新增 `genTableColumns(moduleName)` 按字段类型生成列（BigDecimal/LocalDateTime 加 width），模板接入。
- **验证**：列表页快照出现「商品标题」列，wait_for 真实匹配列表数据。

---

## 四、修复前后测试结果对比

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| 通过率（PRESALE-200） | 69% → 93%（数字虚高，含假通过） | **100%（真实）** |
| toast「新增成功」断言 | 失败被吞，报告显示成功 | 如实 FAILED_ASSERT → 修复后 PASS |
| 商品标题字段 | 被"华为"污染 | 正确（E2E全组件表单压测-0825） |
| 列表验证 | 匹配弹窗输入框残留（假通过） | 匹配列表真实数据（表格列已渲染） |
| 数据库落库 | 多次"100% 通过"但无新记录 | 每次真实创建（20/80/5/10 全对） |
| checkbox/switch/el-select/el_date/upload | 部分失败或假成功 | 全部真实操作成功 |

---

## 五、经验教训与防护建议

1. **E2E 断言必须"双验证"**：toast_visible + 数据库/列表双重确认，纯步骤 success 不可信（本次多次假通过均源于只信单通道）。
2. **生成器模板与真实页面必须对齐**：ref 名、表格列、import 别名等"看起来对"的细节会导致静默失败——生成后用真实浏览器验证提交通路。
3. **定位策略宁缺毋滥**：模糊匹配/fallback 会导致**数据写错位置**（Bug F），定位失败应明确报错而非乱填。
4. **页面状态假设要验证**：点击提交前确认弹窗存在（用例已加"确认弹窗"步骤），避免弹窗意外关闭后错点其他按钮。
5. **测试数据应唯一可追溯**：商品标题含时间戳/用例标识（如 `E2E全组件表单压测-0825`），便于数据库核对。

---

## 附录：修复文件清单

| 文件 | 修复内容 |
|------|---------|
| `tests/testcase-ai.py` | Bug A-G（7 处，已同步工作区副本） |
| `ruoyi-project/gen-ruoyi.mjs` | Bug H（ref 名统一）、Bug I（genTableColumns 表格列）、type 别名 FormType |
| `plus-ui/src/views/presale/*/form.vue`（4 个） | Bug H（ref 名统一） |
| `plus-ui/src/views/presale/presalegoods/index.vue` | Bug I（业务列，重新生成） |
| `PRESALE-200-form-components.yaml` | 弹窗确认步骤 + wait_after 2s（列表刷新） |
