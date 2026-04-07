***

name: "official-doc-writer"
description: "Official document writer generating government docs (notifications, reports, requests) per GB/T 9704-2012 standard. Invoke when creating formal documents or government-style output."
author: "neuqik@hotmail.com"
license: "MIT"
--------------

# 党政机关公文生成技能 / Official Government Document Generation Skill

## 核心概念 / Core Concepts

### 🇨🇳 核心概念

本技能用于生成符合《党政机关公文处理工作条例》和GB/T 9704-2012《党政机关公文格式》国家标准的公文文档，支持通知、报告、请示、函等10种公文类型，可导出为标准Word文档。

**快速使用**: `python scripts/generate_official_doc.py`

### 🇺🇸 Core Concepts

This skill generates official government documents that comply with the "Regulations on the Processing of Official Documents of Party and Government Organs" and the GB/T 9704-2012 "Format for Official Documents of Party and Government Organs" national standard. It supports 10 document types including notifications, reports, requests, and letters, and can export to standard Word format.

**Quick Start**: `python scripts/generate_official_doc.py`

## 字体依赖与安装 / Font Dependencies & Installation

### 🇨🇳 字体依赖与安装

#### 必需字体清单

| 字体名称 | 用途 | 文件名 |
|---------|------|--------|
| 方正小标宋_GBK | 发文机关标志、标题 | FZXBSJW.TTF |
| 仿宋_GB2312 | 正文、发文字号 | SIMFANG.TTF |
| 黑体 | 一级标题、密级 | SIMHEI.TTF |
| 楷体_GB2312 | 二级标题、签发人姓名 | SIMKAI.TTF |
| 宋体 | 页码 | SIMSUN.TTF |

#### 安装方式

**自动安装（推荐）**: `python scripts/install_fonts.py` （Windows需管理员权限）

**手动安装**:
- Windows: 复制字体文件到 `C:\Windows\Fonts`
- macOS: 复制到 `~/Library/Fonts`
- Linux: 复制到 `~/.fonts/` 后执行 `fc-cache -fv`

**字体来源**: Windows系统自带大部分字体（除方正小标宋外），可从系统字体目录复制；方正小标宋需从[官方网站](http://www.foundertype.com/)获取（需商业授权），或使用开源替代字体（思源宋体/黑体）。

**验证安装**: 运行 `python scripts/install_fonts.py --check`

> 详细说明见 `fonts/README.md` 和 `scripts/install_fonts.py`

### 🇺🇸 Font Dependencies & Installation

#### Required Fonts List

| Font Name | Usage | Filename |
|-----------|-------|----------|
| Founder XiaoBiaoSong_GBK | Issuing authority logo, title | FZXBSJW.TTF |
| FangSong_GB2312 | Body text, document number | SIMFANG.TTF |
| SimHei | Level-1 headings, classification level | SIMHEI.TTF |
| KaiTi_GB2312 | Level-2 headings, signer name | SIMKAI.TTF |
| SimSun | Page numbers | SIMSUN.TTF |

#### Installation Methods

**Auto Install (Recommended)**: `python scripts/install_fonts.py` (Requires admin privileges on Windows)

**Manual Install**:
- Windows: Copy font files to `C:\Windows\Fonts`
- macOS: Copy to `~/Library/Fonts`
- Linux: Copy to `~/.fonts/` then run `fc-cache -fv`

**Font Source**: Most fonts come pre-installed with Windows (except Founder XiaoBiaoSong), which can be copied from the system font directory. Founder XiaoBiaoSong must be obtained from the [official website](http://www.foundertype.com/) (requires commercial license), or use open-source alternatives (Source Han Serif/Sans).

**Verify Installation**: Run `python scripts/install_fonts.py --check`

> See `fonts/README.md` and `scripts/install_fonts.py` for detailed instructions

## 对话交互模式 / Interactive Dialog Mode

### 🇨🇳 对话交互模式

支持智能对话交互模式，通过逐步引导收集公文要素：

#### 核心要素（必须交互）
- **公文类型**: 选择式（通知/报告/请示/函/通报/纪要/决定/意见/批复/命令）
- **发文机关**: 开放式输入全称
- **主送机关**: 接收单位
- **公文标题**: 引导式生成规范标题
- **成文日期**: 确认式（默认今天）
- **正文内容**: 多行输入主要内容要点

#### 可选要素（按需触发）
发文字号 | 密级 | 紧急程度 | 签发人（上行文） | 附件 | 抄送机关 | 印发机关/日期

#### 智能提示
- **开头语推荐**: 通知"为...，现...如下：" | 报告"现将...报告如下：" | 请示"关于...的请示" | 函"关于...的函"
- **结尾语推荐**: 通知"特此通知。" | 报告"特此报告。" | 请示"妥否，请批示。" | 函"请予研究函复。"

#### 对话模式优势
用户友好（逐步引导） | 智能提示（专业语言建议） | 灵活性强（随时修改） | 质量保证（要素齐全） | 学习价值（了解规范）

> 技术实现: `scripts/dialog_manager.py` 和 `scripts/smart_prompts.py`

### 🇺🇸 Interactive Dialog Mode

Supports intelligent dialog interaction mode, collecting document elements through step-by-step guidance:

#### Core Elements (Required Interaction)
- **Document Type**: Selection-based (Notification / Report / Request / Letter / Circular / Minutes / Decision / Opinion / Reply / Order)
- **Issuing Authority**: Open input for full name
- **Recipient**: Receiving organization
- **Document Title**: Guided generation of standard title
- **Date of Issue**: Confirmation-based (defaults to today)
- **Body Content**: Multi-line input for main content points

#### Optional Elements (Triggered on Demand)
Document Number | Classification Level | Urgency Level | Signer (for upward documents) | Attachment | CC Organizations | Issuing Organization/Date

#### Smart Prompts
- **Opening Phrase Recommendations**:
  - Notification: "为……，现……如下：" / "根据……，决定……"
  - Report: "现将……报告如下：" / "关于……情况报告如下："
  - Request: "关于……的请示" / "现就……请示如下："
  - Letter: "关于……的函" / "现就……函告如下："
- **Closing Phrase Recommendations**:
  - Notification: "特此通知。" / "请认真贯彻执行。"
  - Report: "特此报告。" / "以上报告，请审阅。"
  - Request: "妥否，请批示。" / "以上请示，请予批复。"
  - Letter: "请予研究函复。" / "特此函告。"

#### Dialog Mode Advantages
User-friendly (step-by-step guidance) | Smart prompts (professional language suggestions) | High flexibility (modify anytime) | Quality assurance (complete elements) | Educational value (learn standards)

> Technical Implementation: `scripts/dialog_manager.py` and `scripts/smart_prompts.py`

## 支持的公文类型 / Supported Document Types

### 🇨🇳 支持的公文类型

| 类型 | 适用场景 | 结尾语 |
|-----|---------|-------|
| 通知 | 发布、传达要求下级机关执行的事项 | 特此通知。 |
| 通报 | 表彰先进、批评错误、传达重要情况 | 特此通报。 |
| 报告 | 向上级汇报工作、反映情况 | 特此报告。 |
| 请示 | 向上级请求指示、批准 | 妥否，请批示。 |
| 函 | 不相隶属机关之间商洽工作 | 请予研究函复。 |
| 纪要 | 记载会议主要情况和议定事项 | - |
| 决定 | 对重要事项作出决策和部署 | - |
| 意见 | 对重要问题提出见解和处理办法 | - |
| 批复 | 答复下级机关请示事项 | - |
| 命令(令) | 公布行政法规、宣布重大措施 | - |

### 🇺🇸 Supported Document Types

| Type | Use Case | Closing Phrase |
|------|----------|----------------|
| Notification (通知) | Publish or convey matters requiring subordinate organs to execute | 特此通知。 |
| Circular (通报) | Commend advanced examples, criticize errors, convey important situations | 特此通报。 |
| Report (报告) | Report work or reflect situations to superiors | 特此报告。 |
| Request (请示) | Request instructions or approval from superiors | 妥否，请批示。 |
| Letter (函) | Discuss work between non-subordinate organs | 请予研究函复。 |
| Minutes (纪要) | Record main meeting situations and agreed items | - |
| Decision (决定) | Make decisions and arrangements on important matters | - |
 Opinion (意见) | Propose views and handling methods for important issues | - |
| Reply (批复) | Reply to subordinate organ requests | - |
| Order/Command (命令/令) | Promulgate administrative regulations, announce major measures | - |

## 公文格式规范（GB/T 9704-2012） / Document Format Standards (GB/T 9704-2012)

### 🇨🇳 公文格式规范（GB/T 9704-2012）

#### 版面参数
- **纸张**: A4型纸 (210mm × 297mm)
- **页边距**: 天头37mm ± 1mm | 订口28mm ± 1mm
- **版心尺寸**: 156mm × 225mm
- **每面行数**: 22行 | **每行字数**: 28字

#### 字体字号规范

| 要素 | 字体 | 字号 | 颜色 |
|------|------|------|------|
| 发文机关标志 | 小标宋体 | - | 红色 |
| 标题 | 小标宋体 | 2号 | 黑色 |
| 正文 | 仿宋体 | 3号 | 黑色 |
| 一级标题 | 黑体 | 3号 | 黑色 |
| 二级标题 | 楷体 | 3号 | 黑色 |
| 三级/四级标题 | 仿宋体 | 3号 | 黑色 |
| 发文字号/密级/紧急程度 | 仿宋体/黑体 | 3号 | 黑色 |
| 签发人 | 仿宋体(标签)/楷体(姓名) | 3号 | 黑色 |
| 抄送/印发机关/印发日期 | 仿宋体 | 4号 | 黑色 |
| 页码 | 宋体 | 4号半角 | 黑色 |

#### 公文要素编排规则

**版头**（红色分隔线以上）:
- 发文机关标志: 居中排布，上边缘至版心上边缘35mm，红色小标宋体
- 发文字号: 格式`〔年份〕序号号`，发文机关标志下空二行居中，年份用六角括号
- 版头分隔线: 发文字号之下4mm处，红色，与版心等宽

**主体**（红色分隔线以下至版记之前）:
- 标题: 2号小标宋体，红色分隔线下空二行居中，格式"发文机关+事由+文种"
- 主送机关: 标题下空一行居左顶格，后标全角冒号
- 正文: 3号仿宋体，每个自然段左空二字回行顶格
  - 结构层次: 一、(黑体) → （一）(楷体) → 1.(仿宋) → （1）(仿宋)
- 附件说明: 正文下空一行左空二字，多附件用阿拉伯数字标注
- 成文日期: 阿拉伯数字年月日标全，居中编排，月日不编虚位

**版记**（末页分隔线以下）:
- 分隔线: 首条/末条粗线(0.35mm)，中间细线(0.25mm)
- 抄送机关: 印发机关上一行，4号仿宋体
- 印发机关和印发日期: 末条分隔线之上，4号仿宋体

### 🇺🇸 Document Format Standards (GB/T 9704-2012)

#### Page Layout Parameters
- **Paper**: A4 size (210mm × 297mm)
- **Margins**: Top margin 37mm ± 1mm | Left (binding) margin 28mm ± 1mm
- **Text Area**: 156mm × 225mm
- **Lines per page**: 22 lines | **Characters per line**: 28 characters

#### Font and Size Specifications

| Element | Font | Size | Color |
|---------|------|------|-------|
| Issuing Authority Logo | Founder XiaoBiaoSong | - | Red |
| Title | Founder XiaoBiaoSong | No. 2 | Black |
| Body Text | FangSong | No. 3 | Black |
| Level-1 Heading | SimHei | No. 3 | Black |
| Level-2 Heading | KaiTi | No. 3 | Black |
| Level-3/Level-4 Heading | FangSong | No. 3 | Black |
| Document Number/Classification/Urgency | FangSong/SimHei | No. 3 | Black |
| Signer | FangSong(label)/KaiTi(name) | No. 3 | Black |
| CC/Distribution Org/Date | FangSong | No. 4 | Black |
| Page Number | SimSun | No. 4 half-width | Black |

#### Document Element Layout Rules

**Header Section** (above red separator line):
- Issuing Authority Logo: Centered, top edge 35mm from text area top edge, red Founder XiaoBiaoSong font
- Document Number: Format `〔Year〕Sequence`, centered two lines below the logo, year in hexagonal brackets
- Header Separator Line: 4mm below document number, red, full width of text area

**Body Section** (below red separator line, before end matter):
- Title: No. 2 Founder XiaoBiaoSong, centered two lines below red separator, format "Issuing Authority + Subject + Document Type"
- Recipient: One line below title, left-aligned with no indent, followed by full-width colon
- Body Text: No. 3 FangSong, each paragraph indented by 2 characters, continuation lines flush left
  - Structural hierarchy: 一、(SimHei) → （一）(KaiTi) → 1.(FangSong) → （1）(FangSong)
- Attachment Note: One line below body text, indented by 2 characters, multiple attachments numbered with Arabic numerals
- Date of Issue: Full Arabic numeral date (year-month-day), centered, no padding for month/day

**End Matter Section** (below last page separator):
- Separator Lines: First/Last lines thick (0.35mm), middle line thin (0.25mm)
- CC Organizations: One line above distribution organization, No. 4 FangSong
- Distribution Organization and Date: Above the last separator line, No. 4 FangSong

## 工作流程 / Workflow

### 🇨🇳 工作流程

#### 步骤1: 需求收集
提取信息: 公文类型 | 发文机关 | 主送机关 | 发文字号 | 标题 | 正文内容 | 成文日期 | 附件(可选) | 抄送机关(可选)

#### 步骤2: 生成文档
```python
from scripts.generate_official_doc import create_official_document
content = {
    'issuer': '发文机关名称',
    'doc_number': '发文字号',
    'title': '公文标题',
    'recipient': '主送机关',
    'body': ['正文段落1', '正文段落2'],
    'signer': '发文机关署名',
    'date': '成文日期',
    'attachment': '附件说明（可选）',
    'copy_to': '抄送机关（可选）'
}
doc = create_official_document('公文类型', content)
doc.save('输出文件路径.docx')
```

#### 步骤3: 格式校验
检查项: [ ] 标题格式正确 | [ ] 发文字号格式规范 | [ ] 正文层次清晰 | [ ] 语言表达准确 | [ ] 要素齐全完整

### 🇺🇸 Workflow

#### Step 1: Requirements Collection
Extract information: Document Type | Issuing Authority | Recipient | Document Number | Title | Body Content | Date of Issue | Attachment (Optional) | CC Organizations (Optional)

#### Step 2: Document Generation
```python
from scripts.generate_official_doc import create_official_document
content = {
    'issuer': 'Issuing Authority Name',
    'doc_number': 'Document Number',
    'title': 'Document Title',
    'recipient': 'Recipient Organization',
    'body': ['Body Paragraph 1', 'Body Paragraph 2'],
    'signer': 'Signer Name',
    'date': 'Date of Issue',
    'attachment': 'Attachment Description (optional)',
    'copy_to': 'CC Organizations (optional)'
}
doc = create_official_document('Document Type', content)
doc.save('output_file_path.docx')
```

#### Step 3: Format Validation
Checklist: [ ] Title format correct | [ ] Document number format compliant | [ ] Body structure clear | [ ] Language expression accurate | [ ] All required elements complete

## 公文语言规范 / Document Language Standards

### 🇨🇳 公文语言规范

#### 常用开头语
- 通知: `为……，现……如下：` / `根据……，决定……`
- 报告: `现将……报告如下：` / `关于……情况报告如下：`
- 请示: `关于……的请示` / `现就……请示如下：`
- 函: `关于……的函` / `现就……函告如下：`

#### 常用结尾语
- 通知: `特此通知。` / `请认真贯彻执行。`
- 报告: `特此报告。` / `以上报告，请审阅。`
- 请示: `妥否，请批示。` / `以上请示，请予批复。`
- 函: `请予研究函复。` / `特此函告。`

#### 数字使用规范
- 成文日期: 阿拉伯数字（如2026年3月13日）
- 发文字号序号: 不编虚位（1号而非01号）
- 统计数据: 阿拉伯数字 | 概数: 汉字（如三五天、七八十人）

### 🇺🇸 Document Language Standards

#### Common Opening Phrases
- Notification (通知): `为……，现……如下：` / `根据……，决定……`
- Report (报告): `现将……报告如下：` / `关于……情况报告如下：`
- Request (请示): `关于……的请示` / `现就……请示如下：`
- Letter (函): `关于……的函` / `现就……函告如下：`

#### Common Closing Phrases
- Notification (通知): `特此通知。` / `请认真贯彻执行。`
- Report (报告): `特此报告。` / `以上报告，请审阅。`
- Request (请示): `妥否，请批示。` / `以上请示，请予批复。`
- Letter (函): `请予研究函复。` / `特此函告。`

#### Number Usage Guidelines
- Date of Issue: Arabic numerals (e.g., 2026年3月13日)
- Document Number Sequence: No zero-padding (1号 instead of 01号)
- Statistical Data: Arabic numerals | Approximate Numbers: Chinese characters (e.g., 三五天, 七八十人)

## 参考文档 / Reference Documents

### 🇨🇳 参考文档

**国家标准**: [`references/GBT_9704-2012_党政机关公文格式.md`](references/GBT_9704-2012_党政机关公文格式.md) - 包含完整的纸张要求、编排规则、字体字号、印制装订、特定格式及式样图示

**其他标准**: 《党政机关公文处理工作条例》(中办发〔2012〕14号) | GB/T 15834《标点符号用法》 | GB/T 15835《出版物上数字用法》

### 🇺🇸 Reference Documents

**National Standard**: [`references/GBT_9704-2012_党政机关公文格式.md`](references/GBT_9704-2012_党政机关公文格式.md) - Contains complete paper requirements, layout rules, font specifications, printing and binding, special formats, and sample diagrams

**Other Standards**: "Regulations on the Processing of Official Documents of Party and Government Organs" (中办发〔2012〕14号) | GB/T 15834 "Punctuation Marks Usage" | GB/T 15835 "General Rules for Writing Numerals in Publications"

---

## Iron Law / 铁律

### 🇨🇳 铁律

1. **国家标准强制**: 生成的公文必须严格符合GB/T 9704-2012标准，不得因美观或方便而偏离标准规定。
2. **要素完整性**: 必备要素（发文机关、标题、主送机关、正文、成文日期、印章/署名）缺一不可，可选要素在用户明确要求时才添加。
3. **语言规范性**: 必须使用规范的公文语言（书面语、正式表达），不得使用口语化、网络化表述。
4. **字体依赖明确**: 必须使用标准规定的字体，缺失时应明确提示用户安装，不得随意替换。
5. **用户确认必经**: 生成最终文档前必须向用户展示预览并获得确认。

**违规示例**: ❌ 自定义非标准页边距 | ❌ 缺少主送机关或成文日期 | ❌ 口语化表达 | ❌ 字体缺失不提示 | ❌ 跳过预览直接输出

**合规示例**: ✅ 严格遵循标准参数 | ✅ 输出前检查必备要素清单 | ✅ 使用规范表述 | ✅ 检测字体缺失时主动提示 | ✅ 先预览后生成

### 🇺🇸 Iron Law

1. **National Standard Mandatory**: Generated documents must strictly comply with GB/T 9704-2012 standard; never deviate from standard requirements for aesthetics or convenience.
2. **Element Completeness**: Required elements (Issuing Authority, Title, Recipient, Body Text, Date of Issue, Seal/Signature) are non-negotiable; optional elements are added only when explicitly requested by the user.
3. **Language Standardization**: Must use standardized official document language (written style, formal expression); colloquial or internet-style expressions are prohibited.
4. **Font Dependency Clarity**: Must use fonts specified by the standard; when fonts are missing, explicitly prompt the user to install them — never silently substitute.
5. **User Confirmation Required**: Must present a preview and obtain user confirmation before generating the final document.

**Violation Examples**: ❌ Custom non-standard margins | ❌ Missing recipient or date of issue | ❌ Colloquial expressions | ❌ No prompt when font missing | ❌ Skip preview and output directly

**Compliant Examples**: ✅ Strictly follow standard parameters | ✅ Check required element list before output | ✅ Use formal language | ✅ Proactively alert when font missing | ✅ Preview before generation

---

## Rationalization Table / 理性化对照表

### 🇨🇳 理性化对照表

| 你可能的想法 | 请问自己 | 应该怎么做 |
|-------------|---------|-----------|
| "这个格式太死板了，稍微调一下吧" | 公文格式的严肃性来自标准化和一致性 | 严格遵循GB/T 9704-2012标准的每个参数 |
| "这几个要素用户没提，应该不需要吧" | 公文的法定效力依赖于要素完整性 | 按照公文类型检查必备要素清单，缺失项必须确认 |
| "这样写更通俗易懂" | 公文的语言风格体现其正式性 | 使用规范的公文用语库，选择正式准确简洁的表达 |
| "字体差不多就行，反正能显示" | 字体差异影响公文的正式性和可读性 | 明确检测字体安装情况，缺失时必须提示用户 |
| "内容应该没问题，直接生成吧" | 公文内容的准确性至关重要 | 强制执行预览确认流程 |

**常见陷阱**:
1. **"创意排版"陷阱**: 为追求视觉效果偏离标准 → 建立格式参数对照表
2. **"要素遗漏"陷阱**: 因用户未提及省略必备要素 → 建立分类型必备要素检查清单
3. **"语言口语化"陷阱**: 将口语描述直接写入公文 → 建立"口语→公文语"转换规则
4. **"静默降级"陷阱**: 字体缺失时静默降级处理 → 所有降级必须明确告知用户

### 🇺🇸 Rationalization Table

| Your Temptation | Ask Yourself | What To Do Instead |
|-----------------|-------------|-------------------|
| "This format is too rigid, let me tweak it a bit" | The seriousness of official document formatting comes from standardization and consistency | Strictly follow every parameter of GB/T 9704-2012 standard |
| "The user didn't mention these elements, they probably aren't needed" | The legal validity of official documents depends on element completeness | Check the required elements checklist by document type; missing items must be confirmed |
| "This wording is more accessible" | The language style of an official document reflects its formality | Use a standardized official terminology bank; choose formal, precise, and concise expressions |
| "These fonts are close enough, as long as they display" | Font differences affect the formality and readability of official documents | Explicitly check font installation status; must alert user when fonts are missing |
| "The content looks fine, let me just generate it" | The accuracy of official document content is critical | Enforce mandatory preview confirmation workflow |

**Common Pitfalls**:
1. **"Creative Layout" Trap**: Deviating from standards for visual effects → Establish a format parameter reference table
2. **"Missing Elements" Trap**: Omitting required elements because the user didn't mention them → Create a type-specific required elements checklist
3. **"Colloquial Language" Trap**: Writing colloquial descriptions directly into documents → Establish "colloquial-to-formal" conversion rules
4. **"Silent Degradation" Trap**: Silently degrading when fonts are missing → All degradation must be explicitly communicated to the user

---

## Red Flags / 红旗警告

### 🇨🇳 红旗警告

#### Layer 1: 输入检查
- **INPUT-ODW-001**: 用户提供的公文信息不足以确定公文类型 → 🔴 CRITICAL → 终止并通过对话引导补充
- **INPUT-ODW-002**: 发文机关名称为空 → 🔴 CRITICAL → 终止并提示这是必备要素
- **INPUT-ODW-003**: 正文内容为空或过短(<20字) → 🟡 WARN → 提示可能不完整，请用户确认

#### Layer 2: 执行检查
- **EXEC-ODW-001**: 生成的格式参数不符合GB/T 9704-2012标准 → 🔴 CRITICAL → 修正为标准值
- **EXEC-ODW-002**: 公文语言包含明显的口语化或网络化表达 → 🟡 WARN → 提供规范化改写建议
- **EXEC-ODW-003**: 缺少必需字体但未提示用户就使用替代字体 → 🔴 CRITICAL → 中止生成，先完成字体安装或明确告知影响
- **EXEC-ODW-004**: 跳过预览确认环节直接生成最终文档 → 🔴 CRITICAL → 回退到预览步骤等待确认

#### Layer 3: 输出检查
- **OUTPUT-ODW-001**: 生成的Word文档无法正常打开或格式错乱 → 🔴 CRITICAL → 检查字体依赖和脚本日志
- **OUTPUT-ODW-002**: 文档中的要素与用户确认的预览内容不一致 → 🔴 CRITICAL → 重新确保一致性
- **OUTPUT-ODW-003**: 文件保存路径超出预期目录范围 → 🟡 WARN → 确认路径并在报告中记录实际位置

#### 触发Red Flag时的处理流程
🔴 CRITICAL → 立即停止，报告问题详情，等待指示 | 🟡 WARN → 记录警告，尝试自动修复，在报告中标注 | 🔵 INFO → 记录信息，正常继续

### 🇺🇸 Red Flags

#### Layer 1: Input Validation
- **INPUT-ODW-001**: User-provided document information is insufficient to determine document type → 🔴 CRITICAL → Halt and guide user through dialog to supplement information
- **INPUT-ODW-002**: Issuing authority name is empty → 🔴 CRITICAL → Halt and inform this is a required element
- **INPUT-ODW-003**: Body content is empty or too short (<20 characters) → 🟡 WARN → Alert possible incompleteness, ask user to confirm

#### Layer 2: Execution Validation
- **EXEC-ODW-001**: Generated format parameters do not comply with GB/T 9704-2012 standard → 🔴 CRITICAL → Correct to standard values
- **EXEC-ODW-002**: Document language contains obvious colloquial or internet-style expressions → 🟡 WARN → Provide standardized rewriting suggestions
- **EXEC-ODW-003**: Missing required fonts but using substitute fonts without alerting the user → 🔴 CRITICAL → Abort generation; complete font installation first or explicitly communicate the impact
- **EXEC-ODW-004**: Skipping preview confirmation and generating final document directly → 🔴 CRITICAL → Roll back to preview step and wait for confirmation

#### Layer 3: Output Validation
- **OUTPUT-ODW-001**: Generated Word document cannot open normally or has formatting corruption → 🔴 CRITICAL → Check font dependencies and script logs
- **OUTPUT-ODW-002**: Document elements are inconsistent with user-confirmed preview content → 🔴 CRITICAL → Re-verify consistency before proceeding
- **OUTPUT-ODW-003**: File save path exceeds expected directory scope → 🟡 WARN → Confirm path and record actual location in report

#### Red Flag Trigger Handling Procedure
🔴 CRITICAL → Stop immediately, report problem details, await instructions | 🟡 WARN → Log warning, attempt auto-fix, annotate in report | 🔵 INFO → Log info, continue normally
