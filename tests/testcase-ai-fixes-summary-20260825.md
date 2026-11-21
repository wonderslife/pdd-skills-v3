# testcase-ai.py 修复与升级总结

- **日期**: 2026-08-25
- **文件**: `D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main\tests\testcase-ai.py`
- **触发场景**: PRESALE-001（商品新增）、PRESALE-200（全组件压测）、PRESALE-201（定金支付）E2E 测试
- **结果**: 修复 15 个 bug + 4 项功能升级，用例从 33%~97% 波动 → **稳定 100% ALL PASS（36/36，跳过 0）**

---



## testcase-ai.py Bug 修复清单（15 个）

### 分类总览

| 类别 | 数量 | 核心危害 |
|------|------|---------|
| 🔴 假通过类（最危险） | 5 | 报告 PASS 但实际没做对/没落库 |
| 🟠 定位错乱类 | 5 | 填错位置 / 点错按钮 / 数据污染 |
| 🟡 交互执行类 | 3 | 元素点不动 / 等待失效 / 弹窗误关 |
| 🟢 时序环境类 | 2 | 页面未加载完就操作 |

### A. 假通过类（报告成功 ≠ 真的成功）

| # | Bug | 现象 | 修复 |
|---|-----|------|------|
| 1 | **wait_for 只读 `text` 不读 `target`** | `"text": [""]` 空文本立即匹配 → wait_for 永远秒过（假通过） | `_build_wait_for_args` 增加 `target` 兜底：`text = step.get("text") or step.get("target")` |
| 2 | **断言失败被吞** | toast 断言失败仍标 success，关键失败被当"非关键" | 非关键断言失败也标 `FAILED_ASSERT`；`toast_visible` 升为关键断言（critical_fail 触发） |
| 3 | **el-select picker 选项找不到也假成功** | JS 找不到选项仍返回 "selected"，实际没选 | JS 明确返回 `ok:false` 时返回 None 走 MCP fill 兜底 |
| 4 | **uid 定位失败直接调 MCP** | 报 `-32602 Required at uid`（不可读） | 优雅返回「未定位到目标元素」+ 快照预览，不再抛原始错误 |
| 5 | **toast 断言单次抓取竞态** | toast 仅 3s 生命期，单次 evaluate_script 偶发错过窗口（提交成功但断言失败） | 改为**轮询抓取**：2.5s 内每 250ms 查 `.el-message`，任一时刻命中即 PASS |

### B. 定位错乱类（填错/点错，数据污染）

| # | Bug | 现象 | 修复 |
|---|-----|------|------|
| 6 | **uid 陈旧**（弹窗打开后还用上一步快照） | 填到旧页面元素（分页"页"框 valuetext=E220） | 每步执行前强制刷新快照（`execute` 开头 `_take_snapshot`） |
| 7 | **uid 缓存复用** | 首次错匹配被缓存，后续一直复用错误 uid | 每步新快照后清空 uid 缓存 |
| 8 | **prefer_role 限定导致错配** | `prefer_role="spinbutton"` 把 textbox 排除 → 模糊落到任意 spinbutton | 改无角色限定的精确匹配（同分自动选可交互元素） |
| 9 | **select_option 危险 fallback"取第一个控件"** | 找不到目标下拉时把品牌"华为"**填进商品标题框**（数据污染） | 删除 fallback，统一走 picker 流程 |
| 10 | **fill 定位到 label（不可交互）** | `_build_fill_args` 定位到 StaticText 而非 input | 定位优先 textbox → spinbutton |

### C. 交互执行类

| # | Bug | 现象 | 修复 |
|---|-----|------|------|
| 11 | **el-checkbox/switch 隐藏 input 点不动** | Element Plus 的 checkbox/switch input 是 0×0 + opacity:0，MCP 判"不可交互" | 降级 DOM 原生 click（form-item label 关联 + 控件文本 + 叶子节点 3 策略） |
| 12 | **`_handle_wait` 1s 硬截断** | `wait_after: 2s` 只等 1s（`min(duration, 1.0)`） | 放开上限到 10s |
| 13 | **el_upload 上传后误关弹窗** | el_upload 执行完发送 **Escape 键** → el-dialog 默认 `close-on-press-escape` → **整个新增弹窗被关** → "确 定"错位点成"搜索" | 删除 Escape 发送（chrome-devtools-mcp 的 upload_file 走 CDP 注入，根本不弹 OS 对话框，Escape 纯多余且有害） |

### D. 时序环境类

| # | Bug | 现象 | 修复 |
|---|-----|------|------|
| 14 | **SPA 首载渲染等待不足** | testcase-ai 用全新 Chrome，SPA 首载 >10s，`_wait_for_assertion_render` 仅 3s 超时 → 在加载中页面（11 元素）上执行 → 登录失败但 continue 继续跑 | navigate 类动作渲染等待 3s → **15s** |
| 15 | **加载遮罩未检测** | RuoYi-Plus 全局加载遮罩「正在加载系统资源」可能持续 40s+，15s 仍不够 | 渲染等待提到 **60s** + 检测快照中"正在加载系统资源"遮罩文本，出现则继续等待 |

---

## 二、功能升级（4 项）

| # | 升级 | 说明 |
|---|------|------|
| 1 | **verify_network 动作真实实现** | 原未注册（34 个动作无它）→ 每轮"跳过 1"。实现 `_execute_verify_network`：调 chrome-devtools-mcp `list_network_requests`（resourceTypes fetch/xhr），**解析 Markdown 行**（`reqid=N METHOD URL [STATUS]`，该工具不返回 JSON），**URL 归一化**（去 /dev-api、/prod-api、/api 前缀后子串匹配），匹配 url_pattern/method/response_code。铁律 3「UI+网络双重校验」完整生效 |
| 2 | **HTML 报告生成** | 原只写 Markdown（技能规范承诺 HTML）。新增 `_md_to_html()` 轻量转换器（无第三方依赖：标题/表格/粗体/代码块），`ReportGenerator.generate` 末尾输出 `report-{ts}.html` 与 .md 并存 |
| 3 | **结果目录跟随被测项目** | 原 `RESULT_BASE_DIR` 写死框架主目录。改为从 YAML 路径向上找含 `testcases` 的目录作为项目根 → 结果输出到 `ruoyi-project/test-result/` |
| 4 | **sys.path 修复（login_manager 加载）** | `login_manager.py` 用 `from tests.framework.xxx` 包导入，直接运行时项目根不在 sys.path → "No module named 'tests'" | 在 BASE_DIR 定义处 `sys.path.insert(0, PROJECT_ROOT)` |

---

## 三、验证结果

| 用例 | 修复前 | 修复后 | 数据库验证 |
|------|--------|--------|-----------|
| PRESALE-001（商品新增，36 步） | 33%~97% 波动（假通过） | **100%（36/36，跳过 0）** | price=100 / deposit=20 / tail=80 / limit=5 / stock=10 落库 ✓ |
| PRESALE-200（全组件压测，31 步） | 69%（9 步失败） | **100%**（16 类控件全通） | 落库 ✓ |
| PRESALE-201（定金支付，21 步） | 提交失败（status 列超长） | **100%**（幂等拦截+订单 pending_tail） | 定金 1 条 + 订单状态机 ✓ |

---

## 四、经验教训（沉淀）

1. **E2E 断言必须 toast + 数据库双验证**——纯步骤 success 不可信（曾出现"100% 通过但数据库 0 条记录"）
2. **快照/缓存一致性**：页面 DOM 变化后（弹窗开/关、路由跳转），旧快照的 uid 全部失效，必须每步刷新 + 清缓存
3. **Element Plus 组件的隐藏 input**（checkbox/switch/el-input-number）MCP 判定不可交互，需 DOM 原生点击兜底
4. **Escape/快捷键会污染页面**：测试框架的全局键模拟可能触发目标页面自身的关闭/提交行为
5. **MCP 工具返回值格式以实测为准**：chrome-devtools-mcp 的 list_network_requests 返回 Markdown 而非 JSON
6. **环境偶发（Redis 抖动/SPA 编译慢）≠ 代码 bug**：先查后端日志（sys-error.log 的 RedissonTimeoutException）再改框架

---

## 五、相关文件

- 测试框架: `tests/testcase-ai.py`（修复已同步工作区副本 `C:\Users\name\WorkBuddy\...\pdd-skills-v3\tests\testcase-ai.py`）
- 用例: `ruoyi-project/testcases/frontend/PRESALE-001/200/201`
- 测试报告: `ruoyi-project/test-result/run-{时间戳}/`（report.md + report.html + detail.md + snapshots/）
