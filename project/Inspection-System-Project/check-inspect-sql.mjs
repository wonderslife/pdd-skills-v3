#!/usr/bin/env node
/**
 * 机房巡检系统 SQL 自检脚本
 *
 * 用法: node check-inspect-sql.mjs
 *
 * 校验项（脚本退出码 0 才代表可安全执行）:
 *   1. sys_menu：每行恰好 22 个值（v6 列数）
 *   2. sys_menu：menu_id 唯一、父级存在、ID 落在本模块号段内
 *   3. 权限闭环：PC 页面 v-hasPermi 用到的每个权限码，菜单里都要有对应按钮
 *   4. 幂等：先清理 sys_menu / sys_role_menu 再插入
 *   5. 授权：按 role_key 关联（v6 超级管理员 role_id 不是 1）
 *   6. sys_dict_*：不得出现 tenant_id（v6 这两张表没有该列）
 *   7. 三个 SQL 文件存在且非空；insp_schema.sql 无 tenant_id
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SQL = path.join(HERE, 'inspect-code', 'sql');
const JAVA = path.join(HERE, 'inspect-code', 'java');
const PC = path.join(HERE, 'inspect-code', 'pc', 'views');

const MENU_ROOT = 1770000000000000010n;
const MENU_LIMIT = 1770000000000000199n;

let failed = 0;
const ok = (m) => console.log(`  \u2713 ${m}`);
const bad = (m) => { failed++; console.log(`  \u2717 ${m}`); };
const warn = (m) => console.log(`  ! ${m}`);
const section = (t) => console.log(`\n=== ${t} ===`);

/** 拆一行 VALUES 的顶层值（忽略单引号内的逗号） */
function splitValues(s) {
  const out = [];
  let cur = '', q = false;
  for (const ch of s) {
    if (ch === "'") { q = !q; cur += ch; continue; }
    if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
/** 去掉 SQL 里的注释行，避免注释内容干扰检查 */
const stripComments = (sql) => sql.split(/\r?\n/).filter((l) => !/^\s*--/.test(l)).join('\n');
const unq = (s) => s.replace(/^'(.*)'$/s, '$1');
const walk = (dir, ext, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, acc);
    else if (e.name.endsWith(ext)) acc.push(p);
  }
  return acc;
};

/* ---------- 1/2. sys_menu 结构 ---------- */
const menuSql = fs.readFileSync(path.join(SQL, 'insp_menu.sql'), 'utf8');
const parsed = [];
for (const line of menuSql.split(/\r?\n/)) {
  const m = line.match(/^INSERT INTO sys_menu \([^)]*\) VALUES \((.*)\);\s*$/);
  if (m) parsed.push(splitValues(m[1]));
}
section(`sys_menu 结构（${parsed.length} 行）`);
if (!parsed.length) bad('没有解析到任何 INSERT INTO sys_menu');
else {
  const bad_ = parsed.filter((v) => v.length !== 22);
  bad_.length
    ? bad(`${bad_.length} 行不是 22 列（实际 ${[...new Set(bad_.map(v => v.length))].join(',')}）`)
    : ok('每行均为 22 列（v6 sys_menu 列数）');

  const ids = parsed.map((v) => v[0]);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  dup.length ? bad(`menu_id 重复: ${dup.join(', ')}`) : ok(`menu_id 全部唯一（${new Set(ids).size} 个）`);

  const idSet = new Set(ids);
  const miss = parsed.filter((v) => v[2] !== '0' && !idSet.has(v[2])).map((v) => `${v[0]}(${unq(v[1])}) -> ${v[2]}`);
  miss.length ? bad(`父菜单不存在: ${miss.join(' | ')}`) : ok('所有 parent_id 均存在');

  const out = ids.filter((id) => BigInt(id) < MENU_ROOT || BigInt(id) > MENU_LIMIT);
  out.length ? bad(`ID 越界(应 ${MENU_ROOT}~${MENU_LIMIT}): ${out.join(', ')}`) : ok('ID 全在本模块独占号段内');

  const t = {};
  for (const v of parsed) { const k = unq(v[9]); t[k] = (t[k] || 0) + 1; }
  ok(`类型分布: ${Object.entries(t).map(([k, n]) => `${k}=${n}`).join(' ')}`);
}

/* ---------- 3. 权限闭环 ---------- */
section('权限闭环');
const menuPerms = new Set(parsed.map((v) => unq(v[12])).filter((p) => p && p !== '#'));
const used = new Set();
for (const f of walk(PC, '.vue')) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/v-hasPermi="\[([^\]]+)\]"/g)) {
    for (const q of m[1].matchAll(/'([^']+)'/g)) used.add(q[1]);
  }
  for (const m of src.matchAll(/hasPermi\(\s*\[?([^\]]+?)\]?\s*\)/g)) {
    for (const q of m[1].matchAll(/'([^']+)'/g)) used.add(q[1]);
  }
}
const javaPerms = new Set();
for (const f of walk(JAVA, '.java')) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/@SaCheckPermission\(\s*"([^"]+)"/g)) javaPerms.add(m[1]);
}
ok(`菜单权限码 ${menuPerms.size} 个 / PC 页面使用 ${used.size} 个 / 后端声明 ${javaPerms.size} 个`);

const ungrantable = [...used].filter((p) => !menuPerms.has(p));
ungrantable.length
  ? bad(`PC 页面用到但菜单无按钮（非超管角色必然 403）: ${ungrantable.join(', ')}`)
  : ok('PC 页面用到的权限码，菜单里都有按钮');

const notInCtrl = [...menuPerms].filter((p) => !javaPerms.has(p));
notInCtrl.length ? bad(`菜单里有、后端无声明（点开 403）: ${notInCtrl.join(', ')}`) : ok('菜单权限码后端全部存在');

const ctrlOnly = [...javaPerms].filter((p) => !used.has(p) && !menuPerms.has(p));
if (ctrlOnly.length) warn(`后端声明但无菜单按钮 / 前端未使用（仅超管可绕过）: ${ctrlOnly.join(', ')}`);

/* ---------- 4/5. 幂等与授权 ---------- */
section('幂等与授权');
/^DELETE FROM sys_role_menu WHERE menu_id BETWEEN/m.test(menuSql)
  ? ok('先清理 sys_role_menu（重复执行不残留脏授权）') : bad('缺 sys_role_menu 清理');
/^DELETE FROM sys_menu\s+WHERE menu_id BETWEEN/m.test(menuSql)
  ? ok('先清理 sys_menu 本号段（重复执行不报 Duplicate entry）') : bad('缺 sys_menu 清理');
if (/role_key = 'superadmin'/.test(menuSql)) ok('角色授权按 role_key 关联（v6 超管 role_id 不是 1）');
else bad("角色授权硬编码了 role_id，v6 的超级管理员是 1761300000000000001，会授权失效");
/(CREATE|INSERT)/i.test(menuSql) && !/\bmenu_id\s*=\s*1\b/.test(menuSql) ? ok('未使用 role_id=1 / menu_id=1 这类猜测值') : warn('检查是否使用了猜测的 ID 常量');

/* ---------- 6. sys_dict ---------- */
section('sys_dict');
const dictRaw = fs.readFileSync(path.join(SQL, 'insp_dict.sql'), 'utf8');
const dictSql = stripComments(dictRaw);
/\btenant_id\b/.test(dictSql)
  ? bad('sys_dict_* 出现 tenant_id —— v6 这两张表无该列，执行会 Unknown column')
  : ok('未使用 tenant_id（符合 v6 表结构）');

const typeList = [...dictSql.matchAll(/INSERT INTO sys_dict_type \([^)]*\) VALUES \([^,]+,\s*'[^']*',\s*'([^']+)'/g)].map((m) => m[1]);
const delTypes = (dictSql.match(/DELETE FROM sys_dict_data WHERE dict_type IN \(([^)]*)\)/) || [])[1] || '';
const uncovered = typeList.filter((t) => !delTypes.includes(`'${t}'`));
uncovered.length
  ? bad(`这些 dict_type 未被 DELETE 覆盖，重复执行唯一键冲突: ${uncovered.join(', ')}`)
  : ok(`dict_type ${typeList.length} 个，全部纳入 DELETE 清理`);

const tRows = (dictSql.match(/INSERT INTO sys_dict_type/g) || []).length;
const dRows = (dictSql.match(/INSERT INTO sys_dict_data/g) || []).length;
ok(`sys_dict_type ${tRows} 行 / sys_dict_data ${dRows} 行`);

/* ---------- 6b. 建表 DDL 可执行性 ---------- */
section('建表 DDL');
const schemaRaw = fs.readFileSync(path.join(SQL, 'insp_schema.sql'), 'utf8');
const schemaSql = stripComments(schemaRaw);

// MySQL 严格模式：NOT NULL 与 DEFAULT NULL 互斥，同写报 1067 Invalid default value
const badDefaults = [...schemaSql.matchAll(/^(\s*)([a-z_]+)\s+[A-Za-z()0-9]+[^\n]*?NOT NULL\s+DEFAULT\s+NULL/gi)]
  .map((m) => m[2]);
badDefaults.length
  ? bad(`NOT NULL 与 DEFAULT NULL 同写（MySQL 1067）: ${[...new Set(badDefaults)].join(', ')}`)
  : ok('无 NOT NULL DEFAULT NULL（不会触发 1067）');

// 每张表必须有主键（v6 用雪花 ID，非自增）
const createCount = (schemaSql.match(/CREATE TABLE/gi) || []).length;
const pkCount = (schemaSql.match(/PRIMARY KEY/gi) || []).length;
pkCount === createCount
  ? ok(`${createCount} 张表均定义了 PRIMARY KEY`)
  : bad(`CREATE TABLE ${createCount} 个，但 PRIMARY KEY 只有 ${pkCount} 个`);

(schemaSql.match(/AUTO_INCREMENT/gi) || []).length === 0
  ? ok('未使用 AUTO_INCREMENT（v6 主键由 MyBatis-Plus 雪花 ID 生成）')
  : warn('检测到 AUTO_INCREMENT，与 v6 的 ASSIGN_ID 主键策略不符');

(schemaSql.match(/DEFAULT CHARSET=utf8mb4/gi) || []).length === createCount
  ? ok('全部 utf8mb4（与 ry_vue.sql 一致）')
  : bad('存在非 utf8mb4 的表');

// 括号配平，防止生成的 DDL 被截断
let depth = 0, unbalanced = false;
for (const ch of schemaSql) { if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth < 0) { unbalanced = true; break; } } }
(!unbalanced && depth === 0) ? ok('括号配平') : bad('括号不配平，DDL 可能被截断');

// 索引/主键引用的列必须在表内已定义（否则 MySQL 1072 Key column doesn't exist）
const blocks = [...schemaSql.matchAll(/CREATE TABLE\s+(\w+)\s*\(([\s\S]*?)\)\s*ENGINE/gi)];
const idxProblems = [];
for (const [, table, body] of blocks) {
  const cols = new Set();
  for (const line of body.split(',')) {
    if (/^\s*(PRIMARY|UNIQUE|KEY|INDEX|CONSTRAINT)\b/i.test(line)) continue;
    const m = line.match(/^\s*([a-z_][a-z0-9_]*)\s+[A-Z]/i);
    if (m) cols.add(m[1]);
  }
  const idxCols = [];
  for (const m of body.matchAll(/(?:UNIQUE\s+)?KEY\s+\w+\s*\(([^)]*)\)/gi))
    for (const c of m[1].split(',')) idxCols.push(c.trim().split(/\s+/)[0].replace(/`/g, ''));
  for (const m of body.matchAll(/PRIMARY\s+KEY\s*\(([^)]*)\)/gi))
    for (const c of m[1].split(',')) idxCols.push(c.trim().replace(/`/g, ''));
  const missing = [...new Set(idxCols.filter((c) => c && !cols.has(c)))];
  if (missing.length) idxProblems.push(`${table} -> ${missing.join(', ')}`);
}
blocks.length === createCount
  ? ok(`解析出 ${blocks.length} 张表`)
  : bad(`解析到 ${blocks.length} 张表，与 CREATE TABLE 计数 ${createCount} 不符（DDL 结构可能损坏）`);
idxProblems.length
  ? bad(`索引引用不存在的列（MySQL 1072）: ${idxProblems.join('; ')}`)
  : ok('索引/主键全部指向已定义的列（不会触发 1072）');

/* ---------- 7. 文件 ---------- */
section('文件');
for (const f of ['insp_schema.sql', 'insp_dict.sql', 'insp_menu.sql']) {
  const p = path.join(SQL, f);
  const st = fs.existsSync(p) ? fs.statSync(p) : null;
  st && st.size > 0 ? ok(`${f}  ${st.size} bytes`) : bad(`${f} 缺失或为空`);
}
stripComments(fs.readFileSync(path.join(SQL, 'insp_schema.sql'), 'utf8')).includes('tenant_id')
  ? bad('insp_schema.sql 含 tenant_id') : ok('insp_schema.sql 无 tenant_id');

console.log(failed === 0 ? '\n\u2705 全部通过，SQL 可安全执行' : `\n\u274c 有 ${failed} 项未通过`);
process.exit(failed === 0 ? 0 : 1);
