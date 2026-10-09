#!/usr/bin/env node
/**
 * 舆情监测平台 · F-014「舆情日报生成」代码生成器
 *
 * 依据：
 *   - dev-specs/F-014-daily-report.md（11 条验收标准）
 *   - 主生成器 gen-yuqing.mjs 对 yq_report 的显式声明：
 *     // 生成/校对/导出/提交/推送端点复杂（文档渲染 + MinIO），Controller 与 ExtService 手写
 *     ctrl: false, pcPage: false, svcHandwritten: true
 *     —— 本生成器即该声明的落地
 *   - F-009 analytics 包既有基建（ReportHandoffBuilder / DashboardView / AggregateScope）
 *   - F-011 push 包既有基建（PushDispatcher / PushRequest / PushTargetResolver / PushScene.REPORT_READY）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/report/config/**     报告生成配置属性
 *   java/org/dromara/yuqing/report/build/**      正文构建器（纯函数，可离线自测）
 *   java/org/dromara/yuqing/report/domain/**     传输对象（BO / 结果 / 行记录）
 *   java/org/dromara/yuqing/report/render/**     Word / PDF 渲染与 Markdown→HTML
 *   java/org/dromara/yuqing/report/push/**       报告推送器（复用 F-011）
 *   java/org/dromara/yuqing/report/service/**    扩展服务接口与实现
 *   java/org/dromara/yuqing/controller/YqReportController.java
 *   java/org/dromara/yuqing/job/YqDailyReportJobExecutor.java
 *   config/yq_report.yml                         配置样例
 *   test/java/org/dromara/yuqing/report/F014ReportTest.java   离线自测
 *
 * 用法:
 *   node gen-yuqing-report.mjs             # 生成
 *   node gen-yuqing-report.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（本项目已因「两个生成器抢同一产物」踩过坑，此处严格声明）：
 *   本生成器 **不产出** 以下文件，它们分别归其它生成器所有：
 *     - YqReport / YqReportSection / YqReportOpinion 的 domain、mapper、
 *       service 接口、service 实现、SQL、菜单与字典（gen-yuqing.mjs）
 *       ※ 主生成器对这三个实体声明了 ctrl:false / pcPage:false，
 *         即「上层由手写补齐」——本生成器补的正是 controllers 与 report/service/**
 *     - reportTemplate / reportSection 的 CRUD Controller（gen-yuqing.mjs）
 *     - alert/**、push/**（gen-yuqing-alert.mjs）
 *       ※ 例外：report/push/ReportPusher 是本功能专属的推送编排，不是 push 包基建
 *     - analytics/**、job/YqStatsAggregateJobExecutor（gen-yuqing-analytics.mjs）
 *     - collect/**、sql/**、collect/OfflineCollectTestRunner（gen-yuqing-collect.mjs）
 *     - job/ 下其余执行器（分别归 alert / collect / analytics 生成器）
 *   本生成器 **接管** 的既有产物仅一处：在 gen-yuqing-collect.mjs 的 TARGETS 中
 *   登记 F014ReportTest —— 该登记写在 collect 生成器内，不构成归属抢占。
 *
 * ⚠ 与 pc/views 的关系：本生成器产 PC 端 api 与 views（主生成器声明 pcPage:false），
 *   路径分别为 pc/api/yuqing/report/** 与 pc/views/yuqing/report/**。
 */
import fs from 'fs';
import path from 'path';
import { REPORT_TPL1 } from './gen-yuqing-report-tpl1.mjs';
import { REPORT_TPL2 } from './gen-yuqing-report-tpl2.mjs';
import { REPORT_TPL3 } from './gen-yuqing-report-tpl3.mjs';
import { REPORT_TPL4 } from './gen-yuqing-report-tpl4.mjs';
import { REPORT_TPL5 } from './gen-yuqing-report-tpl5.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [
  ...REPORT_TPL1,
  ...REPORT_TPL2,
  ...REPORT_TPL3,
  ...REPORT_TPL4,
  ...REPORT_TPL5,
];

/**
 * 归一化产物相对路径。
 *
 * Java 源码在模板里按「包内相对路径」书写（如 report/build/DailyReportBuilder.java），
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

/* Java 产物里出现 \n / \t 这类转义序列时最容易在四层传递中被吃掉一层，
 * 本项目约定 Java 一律用文本块或显式字符串拼接，不用 \n。这里只告警不拦截。
 *
 * 已知且刻意的例外（白名单）：这些文件的业务语义本身就是处理换行
 *   - DailyReportBuilder  NL 常量（拼接正文）
 *   - ReportFileName      ILLEGAL 正则（清洗换行与制表符）
 *   - MarkdownToHtml      按行切分的正则
 *   - WordRenderer        按行切分的正则
 *   - ReportPusher        降级摘要拼接
 *   - F014ReportTest      断言里的多行 Markdown 输入
 */
const ALLOW = /(DailyReportBuilder|ReportFileName|MarkdownToHtml|WordRenderer|ReportPusher|F014ReportTest)\.java$/;
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
console.log('⚙  F-014 舆情日报生成 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/report/build/', '正文构建（纯函数）'],
  ['java/org/dromara/yuqing/report/render/', 'Word / PDF 渲染'],
  ['java/org/dromara/yuqing/report/domain/', '传输对象'],
  ['java/org/dromara/yuqing/report/config/', '配置属性'],
  ['java/org/dromara/yuqing/report/service/', '扩展服务'],
  ['java/org/dromara/yuqing/report/push/', '报告推送'],
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
console.log('     node --check gen-yuqing-report.mjs     # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run       # 部署预览');
console.log('     node deploy-yuqing.mjs                 # 落盘到三个真实工程');
console.log('');
