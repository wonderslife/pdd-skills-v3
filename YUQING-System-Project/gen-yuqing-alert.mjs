#!/usr/bin/env node
/**
 * 舆情监测平台 · F-010「风险预警」+ F-011「企业微信推送」代码生成器
 *
 * 依据：
 *   - dev-specs/F-010-alert.md（10 条验收标准）
 *   - dev-specs/F-011-push.md（11 条验收标准）
 *   - dev-specs/F-008-level-rule.md（分级体系：兜底分级器口径）
 *   - docs/技术架构说明.md §4.6（yq_opinion 在 Doris，业务侧只读）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/alert/**    预警引擎（场景 / 规则 / 计数 / 突发增量 / 指纹 / 状态机 / 主引擎 / 兜底分级）
 *   java/org/dromara/yuqing/push/**     推送引擎（场景 / 免打扰 / 目标解析 / 模板渲染 / 通道 SPI / 重试 / 调度器）
 *   java/org/dromara/yuqing/service/**  预警与推送调度服务
 *   java/org/dromara/yuqing/controller/YqAlertDispatchController.java
 *   java/org/dromara/yuqing/controller/YqPushDispatchController.java
 *   java/org/dromara/yuqing/job/YqAlertScanJobExecutor.java
 *   config/yq_alert.yml                 配置样例
 *   pc/api/yuqing/{alert,push}/dispatch.ts
 *   pc/views/yuqing/{alert,alertRule,pushRule,pushTemplate,pushRecord}/index.vue
 *   h5/api/yuqing/alert/dispatch.js
 *   h5/pages/yuqing/alert/index.vue
 *   test/java/org/dromara/yuqing/alert/F010AlertPushTest.java
 *
 * 用法:
 *   node gen-yuqing-alert.mjs             # 生成
 *   node gen-yuqing-alert.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（防止两个生成器抢同一产物，本项目已踩过一次坑）：
 *   本生成器不产出以下文件，它们分别归 gen-yuqing.mjs / gen-yuqing-collect.mjs 所有：
 *     - PC 端 CRUD 的 index.ts 与 types.ts（字段驱动，gen-yuqing.mjs）
 *     - H5 端 api（除 alert/dispatch.js 外，gen-yuqing.mjs）
 *     - domain / mapper / service 接口 / service 实现（gen-yuqing.mjs）
 *     - collect 引擎、sql 脚本、OfflineCollectTestRunner.java（gen-yuqing-collect.mjs）
 *   若日后把 alert/alertRule/pushRule/pushTemplate/pushRecord 任一表改成 pcPage: true，
 *   必须先删掉本文件的对应 view 模板，否则会互相覆盖。
 */
import fs from 'fs';
import path from 'path';
import { ALERT_TPL } from './gen-yuqing-alert-tpl1.mjs';
import { PUSH_TPL } from './gen-yuqing-alert-tpl2.mjs';
import { WEB_TPL } from './gen-yuqing-alert-tpl3.mjs';
import { WEB_PC_TPL } from './gen-yuqing-alert-tpl4.mjs';
import { TEST_TPL } from './gen-yuqing-alert-tpl5.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [...ALERT_TPL, ...PUSH_TPL, ...WEB_TPL, ...WEB_PC_TPL, ...TEST_TPL];

/**
 * 归一化产物相对路径。
 *
 * 模板里 Java 源码按「包内相对路径」书写（如 alert/AlertEngine.java、push/PushScene.java），
 * 便于人读；写出前统一补上 java/org/dromara/yuqing/ 前缀，与 gen-yuqing.mjs /
 * gen-yuqing-collect.mjs 的输出布局对齐（deploy-yuqing.mjs 按该布局搬运）。
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
 *   2) ${ 不拦：模板里写成 \${ 时产物得到字面 ${ （如 yq_alert.yml 的环境变量占位符），
 *      这是正确行为；若有人漏写反斜杠，Node 在生成阶段就会抛 ReferenceError，天然被拦住。 */
const bad = FILES.filter(f => f.content.includes('`'));
if (bad.length) {
  console.error('✗ 以下产物内容含未转义的反引号，会破坏三层转义约定：');
  for (const b of bad) console.error('    ' + b.rel);
  process.exit(1);
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
console.log('⚙  F-010 预警 / F-011 推送 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/alert/', 'F-010 预警引擎'],
  ['java/org/dromara/yuqing/push/', 'F-011 推送引擎'],
  ['java/org/dromara/yuqing/service/', '调度服务（预警 + 推送）'],
  ['java/org/dromara/yuqing/controller/', '调度控制器'],
  ['java/org/dromara/yuqing/job/', 'SnailJob 定时任务'],
  ['config/', '配置样例'],
  ['pc/', 'PC 端 api + views'],
  ['h5/', 'H5 端 api + pages'],
  ['test/', '离线自测'],
];
for (const [prefix, label] of groups) {
  const n = FILES.filter(f => f.rel.replace(/\\/g, '/').startsWith(prefix)).length;
  console.log('     ' + prefix.replace('java/org/dromara/yuqing/', '').padEnd(14) + String(n).padStart(3) + ' 文件   ' + label);
}
console.log('');
console.log('   合计 ' + FILES.length + ' 文件 / ' + (bytes / 1024).toFixed(1) + ' KB');
console.log('');
console.log('   下一步：');
console.log('     node --check gen-yuqing-alert.mjs        # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run         # 部署预览');
console.log('     node deploy-yuqing.mjs                   # 落盘到三个真实工程');
console.log('');
