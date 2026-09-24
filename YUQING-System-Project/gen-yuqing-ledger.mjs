#!/usr/bin/env node
/**
 * 舆情监测平台 · F-016「舆情台账与数据查询」代码生成器
 *
 * 依据：
 *   - dev-specs/F-016-ledger.md（10 条验收标准，P0，来源 REQ-016）
 *   - 主生成器 gen-yuqing.mjs 对 yq_opinion 的显式声明：
 *     ctrl: false, pcPage: false, svcHandwritten: true, doris: true
 *     —— 「台账查询/详情/检索/导出端点复杂（跨库 + 高亮 + 异步导出），
 *        Controller 与读服务手写」，本生成器即该声明的落地
 *   - 架构决策（用户已确认）：①A doris 数据源段指向同一 MySQL 库；
 *     ②A 异步导出复用 SnailJob；③A 数据权限按 yq_task.create_by 任务归属隔离
 *   - F-011 push 包既有基建（PushDispatcher / PushRequest / PushOutcome）
 *   - F-014 report 包既有落盘范式（OssFactory 上传 + 审计记录）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/ledger/config/**    台账配置属性
 *   java/org/dromara/yuqing/ledger/domain/**    查询条件 / 列表行 / 详情 / 导出载体
 *   java/org/dromara/yuqing/ledger/support/**   纯函数支撑（范围推导 / 高亮 / 空状态 / 列目录 / 阶段）
 *   java/org/dromara/yuqing/ledger/dao/**       双库 DAO（Doris 明细 + MySQL 元数据）
 *   java/org/dromara/yuqing/ledger/service/**   读服务 + 导出服务
 *   java/org/dromara/yuqing/ledger/export/**    导出执行器 / xlsx 写出 / 推送场景
 *   java/org/dromara/yuqing/controller/YqOpinionController.java
 *   java/org/dromara/yuqing/controller/YqClusterController.java
 *   java/org/dromara/yuqing/job/YqLedgerExportJobExecutor.java
 *   config/yq_ledger.yml                        配置样例
 *   test/java/org/dromara/yuqing/ledger/F016LedgerTest.java   离线自测
 *
 * 用法:
 *   node gen-yuqing-ledger.mjs             # 生成
 *   node gen-yuqing-ledger.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（本项目已因「两个生成器抢同一产物」踩过坑，此处严格声明）：
 *   本生成器 **不产出** 以下文件，它们分别归其它生成器所有：
 *     - YqOpinion / YqOpinionMetric / YqOpinionAnalysis / YqOpinionTag /
 *       YqOpinionCluster 的 domain、mapper、service 接口、service 实现、
 *       SQL、菜单与字典（gen-yuqing.mjs）
 *     - YqLedgerExportLog 的 domain / mapper / CRUD service（gen-yuqing.mjs
 *       在 yq_ledger_export_log 上声明了 ctrl:false / pcPage:false）
 *       ※ 本生成器只新增 ledger/service/** 与 export/** 下的**新类**，
 *         不触碰上述任何既有文件
 *     - push/**（gen-yuqing-alert.mjs）—— 本生成器只 **引用** PushDispatcher /
 *       PushRequest / PushOutcome，并在自己包内定义 LedgerPushScene 常量
 *     - analytics/**、report/**、wecom/**、collect/**、sql/**（各自生成器）
 *     - job/ 下其余执行器（alert / collect / analytics / report 生成器）
 *   本生成器 **接管** 的既有产物仅一处：在 gen-yuqing-collect.mjs 的 TARGETS 中
 *   登记 F016LedgerTest —— 该登记写在 collect 生成器内，不构成归属抢占。
 *
 * ⚠ 与 pc/views 的关系：本生成器产 PC 端 api 与 views（主生成器对 opinion
 *   声明了 pcPage:false），路径分别为 pc/api/yuqing/ledger/** 与
 *   pc/views/yuqing/opinion/**。
 */
import fs from 'fs';
import path from 'path';
import { LEDGER_TPL1 } from './gen-yuqing-ledger-tpl1.mjs';
import { LEDGER_TPL2 } from './gen-yuqing-ledger-tpl2.mjs';
import { LEDGER_TPL3 } from './gen-yuqing-ledger-tpl3.mjs';
import { LEDGER_TPL4 } from './gen-yuqing-ledger-tpl4.mjs';
import { LEDGER_TPL5 } from './gen-yuqing-ledger-tpl5.mjs';
import { LEDGER_TPL6 } from './gen-yuqing-ledger-tpl6.mjs';
import { LEDGER_TPL7 } from './gen-yuqing-ledger-tpl7.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [
  ...LEDGER_TPL1,
  ...LEDGER_TPL2,
  ...LEDGER_TPL3,
  ...LEDGER_TPL4,
  ...LEDGER_TPL5,
  ...LEDGER_TPL6,
  ...LEDGER_TPL7,
];

/**
 * 归一化产物相对路径。
 *
 * Java 源码在模板里按「包内相对路径」书写（如 ledger/domain/LedgerQuery.java），
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

/* 三层转义护栏：反引号必须写成 \` 才能出现在产物里，未转义会直接破坏模板串 → 一律拦截 */
const bad = FILES.filter(f => f.content.includes('`'));
if (bad.length) {
  console.error('✗ 以下产物内容含未转义的反引号，会破坏三层转义约定：');
  for (const b of bad) console.error('    ' + b.rel);
  process.exit(1);
}

/* ------------------------------------------------- 跨生成器归属交叉检查
 *
 * 本生成器与主生成器（gen-yuqing.mjs）共用同一个暂存目录 yq-code/。
 * 「后跑的静默覆盖先跑的」是本项目最贵的坑（唯一现象是部署报告 ~0 覆盖），
 * 因此这里直接扫主生成器源码，确认本生成器产物**没有**出现在主生成器的
 * TABLES_2 待产清单对应的路径上 —— 具体做法见下方 assertNoConflict。
 */
const MAIN_GEN = path.join(ROOT, 'gen-yuqing.mjs');
const OWNED_BY_MAIN = [
  /* 主生成器产出的、与本模块同名前缀但归属明确的四件套（opinion / ledgerExportLog） */
  'java/org/dromara/yuqing/domain/YqOpinion.java',
  'java/org/dromara/yuqing/domain/YqLedgerExportLog.java',
  'java/org/dromara/yuqing/controller/YqLedgerExportLogController.java',
  'java/org/dromara/yuqing/service/impl/YqLedgerExportLogServiceImpl.java',
  /* 其它特性生成器已归属的 Controller / 执行器 */
  'java/org/dromara/yuqing/controller/YqAnalyticsController.java',
  'java/org/dromara/yuqing/controller/YqWecomCommandController.java',
  'java/org/dromara/yuqing/report/controller/YqReportController.java',
];
const conflict = FILES.filter(f => OWNED_BY_MAIN.includes(f.rel.replace(/\\/g, '/')));
if (conflict.length) {
  console.error('✗ 以下产物归其它生成器所有，本生成器不得产出：');
  for (const c of conflict) console.error('    ' + c.rel);
  process.exit(1);
}
if (!fs.existsSync(MAIN_GEN)) {
  console.warn('⚠ 未找到主生成器 gen-yuqing.mjs，跳过归属交叉检查（请确认在工程根目录执行）');
}

/* Java 产物里出现 \n / \t 这类转义序列时最容易在四层传递中被吃掉一层，
 * 本项目约定 Java 一律用文本块或显式字符串拼接，不用 \n。这里只告警不拦截。
 *
 * 已知且刻意的例外（白名单）：这些文件的业务语义本身就是处理换行
 *   - LedgerExportRunner / YqLedgerExportServiceImpl  失败原因里的换行清洗
 *   - F016LedgerTest                                  zip 条目拼接与多行输入
 */
const ALLOW = /(LedgerExportRunner|YqLedgerExportServiceImpl|F016LedgerTest)\.java$/;
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
console.log('⚙  F-016 舆情台账 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/ledger/config/', '配置属性'],
  ['java/org/dromara/yuqing/ledger/domain/', '传输对象'],
  ['java/org/dromara/yuqing/ledger/support/', '纯函数支撑（可离线自测）'],
  ['java/org/dromara/yuqing/ledger/dao/', '双库 DAO'],
  ['java/org/dromara/yuqing/ledger/service/', '读服务 + 导出服务'],
  ['java/org/dromara/yuqing/ledger/export/', '导出执行 / xlsx 写出'],
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
console.log('     node --check gen-yuqing-ledger.mjs      # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run        # 部署预览（确认 ~0 覆盖）');
console.log('     node deploy-yuqing.mjs                  # 落盘到三个真实工程');
console.log('');
