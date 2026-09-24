#!/usr/bin/env node
/**
 * 舆情监测平台 · F-012「企业微信端任务管控（H5）」代码生成器
 *
 * 依据：
 *   - dev-specs/F-012-h5-console.md（12 条验收标准）
 *   - PRD §8.4 待确认 1（企业微信自建应用凭据，阻塞联调）
 *   - F-011 push 包既有基建（WecomTokenHolder / WecomTransport / PushUserDirectory）
 *
 * 产物（统一落在 yq-code/ 下，由 deploy-yuqing.mjs 搬运）：
 *   java/org/dromara/yuqing/wecom/config/**      企微配置（属性 / 授权链接 / 装配）
 *   java/org/dromara/yuqing/wecom/**             免登服务 / API 客户端 / 绑定解析 / 成员信息
 *   java/org/dromara/yuqing/wecom/command/**     指令类型 / 解析结果 / 解析引擎（纯函数）
 *   java/org/dromara/yuqing/wecom/domain/**      传输对象（AuthVo / HomeVo / Bo）
 *   java/org/dromara/yuqing/wecom/service/**     扩展服务接口与实现
 *   java/org/dromara/yuqing/wecom/controller/**  H5 端控制器（7 端点）
 *   config/yq_wecom.yml                          配置样例
 *   test/java/org/dromara/yuqing/wecom/F012WecomTest.java   离线自测（28 用例）
 *
 * 用法:
 *   node gen-yuqing-wecom.mjs             # 生成
 *   node gen-yuqing-wecom.mjs --dry-run   # 只列出将产出的文件
 *
 * ⚠ 归属边界（本项目已因「两个生成器抢同一产物」踩过坑，此处严格声明）：
 *   本生成器 **不产出** 以下文件，它们分别归其它生成器所有：
 *     - domain / mapper / service 接口 / service 实现 / 菜单与字典 SQL（gen-yuqing.mjs）
 *       ※ 例外：wecom/domain/** 下的 VO/BO 是本功能专属传输对象，不涉及数据库表，归本生成器
 *     - alert/**、push/**（gen-yuqing-alert.mjs）
 *     - analytics/**、job/YqStatsAggregateJobExecutor（gen-yuqing-analytics.mjs）
 *     - collect/**、sql/**、collect/OfflineCollectTestRunner.java（gen-yuqing-collect.mjs）
 *   本生成器 **接管** 的既有产物仅一处：在 gen-yuqing-collect.mjs 的 TARGETS 中登记
 *   F012WecomTest —— 该登记写在 collect 生成器内，不构成归属抢占。
 *
 * ⚠ 与 F-011 的 token 复用：WecomTokenHolder 不是 Spring Bean，由 YqWecomConfig 装配；
 *   与推送共用同一实例，避免两个持有者刷新 token 互相顶掉（企微同应用 token 全局唯一）。
 */
import fs from 'fs';
import path from 'path';
import { WECOM_TPL } from './gen-yuqing-wecom-tpl1.mjs';
import { WECOM_TPL2 } from './gen-yuqing-wecom-tpl2.mjs';
import { WECOM_TPL3 } from './gen-yuqing-wecom-tpl3.mjs';
import { WECOM_TPL4 } from './gen-yuqing-wecom-tpl4.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'yq-code');
const DRY = process.argv.slice(2).includes('--dry-run');

const FILES = [
  ...WECOM_TPL,
  ...WECOM_TPL2,
  ...WECOM_TPL3,
  ...WECOM_TPL4,
];

/**
 * 归一化产物相对路径。
 *
 * Java 源码在模板里按「包内相对路径」书写（如 wecom/WecomLoginService.java），
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
 * 本项目约定 Java 一律用文本块或显式字符串拼接，不用 \n。这里只告警不拦截。 */
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
console.log('⚙  F-012 企业微信端任务管控（H5） 代码生成' + (DRY ? '（dry-run，不落盘）' : ''));
console.log('   输出目录: ' + OUT);
console.log('');
console.log('   产物分组:');
const groups = [
  ['java/org/dromara/yuqing/wecom/command/', '指令解析引擎（纯函数）'],
  ['java/org/dromara/yuqing/wecom/config/', '企微配置与装配'],
  ['java/org/dromara/yuqing/wecom/domain/', '传输对象'],
  ['java/org/dromara/yuqing/wecom/service/', '扩展服务'],
  ['java/org/dromara/yuqing/wecom/controller/', 'H5 控制器'],
  ['java/org/dromara/yuqing/wecom/', '免登核心'],
  ['config/', '配置样例'],
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
console.log('     node --check gen-yuqing-wecom.mjs     # 语法自检');
console.log('     node deploy-yuqing.mjs --dry-run      # 部署预览');
console.log('     node deploy-yuqing.mjs                # 落盘到三个真实工程');
console.log('');
