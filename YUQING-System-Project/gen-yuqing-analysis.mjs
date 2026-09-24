#!/usr/bin/env node
/**
 * 舆情监测平台 · F-007「智能研判」代码生成器
 *
 * 依据：
 *   - dev-specs/F-007-analysis.md（11 条验收标准，P0，来源 REQ-007）
 *   - 架构决策：自建零依赖大模型通道（JDK HttpClient，不引入 ruoyi-common-ai，
 *     因为 ruoyi-admin 未依赖该模块且 snail-ai.enabled=false）+
 *     规则兜底 RuleJudger 作为 llm.enabled=false 时的默认路径
 *   - 复用 F-016 台账既有资产：LedgerScope / LedgerWrapperFactory / LedgerTimeParser /
 *     LedgerDetail / IYqLedgerService（读侧详情与数据权限）
 *   - 零新建表：yq_opinion_analysis / yq_opinion_cluster / yq_opinion_tag /
 *     yq_train_sample / yq_model_version / yq_knowledge 六表字段已完备
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/analysis/config/**    配置属性
 *   java/org/dromara/yuqing/analysis/llm/**       大模型通道（接口 + JDK HttpClient 实现）
 *   java/org/dromara/yuqing/analysis/parse/**     JSON 门面 + 结果解析
 *   java/org/dromara/yuqing/analysis/prompt/**    提示词规范与构建（含注入防护）
 *   java/org/dromara/yuqing/analysis/variant/**   隐性/变体表述识别
 *   java/org/dromara/yuqing/analysis/judge/**     规则兜底判定 + 结论融合
 *   java/org/dromara/yuqing/analysis/cluster/**   相似度 + 聚合决策
 *   java/org/dromara/yuqing/analysis/stage/**     传播脉络阶段判定与写出
 *   java/org/dromara/yuqing/analysis/domain/**    查询条件 / 列表行 / 详情 / 批量结果
 *   java/org/dromara/yuqing/analysis/dao/**       双库 DAO（Doris 读写 + MySQL 读写）
 *   java/org/dromara/yuqing/analysis/engine/**    单条研判流水线
 *   java/org/dromara/yuqing/analysis/service/**   编排服务 + 实现
 *   java/org/dromara/yuqing/controller/YqAnalysisController.java
 *   java/org/dromara/yuqing/job/YqAnalysisJobExecutor.java
 *   pc/api/yuqing/analysis/**                     PC 接口层
 *   pc/views/yuqing/analysis/**                   PC 研判中心页面
 *   config/yq_analysis.yml                        配置样例
 *   test/java/org/dromara/yuqing/analysis/F007AnalysisTest.java   离线自测
 *
 * 用法:
 *   node gen-yuqing-analysis.mjs             # 生成
 *   node gen-yuqing-analysis.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（本项目已因「两个生成器抢同一产物」踩过坑，此处严格声明）：
 *   本生成器 **不产出** 以下文件，它们分别归其它生成器所有：
 *     - YqOpinion / YqOpinionAnalysis / YqOpinionCluster / YqOpinionTag /
 *       YqTrainSample / YqModelVersion / YqKnowledge 的 domain、mapper、
 *       service 接口、service 实现、SQL、菜单与字典（gen-yuqing.mjs）
 *     - ledger/**（gen-yuqing-ledger.mjs）—— 本生成器只 **引用**
 *       LedgerScope / LedgerWrapperFactory / LedgerTimeParser / LedgerDetail /
 *       IYqLedgerService，不修改其中任何一行
 *     - push/**（gen-yuqing-alert.mjs）、analytics/**、report/**、wecom/**、
 *       collect/**（各自生成器）
 *     - job/ 下其余执行器；controller 下其余控制器
 *     - pc/api/yuqing/ledger/**、pc/views/yuqing/opinion/**（gen-yuqing-ledger.mjs）
 *       —— 本生成器产 pc/api/yuqing/analysis/** 与 pc/views/yuqing/analysis/**，
 *       与台账的「孤儿 API」（opinionAnalysis / trainSample / modelVersion 等）不重名
 *   本生成器需要「接管」的既有产物有两处，均写在对方生成器内部，不构成抢占：
 *     ① gen-yuqing-collect.mjs 的 OfflineCollectTestRunner.TARGETS 登记 F007AnalysisTest；
 *     ② gen-yuqing-alert.mjs 的 LevelResolver.ANALYZED 由 "done" 改为 "completed"
 *        （与字典 yq_analyze_status 对齐 —— 原来的 "done" 在任何地方都不会被写入，
 *        是一处从未生效的死常量）。
 */
import fs from 'fs';
import path from 'path';
import { ANALYSIS_TPL1 } from './gen-yuqing-analysis-tpl1.mjs';
import { ANALYSIS_TPL2 } from './gen-yuqing-analysis-tpl2.mjs';
import { ANALYSIS_TPL3 } from './gen-yuqing-analysis-tpl3.mjs';
import { ANALYSIS_TPL4 } from './gen-yuqing-analysis-tpl4.mjs';
import { ANALYSIS_TPL5 } from './gen-yuqing-analysis-tpl5.mjs';
import { ANALYSIS_TPL6 } from './gen-yuqing-analysis-tpl6.mjs';
import { ANALYSIS_TPL7 } from './gen-yuqing-analysis-tpl7.mjs';
import { ANALYSIS_TPL8 } from './gen-yuqing-analysis-tpl8.mjs';
import { ANALYSIS_TPL9 } from './gen-yuqing-analysis-tpl9.mjs';
import { ANALYSIS_TPL10 } from './gen-yuqing-analysis-tpl10.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [
  ...ANALYSIS_TPL1,
  ...ANALYSIS_TPL2,
  ...ANALYSIS_TPL3,
  ...ANALYSIS_TPL4,
  ...ANALYSIS_TPL5,
  ...ANALYSIS_TPL6,
  ...ANALYSIS_TPL7,
  ...ANALYSIS_TPL8,
  ...ANALYSIS_TPL9,
  ...ANALYSIS_TPL10,
];

/**
 * 归一化产物相对路径。
 *
 * Java 源码在模板里按「包内相对路径」书写（如 analysis/engine/AnalysisEngine.java），
 * 便于人读；写出前统一补上 java/org/dromara/yuqing/ 前缀。
 */
const JAVA_PREFIX = 'java/org/dromara/yuqing/';
const TOP_LEVELS = ['java/', 'pc/', 'h5/', 'sql/', 'config/', 'test/'];

function normRel(rel) {
  const r = rel.replace(/\\/g, '/');
  return TOP_LEVELS.some((p) => r.startsWith(p)) ? r : JAVA_PREFIX + r;
}

for (const f of FILES) {
  f.rel = normRel(f.rel);
}

/* ---------------------------------------------------------------- 自检 */

const seen = new Map();
const dup = [];
for (const f of FILES) {
  const key = f.rel.replace(/\\/g, '/');
  if (seen.has(key)) dup.push(key);
  seen.set(key, true);
}
if (dup.length) {
  console.error('✗ 模板内存在重复产物路径（会导致后写覆盖前写）：');
  for (const d of dup) console.error('    ' + d);
  process.exit(1);
}

const missing = FILES.filter(f => !f.rel || typeof f.content !== 'string' || !f.content.length);
if (missing.length) {
  console.error('✗ 存在缺失 rel 或 content 的模板项，数量: ' + missing.length);
  process.exit(1);
}

/* 三层转义护栏 ①：反引号必须写成 \` 才能出现在产物里，未转义会直接破坏模板串 */
const bad = FILES.filter(f => f.content.includes('`'));
if (bad.length) {
  console.error('✗ 以下产物内容含未转义的反引号，会破坏三层转义约定：');
  for (const b of bad) console.error('    ' + b.rel);
  process.exit(1);
}

/* 三层转义护栏 ②：产物内容里出现 ${...} 说明模板串插值没被转义成 \${ ——
 * 那会在生成阶段就被 JS 求值（未定义变量直接 ReferenceError），
 * 或者被静默替换成空串（变量存在但为 undefined），后者更难发现。
 *
 * 注：模板串里「真正的插值」是我们刻意使用的，此处校验的是**模板源码**
 * 而不是产物内容，见下方 checkTemplateSourceInterpolation()。 */
function checkTemplateSourceInterpolation() {
  const offenders = [];
  for (const tpl of ['gen-yuqing-analysis-tpl1.mjs', 'gen-yuqing-analysis-tpl2.mjs',
    'gen-yuqing-analysis-tpl3.mjs', 'gen-yuqing-analysis-tpl4.mjs',
    'gen-yuqing-analysis-tpl5.mjs', 'gen-yuqing-analysis-tpl6.mjs',
    'gen-yuqing-analysis-tpl7.mjs', 'gen-yuqing-analysis-tpl8.mjs',
    'gen-yuqing-analysis-tpl9.mjs', 'gen-yuqing-analysis-tpl10.mjs']) {
    const abs = path.join(ROOT, tpl);
    if (!fs.existsSync(abs)) continue;
    const lines = fs.readFileSync(abs, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('#')) return;
      const p = line.indexOf('${');
      if (p >= 0 && line[p - 1] !== '\\') {
        offenders.push(tpl + ':' + (i + 1) + '  ' + t.slice(0, 90));
      }
    });
  }
  if (offenders.length) {
    console.error('✗ 以下模板串含未转义的 ${ （会被 JS 提前求值，需写成 \\${）：');
    for (const o of offenders) console.error('    ' + o);
    process.exit(1);
  }
}
checkTemplateSourceInterpolation();

/* 三层转义护栏 ③：产物内容里出现真实控制字符（CR / TAB），
 * 说明模板里的 \r \t 少了反斜杠、被 JS 提前解析成了真实字符。
 * Java 字符字面量跨行会直接编译失败，且报错位置常在几百行之外。 */
const ctrlBad = [];
for (const f of FILES) {
  for (const ch of f.content) {
    if (ch === '\r' || ch === '\t') { ctrlBad.push(f.rel); break; }
  }
}
if (ctrlBad.length) {
  console.error('✗ 以下产物内容含真实 CR/TAB 控制字符（模板里的 \\r \\t 被提前解析）：');
  for (const c of ctrlBad) console.error('    ' + c);
  process.exit(1);
}

/* ------------------------------------------------- 跨生成器归属交叉检查
 *
 * 本生成器与其它生成器共用同一个暂存目录 yq-code/。
 * 「后跑的静默覆盖先跑的」是本项目最贵的坑（唯一现象是部署报告 ~0 覆盖），
 * 因此这里显式列出所有**不得**产出的路径。
 */
const OWNED_BY_OTHERS = [
  /* gen-yuqing.mjs：实体的四件套（本模块只引用，不产出） */
  'java/org/dromara/yuqing/domain/YqOpinion.java',
  'java/org/dromara/yuqing/domain/YqOpinionAnalysis.java',
  'java/org/dromara/yuqing/domain/YqOpinionCluster.java',
  'java/org/dromara/yuqing/domain/YqOpinionTag.java',
  'java/org/dromara/yuqing/domain/YqTrainSample.java',
  'java/org/dromara/yuqing/domain/YqModelVersion.java',
  'java/org/dromara/yuqing/domain/YqKnowledge.java',
  'java/org/dromara/yuqing/service/impl/YqOpinionServiceImpl.java',
  /* gen-yuqing.mjs：其它控制器（同名冲突会让菜单指向错误的接口） */
  'java/org/dromara/yuqing/controller/YqOpinionController.java',
  'java/org/dromara/yuqing/controller/YqAnalyticsController.java',
  /* gen-yuqing-ledger.mjs：台账读侧与导出 */
  'java/org/dromara/yuqing/controller/YqClusterController.java',
  'java/org/dromara/yuqing/ledger/service/IYqLedgerService.java',
  'java/org/dromara/yuqing/ledger/service/impl/YqLedgerServiceImpl.java',
  'java/org/dromara/yuqing/ledger/support/LedgerScope.java',
  'java/org/dromara/yuqing/ledger/support/LedgerWrapperFactory.java',
  'java/org/dromara/yuqing/ledger/support/LedgerTimeParser.java',
  'java/org/dromara/yuqing/ledger/domain/LedgerDetail.java',
  /* gen-yuqing-alert.mjs */
  'java/org/dromara/yuqing/alert/LevelResolver.java',
  /* gen-yuqing-collect.mjs */
  'java/org/dromara/yuqing/collect/pipeline/DorisStreamLoader.java',
];
const conflict = FILES.filter(f => OWNED_BY_OTHERS.includes(f.rel.replace(/\\/g, '/')));
if (conflict.length) {
  console.error('✗ 以下产物归其它生成器所有，本生成器不得产出：');
  for (const c of conflict) console.error('    ' + c.rel);
  process.exit(1);
}
if (!fs.existsSync(path.join(ROOT, 'gen-yuqing.mjs'))) {
  console.warn('⚠ 未找到主生成器 gen-yuqing.mjs，跳过归属交叉检查（请确认在工程根目录执行）');
}

/* Java 产物里出现 \n / \t 这类转义序列时最容易在四层传递中被吃掉一层。
 * 本项目约定 Java 一律用文本块或 (char) N 构造，这里只告警不拦截。 */
const ALLOW = /(F007AnalysisTest)\.java$/;
const suspicious = FILES.filter(f => f.rel.endsWith('.java')
  && /\\n|\\t/.test(f.content) && !ALLOW.test(f.rel));
if (suspicious.length) {
  console.warn('⚠ 以下 Java 产物含 \\n 或 \\t 转义序列，请确认不是转义层级错位：');
  for (const s of suspicious) console.warn('    ' + s.rel);
}

/* ---------------------------------------------------------------- 写出 */

const byDir = new Map();
let bytes = 0;
for (const f of FILES) {
  const rel = f.rel.replace(/\\/g, '/');
  const abs = path.join(OUT, rel);
  const dir = path.dirname(rel);
  byDir.set(dir, (byDir.get(dir) || 0) + 1);
  bytes += Buffer.byteLength(f.content, 'utf8');
  if (!DRY) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content, 'utf8');
  }
}

console.log('');
console.log('⚙  F-007 智能研判 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/analysis/config/', '配置属性'],
  ['java/org/dromara/yuqing/analysis/llm/', '大模型通道'],
  ['java/org/dromara/yuqing/analysis/parse/', 'JSON 门面 + 结果解析'],
  ['java/org/dromara/yuqing/analysis/prompt/', '提示词（含注入防护）'],
  ['java/org/dromara/yuqing/analysis/variant/', '变体表述识别'],
  ['java/org/dromara/yuqing/analysis/judge/', '规则兜底 + 结论融合'],
  ['java/org/dromara/yuqing/analysis/cluster/', '相似度 + 聚合决策'],
  ['java/org/dromara/yuqing/analysis/stage/', '传播脉络'],
  ['java/org/dromara/yuqing/analysis/domain/', '传输对象'],
  ['java/org/dromara/yuqing/analysis/dao/', '双库 DAO'],
  ['java/org/dromara/yuqing/analysis/engine/', '单条研判流水线'],
  ['java/org/dromara/yuqing/analysis/service/', '编排服务'],
  ['java/org/dromara/yuqing/controller/', 'PC 控制器'],
  ['java/org/dromara/yuqing/job/', '定时任务'],
  ['pc/', 'PC api + views'],
  ['config/', '配置样例'],
  ['test/', '离线自测'],
];
for (const [prefix, label] of groups) {
  const n = FILES.filter(f => f.rel.replace(/\\/g, '/').startsWith(prefix)).length;
  if (n === 0) continue;
  console.log('     ' + prefix.replace('java/org/dromara/yuqing/', '').padEnd(30) + String(n).padStart(3) + ' 文件   ' + label);
}
console.log('');
console.log('   合计 ' + FILES.length + ' 文件 / ' + (bytes / 1024).toFixed(1) + ' KB');
console.log('');
console.log('   下一步：');
console.log('     node --check gen-yuqing-analysis.mjs      # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run          # 部署预览（确认 ~0 覆盖）');
console.log('     node deploy-yuqing.mjs                    # 落盘到三个真实工程');
console.log('');
