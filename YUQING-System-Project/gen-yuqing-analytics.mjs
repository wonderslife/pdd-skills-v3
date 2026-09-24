#!/usr/bin/env node
/**
 * 舆情监测平台 · F-009「多维分析」代码生成器
 *
 * 依据：
 *   - dev-specs/F-009-analytics.md（10 条验收标准，脚本实测，勿沿用旧叙述）
 *   - docs/技术架构说明.md §4.7（预聚合落 Doris，Unique Key 覆盖写）
 *   - dev-specs/F-006 产出字段（去重率 / 降噪率）
 *   - dev-specs/F-010/F-011 产出字段（预警命中率 / 推送成功率）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/analytics/**        分析引擎（枚举 / 切片 / 归一 / 聚合 / 结论 / 看板装配 / 下钻 / 导出 / 报告交接）
 *   java/org/dromara/yuqing/analytics/jdbc/**   明细读取与预聚合读写（全部 LambdaQueryWrapper / 预编译占位符）
 *   java/org/dromara/yuqing/analytics/config/** 引擎配置
 *   java/org/dromara/yuqing/service/IYqAnalyticsService.java + impl
 *   java/org/dromara/yuqing/controller/YqAnalyticsController.java
 *   java/org/dromara/yuqing/job/YqStatsAggregateJobExecutor.java
 *   config/yq_analytics.yml                     配置样例
 *   pc/api/yuqing/analytics/{index,types}.ts
 *   pc/views/yuqing/dashboard/{index,DimBars,ConclusionPanel,DrilldownDrawer}.vue
 *   test/java/org/dromara/yuqing/analytics/F009AnalyticsTest.java
 *
 * 用法:
 *   node gen-yuqing-analytics.mjs             # 生成
 *   node gen-yuqing-analytics.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（本项目已因「两个生成器抢同一产物」踩过坑）：
 *   本生成器 **不产出** 以下文件，它们分别归 gen-yuqing.mjs / gen-yuqing-collect.mjs / gen-yuqing-alert.mjs 所有：
 *     - domain / mapper / service 接口 / service 实现 / 菜单与字典 SQL（gen-yuqing.mjs）
 *     - collect 引擎、sql/**、OfflineCollectTestRunner.java（gen-yuqing-collect.mjs）
 *     - alert/**、push/**、预警与推送控制器与任务（gen-yuqing-alert.mjs）
 *   同理，本生成器 **不接管** yq_stats_daily / yq_stats_dim / yq_stats_hot / yq_stats_batch 四张表的
 *   建表 DDL —— 它们由 gen-yuqing.mjs（Doris 侧）与 gen-yuqing-collect.mjs（MySQL 镜像侧）产出。
 */
import fs from 'fs';
import path from 'path';
import { ANALYTICS_TPL } from './gen-yuqing-analytics-tpl1.mjs';
import { ANALYTICS_TPL2 } from './gen-yuqing-analytics-tpl2.mjs';
import { ANALYTICS_TPL3 } from './gen-yuqing-analytics-tpl3.mjs';
import { ANALYTICS_TPL4 } from './gen-yuqing-analytics-tpl4.mjs';
import { ANALYTICS_TPL5 } from './gen-yuqing-analytics-tpl5.mjs';
import { ANALYTICS_TPL6 } from './gen-yuqing-analytics-tpl6.mjs';
import { ANALYTICS_TPL7 } from './gen-yuqing-analytics-tpl7.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [
  ...ANALYTICS_TPL,
  ...ANALYTICS_TPL2,
  ...ANALYTICS_TPL3,
  ...ANALYTICS_TPL4,
  ...ANALYTICS_TPL5,
  ...ANALYTICS_TPL6,
  ...ANALYTICS_TPL7,
];

/**
 * 归一化产物相对路径。
 *
 * Java 源码在模板里按「包内相对路径」书写（如 analytics/StatsGrain.java、service/IYqAnalyticsService.java），
 * 便于人读；写出前统一补上 java/org/dromara/yuqing/ 前缀，与其它生成器输出布局对齐。
 * ⚠ 注意：config/yq_analytics.yml 是「配置样例」而不是 Java 包路径 ——
 *   由于 TOP_LEVELS 先于前缀补全判断，它会被正确保留为 config/ 下的一级目录。
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

/* 三层转义护栏：
 *   1) 反引号必须写成 \` 才能出现在产物里，未转义会直接破坏模板串 → 一律拦截；
 *   2) ${ 不拦：模板里写成 \${ 时产物得到字面 ${（如 yq_analytics.yml 的环境变量占位符），
 *      这是正确行为；若有人漏写反斜杠，Node 在生成阶段就会抛 ReferenceError，天然被拦住。 */
const bad = FILES.filter(f => f.content.includes('`'));
if (bad.length) {
  console.error('✗ 以下产物内容含未转义的反引号，会破坏三层转义约定：');
  for (const b of bad) console.error('    ' + b.rel);
  process.exit(1);
}

/* Java 产物里出现 \n / \t 这类转义序列时最容易在四层传递中被吃掉一层，
 * 本项目约定 Java 一律用文本块或显式字符串拼接，不用 \n。这里只做告警不拦截，
 * 因为 SQL 与前端模板里合法地存在 \n（如 TS 的模板字面量换行）。 */
const suspicious = FILES.filter(f => f.rel.endsWith('.java') && /\\n|\\t/.test(f.content));
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
console.log('⚙  F-009 多维分析 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/analytics/jdbc/', '明细读取与预聚合读写'],
  ['java/org/dromara/yuqing/analytics/config/', '引擎配置'],
  ['java/org/dromara/yuqing/analytics/', '分析引擎（纯函数为主）'],
  ['java/org/dromara/yuqing/service/', '分析服务接口与实现'],
  ['java/org/dromara/yuqing/controller/', '看板控制器'],
  ['java/org/dromara/yuqing/job/', 'SnailJob 定时预聚合'],
  ['config/', '配置样例'],
  ['pc/', 'PC 端 api + 看板视图'],
  ['test/', '离线自测'],
];
for (const [prefix, label] of groups) {
  const n = FILES.filter(f => f.rel.replace(/\\/g, '/').startsWith(prefix)).length;
  console.log('     ' + prefix.replace('java/org/dromara/yuqing/', '').padEnd(30) + String(n).padStart(3) + ' 文件   ' + label);
}
console.log('');
console.log('   合计 ' + FILES.length + ' 文件 / ' + (bytes / 1024).toFixed(1) + ' KB');
console.log('');
console.log('   下一步：');
console.log('     node --check gen-yuqing-analytics.mjs     # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run          # 部署预览');
console.log('     node deploy-yuqing.mjs                    # 落盘到三个真实工程');
console.log('');
