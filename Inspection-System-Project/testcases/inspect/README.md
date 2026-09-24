# 机房巡检系统 · E2E 测试用例集

本目录存放机房巡检系统的端到端（E2E）测试用例，YAML 格式，由 `tests/testcase-ai.py` 引擎驱动，通过 Chrome DevTools MCP 在真实浏览器中回放。

覆盖范围：**PC 管理端 11 条 + H5 扫码端 3 条 = 14 条**，每条 YAML 配套一个同名 `.env`（测试数据全部走环境变量，不硬编码）。

---

## 目录结构

```
testcases/inspect/
├── pc/                              # PC 管理端（plus-ui v6）
│   ├── pc-001-login.yaml / .env
│   ├── pc-002-room-crud.yaml / .env
│   ├── pc-003-area-crud.yaml / .env
│   ├── pc-004-template-detail.yaml / .env
│   ├── pc-005-point-crud.yaml / .env
│   ├── pc-006-point-qrcode.yaml / .env
│   ├── pc-007-point-import.yaml / .env
│   ├── pc-008-record-query-remark.yaml / .env
│   ├── pc-009-record-supplement.yaml / .env
│   ├── pc-010-abnormal-process.yaml / .env
│   └── pc-011-stats.yaml / .env
├── h5/                              # H5 扫码端（RuoYi-App-Plus）
│   ├── h5-001-scan-normal.yaml / .env
│   ├── h5-002-abnormal-submit.yaml / .env
│   └── h5-003-duplicate-reject.yaml / .env
├── data/                            # 导入/上传用样例文件（可选）
└── README.md                        # 本文件
```

---

## 用例清单

### PC 管理端

| 用例 ID | 标题 | 优先级 | 核心断言 |
|---|---|---|---|
| INSP-PC-001 | PC 登录并加载机房巡检菜单 | P0 | 登录接口 200；7 个二级菜单全部可见 |
| INSP-PC-002 | 机房管理：增/查/改/删/导出 | P0 | 必填校验拦截；POST/PUT/DELETE 均 200 |
| INSP-PC-003 | 区域管理：新增（机房/父区域下拉） | P1 | 父区域下拉有数据且含「顶级」；列表关联名回填 |
| INSP-PC-004 | 巡检项模板：模板 + 明主子表 | P0 | 明细数 > 0；修改时明细回显 |
| INSP-PC-005 | 点位管理：从模板导入巡检项 | P0 | 不再提示「没有巡检项明细」；关联列有值 |
| INSP-PC-006 | 点位二维码：查看/下载/批量导出 | P0 | img 为 blob 且有 naturalWidth（非裂图） |
| INSP-PC-007 | 点位批量导入（Excel） | P1 | 下载模板 → 校验 → 确认导入，部分成功 |
| INSP-PC-008 | 记录查询/详情/追加备注/导出 | P0 | 关联列回填；空备注被拦截 |
| INSP-PC-009 | 巡检逾期补录 | P1 | 来源标记为「PC补录」 |
| INSP-PC-010 | 异常处理闭环 | P0 | 空处理说明被拦截；状态流转为「已处理」 |
| INSP-PC-011 | 统计报表：粒度/机房/排名 | P1 | 切粒度触发重查；排名表列完整 |

### H5 扫码端

| 用例 ID | 标题 | 优先级 | 核心断言 |
|---|---|---|---|
| INSP-H5-001 | 扫码巡检（全正常）闭环 | P0 | resolve → 逐项正常 → 提交成功 → 我的记录可见 |
| INSP-H5-002 | 异常项校验 + 进入异常池 | P0 | 「说明必填」「照片必传」双拦截；PC 异常池可见 |
| INSP-H5-003 | 同周期重复巡检拦截 | P1 | 提示「本周期已巡检」；不进入执行页 |

---

## 推荐执行顺序（含数据依赖）

```
①  pc-001-login              （登录冒烟，无依赖）
②  pc-002-room-crud          （产出：测试机房）        ← 串行执行请止于「导出」，不要删机房
③  pc-003-area-crud          （产出：顶级/子区域，依赖 ②）
④  pc-004-template-detail    （产出：模板 + 明细，无依赖）★模板明细数必须 > 0
⑤  pc-005-point-crud         （产出：点位 01 + 巡检项，依赖 ②③④）★模板导入回归点
⑥  pc-006-point-qrcode       （依赖 ⑤）★blob 取值回归点
⑦  pc-007-point-import       （可选，需样例 Excel）
⑧  h5-001-scan-normal        （产出：巡检记录，依赖 ⑤）
⑨  h5-003-duplicate-reject   （依赖 ⑧：必须已有本周期记录）
⑩  h5-002-abnormal-submit    （产出：异常项，需另一个点位 02）
⑪  pc-008-record-query-remark（依赖 ⑧）
⑫  pc-009-record-supplement  （依赖 ⑤）
⑬  pc-010-abnormal-process   （依赖 ⑩）★异常处理回归点
⑭  pc-011-stats              （依赖 ⑧⑩，数据越多越有意义）
```

**最小回归集（每次改动后建议跑）**：`pc-001 → pc-004 → pc-005 → pc-006 → h5-001 → pc-010`
（正好覆盖本迭代修复的 4 处回归：模板明细、二维码 blob、关联字段回填、异常处理）

---

## 前置条件

| 项 | 要求 |
|---|---|
| 后端 | RuoYi-Vue-Plus v6 已启动在 `localhost:8080`，且已执行 `insp_schema.sql` / `insp_dict.sql` / `insp_menu.sql` |
| PC 前端 | 已启动或构建，默认 `http://localhost:80`（`VITE_APP_PORT=80`，代理 `/dev-api → localhost:8080`） |
| H5 前端 | 已启动，默认 `http://localhost:3002`（见 `RuoYi-App-Plus/env/.env`） |
| **验证码** | 建议在「系统管理 > 参数设置」将 `sys.account.captchaEnabled` 设为 `false`，否则用例会被登录页验证码卡住 |
| 账号权限 | 用例使用超管账号（`role_key=superadmin`），已具备 `inspect:*:*` 全部权限 |
| 浏览器 | Chrome + Chrome DevTools MCP；H5 用例建议切移动视图 `390x844` |

---

## 测试数据准备

1. **样例 Excel（pc-007 用）**：先在「点位管理 > 批量导入」里点「下载模板」，按模板表头填 2 行——1 行合法、1 行故意留空点位编码，另存为
   `testcases/inspect/data/point-import-sample.xlsx`。
2. **样例照片（h5-002 用）**：任意 JPG 放到 `testcases/inspect/data/site-photo.jpg`，用于异常项现场照片上传。
3. **点位与周期**：H5 用例会锁定点位本周期状态。重复执行前，需要
   - 换用新的点位编码，或
   - 清理 `insp_record` 中该点位本周期的记录，或
   - 直接改点位 `cycle_type` 为 `custom` 且 `cycle_value=0` 以便反复测试

---

## 执行方式

### ① 安装引擎依赖（首次）

`tests/testcase-ai.py` 依赖 `pyyaml` 与 `mcp`：

```bash
python -m pip install pyyaml mcp
```

### ② 静态校验（秒级，无需浏览器）

先跑校验，确认 YAML 语法、必填字段、step 编号、`.env` 配对与变量引用都没问题：

```bash
python testcases/scripts/validate-cases.py testcases/inspect
```

### ③ 执行用例

```bash
cd tests

# 单条执行
python testcase-ai.py ../testcases/inspect/pc/pc-001-login.yaml

# 按依赖顺序批量执行
pwsh ../testcases/scripts/run-inspect-tests.ps1

# 只要 PC 端
pwsh ../testcases/scripts/run-inspect-tests.ps1 -SkipH5

# 只跑某条
pwsh ../testcases/scripts/run-inspect-tests.ps1 -Only pc-004-template-detail
```

执行完在 `tests/reports/` 下生成 HTML 报告（含逐步截图）。

---

## 待确认项（执行前请核对）

| 项 | 当前默认值 | 需确认 |
|---|---|---|
| PC 访问地址 | `http://localhost:80` | 是否为实际端口/域名 |
| H5 访问地址 | `http://localhost:3002` | 同上 |
| 登录账号 | `admin / admin123` | 是否为实际测试账号（不建议用超管跑常规回归） |
| 验证码 | 要求关闭 | 若无法关闭需人工介入 |
| 模板/机房等测试数据名 | `自动化测试机房-01` 等 | 若库中已重名请调整 `.env` |

---

## 已知限制

- **H5 真机扫码**：`uni.scanCode` 在浏览器中不可用，用例统一走「手动输入点位编码」通道——与扫码共用同一个 `/inspect/scan/resolve` 接口，业务等价。
- **H5 拍照**：浏览器中由 `input[type=file]` 承载，自动触发文件选择器在部分环境不稳定，`h5-002` 步骤 10 可能需人工点选一次。
- **下拉定位**：部分页面搜索区与弹窗表单的 placeholder 文案相同（如「请输入机房名称」）。执行引擎会结合步骤 `desc` 与截图智能定位；若命中错误控件，可通过首次执行后写回的 `uid_cache_key` 修正。
