# PDD 开发流水线完整执行文档

> 以「巡检」需求为例，从建项目到看板显示完成，全流程可复制执行。
> 所有命令已在本机实测通过（Node v22，pdd-skills v3.2.5）。

---

## 〇、准备（只需一次）

```bash
# 1. 确认在项目根目录（框架代码所在目录）
cd D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main

# 2. 确认 CLI 可用
node bin\pdd.js version        # 应输出 pdd-skills v3.2.5
```

> ⚠️ 重要约定：`dashboard` / `vm status` 的 projectRoot = **启动命令所在目录**，
> 所以**所有业务命令都要在"你的项目目录"里执行**，不要在框架根目录执行。

---

## 一、建项目

```bash
cd D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main
#两选一
#ruoyi 项目模板
node bin\pdd.js init ruoyi-project -t ruoyi -i generic
# 预售项目模板 generic
node bin\pdd.js init pre-sale-demo -t generic -i generic
# -t generic 项目模板（跳过交互选择）
# -i generic 目标 IDE（跳过交互选择）
node bin\pdd.js init Inspection-System-Project -t ruoyi -i generic
node bin\pdd.js init BDRM-APP-Project -t ruoyi -i generic
node bin\pdd.js init YUQING-System-Project -t ruoyi -i generic
node bin\pdd.js init BDRM-TEST-SYSTEM -t ruoyi -i generic
node bin\pdd.js init project\Converged-Publishing-Platform -t ruoyi -i generic


cd ruoyi-project
cd pre-sale-demo
cd Inspection-System-Project
cd BDRM-APP-Project
cd YUQING-System-Project
cd BDRM-TEST-SYSTEM
cd project\Converged-Publishing-Platform 
```

预期：创建 docs / specs / templates / scripts / tests 等目录。

---

## 二、写需求文档 PRD（第 1 阶段 PRD）

把模板复制一份并填写真实需求：

```bash
# 复制 PRD 模板
cp E:\ZHAI\APPPROJECT\pdd-skills-v3-main\templates\prd-template.prdx .\my-feature.prd
```

用编辑器打开 `my-feature.prd`，把占位符替换成「预售」需求（示例骨架）：

```markdown
# Product Requirements Document
**版本**: v1.0.0
**日期**: 2026-08-24

## 1. 项目概述
构建预售商城：商家发布预售商品（定金+尾款），买家先付定金锁定库存，预售结束后付尾款。

## 2. 功能需求
#### 模块 1: 预售商品管理
**需求ID**: REQ-001
**功能描述**: 商家发布预售商品，设置定金、尾款、预售截止时间、限购数量
**验收标准**:
- [ ] 必填字段校验
- [ ] 预售截止后不可付定金
- [ ] 限购数量校验

#### 模块 2: 定金支付
**需求ID**: REQ-002
**功能描述**: 买家支付定金锁定订单与库存，接口幂等
**验收标准**:
- [ ] 支付成功生成待付尾款订单
- [ ] 重复支付幂等
- [ ] 库存不足拦截

```

---
使用pdd-extract-features技能生成功能点
## 三、写规格文件（功能点定义）

> 关键机制：看板扫描器只识别 **`dev-specs/` 目录**下的文件，且**一个 .md 文件 = 一个功能点**。

```bash
mkdir dev-specs

cd D:/APPPROJECTS/pdd-skills-v3-main/pdd-skills-v3-main/Inspection-System-Project
node gen-dev-specs.mjs --dry-run   # 先看会生成什么
node gen-dev-specs.mjs             # 正式生成
node gen-spec.mjs                  # 贯通下游 -> specs/spec.md（并自动补充 PRD 中的接口定义）
```




为每个功能点建一个文件，格式固定（`ID:` 必须大写前缀 `F-` 或 `feat-`）：

**dev-specs/F-101-presale-goods.md**
```markdown
# 预售商品管理
ID: F-101
优先级: P0

商家可发布预售商品，设置定金、尾款、预售截止时间、限购数量。预售期内商品不可直接购买，只可支付定金。状态流转：draft(草稿) → presale(预售中) → sold_out(售罄) / off_sale(下架)。

## 验收标准
- 创建预售商品必填：定金、尾款、预售截止时间、限购数量
- 预售截止后不可再支付定金
- 限购数量在定金支付时校验
```

**dev-specs/F-102-deposit-pay.md**
```markdown
# 定金支付
ID: F-102
优先级: P0

买家在预售期内支付定金，锁定预售订单与库存。支付成功后生成预售订单（状态 pending_tail）。定金支付接口需防重放、幂等。

## 验收标准
- 定金支付成功后生成 pending_tail 订单
- 重复支付定金时幂等处理
- 库存不足时定金支付失败并提示
```

```

> 格式要点：`# 标题`、`ID: F-xxx`、`优先级: P0/P1/P2`、`## 验收标准` 下的 `- 条目` 都会被扫描器解析。

---

## 四、首次扫描：功能点自动进入 SPEC（第 2 阶段）

```bash
node ..\bin\pdd.js vm status
```

预期输出：

```
总功能点: 4
阶段分布:
  spec  4 个功能点        ← 自动识别，无需手动标记！
```

> 这是唯一自动的阶段：`dev-specs/` 下有规格文件，扫描器自动创建功能点并置为 spec。
> （PRD → EXTRACTED 两阶段在此框架中无独立命令，创建即 spec。）

---

## 五、生成 generate 用的规格文档（自动，推荐）

`generate` 命令需要一份 `specs/spec.md`。**不用手写**——用工具从 `dev-specs/` 自动生成：

```bash
# 复制自动生成脚本（每个项目放一份；项目里已有可跳过）
cp ..\ruoyi-project\gen-spec.mjs .\gen-spec.mjs

# 自动生成 specs/spec.md
#   扫描 dev-specs/ 提取 标题/ID/描述/验收标准/标签
#   并自动从 PRD 解析接口清单，按功能点归属填进「#### 接口定义」
node gen-spec.mjs
```

**常用选项**：

| 选项 | 说明 |
|------|------|
| `--prd <file>` | 指定 PRD（默认自动探测 `my-feature.prd`，找不到则找 `*.prd` / `*PRD*.md`） |
| `--no-api` | 关闭接口自动补充，接口章节回到占位（旧行为） |
| `--list-apis` | 只打印 PRD 中解析到的接口清单（含 anchor / 特征词），用于校准 |
| `--debug-match` | 打印功能点画像与每条接口的匹配过程，用于排查归属错误 |
| `--api-map <f>` | 用外置 JSON 映射表覆盖自动匹配 |
| `--dry-run` | 只输出统计，不写文件 |

生成的 `spec.md` 结构（generate 解析规则：`##` 是功能点，`####` 是子节）：

```markdown
# 项目名 开发规格
版本: v1.0.0

## 预售商品管理 |presale-goods
#### 功能描述
商家可发布预售商品，设置定金、尾款、预售截止时间、限购数量...

#### 验收标准
- 创建预售商品必填：定金、尾款、预售截止时间、限购数量
- 预售截止后不可再支付定金

#### 接口定义
| 方法 | 路径 | 权限标识 | 说明 |
|------|------|---------|------|
| GET | /presale/goods/list | presale:goods:list | 商品列表（分页） |
| POST | /presale/goods | presale:goods:add | 新增商品 |
```

### 接口自动补充的匹配规则

`gen-spec.mjs` 会解析 PRD 中所有「表头含 **方法 + 路径**」的 Markdown 表格（列顺序可变、代码块内的伪表格自动忽略），然后按以下分层规则把接口归到功能点：

| 规则 | 依据 | 说明 |
|------|------|------|
| A | 显式声明 / api-map | dev-spec 内写了 `接口: GET /x`，或表格已人工填写 → 最高优先级，**永不覆盖** |
| B | 特征词 | 接口路径/权限中的业务特征词（如 `qrcode`、`supplement`、`draft`）命中功能点 |
| C | 模块锚 | 用路径业务段（如 `point`、`record`）匹配功能点 slug/标题，**基础 CRUD 接口走这条** |
| D | 说明文本 | 接口说明的中文关键词命中功能点标题 |
| E | 未匹配 | 保留占位并在控制台报告，**绝不硬塞** |

> ⚠️ 自动匹配无法保证 100% 准确（PRD 的功能需求章节通常不含接口归属信息）。生成后请**扫一眼控制台的匹配报告**：
> - 若提示「N 条接口未匹配」→ 在对应 dev-spec 加一行 `接口: /path`，或建 `prd-api-map.json`
> - 若有归属明显不对的 → 用 `--debug-match` 查看匹配依据，再用上述两种方式覆盖

**精确覆盖方式一**（推荐，写在 dev-spec 文件顶部属性区）：

```markdown
# PC 逾期补录
ID: F-010
优先级: P1
来源: REQ-010
接口: POST /inspect/record/supplement
```

**精确覆盖方式二**（项目根放 `prd-api-map.json`，按功能点 ID / 标题 / slug 索引）：

```json
{
  "F-008": ["/inspect/record/draft", "/inspect/record/submit"],
  "h5-inspect": ["/inspect/record/myPointList"]
}
```

> 手动写也可以：格式为 `## 功能点名称 |标签` + `#### 功能描述/验收标准/接口定义`（子节必须 `####`，`###` 会被误判为独立功能点）。

---

## 六、生成代码骨架

```bash
# 预览模式（不实际生成）
node ..\bin\pdd.js generate -s ./specs/spec.md -o ./src --dry-run

# 实际生成
node ..\bin\pdd.js generate -s ./specs/spec.md -o ./src
```

预期：每个功能点生成 `.js` / `.md` / `.test.js` 三个文件 + `GENERATION_REPORT.md`。
（产出是带 TODO 的骨架代码，业务逻辑需自己填充。）

# ruoyi代码生成
cd D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main\ruoyi-project


node gen-ruoyi.mjs

# 后端代码生成 指定项目位置
node gen-ruoyi.mjs ./specs/spec.md "D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java"
node gen-ruoyi.mjs <spec.md> <后端java目录> [前端src目录]
# 前后端一起生成
node gen-ruoyi.mjs ./specs/spec.md \
"D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java" \
"D:/APPPROJECTS/plus-ui-v6.0.0-Vue/src"

---

## 七、标记阶段：implementing → verifying → done

```bash
# 复制阶段推进工具（每个项目都需要一份）
cp ..\pdd-stage.mjs .\pdd-stage.mjs

# 标记开发实现中
node pdd-stage.mjs implementing

# 运行验证（真实检查，骨架代码通过率低属正常）
node ..\bin\pdd.js verify -s ./specs/spec.md -c ./src

# 标记验证中
node pdd-stage.mjs verifying

# 标记完成
node pdd-stage.mjs done
```

`pdd-stage.mjs` 用法：

```bash
node pdd-stage.mjs                 # 查看阶段分布
node pdd-stage.mjs done            # 全部功能点推进到 done
node pdd-stage.mjs done F-101      # 只推进单个功能点
node pdd-stage.mjs implementing    # 任意阶段
```

> 说明：阶段只前推不回退；重复执行安全。

---

## 八、查看看板

```bash
# 必须在项目目录启动！
node ..\bin\pdd.js dashboard
```

浏览器自动打开 http://localhost:3001，看板/流水线应显示 4 个功能点全部在「已完成 ✨」。

---

## 九、测试流程及步骤，在workbuddy安装testcase-modeler和testcase-agent技能

>用法（新对话生效）
技能	触发语
testcase-modeler	@testcase-modeler 写个测试用例：预售商品定金支付正常流程
@testcase-modeler 录制测试流程：点开预售管理→新增商品
或 /testcase /model /录制
testcase-agent	@testcase-agent 执行测试 ruoyi-project/testcases/frontend/PRESALE-001-goods-create.yaml
@testcase-agent 跑一下这个yaml
或 /run-test

# 运行单个文件
# venv 已建（含 yaml + mcp）
"C:/Users/name/.workbuddy/binaries/python/envs/pdd-test/Scripts/python.exe"

# 运行命令（在 pdd-skills-v3-main 目录）
export CHROME_PATH="C:/Users/name/AppData/Local/Google/Chrome/Application/chrome.exe"
python tests/testcase-ai.py ruoyi-project/testcases/frontend/PRESALE-001-goods-create.yaml

# 简易方法
cd D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main
./run-test ruoyi-project\testcases\frontend\PRESALE-001-goods-create.yaml
./run-test ruoyi-project\testcases\frontend\PRESALE-100-goods-create.yaml

## 附 A：全流程命令速查

```bash
cd D:\APPPROJECTS\pdd-skills-v3-main\pdd-skills-v3-main

# 1. 建项目
node bin\pdd.js init <项目名> -t generic -i generic
cd <项目名>

# 2. 写 PRD（复制模板改内容）
cp ..\templates\prd-template.prdx .\my-feature.prd

# 3. 写规格文件（一个功能点一个文件）
mkdir dev-specs
#    dev-specs/F-xxx-名称.md（含 # 标题 / ID: F-xxx / 优先级 / ## 验收标准）

# 4. 首次扫描（自动进入 spec）
node ..\bin\pdd.js vm status

# 5. 写 generate 规格文档
#    specs/spec.md（## 功能点 + #### 子节）

# 6. 生成代码
node ..\bin\pdd.js generate -s ./specs/spec.md -o ./src

# 7. 推进阶段
cp ..\my-project\pdd-stage.mjs .\pdd-stage.mjs
node pdd-stage.mjs implementing
node ..\bin\pdd.js verify -s ./specs/spec.md -c ./src
node pdd-stage.mjs verifying
node pdd-stage.mjs done

# 8. 看板
node ..\bin\pdd.js dashboard
```

---

## 附 B：常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 看板没有数据 | ① dashboard 要在**项目目录**启动；② 先跑一次 `vm status` 让扫描器建功能点 |
| 功能点数量翻倍 | 旧版本扫描器误识别，更新代码后 `rm -rf .pdd-vm` 重建 |
| 功能点全在 prd | 检查 `dev-specs/` 文件是否存在、`ID:` 是否大写前缀（F-xxx） |
| verify 通过率低/FAILED | 正常，生成的是 TODO 骨架，填充真实代码后再验证 |
| init 卡在交互选择 | 补参数：`-t generic -i generic` |
| pdd-stage 报 ESM 语法错 | 确认文件名是 `pdd-stage.mjs`（不是 .cjs） |
