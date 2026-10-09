#!/usr/bin/env node
/**
 * 舆情平台 · 全量生成器编排与产物定稿校验
 *
 * 为什么需要它：所有生成器都写同一个暂存目录 yq-code/，且存在
 * 【多生成器共管同一产物】的两段式覆盖设计（例如 pc/api/yuqing/report/*：
 * 主生成器先出基础 CRUD，gen-yuqing-report.mjs 再接管覆盖成 F-014 增强版）。
 * 只要生成器顺序跑错、或漏跑接管方，就会静默丢失增强版产物
 * —— 唯一现象是「前端突然报 TS2305 找不到导出」。
 *
 * ⚠ 本脚本【不 spawn 子进程】（沙箱下 spawn 会 EBUSY）。它有两种用法：
 *
 *   1) 打印执行顺序（供外部按序执行）：
 *        node gen-all.mjs --list
 *      输出形如：
 *        node gen-yuqing.mjs && node gen-yuqing-collect.mjs && ... 
 *      直接复制到 shell 执行即可。
 *
 *   2) 生成完毕后做产物定稿 + 交付前体检：
 *        node gen-all.mjs --verify
 *      检查两段式覆盖产物是否由接管方定稿、暂存目录是否齐备。
 *
 * 顺序约束（改动务必同步本表）：
 *   1. gen-yuqing.mjs            主生成器（表/字典/菜单/基础三端 CRUD）
 *   2. gen-yuqing-collect.mjs    采集 + 净化 + Doris MySQL 镜像建表
 *   3. gen-yuqing-alert.mjs      F-010 预警 + F-011 推送
 *   4. gen-yuqing-analytics.mjs  F-009 多维分析
 *   5. gen-yuqing-report.mjs     F-014 日报生成【接管覆盖 report API/views】
 *   6. gen-yuqing-wecom.mjs      F-012 企微 H5
 *   7. gen-yuqing-ledger.mjs     F-016 舆情台账（台账/检索/导出/聚合视图）
 *   8. gen-yuqing-analysis.mjs   F-007 智能研判（研判中心页面，不接管任何既有产物）
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

/** 执行顺序：(文件, 职责说明, 是否覆盖他人产物) */
const PIPELINE = [
  ['gen-yuqing.mjs',            '主生成器：25 表 + 43 字典 + 84 菜单 + 三端基础 CRUD', false],
  ['gen-yuqing-collect.mjs',    'F-004/006：采集引擎 + 净化去重 + Doris MySQL 镜像 9 表', false],
  ['gen-yuqing-alert.mjs',      'F-010/011：预警引擎 + 企微推送', false],
  ['gen-yuqing-analytics.mjs',  'F-009：多维分析 + 预聚合', false],
  ['gen-yuqing-report.mjs',     'F-014：日报生成【覆盖 pc/api/yuqing/report/* 基础版】', true],
  ['gen-yuqing-wecom.mjs',      'F-012：企业微信 H5 后端', false],
  ['gen-yuqing-ledger.mjs',     'F-016：舆情台账（台账/检索/导出/事件聚合视图）', false],
  /* 必须排在最后：F-007 会「接管」两处既有产物 ——
   *   ① gen-yuqing-collect.mjs 的 OfflineCollectTestRunner.TARGETS 登记 F007AnalysisTest；
   *   ② gen-yuqing-alert.mjs 的 LevelResolver.ANALYZED 由 "done" 改为 "completed"。
   * 这两处都写在对方生成器内部，不构成对 yq-code/ 产物的抢占（分析产物零覆盖）。 */
  ['gen-yuqing-analysis.mjs',   'F-007：智能研判（研判中心 + 大模型通道 + 规则兜底）', false],
];

/** 两段式覆盖产物：必须由「接管方」最终定稿 */
const TAKEOVER_ARTIFACTS = [
  {
    rel: 'pc/api/yuqing/report/index.ts',
    producer: 'gen-yuqing.mjs',
    takeover: 'gen-yuqing-report.mjs',
    minExports: 10, // F-014 增强版应有 13 个导出
  },
  {
    rel: 'pc/api/yuqing/report/types.ts',
    producer: 'gen-yuqing.mjs',
    takeover: 'gen-yuqing-report.mjs',
    minExports: 6,  // F-014 增强版应有 7 个接口
  },
];

const argv = process.argv.slice(2);
const listOnly = argv.includes('--list');

/* ---------- 0. --list：打印可直接执行的命令链 ---------- */
if (listOnly) {
  console.log('舆情平台生成器执行顺序：');
  PIPELINE.forEach(([f, desc, takes], i) => {
    console.log(`  ${i + 1}. ${f.padEnd(28)} ${desc}${takes ? '   ⚠ 接管覆盖' : ''}`);
  });
  console.log('\n--- 复制以下单行命令到 shell 执行（顺序不可变、不可漏跑）---\n');
  console.log('node ' + PIPELINE.map(([f]) => f).join(' && node '));
  console.log('\n--- 或逐条执行 ---');
  PIPELINE.forEach(([f]) => console.log(`node ${f}`));
  console.log('\n提示：跑完后再执行 `node gen-all.mjs --verify` 校验接管产物是否定稿。');
  process.exit(0);
}

/* ---------- 1. 生成器存在性预检（不 spawn，仅存在性） ---------- */
console.log('=== [1] 生成器清单预检 ===');
let miss = 0;
for (const [f] of PIPELINE) {
  if (!fs.existsSync(path.join(ROOT, f))) { console.log(`  ✗ 缺失 ${f}`); miss++; }
  else console.log(`  ✓ ${f}`);
}
if (miss) { console.log(`\n${miss} 个生成器缺失，终止。`); process.exit(1); }

/* ---------- 2. 接管产物定稿校验 ---------- */
console.log('\n=== [2] 两段式覆盖产物定稿校验 ===');
let artFail = 0;
for (const a of TAKEOVER_ARTIFACTS) {
  const p = path.join(ROOT, 'yq-code', a.rel);
  if (!fs.existsSync(p)) { console.log(`  ✗ ${a.rel} 不存在（应由 ${a.takeover} 产出）`); artFail++; continue; }
  const txt = fs.readFileSync(p, 'utf-8');
  const n = (txt.match(/^export\s/gm) || []).length;
  if (n >= a.minExports) {
    console.log(`  ✓ ${a.rel.padEnd(36)} ${n} 个导出（≥${a.minExports}，已由 ${a.takeover} 定稿）`);
  } else {
    console.log(`  ✗ ${a.rel} 仅 ${n} 个导出（应 ≥${a.minExports}）`);
    console.log(`      → 疑似被 ${a.producer} 的基础版覆盖，${a.takeover} 未接管或顺序错误`);
    artFail++;
  }
}

/* ---------- 3. 暂存目录产物总览 ---------- */
console.log('\n=== [3] 暂存目录产物 ===');
for (const d of ['java', 'sql', 'config', 'pc', 'h5', 'test']) {
  const dir = path.join(ROOT, 'yq-code', d);
  if (!fs.existsSync(dir)) { console.log(`  ${d.padEnd(10)} (无)`); continue; }
  let n = 0;
  const walk = (x) => {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      const p = path.join(x, e.name);
      if (e.isDirectory()) walk(p); else n++;
    }
  };
  walk(dir);
  console.log(`  ${d.padEnd(10)} ${n} 文件`);
}

console.log('');
if (artFail) {
  console.log(`❌ ${artFail} 个接管产物未定稿，请检查生成器顺序。`);
  process.exit(1);
}
console.log('✅ 接管产物均已定稿。下一步：node check-yuqing-sql.mjs && node deploy-yuqing.mjs');
