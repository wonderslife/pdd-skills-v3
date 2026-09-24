#!/usr/bin/env node
/**
 * 舆情监测平台 SQL 交付前校验
 *
 * 用法:
 *   node check-yuqing-sql.mjs
 *   node check-yuqing-sql.mjs --dir yq-code/sql --pc D:/APPPROJECTS/plus-ui-v6.0.0-Vue
 *
 * 校验项（照 ruoyi-v6-fullstack-codegen 技能清单）:
 *   1) sys_menu 每行 INSERT 的值个数 = 22（v6 权威列数）
 *   2) menu_id 唯一 / parent_id 存在 / ID 落在本模块号段内
 *   3) 权限闭环：PC 页面 v-hasPermi 用到的权限码，菜单里必须有对应 F 节点
 *   4) 幂等：DELETE sys_role_menu + DELETE sys_menu 都在
 *   5) 授权用 role_key 关联，而非硬编码 role_id
 *   6) 字典脚本不含 tenant_id；每个 dict_type 都被 DELETE 覆盖
 *   7) MySQL 建表 DDL：无 NOT NULL DEFAULT NULL、PRIMARY KEY 数=表数、无 AUTO_INCREMENT、utf8mb4
 *   8) 索引列存在性：KEY/PRIMARY KEY 引用的列必须在表内（MySQL 1072）
 *   9) 四个 SQL 文件存在且非空
 *  10) 样例词表导入脚本（P0-4）
 *  11) F-006 净化批次表 / 新增列 / 字典 / 菜单
 *  12) F-010 预警 + F-011 推送：新增列、调度产物、PC/H5 前端
 *  13) F-009 多维分析：预聚合表 / 互动量列 / 重复列扫描 / 字典 / 菜单 / 看板前端
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const getOpt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SQL_DIR = path.resolve(ROOT, getOpt('--dir', 'yq-code/sql'));
const PC_DIR = path.resolve(getOpt('--pc', 'D:/APPPROJECTS/plus-ui-v6.0.0-Vue/src/views/yuqing'));
/* PC api 目录（views 的同级兄弟目录），用于校验调度类接口封装是否存在 */
const PC_API_DIR = path.resolve(getOpt('--pc-api', 'D:/APPPROJECTS/plus-ui-v6.0.0-Vue/src/api/yuqing'));
/* H5 页面目录 */
const H5_DIR = path.resolve(getOpt('--h5', 'D:/APPPROJECTS/RuoYi-App-Plus/src/pages/yuqing'));
/* 后端 Java 源码目录（F-016 起用于校验 ledger 包与控制器产物是否已落盘） */
const JAVA_DIR = path.resolve(getOpt('--java',
  'D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java/org/dromara/yuqing'));

/* 与 gen-yuqing.mjs 的 MENU_ROOT / MENU_C_MAX / BTN_MIN / MENU_LIMIT 保持一致 */
const MENU_LO = 1761400000000000900n, MENU_C_HI = 1761400000000000913n;
const BTN_LO = 1761400000000006011n, BTN_HI = 1761400000000006139n;

let fails = 0, warns = 0;
const R = [];
const ok = (s) => R.push(`  ✓ ${s}`);
const bad = (s) => { fails++; R.push(`  ✗ ${s}`); };
const warn = (s) => { warns++; R.push(`  ! ${s}`); };
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '');

/** 去 SQL 注释行（-- 开头 / 行内 -- 之后），避免注释里提到 tenant_id 造成误报 */
const stripComments = (s) => s.split('\n').map(l => l.replace(/--.*$/, '')).join('\n');

/** 把 "a, b, 'x,y', f(1,2), NULL" 按顶层逗号切分 */
function splitTopLevel(s) {
  const out = []; let depth = 0, cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === q && s[i - 1] !== '\\') q = null; continue; }
    if (c === "'" || c === '"') { q = c; cur += c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 提取 `INSERT INTO t (...) VALUES (...)` / `insert into t values(...)` 的所有 value 元组 */
function insertTuples(sql) {
  const tuples = [];
  const re = /insert\s+into\s+(\w+)\s*(\([^)]*\))?\s*values\s*/gi;
  let m;
  while ((m = re.exec(sql))) {
    const table = m[1];
    let i = re.lastIndex, depth = 0, start = -1, q = null;
    for (; i < sql.length; i++) {
      const c = sql[i];
      if (q) { if (c === q && sql[i - 1] !== '\\') q = null; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '(') { if (depth === 0) start = i; depth++; continue; }
      if (c === ')') { depth--; if (depth === 0 && start >= 0) { tuples.push({ table, cols: m[2], vals: sql.slice(start + 1, i) }); start = -1; break; } }
    }
    re.lastIndex = i;
  }
  return tuples;
}

/* ---------------- 9. 文件存在性 ---------------- */
const FILES = ['yq_schema.sql', 'yq_doris_schema.sql', 'yq_dict.sql', 'yq_menu.sql'];
const text = {};
R.push('\n[9] 交付文件存在且非空');
for (const f of FILES) {
  const p = path.join(SQL_DIR, f);
  const t = read(p);
  text[f] = t;
  if (!t.trim()) bad(`${f} 不存在或为空`); else ok(`${f.padEnd(22)} ${t.length} 字符`);
}

const menuSql = text['yq_menu.sql'];
const dictSql = text['yq_dict.sql'];
const schemaSql = text['yq_schema.sql'];
const dorisSql = text['yq_doris_schema.sql'];

/* ---------------- 1. sys_menu 每行 22 值 ---------------- */
R.push('\n[1] sys_menu 每行 INSERT 值个数 = 22');
{
  const tuples = insertTuples(menuSql).filter(t => t.table.toLowerCase() === 'sys_menu' && t.vals);
  let badRows = [];
  for (const t of tuples) {
    const n = splitTopLevel(t.vals).length;
    if (n !== 22) badRows.push(`${n} 值: ${t.vals.slice(0, 60)}…`);
  }
  if (!tuples.length) bad('未解析到任何 sys_menu INSERT');
  else if (badRows.length) bad(`${badRows.length} 行值个数不是 22：\n      ${badRows.slice(0, 5).join('\n      ')}`);
  else ok(`${tuples.length} 行 INSERT，行行 22 值`);
}

/* ---------------- 2. menu_id 唯一 / parent 存在 / 号段 ---------------- */
R.push('\n[2] menu_id 唯一 / parent_id 存在 / ID 在号段内');
{
  const rows = [];
  for (const t of insertTuples(menuSql).filter(t => t.table.toLowerCase() === 'sys_menu' && t.vals)) {
    const v = splitTopLevel(t.vals);
    rows.push({ id: v[0], name: v[1].replace(/^'|'$/g, ''), parent: v[2], type: v[9].replace(/^'|'$/g, '') });
  }
  const seen = new Map();
  let dup = [];
  for (const r of rows) { if (seen.has(r.id)) dup.push(r.id); seen.set(r.id, r.name); }
  dup.length ? bad(`menu_id 重复: ${dup.join(', ')}`) : ok(`${rows.length} 个节点，menu_id 全部唯一`);

  const missing = rows.filter(r => r.parent !== '0' && !seen.has(r.parent));
  missing.length ? bad(`父菜单不存在: ${missing.map(r => `${r.id}->${r.parent}`).join(', ')}`) : ok('parent_id 引用全部存在');

  const out = rows.filter(r => {
    const n = BigInt(r.id);
    return !((n >= MENU_LO && n <= MENU_C_HI) || (n >= BTN_LO && n <= BTN_HI));
  });
  out.length ? bad(`ID 越界: ${out.map(r => r.id).join(', ')}`) : ok(`ID 全部落在 ${MENU_LO}~${MENU_C_HI} / ${BTN_LO}~${BTN_HI}`);

  const byType = { M: 0, C: 0, F: 0 };
  rows.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
  ok(`类型分布: M×${byType.M} / C×${byType.C} / F×${byType.F}`);
}

/* ---------------- 3. 权限闭环 ---------------- */
R.push('\n[3] 权限闭环（PC 页面的 v-hasPermi 必须在菜单里有 F 节点）');
{
  const menuPerms = new Set();
  for (const t of insertTuples(menuSql).filter(t => t.vals)) {
    if (t.table.toLowerCase() !== 'sys_menu') continue;
    const v = splitTopLevel(t.vals);
    const perm = (v[12] || '').replace(/^'|'$/g, '');
    if (perm) menuPerms.add(perm);
  }
  const used = new Map(); // perm -> 文件
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.vue')) {
        const s = fs.readFileSync(p, 'utf-8');
        for (const m of s.matchAll(/v-hasPermi="\[([^\]]+)\]"/g)) {
          for (const q of m[1].matchAll(/'([^']+)'/g)) {
            if (!used.has(q[1])) used.set(q[1], e.name);
          }
        }
      }
    }
  };
  walk(PC_DIR);
  const missing = [...used.entries()].filter(([p]) => !menuPerms.has(p));
  if (!used.size) warn(`未在 ${PC_DIR} 找到 v-hasPermi（PC 页面未部署？）`);
  else if (missing.length) bad(`页面用到但菜单缺失的权限码（非超管必然 403）:\n      ${missing.map(([p, f]) => `${p}  (${f})`).join('\n      ')}`);
  else ok(`${used.size} 个页面权限码全部命中菜单（非超管可用）`);
}

/* ---------------- 4. 幂等 ---------------- */
R.push('\n[4] 幂等：菜单/字典脚本可重复执行');
{
  const has = (s, re) => re.test(stripComments(s));
  has(menuSql, /delete\s+from\s+sys_role_menu/i) ? ok('菜单脚本含 DELETE sys_role_menu') : bad('菜单脚本缺 DELETE sys_role_menu');
  has(menuSql, /delete\s+from\s+sys_menu/i) ? ok('菜单脚本含 DELETE sys_menu') : bad('菜单脚本缺 DELETE sys_menu');
  has(dictSql, /delete\s+from\s+sys_dict_data/i) ? ok('字典脚本含 DELETE sys_dict_data') : bad('字典脚本缺 DELETE sys_dict_data');
  has(dictSql, /delete\s+from\s+sys_dict_type/i) ? ok('字典脚本含 DELETE sys_dict_type') : bad('字典脚本缺 DELETE sys_dict_type');
  const drops = (schemaSql.match(/drop\s+table\s+if\s+exists/gi) || []).length;
  ok(`建表脚本含 ${drops} 条 DROP TABLE IF EXISTS（幂等但破坏性，交付说明需注明）`);
}

/* ---------------- 5. 授权用 role_key ---------------- */
R.push('\n[5] 授权用 role_key 而非硬编码 role_id');
{
  const s = stripComments(menuSql);
  /insert\s+into\s+sys_role_menu[\s\S]*?select[\s\S]*?sys_role[\s\S]*?role_key/i.test(s)
    ? ok('sys_role_menu 通过 sys_role.role_key 关联')
    : bad('sys_role_menu 未见 role_key 关联（硬编码 role_id 会授权失效，v6 超管 role_id 并非 1）');
  /values\s*\(\s*1\s*,/.test(s) ? warn('检测到 sys_role_menu values(1, ...) 形式的硬编码授权') : ok('无硬编码 role_id 授权');
}

/* ---------------- 6. 字典脚本 ---------------- */
R.push('\n[6] 字典脚本：无 tenant_id / 每个 dict_type 都被清理覆盖');
{
  const s = stripComments(dictSql);
  /tenant_id/i.test(s) ? bad('字典脚本出现 tenant_id（v6 的 sys_dict_* 无此列 → Unknown column）') : ok('字典脚本不含 tenant_id');
  const types = new Set();
  for (const m of s.matchAll(/from\s+sys_dict_type\s+where\s+dict_type\s+in\s*\(([^)]*)\)/gi)) {
    for (const q of m[1].matchAll(/'([^']+)'/g)) types.add(q[1]);
  }
  const inserted = new Set();
  for (const t of insertTuples(s).filter(t => t.table.toLowerCase() === 'sys_dict_type')) {
    const v = splitTopLevel(t.vals);
    inserted.add(v[2].replace(/^'|'$/g, ''));
  }
  const uncovered = [...inserted].filter(x => !types.has(x));
  uncovered.length ? bad(`以下 dict_type 未被 DELETE 覆盖: ${uncovered.join(', ')}`) : ok(`${inserted.size} 个 dict_type 全部被清理覆盖`);
  const dataN = insertTuples(s).filter(t => t.table.toLowerCase() === 'sys_dict_data').length;
  ok(`字典项 ${dataN} 条`);
}

/* ---------------- 7. MySQL DDL ---------------- */
R.push('\n[7] MySQL 建表 DDL 规范');
{
  const s = stripComments(schemaSql);
  const blocks = [...s.matchAll(/create\s+table\s+(\w+)\s*\(([\s\S]*?)\)\s*engine/gi)];
  const tables = blocks.map(b => ({ name: b[1], body: b[2] }));
  ok(`解析到 ${tables.length} 张表`);

  const bad1067 = [];
  for (const t of tables) if (/not\s+null\s+default\s+null/i.test(t.body)) bad1067.push(t.name);
  bad1067.length ? bad(`NOT NULL DEFAULT NULL（MySQL 1067）: ${bad1067.join(', ')}`) : ok('无 NOT NULL DEFAULT NULL（避 1067）');

  const pk = (s.match(/primary\s+key\s*\(/gi) || []).length;
  pk === tables.length ? ok(`PRIMARY KEY 数(${pk}) == 表数(${tables.length})`) : bad(`PRIMARY KEY 数(${pk}) != 表数(${tables.length})`);

  /auto_increment/i.test(s) ? bad('DDL 出现 AUTO_INCREMENT（v6 主键为雪花 ID）') : ok('无 AUTO_INCREMENT');

  // 每张表都以 ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 收尾，数量应与表数一致
  const utf8 = (s.match(/charset\s*=\s*utf8mb4/gi) || []).length;
  utf8 === tables.length ? ok(`全部 utf8mb4 (${utf8}/${tables.length})`) : warn(`utf8mb4 出现 ${utf8} 次，表数 ${tables.length}`);

  const open = (s.match(/\(/g) || []).length, close = (s.match(/\)/g) || []).length;
  open === close ? ok(`括号配平 (${open})`) : bad(`括号不配平: ( ${open} vs ) ${close}`);
}

/* ---------------- 8. 索引列存在性 ---------------- */
R.push('\n[8] 索引列存在性（MySQL 1072 Key column doesn\'t exist）');
{
  const s = stripComments(schemaSql);
  const blocks = [...s.matchAll(/create\s+table\s+(\w+)\s*\(([\s\S]*?)\)\s*engine/gi)];
  const problems = [];
  for (const b of blocks) {
    const tname = b[1];
    const lines = b[2].split('\n').map(l => l.trim()).filter(Boolean);
    const cols = new Set();
    for (const l of lines) {
      if (/^(primary|unique|key|index|constraint|fulltext|foreign)\b/i.test(l)) continue;
      const m = l.match(/^`?(\w+)`?\s+(bigint|int|varchar|char|datetime|date|text|decimal|json|tinyint)/i);
      if (m) cols.add(m[1]);
    }
    for (const l of lines) {
      if (!/^(primary|unique|key|index)\b/i.test(l)) continue;
      const refs = [...l.matchAll(/\(([^()]+)\)/g)].flatMap(m => m[1].split(',').map(x => x.trim().replace(/`/g, '')));
      for (const c of refs) {
        if (c && !cols.has(c)) problems.push(`${tname}.${c}`);
      }
    }
  }
  problems.length ? bad(`索引引用了不存在的列: ${problems.join(', ')}`) : ok('全部 KEY/PRIMARY KEY 引用的列都在表内');
}

/* ---------------- Doris 专项 ---------------- */
R.push('\n[+] Doris 建表脚本专项');
{
  const s = stripComments(dorisSql);
  const n = (s.match(/create\s+table\s+if\s+not\s+exists/gi) || []).length;
  /* 6 张事实表 + F-009 预聚合 3 张（stats_daily / stats_dim / stats_hot） */
  n === 9 ? ok(`9 张 Doris 表（6 事实表 + 3 预聚合表）`) : warn(`解析到 ${n} 张 Doris 表（预期 9）`);
  /unique\s+key\s*\(\s*`collect_date`\s*,\s*`url_hash`\s*\)/i.test(s.replace(/\s+/g, ' '))
    ? ok('yq_opinion 的 Unique Key 为 (collect_date, url_hash)')
    : warn('yq_opinion 未检出预期的 Unique Key(collect_date, url_hash)');
  /enable_unique_key_merge_on_write/i.test(s) ? ok('启用 Merge-on-Write') : warn('未检出 Merge-on-Write');
  const inv = (s.match(/using\s+inverted/gi) || []).length;
  inv ? ok(`中文分词倒排索引 ${inv} 处`) : warn('未检出 INVERTED 倒排索引');
  const dp = (s.match(/dynamic_partition\.enable/gi) || []).length;
  ok(`动态分区 ${dp} 张表`);

  // Unique Key 引用的列必须真实存在于本表 schema，且键列须按声明顺序置于最前
  // —— 早期版本漏渲染主键列，UNIQUE KEY(log_id) 引用了不存在的列，Doris 会直接拒绝建表。
  const keyIssues = [];
  const stmts = s.match(/create\s+table\s+if\s+not\s+exists\s+\w+\s*\([\s\S]*?;\s*\n/gi) || [];
  for (const stmt of stmts) {
    const name = (stmt.match(/exists\s+(\w+)/i) || [])[1] || '?';
    const body = stmt.slice(stmt.indexOf('(') + 1);
    const cols = [...body.matchAll(/^\s*`(\w+)`/gm)].map(m => m[1]);
    const km = body.match(/unique\s+key\s*\(([^)]*)\)/i);
    if (!km) { keyIssues.push(`${name} 缺 Unique Key`); continue; }
    const keys = km[1].split(',').map(x => x.replace(/[`\s]/g, ''));
    const missing = keys.filter(k => !cols.includes(k));
    if (missing.length) keyIssues.push(`${name} 的 Unique Key 引用了不存在的列 ${missing.join('/')}`);
    else if (cols.slice(0, keys.length).join(',') !== keys.join(',')) {
      keyIssues.push(`${name} 的键列未按 UNIQUE KEY 顺序置于 schema 最前（实际 ${cols.slice(0, keys.length).join(',')}）`);
    }
  }
  keyIssues.length
    ? keyIssues.forEach(b => bad(`Doris: ${b}`))
    : ok(`全部 ${stmts.length} 张表的 Unique Key 列均存在于 schema 且键列置首`);
}

/* ---------------- 10. 词表导入脚本（P0-4） ---------------- */
R.push('\n[10] yq_keyword_sample_import.sql（样例词表导入）');
{
  const f = 'yq_keyword_sample_import.sql';
  const t = read(path.join(SQL_DIR, f));
  if (!t.trim()) {
    bad(`${f} 不存在或为空`);
  } else {
    ok(`${f.padEnd(30)} ${t.length} 字符`);
    const clean = stripComments(t);

    /* 分组必须先建、且脚本幂等 */
    const grp = clean.match(/insert\s+into\s+yq_keyword_group\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\)\s*;/i);
    const grpId = grp ? splitTopLevel(grp[2])[0] : null;
    if (!grp || !grpId) {
      bad('未找到 yq_keyword_group 的 INSERT');
    } else {
      ok(`分组 group_id = ${grpId}`);
      new RegExp(`delete\\s+from\\s+yq_keyword_group\\s+where\\s+group_id\\s*=\\s*${grpId}`, 'i').test(clean)
        ? ok('分组 INSERT 前有 DELETE（可重复执行）')
        : bad('分组 INSERT 前缺少 DELETE，重复执行会撞唯一键');
    }

    const m = clean.match(/insert\s+into\s+yq_keyword\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/i);
    if (!m) {
      bad('未找到 yq_keyword 的 INSERT 语句');
    } else {
      const cols = m[1].split(',').map((s) => s.trim());
      cols.length === 15 ? ok('yq_keyword 列数 = 15') : bad(`yq_keyword 列数 = ${cols.length}（预期 15）`);

      const rows = splitTopLevel(m[2]).map((r) => splitTopLevel(r.replace(/^\s*\(/, '').replace(/\)\s*$/, '')));
      const idx = {};
      cols.forEach((c, i) => { idx[c] = i; });

      const widthIssues = rows.filter((r) => r.length !== cols.length).length;
      widthIssues === 0 ? ok(`${rows.length} 行，每行值个数均为 ${cols.length}`)
                        : bad(`${widthIssues} 行的值个数不等于列数 ${cols.length}`);

      const TYPES = new Set(['precise', 'fuzzy', 'negative', 'combo']);
      const CATS = new Set(['core', 'related', 'block']);
      const unq = (i) => (v) => v.replace(/^'|'$/g, '');
      const badType = rows.filter((r) => !TYPES.has(unq(0)(r[idx.keyword_type])));
      const badCat = rows.filter((r) => !CATS.has(unq(0)(r[idx.keyword_category])));
      badType.length ? bad(`keyword_type 越界：${badType.slice(0, 3).map((r) => r[idx.keyword_type]).join(',')}`)
                     : ok('keyword_type 全部落在字典 precise/fuzzy/negative/combo 内');
      badCat.length ? bad(`keyword_category 越界：${badCat.slice(0, 3).map((r) => r[idx.keyword_category]).join(',')}`)
                    : ok('keyword_category 全部落在字典 core/related/block 内');

      const ids = rows.map((r) => r[idx.keyword_id]);
      new Set(ids).size === ids.length ? ok(`keyword_id 唯一（${ids.length} 条）`)
                                       : bad(`keyword_id 有重复：${ids.length - new Set(ids).size} 处`);

      const dirty = rows.filter((r) => /^'\s|\s'$/.test(r[idx.keyword_text]));
      dirty.length ? bad(`keyword_text 前后带空白 ${dirty.length} 处（会破坏去重与展示）：${unq(0)(dirty[0][idx.keyword_text])}`)
                   : ok('keyword_text 无前后空白');

      const combos = rows.filter((r) => unq(0)(r[idx.keyword_type]) === 'combo');
      const comboMismatch = combos.filter((r) => r[idx.combo_expression] !== r[idx.keyword_text] || r[idx.combo_expression] === 'NULL');
      comboMismatch.length ? bad(`combo 行的 combo_expression 与 keyword_text 不一致或为 NULL（${comboMismatch.length} 条）`)
                           : ok(`combo 行 ${combos.length} 条，combo_expression 与 keyword_text 一致`);

      /* 数量与单测、交付说明保持同一套实测值 —— 换词表时三处一起改 */
      const EXPECT = { combo: 2, negative: 177 };
      const actualCombo = combos.length;
      const actualNeg = rows.filter((r) => unq(0)(r[idx.keyword_type]) === 'negative').length;
      actualCombo === EXPECT.combo ? ok(`组合表达式 ${actualCombo} 条`)
                                   : bad(`组合表达式 ${actualCombo} 条（预期 ${EXPECT.combo}，若已更换词表请同步单测与交付说明）`);
      actualNeg === EXPECT.negative ? ok(`排除词 ${actualNeg} 条`)
                                    : bad(`排除词 ${actualNeg} 条（预期 ${EXPECT.negative}，若已更换词表请同步单测与交付说明）`);

      new RegExp(`delete\\s+from\\s+yq_keyword\\s+where\\s+group_id\\s*=\\s*${grpId}`, 'i').test(clean)
        ? ok('关键词 INSERT 前有 DELETE（可重复执行）')
        : bad('关键词 INSERT 前缺少 DELETE');

      /* ID 号段不得与其他 SQL 文件撞车 */
      const others = FILES.map((x) => read(path.join(SQL_DIR, x))).join('\n');
      const clash = ids.filter((id) => new RegExp(`(?<![\\d])${id}(?![\\d])`).test(others));
      clash.length ? bad(`keyword_id 与既有 SQL 撞号 ${clash.length} 处：${clash.slice(0, 3).join(',')}`)
                   : ok(`keyword_id 号段 ${ids[0]}..${ids[ids.length - 1]} 与既有脚本无冲突`);
    }
  }
}

/* ---------------- 11. F-006 净化批次表与新增列 ---------------- */
R.push('\n[11] F-006 净化批次 yq_clean_batch / 新增列 / 字典 / 菜单');
{
  /* 11.1 建表存在且字段齐全 */
  const create = schemaSql.match(/CREATE TABLE yq_clean_batch \(([\s\S]*?)\n\) ENGINE/i);
  if (!create) {
    bad('yq_schema.sql 缺少 yq_clean_batch 建表');
  } else {
    const body = create[1];
    ok('yq_schema.sql 含 yq_clean_batch 建表');
    const REQUIRED = [
      'batch_id', 'batch_name', 'batch_type', 'scope_task_id', 'scope_channel_id',
      'scope_start_date', 'scope_end_date', 'total_count', 'cleaned_count', 'rejected_count',
      'dup_count', 'dup_channel_count', 'preview_only', 'status', 'fail_reason', 'cost_ms'
    ];
    const miss = REQUIRED.filter((c) => !new RegExp(`\\b${c}\\b`).test(body));
    miss.length ? bad(`yq_clean_batch 缺列: ${miss.join(', ')}`) : ok(`yq_clean_batch 必备列齐全（${REQUIRED.length} 项）`);

    /* 七类降噪计数列：台账「按原因统计剔除量」的数据源，少一类就看不全 */
    const NOISE_COLS = ['spam', 'advertisement', 'flooding', 'meaningless', 'bot', 'blank', 'violation']
      .map((c) => `noise_${c}`);
    const missNoise = NOISE_COLS.filter((c) => !new RegExp(`\\b${c}\\b`).test(body));
    missNoise.length ? bad(`yq_clean_batch 缺降噪分类计数列: ${missNoise.join(', ')}`)
                     : ok(`七类降噪计数列齐全（${NOISE_COLS.length} 列）`);

    /* 列宽兜底：condition_replay 是最长取值（16 字符），VARCHAR(20) 刚好装下 */
    const bt = body.match(/batch_type\s+VARCHAR\((\d+)\)/i);
    bt && Number(bt[1]) >= 16 ? ok(`batch_type 列宽 ${bt[1]} ≥ 16（可容纳 condition_replay）`)
                              : bad(`batch_type 列宽不足或缺失: ${bt ? bt[1] : 'n/a'}`);
    const fr = body.match(/fail_reason\s+VARCHAR\((\d+)\)/i);
    fr ? ok(`fail_reason 列宽 ${fr[1]}`) : bad('fail_reason 列缺失');
  }

  /* 11.2 yq_opinion 新增两列：Doris 与 MySQL 镜像必须同步，否则本地联调与生产不一致 */
  for (const [label, src, file] of [
    ['Doris', dorisSql, 'yq_doris_schema.sql'],
    ['MySQL 镜像', read(path.join(SQL_DIR, 'yq_doris_mysql_fallback.sql')), 'yq_doris_mysql_fallback.sql']
  ]) {
    if (!src.trim()) { bad(`${file} 不存在或为空`); continue; }
    const seg = src.match(/CREATE TABLE (?:IF NOT EXISTS )?yq_opinion \(([\s\S]*?)\n\)/i);
    if (!seg) { bad(`${file} 未解析到 yq_opinion`); continue; }
    for (const col of ['dup_channel_ids', 'clean_time']) {
      new RegExp(`\\b${col}\\b`).test(seg[1])
        ? ok(`${file} 的 yq_opinion 含 ${col}`)
        : bad(`${file} 的 yq_opinion 缺 ${col}（跨渠道标记/净化时间无处落）`);
    }
  }

  /* 11.3 新增字典类 */
  for (const [type, values] of [
    ['yq_clean_batch_type', ['incremental', 'condition_replay', 'full_replay']],
    ['yq_clean_batch_status', ['running', 'success', 'failed']]
  ]) {
    const hasType = dictSql.includes(`'${type}'`);
    const missVal = values.filter((v) => !new RegExp(`'${v}', '${type}'`).test(dictSql));
    if (!hasType) bad(`yq_dict.sql 缺少字典 ${type}`);
    else if (missVal.length) bad(`字典 ${type} 缺取值: ${missVal.join(', ')}`);
    else ok(`字典 ${type} 与 ${values.length} 个取值齐备`);
  }

  /* 11.4 菜单与权限 */
  menuSql.includes("'净化批次'") ? ok('菜单含「净化批次」') : bad('菜单缺「净化批次」');
  menuSql.includes("'yuqing:clean:list'") ? ok('菜单含 yuqing:clean:list') : bad('菜单缺 yuqing:clean:list');
  menuSql.includes("'yuqing:clean:replay'") ? ok('菜单含 yuqing:clean:replay（重跑按钮权限）') : bad('菜单缺 yuqing:clean:replay');
  /* 权限必须在菜单 SQL 里出现过，否则后台按钮会被 v-hasPermi 隐藏 */
  const cleanPerms = (menuSql.match(/'yuqing:clean:[a-z]+'/g) || []);
  cleanPerms.length >= 6 ? ok(`yuqing:clean:* 权限 ${new Set(cleanPerms).size} 个`)
                         : bad(`yuqing:clean:* 权限仅 ${cleanPerms.length} 个（预期 ≥ 6）`);
}

/* ---------------- 12. F-010 预警 / F-011 推送 新增列与调度产物 ---------------- */
R.push('\n[12] F-010 预警规则 / F-011 推送规则 / 预警记录 新增列与调度产物');
{
  /** 取某张 MySQL 表的 DDL 主体 */
  const tableBody = (table) => {
    const m = schemaSql.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\) ENGINE`, 'i'));
    return m ? m[1] : null;
  };

  /* 12.1 预警规则：四类场景 / 传播阈值 / 突发增量参数 / 冷却期 / 专项标签 */
  const ALERT_RULE_COLS = ['trigger_scenes', 'spread_threshold', 'burst_ratio', 'min_burst_count', 'cooldown_minutes', 'topic_tags'];
  const alertRuleBody = tableBody('yq_alert_rule');
  if (!alertRuleBody) {
    bad('yq_schema.sql 未解析到 yq_alert_rule');
  } else {
    const miss = ALERT_RULE_COLS.filter((c) => !new RegExp(`\\b${c}\\b`).test(alertRuleBody));
    miss.length
      ? bad(`yq_alert_rule 缺列: ${miss.join(', ')}（场景/阈值不可配，验收标准 1/2 落不了地）`)
      : ok(`yq_alert_rule 新增列齐全（${ALERT_RULE_COLS.length} 项）`);

    /* trigger_scenes 必须装得下四类场景全选：'new_negative,high_risk,burst_increment,special_topic' = 52 字符 */
    const ts = alertRuleBody.match(/trigger_scenes\s+VARCHAR\((\d+)\)/i);
    ts && Number(ts[1]) >= 60
      ? ok(`trigger_scenes 列宽 ${ts[1]} ≥ 60（四类场景全选 52 字符）`)
      : bad(`trigger_scenes 列宽不足或缺失: ${ts ? ts[1] : 'n/a'}`);

    const br = alertRuleBody.match(/burst_ratio\s+DECIMAL\((\d+),(\d+)\)/i);
    br ? ok(`burst_ratio 定点数 ${br[1]},${br[2]}（避免浮点比较误差）`) : bad('burst_ratio 缺失或非 DECIMAL');
  }

  /* 12.2 推送规则：免打扰时段（跨夜语义由 QuietHours 承担） */
  const pushRuleBody = tableBody('yq_push_rule');
  if (!pushRuleBody) {
    bad('yq_schema.sql 未解析到 yq_push_rule');
  } else {
    for (const col of ['quiet_start', 'quiet_end']) {
      const m = pushRuleBody.match(new RegExp(`${col}\\s+VARCHAR\\((\\d+)\\)`, 'i'));
      if (!m) {
        bad(`yq_push_rule 缺 ${col}`);
      } else if (Number(m[1]) < 5) {
        /* HH:mm 至少 5 字符，短了会截断成 "22:0" */
        bad(`${col} 列宽 ${m[1]} < 5，HH:mm 会被截断`);
      } else {
        ok(`yq_push_rule 的 ${col} 列宽 ${m[1]} ≥ 5`);
      }
    }
  }

  /* 12.3 预警记录：事件聚合指纹（验收标准 7 的去重载体） */
  const alertBody = tableBody('yq_alert');
  if (!alertBody) {
    bad('yq_schema.sql 未解析到 yq_alert');
  } else {
    const fp = alertBody.match(/fingerprint\s+VARCHAR\((\d+)\)/i);
    if (!fp) {
      bad('yq_alert 缺 fingerprint（同事件重复预警无法抑制）');
    } else if (Number(fp[1]) < 64) {
      /* cluster:<雪花ID> 约 26 字符；task:<id>:<16位hash> 约 30 字符。64 留足余量 */
      bad(`fingerprint 列宽 ${fp[1]} < 64`);
    } else {
      ok(`yq_alert 的 fingerprint 列宽 ${fp[1]} ≥ 64`);
    }
  }

  /* 12.4 PC 端：五个调度/管理页面存在且引用了正确端点 */
  const PC_PAGES = [
    ['alert', '预警处置台', ['processAlert', 'alertPendingCount', 'yuqing:alert:process']],
    ['alertRule', '预警规则', ['triggerScenes', 'burstRatio', 'cooldownMinutes']],
    ['pushRule', '推送规则', ['quietStart', 'quietEnd', 'flushPush']],
    ['pushTemplate', '推送模板', ['bodyTemplate', 'fieldList']],
    ['pushRecord', '推送记录', ['retryPush', 'pushStatistics']]
  ];
  for (const [dir, label, needles] of PC_PAGES) {
    const file = path.join(PC_DIR, dir, 'index.vue');
    if (!fs.existsSync(file)) {
      bad(`PC 页面缺失: views/yuqing/${dir}/index.vue（${label}）`);
      continue;
    }
    const src = read(file);
    const miss = needles.filter((n) => !src.includes(n));
    miss.length
      ? bad(`views/yuqing/${dir}/index.vue 缺关键内容: ${miss.join(', ')}`)
      : ok(`PC 页面 ${dir}（${label}）存在并含 ${needles.length} 项关键内容`);
  }

  /* 12.5 PC 端调度接口封装 */
  for (const [rel, label, needles] of [
    ['alert/dispatch.ts', '预警调度接口', ['/yuqing/alert/scan', '/yuqing/alert/process', '/yuqing/alert/pendingCount']],
    ['push/dispatch.ts', '推送调度接口', ['/yuqing/push/retry/', '/yuqing/push/flush', '/yuqing/push/statistics']]
  ]) {
    const file = path.join(PC_API_DIR, rel);
    if (!fs.existsSync(file)) {
      bad(`PC 接口封装缺失: api/yuqing/${rel}（${label}）`);
      continue;
    }
    const src = read(file);
    const miss = needles.filter((n) => !src.includes(n));
    miss.length ? bad(`api/yuqing/${rel} 缺端点: ${miss.join(', ')}`)
                : ok(`PC 接口封装 ${rel} 含 ${needles.length} 个端点`);
  }

  /* 12.6 H5 预警页面与接口 */
  const h5Page = path.join(H5_DIR, 'alert/index.vue');
  const h5Api = read(path.join(H5_DIR, '../../api/yuqing/alert/dispatch.js'));
  fs.existsSync(h5Page) ? ok('H5 预警页面 pages/yuqing/alert/index.vue 存在')
                        : bad('H5 预警页面缺失: pages/yuqing/alert/index.vue');
  if (fs.existsSync(h5Page)) {
    const src = read(h5Page);
    /* H5 页面必须走 definePage 宏，且处置前必须做「说明非空」前端校验，与后端状态机口径一致 */
    src.includes('definePage(') ? ok('H5 预警页面使用 definePage 宏')
                               : bad('H5 预警页面未使用 definePage（不会被 uni-pages 扫描）');
    src.includes('processRemark') ? ok('H5 预警页面含处置说明字段')
                                 : bad('H5 预警页面缺处置说明字段');
  }
  h5Api.includes('/yuqing/alert/process') && h5Api.includes('/yuqing/alert/pendingCount')
    ? ok('H5 接口封装 alert/dispatch.js 含处置与未处置计数端点')
    : bad('H5 接口封装 alert/dispatch.js 缺端点');
}

/* ---------------- 13. F-009 多维分析：预聚合表 / 列 / 字典 / 菜单 / 看板前端 ---------------- */
R.push('\n[13] F-009 多维分析：预聚合表 / 互动量列 / 字典 / 菜单 / 看板前端');
{
  /** 取某张 MySQL 表的 DDL 主体 */
  const bodyOf = (table, src = schemaSql) => {
    const m = src.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\) ENGINE`, 'i'));
    return m ? m[1] : null;
  };

  /* 13.1 聚合批次表：结论与降级提示的载体 */
  const batchBody = bodyOf('yq_stats_batch');
  if (!batchBody) {
    bad('yq_schema.sql 缺少 yq_stats_batch 建表');
  } else {
    const REQUIRED = ['batch_id', 'batch_no', 'begin_date', 'end_date', 'trigger_type', 'status',
      'source_count', 'daily_rows', 'dim_rows', 'hot_rows', 'cost_ms', 'data_until', 'notice',
      'conclusion_json', 'fail_reason'];
    const miss = REQUIRED.filter((c) => !new RegExp(`\\b${c}\\b`).test(batchBody));
    miss.length ? bad(`yq_stats_batch 缺列: ${miss.join(', ')}`)
                : ok(`yq_stats_batch 必备列齐全（${REQUIRED.length} 项）`);

    /* 结构化结论必须落库：看板的「核心事件 / 传播路径」只能从批次读，预聚合表里没有明细 */
    const cj = batchBody.match(/conclusion_json\s+([A-Za-z]+(?:\(\d+\))?)/);
    cj && /^(TEXT|LONGTEXT|JSON)$/i.test(cj[1])
      ? ok(`conclusion_json 类型 ${cj[1]}（装得下完整结论 JSON）`)
      : bad(`conclusion_json 类型不足: ${cj ? cj[1] : '缺失'}`);

    /* 批次号参与幂等判重与「最新成功批次」查询，必须有 */
    const bn = batchBody.match(/batch_no\s+VARCHAR\((\d+)\)/i);
    bn ? ok(`batch_no 列宽 ${bn[1]}`) : bad('yq_stats_batch 缺 batch_no');
  }

  /* 13.2 三张预聚合表：Doris 与 MySQL 镜像必须同时存在，否则本地联调起不来 */
  for (const [label, src, file] of [
    ['Doris', dorisSql, 'yq_doris_schema.sql'],
    ['MySQL 镜像', read(path.join(SQL_DIR, 'yq_doris_mysql_fallback.sql')), 'yq_doris_mysql_fallback.sql']
  ]) {
    if (!src.trim()) { bad(`${file} 不存在或为空`); continue; }
    const missing = ['yq_stats_daily', 'yq_stats_dim', 'yq_stats_hot']
      .filter((t) => !new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${t} \\(`, 'i').test(src));
    missing.length ? bad(`${file}（${label}）缺表: ${missing.join(', ')}`)
                   : ok(`${file}（${label}）含 3 张预聚合表`);

    const daily = src.match(/CREATE TABLE (?:IF NOT EXISTS )?yq_stats_daily \(([\s\S]*?)\n\)/i);
    if (daily) {
      /* 互动量四列：「互动数据」卡片与结论文字的数据源，少一列就走不通 */
      const INTER = ['read_sum', 'comment_sum', 'share_sum', 'like_sum'];
      const missInter = INTER.filter((c) => !new RegExp(`\\b${c}\\b`).test(daily[1]));
      missInter.length ? bad(`${file} 的 yq_stats_daily 缺互动量列: ${missInter.join(', ')}`)
                       : ok(`${file} 的 yq_stats_daily 含四项互动量列`);
      /* 列名在 Doris 侧带反引号，正则必须容忍 —— 漏了会把「有列」误判成「缺列」 */
      const nr = daily[1].match(/`?negative_rate`?\s+DECIMAL\((\d+),(\d+)\)/i);
      nr ? ok(`${file} 的 negative_rate 定点数 ${nr[1]},${nr[2]}`) : bad(`${file} 的 negative_rate 缺失或非 DECIMAL`);
    }
  }

  /* 13.3 全库重复列扫描（本轮真实踩到的缺陷）
   * genDorisSql 的列池同时含「显式补的主键列」与 fields 里声明的同名列，
   * 渲染出两行 `dim_id` → Doris 直接 duplicate column 建表失败。
   * 300 行 DDL 里人眼看不见，只能靠脚本兜住。 */
  const dupIssues = [];
  for (const [file, src] of [
    ['yq_schema.sql', schemaSql],
    ['yq_doris_schema.sql', dorisSql],
    ['yq_doris_mysql_fallback.sql', read(path.join(SQL_DIR, 'yq_doris_mysql_fallback.sql'))]
  ]) {
    const s = stripComments(src);
    for (const m of s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]*?)\n\s*\)/gi)) {
      const cols = [...m[2].matchAll(/^\s*`?(\w+)`?\s+(?:bigint|int|varchar|char|datetime|date|text|longtext|decimal|json|tinyint|string)/gim)]
        .map((x) => x[1]);
      const dup = [...new Set(cols.filter((c, i) => cols.indexOf(c) !== i))];
      if (dup.length) dupIssues.push(`${file}/${m[1]}: ${dup.join('/')}`);
    }
  }
  dupIssues.length ? bad(`DDL 存在重复列（建表会直接失败）: ${dupIssues.join('; ')}`)
                   : ok('三份 SQL 的全部建表语句均无重复列');

  /* 13.4 新增字典类 */
  for (const [type, values] of [
    ['yq_stats_trigger_type', ['auto', 'manual', 'replay']],
    ['yq_stats_batch_status', ['running', 'success', 'failed']]
  ]) {
    const hasType = dictSql.includes(`'${type}'`);
    const missVal = values.filter((v) => !new RegExp(`'${v}', '${type}'`).test(dictSql));
    if (!hasType) bad(`yq_dict.sql 缺少字典 ${type}`);
    else if (missVal.length) bad(`字典 ${type} 缺取值: ${missVal.join(', ')}`);
    else ok(`字典 ${type} 与 ${values.length} 个取值齐备`);
  }

  /* 13.5 菜单：统计看板 + 三枚按钮权限（重算是 F-009 独有动作，缺了只能干等定时任务） */
  menuSql.includes("'统计看板'") ? ok('菜单含「统计看板」') : bad('菜单缺「统计看板」');
  for (const [perm, label] of [
    ['yuqing:dashboard:list', '看板查询'],
    ['yuqing:dashboard:export', '看板导出'],
    ['yuqing:dashboard:aggregate', '看板重算']
  ]) {
    menuSql.includes(`'${perm}'`) ? ok(`菜单含 ${perm}（${label}）`) : bad(`菜单缺 ${perm}（${label}）`);
  }
  const dashPerms = new Set(menuSql.match(/'yuqing:dashboard:[a-z]+'/g) || []);
  dashPerms.size >= 3 ? ok(`yuqing:dashboard:* 权限 ${dashPerms.size} 个`)
                      : bad(`yuqing:dashboard:* 权限仅 ${dashPerms.size} 个（预期 ≥ 3）`);

  /* 13.6 PC 看板页面与接口封装 */
  const dashView = path.join(PC_DIR, 'dashboard/index.vue');
  if (!fs.existsSync(dashView)) {
    bad('PC 页面缺失: views/yuqing/dashboard/index.vue（统计看板）');
  } else {
    const src = read(dashView);
    const needles = ['listBatches', 'getDrilldown', 'aggregateStats', 'conclusion',
      'yuqing:dashboard:aggregate', '/yuqing/analytics/export'];
    const miss = needles.filter((n) => !src.includes(n));
    miss.length ? bad(`views/yuqing/dashboard/index.vue 缺关键内容: ${miss.join(', ')}`)
                : ok(`PC 看板页面存在并含 ${needles.length} 项关键内容`);
  }
  const analyticsApi = path.join(PC_API_DIR, 'analytics/index.ts');
  if (!fs.existsSync(analyticsApi)) {
    bad('PC 接口封装缺失: api/yuqing/analytics/index.ts（看板查询 / 下钻 / 报告交接 / 重算 / 批次）');
  } else {
    const src = read(analyticsApi);
    const needles = ['/yuqing/analytics/dashboard', '/yuqing/analytics/drilldown',
      '/yuqing/analytics/handoff', '/yuqing/analytics/aggregate', '/yuqing/analytics/batches'];
    const miss = needles.filter((n) => !src.includes(n));
    miss.length ? bad(`api/yuqing/analytics/index.ts 缺端点: ${miss.join(', ')}`)
                : ok(`PC 看板接口封装含 ${needles.length} 个端点`);
  }
  /* 13.7 TS 类型里的重复字段
   * 与 13.3 同源：表定义里手写主键列 + 生成器自动补主键 = 接口里出现两行同名字段
   * （TS2300 Duplicate identifier）。vue-tsc 全量跑一次要几分钟，这里先挡住。 */
  const tsDup = [];
  const apiRoot = path.dirname(PC_API_DIR);
  if (fs.existsSync(apiRoot)) {
    for (const d of fs.readdirSync(apiRoot, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const tf = path.join(apiRoot, d.name, 'types.ts');
      if (!fs.existsSync(tf)) continue;
      const src = read(tf);
      for (const m of src.matchAll(/export\s+interface\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
        const names = [...m[2].matchAll(/^\s{2}(\w+)\??:/gm)].map((x) => x[1]);
        const dup = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
        if (dup.length) tsDup.push(`${d.name}/types.ts ${m[1]}: ${dup.join('/')}`);
      }
    }
  }
  tsDup.length ? bad(`TS 类型存在重复字段（vue-tsc TS2300）: ${tsDup.join('; ')}`)
               : ok('PC 端 yuqing/*/types.ts 接口无重复字段');
}

/* ---------------- 14. F-016 舆情台账：审计表 / 推送场景 / 双库读服务 / 前端 ---------------- */
R.push('\n[14] F-016 舆情台账：审计表 / 推送场景 / 权限码 / 双库读服务 / PC 页面');
{
  /** 取某张 MySQL 表的 DDL 主体（与 13 同源实现，避免跨块引用） */
  const bodyOfL = (table) => {
    const m = schemaSql.match(new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\) ENGINE`, 'i'));
    return m ? m[1] : null;
  };
  const jread = (rel) => read(path.join(JAVA_DIR, rel));
  /* 剥掉块注释与行注释：下文多处判据都要求「只看代码，不看注释里的同名文本」，
   * 否则本文件自己写的「不得 import PageQuery」「（无 @ExcelProperty）」等说明
   * 会把检查判成违规。 */
  const deComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  /* 14.1 台账导出审计表（验收标准 10） */
  const ledBody = bodyOfL('yq_ledger_export_log');
  if (!ledBody) {
    bad('yq_schema.sql 缺少 yq_ledger_export_log 建表（F-016 导出审计无法落地）');
  } else {
    const REQ = ['export_id', 'export_scope', 'query_summary', 'query_json', 'columns_json',
      'row_count', 'column_count', 'export_mode', 'status', 'file_name', 'file_url',
      'finish_time', 'fail_reason', 'oper_ip',
      'create_by', 'create_time'];
    const miss = REQ.filter((c) => !new RegExp(`\\b${c}\\b`).test(ledBody));
    miss.length ? bad(`yq_ledger_export_log 缺列: ${miss.join(', ')}`)
                : ok(`yq_ledger_export_log 必备列齐全（${REQ.length} 项，含导出人与操作时间）`);

    /* 验收标准 10 要求「导出人、时间、条件、条数」四项可查 —— 逐项确认载体列存在 */
    const AUDIT = { '导出人': 'create_by', '时间': 'create_time', '条件': 'query_summary', '条数': 'row_count' };
    const lack = Object.entries(AUDIT).filter(([, c]) => !new RegExp(`\\b${c}\\b`).test(ledBody));
    lack.length ? bad(`审计四要素缺列: ${lack.map((x) => x[0] + '(' + x[1] + ')').join(', ')}`)
                : ok('审计四要素（导出人/时间/条件/条数）均有列承载');

    /* 条件 JSON 必须能装下完整查询条件；VARCHAR 会截断导致回放失败 */
    const qj = ledBody.match(/query_json\s+([A-Za-z]+(?:\(\d+\))?)/);
    qj && /^(TEXT|LONGTEXT|JSON)$/i.test(qj[1])
      ? ok(`query_json 类型 ${qj[1]}（可容纳完整条件快照）`)
      : bad(`query_json 类型不足: ${qj ? qj[1] : '缺失'}`);

    /* 审计列表按 (create_by, create_time) 过滤 + 倒序；非全量角色只看自己的记录 */
    const hasOwnerIdx = /KEY\s+\w+\s*\(\s*create_by\s*,\s*create_time\s*\)/i.test(ledBody);
    hasOwnerIdx ? ok('存在 (create_by, create_time) 索引（审计列表按导出人过滤）')
                : bad('缺少 (create_by, create_time) 索引：非全量角色的审计列表会全表扫描');
  }

  /* 14.1b 审计列索引防回归。
   *
   * 背景：gen-yuqing.mjs 的 genIndexes 用 allFields(t) 做「列存在性」守卫，
   * 而审计列（create_by / create_time）是 genTable 在 fields 之后追加的，
   * 不在 t.fields 里 —— 于是引用审计列的索引被【静默丢弃】，DDL 与线上表都没有，
   * 也没有任何报错。曾同时影响 F-011 / F-012 / F-016 三处。
   * 这里显式断言这三条索引确实落地，防止回归。 */
  const AUDIT_IDX = [
    ['yq_push_record', 'idx_yq_pushrec_status', 'F-011 推送记录'],
    ['yq_wecom_command', 'idx_yq_cmd_status', 'F-012 企微指令'],
    ['yq_ledger_export_log', 'idx_yq_lexp_owner', 'F-016 台账导出审计'],
  ];
  const idxLack = [];
  for (const [tb, name, label] of AUDIT_IDX) {
    const b = bodyOfL(tb);
    if (!b) {
      idxLack.push(`${tb}(表缺失)`);
      continue;
    }
    if (!new RegExp(`\\b${name}\\b`).test(b)) {
      idxLack.push(`${label}: ${tb}.${name}`);
    }
  }
  idxLack.length
    ? bad(`引用审计列的索引未落地（生成器静默丢弃已回归）: ${idxLack.join('; ')}`)
    : ok(`审计列索引 ${AUDIT_IDX.length} 条均已落地（F-011/F-012/F-016）`);

  /* 14.2 导出完成推送场景必须已在字典登记（验收标准 6） */
  if (/ledger_export_ready/.test(dictSql)) {
    ok('字典 yq_push_scene 含 ledger_export_ready（异步导出完成通知场景）');
  } else {
    bad('字典 yq_push_scene 缺 ledger_export_ready：推送记录列表会显示裸编码');
  }

  /* 14.3 台账权限码与菜单 component 指向（复用已有 7 枚，不新增菜单） */
  const PERMS = ['yuqing:opinion:list', 'yuqing:opinion:query', 'yuqing:opinion:export',
    'yuqing:opinion:import', 'yuqing:opinion:remove', 'yuqing:opinion:analyze', 'yuqing:opinion:correct'];
  const permMiss = PERMS.filter((p) => !menuSql.includes(p));
  permMiss.length ? bad(`台账权限码缺失: ${permMiss.join(', ')}`)
                  : ok(`台账权限码 ${PERMS.length} 枚齐备（list/query/export/import/remove/analyze/correct）`);
  const opinionMenu = /'yuqing\/opinion\/index'/.test(menuSql);
  opinionMenu ? ok('菜单「舆情台账」component 指向 yuqing/opinion/index')
              : bad('菜单中找不到 yuqing/opinion/index 的 component 配置');

  /* 14.4 台账后端产物落盘情况 */
  const JAVA_REL = [
    'ledger/config/YqLedgerProperties.java',
    'ledger/domain/LedgerQuery.java', 'ledger/domain/LedgerRow.java', 'ledger/domain/LedgerDetail.java',
    'ledger/support/LedgerScope.java', 'ledger/support/LedgerScopeResolver.java',
    'ledger/support/LedgerHighlighter.java', 'ledger/support/LedgerEmptyHint.java',
    'ledger/support/LedgerColumnCatalog.java', 'ledger/support/LedgerQuerySummary.java',
    'ledger/support/LedgerTimeParser.java', 'ledger/support/LedgerStages.java',
    'ledger/dao/LedgerOpinionDao.java', 'ledger/dao/LedgerMetaDao.java',
    'ledger/service/IYqLedgerService.java', 'ledger/service/impl/YqLedgerServiceImpl.java',
    'ledger/service/IYqLedgerExportService.java', 'ledger/service/impl/YqLedgerExportServiceImpl.java',
    'ledger/export/LedgerExcelWriter.java', 'ledger/export/LedgerExportRunner.java',
    'ledger/export/LedgerPushScene.java',
    'controller/YqOpinionController.java', 'controller/YqClusterController.java',
    'job/YqLedgerExportJobExecutor.java',
  ];
  const jMiss = JAVA_REL.filter((r2) => !fs.existsSync(path.join(JAVA_DIR, r2)));
  jMiss.length ? bad(`台账后端产物缺失 ${jMiss.length} 个: ${jMiss.join(', ')}`)
               : ok(`台账后端产物齐备（${JAVA_REL.length} 个类）`);

  /* 14.5 数据权限（验收标准 8 / 决策 ③A）：denyAll 必须落成恒假条件，绝不能「不加条件」 */
  const wrapper = jread('ledger/support/LedgerWrapperFactory.java');
  if (!wrapper) {
    bad('LedgerWrapperFactory 未落盘，无法校验数据权限 SQL 语义');
  } else {
    const hasDeny = /isDenyAll\(\)/.test(wrapper);
    /* 无授权时若走「不加条件」分支，等价于全量可见 = 越权泄露 */
    const fakeEq = /eq\(\s*YqOpinion::getOpinionId\s*,\s*-1L\s*\)/.test(wrapper);
    hasDeny && fakeEq
      ? ok('denyAll 分支生成恒假条件（eq opinion_id = -1L），不会退化成「不加条件」')
      : bad('denyAll 语义未落成恒假条件：无授权用户可能看到全量数据（越权）');
  }

  /* 14.6 导出上限与异步阈值必须可配（验收标准 5、6） */
  const props = jread('ledger/config/YqLedgerProperties.java');
  if (!props) {
    bad('YqLedgerProperties 未落盘（导出上限不可配）');
  } else {
    const KEYS = [['syncExportLimit', 'sync-export-limit'], ['maxExportRows', 'max-export-rows'],
      ['maxPageSize', 'max-page-size'], ['exportJobId', 'export-job-id'],
      ['allDataRoleKeys', 'all-data-role-keys']];
    const kMiss = KEYS.filter(([f]) => !new RegExp(`\\b${f}\\b`).test(props));
    kMiss.length ? bad(`台账配置缺项: ${kMiss.map((x) => x[1]).join(', ')}`)
                 : ok(`台账配置 ${KEYS.length} 项齐备（同步上限/硬上限/单页上限/作业ID/全量角色键）`);
  }

  /* 14.7 导出列白名单必须由行对象注解派生，且列数与导出载体一致（验收标准 5「字段范围可配置」） */
  const rowSrc = jread('ledger/domain/LedgerRow.java');
  const catSrc = jread('ledger/support/LedgerColumnCatalog.java');
  if (!rowSrc || !catSrc) {
    bad('LedgerRow / LedgerColumnCatalog 未落盘，无法校验导出列白名单');
  } else {
    const annotated = (rowSrc.match(/@ExcelProperty\(/g) || []).length;
    /* Fesod 注解包名写错（写成 EasyExcel）会让导出静默无表头 */
    const fesod = /import\s+org\.apache\.fesod\.sheet\.annotation\.ExcelProperty;/.test(rowSrc)
      && !/com\.alibaba\.excel/.test(rowSrc);
    fesod ? ok('LedgerRow 使用 Fesod 注解包名（org.apache.fesod.sheet.*）')
          : bad('LedgerRow 的 Excel 注解包名不对（v6 必须用 Fesod，否则导出静默无表头）');
    /* 白名单反射派生 -> 不会与实体漂移 */
    const reflect = /getDeclaredFields\(\)/.test(catSrc) && /getAnnotation\(ExcelProperty\.class\)/.test(catSrc);
    reflect ? ok('导出列白名单由 LedgerRow 注解反射派生（不会与实体漂移）')
            : bad('LedgerColumnCatalog 未反射派生白名单，存在与实体漂移的风险');
    annotated >= 15
      ? ok(`LedgerRow 可导出列 ${annotated} 列（≥15）`)
      : bad(`LedgerRow 可导出列仅 ${annotated} 列，台账导出字段过少`);
    /* 导出行必须只让该导的字段带注解。
     * ⚠ 判据必须【先剥注释再按分号切声明段】：早期版本直接在整份源码上做
     * 「注解后 80 字符内出现字段名」的正则，被两条无关文本误伤 ——
     *   ① 注释「（无 @ExcelProperty）」出现在 alertFlag 上方；
     *   ② opinionUrl 的注解与 alertFlag 的声明距离不足 80 字符。
     * 剥注释 + 按 `;` 分段后，判据变成「同一声明段内既有注解又有该字段名」，
     * 才真正等价于「这个字段带了 @ExcelProperty」。 */
    const rowClean = deComment(rowSrc);
    const leaked = ['fragments', 'alertFlag', 'pushFlag', 'clusterId'].filter((f) =>
      rowClean.split(';').some((seg) =>
        new RegExp(`private\\s+[A-Za-z<>,.\\[\\] ]+\\b${f}\\b\\s*$`).test(seg.trim())
        && /@ExcelProperty/.test(seg)));
    leaked.length ? bad(`以下非展示字段带导出注解（会导出去）: ${leaked.join(', ')}`)
                  : ok('高亮片段等非展示字段未进入导出列');
  }

  /* 14.8 台账端点清单（PRD §6.3） */
  const ctrl = jread('controller/YqOpinionController.java');
  const clusterCtrl = jread('controller/YqClusterController.java');
  if (!ctrl || !clusterCtrl) {
    bad('台账控制器未落盘');
  } else {
    const EP = ['"/list"', '"/search"', '"/export"', '"/export/{exportId}"', '"/exportLog/list"'];
    const eMiss = EP.filter((e) => !ctrl.includes(e));
    eMiss.length ? bad(`YqOpinionController 缺端点: ${eMiss.join(', ')}`)
                 : ok(`台账控制器含 ${EP.length} 个固定端点`);
    const detailEp = /@GetMapping\("\/\{opinionId\}"\)/.test(ctrl);
    detailEp ? ok('台账详情端点 /{opinionId} 存在') : bad('台账详情端点缺失');
    /* 固定路径必须在 /{opinionId} 之前，否则会被路径变量误吞 */
    const iSearch = ctrl.indexOf('"/search"'), iExport = ctrl.indexOf('"/export"');
    const iDetail = ctrl.indexOf('@GetMapping("/{opinionId}")');
    iDetail >= 0 && iSearch >= 0 && iExport >= 0 && iSearch > iDetail && iExport > iDetail
      ? ok('/search 与 /export 声明在 /{opinionId} 之前（避免被路径变量吞掉）')
      : bad('固定路径未前置到 /{opinionId} 之前，存在被路径变量误匹配的风险');
    (/@SaCheckPermission\("yuqing:opinion:export"\)/.test(ctrl))
      ? ok('台账导出端点挂 yuqing:opinion:export 权限')
      : bad('台账导出端点缺少权限注解');
    (/yuqing\/cluster/.test(clusterCtrl) && /@GetMapping\("\/\{clusterId\}"\)/.test(clusterCtrl))
      ? ok('事件聚合端点 /yuqing/cluster/{clusterId} 存在（验收标准 4）')
      : bad('事件聚合端点缺失');
  }

  /* 14.9 异步导出执行器：SnailJob 执行器名与配置键闭环（决策 ②A） */
  const jobSrc = jread('job/YqLedgerExportJobExecutor.java');
  if (!jobSrc) {
    bad('YqLedgerExportJobExecutor 未落盘');
  } else {
    const m = jobSrc.match(/@JobExecutor\(name\s*=\s*"([^"]+)"\)/);
    m ? ok(`异步导出执行器名 ${m[1]}（需在调度控制台按此名建作业）`)
      : bad('YqLedgerExportJobExecutor 缺 @JobExecutor(name=...)');
  }

  /* 14.10 PC 台账页面与接口封装 */
  const PC_FILES = [
    'opinion/index.vue', 'opinion/OpinionDetailDrawer.vue',
    'opinion/ClusterTimelineDrawer.vue', 'opinion/ExportLogDialog.vue',
  ];
  const pcMiss = PC_FILES.filter((f) => !fs.existsSync(path.join(PC_DIR, f)));
  pcMiss.length ? bad(`PC 台账页面缺失: ${pcMiss.join(', ')}（菜单点进去会空白）`)
                : ok(`PC 台账页面 ${PC_FILES.length} 个齐备（含详情/事件时间轴/导出记录）`);

  const apiIdx = read(path.join(PC_API_DIR, 'ledger/index.ts'));
  const apiTypes = read(path.join(PC_API_DIR, 'ledger/types.ts'));
  if (!apiIdx || !apiTypes) {
    bad('PC 台账接口封装 api/yuqing/ledger 缺失');
  } else {
    const EPS = ['/yuqing/opinion/list', '/yuqing/opinion/search', '/yuqing/opinion/export',
      '/yuqing/opinion/exportLog/list', '/yuqing/cluster/'];
    const aMiss = EPS.filter((e) => !apiIdx.includes(e));
    aMiss.length ? bad(`api/yuqing/ledger/index.ts 缺端点: ${aMiss.join(', ')}`)
                 : ok(`PC 台账接口封装含 ${EPS.length} 组端点`);
    /* 三件套 import 必须走本工程既有路径，写错即 TS2305 */
    const okImp = /from '@\/utils\/api-types'/.test(apiIdx)
      && /from '@\/api\/types'/.test(apiIdx)
      && !/from 'axios'/.test(apiIdx);
    okImp ? ok('AxiosPromise / PageResult 的 import 路径正确（非 axios / 非全局）')
          : bad('PC 台账接口的 AxiosPromise 或 PageResult import 路径不对（会 TS2305）');
    /* types.ts 不得 import 全局 PageQuery：先剥注释再判，否则文件头
     * 「本文件不得 import PageQuery」这句说明本身就会把自己判成违规。 */
    const typesClean = deComment(apiTypes);
    !/\bPageQuery\b/.test(typesClean)
      ? ok('台账 types.ts 未使用全局 PageQuery（避免 TS2305 + TS2339）')
      : bad('台账 types.ts 出现了 PageQuery：全局接口 import 即报错');
    /* el-table 行类型字段必须全部可选，否则 scope.row 传参 TS2345。
     * ⚠ 只对「行类型」（*VO / *Row / *Node / *Point）做此要求：
     *   *Form / *Params 是请求体，query 这类必填字段是刻意的约束。 */
    const ROW_LIKE = /(VO|Row|Node|Point)$/;
    const required = [];
    for (const m of typesClean.matchAll(/export\s+interface\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      if (!ROW_LIKE.test(m[1])) continue;
      for (const f of m[2].matchAll(/^\s{2}(\w+):\s/gm)) {
        required.push(m[1] + '.' + f[1]);
      }
    }
    required.length === 0
      ? ok('台账行类型字段全部可选（el-table 传参约束）')
      : bad(`台账行类型存在 ${required.length} 个必需字段（如 ${required.slice(0, 5).join(', ')}），el-table 传参会 TS2345`);
  }

  /* 14.11 PC 页面必须使用与后端一致的权限码（否则「按钮看得见、点了 403」） */
  const idxVue = read(path.join(PC_DIR, 'opinion/index.vue'));
  if (idxVue) {
    const used = new Set([...idxVue.matchAll(/yuqing:opinion:(\w+)/g)].map((x) => x[1]));
    const bad2 = [...used].filter((p) => !PERMS.includes(`yuqing:opinion:${p}`));
    bad2.length ? bad(`PC 台账页面使用了后端不存在的权限码: ${bad2.join(', ')}`)
                : ok(`PC 台账页面权限码与后端一致（${[...used].join('/')}）`);
    /* 详情抽屉正文不得用 v-html 渲染原始正文（存储型 XSS 面） */
    const drawer = read(path.join(PC_DIR, 'opinion/OpinionDetailDrawer.vue'));
    drawer && /<pre[\s\S]{0,200}\{\{\s*detail\.content/.test(drawer)
      ? ok('详情正文以纯文本渲染（未用 v-html 渲染原文）')
      : warn('未确认详情正文的渲染方式，请确认原文未走 v-html');
  }

  /* 14.12 import ↔ export 闭环。
   *
   * 背景：vue-tsc 全量跑一次要几十秒，而「页面 import 了接口模块里不存在的名字」
   * （漏写导出、改名没同步）是最常见的一类 TS2304/TS2305。这里用静态比对提前拦住。
   * 实测已抓到：index.vue 漏 import searchLedger 导致的 TS2304。 */
  const VIEW_DIR = path.join(PC_DIR, 'opinion');
  const apiExports = new Set([...apiIdx.matchAll(/export\s+const\s+(\w+)/g)].map((x) => x[1]));
  const typeExports = new Set([
    ...[...apiTypes.matchAll(/export\s+interface\s+(\w+)/g)].map((x) => x[1]),
    ...[...apiTypes.matchAll(/export\s+type\s+(\w+)/g)].map((x) => x[1]),
  ]);
  const broken = [];
  let checked = 0;
  if (fs.existsSync(VIEW_DIR)) {
    for (const f of fs.readdirSync(VIEW_DIR)) {
      if (!f.endsWith('.vue')) continue;
      const src = read(path.join(VIEW_DIR, f));
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/api\/yuqing\/ledger'/g)) {
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (!name) continue;
          checked++;
          if (!apiExports.has(name)) broken.push(`${f}: ${name}（api/yuqing/ledger/index.ts 未导出）`);
        }
      }
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/api\/yuqing\/ledger\/types'/g)) {
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim();
          if (!name) continue;
          checked++;
          if (!typeExports.has(name)) broken.push(`${f}: ${name}（types.ts 未导出）`);
        }
      }
    }
  }
  broken.length
    ? bad(`台账页面 import 了不存在的导出（vue-tsc TS2304）：${broken.join('; ')}`)
    : ok(`台账页面 import 与接口导出闭环一致（校验 ${checked} 个具名导入）`);
}

/* ---------------- 15. F-007 智能研判：菜单 / 权限闭环 / 后端产物 / 前端闭环 ---------------- */
R.push('\n[15] F-007 智能研判：菜单 / 权限闭环 / 后端产物 / 前端闭环');
{
  const jread = (rel) => read(path.join(JAVA_DIR, rel));
  const aread = (rel) => read(path.join(PC_API_DIR, rel));
  const pread = (rel) => read(path.join(PC_DIR, rel));
  const AVIEW = path.join(PC_DIR, 'analysis');
  const deComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

  /* 15.1 C 菜单「研判中心」与权限码复用（零新增，与 14.3 同一口径） */
  const menuHit = /'yuqing\/analysis\/index'/.test(menuSql);
  menuHit ? ok('菜单「研判中心」component 指向 yuqing/analysis/index')
          : bad('菜单中找不到 yuqing/analysis/index 的 component 配置（点进去会是空白页）');
  const A_PERMS = ['yuqing:opinion:list', 'yuqing:opinion:query',
    'yuqing:opinion:analyze', 'yuqing:opinion:correct', 'yuqing:model:iterate'];
  const aPermMiss = A_PERMS.filter((p) => !menuSql.includes(p));
  aPermMiss.length ? bad(`研判所需的权限码在菜单里缺失（按钮点了会 403）: ${aPermMiss.join(', ')}`)
                   : ok(`研判所需权限码 ${A_PERMS.length} 枚均在菜单里有 F 节点（零新增，全部复用既有按钮）`);
  /* C 菜单号段必须已经抬到 0913，否则 0913 会被 [2] 判为越界 */
  const cHiOk = MENU_C_HI >= 1761400000000000913n;
  cHiOk ? ok('MENU_C_HI 已覆盖新菜单 0913（号段常量与生成器同步）')
        : bad('MENU_C_HI 未同步到 0913：新菜单会被判为越界');

  /* 15.2 后端产物落盘（analysis 包全量） */
  const A_JAVA = [
    'analysis/config/YqAnalysisProperties.java',
    'analysis/llm/ILlmClient.java', 'analysis/llm/LlmRequest.java', 'analysis/llm/LlmResponse.java',
    'analysis/llm/LlmException.java', 'analysis/llm/OpenAiCompatibleLlmClient.java',
    'analysis/parse/AnalysisJson.java', 'analysis/parse/ParsedJudgement.java',
    'analysis/parse/AnalysisResultParser.java',
    'analysis/prompt/PromptSpec.java', 'analysis/prompt/PromptPair.java', 'analysis/prompt/AnalysisPromptBuilder.java',
    'analysis/variant/VariantRule.java', 'analysis/variant/VariantDetector.java',
    'analysis/judge/RuleJudger.java', 'analysis/judge/JudgementMerger.java',
    'analysis/cluster/TextSimilarity.java', 'analysis/cluster/ClusterDraft.java', 'analysis/cluster/OpinionClusterer.java',
    'analysis/stage/SpreadStageClassifier.java', 'analysis/stage/SpreadPathWriter.java',
    'analysis/domain/AnalysisQuery.java', 'analysis/domain/AnalysisRow.java',
    'analysis/domain/AnalysisDetailView.java', 'analysis/domain/AnalysisCorrectBo.java',
    'analysis/domain/AnalysisPage.java', 'analysis/domain/AnalysisBatchResult.java',
    'analysis/domain/ClusterCard.java',
    'analysis/dao/AnalysisOpinionDao.java', 'analysis/dao/AnalysisMetaDao.java',
    'analysis/engine/AnalysisEngine.java',
    'analysis/service/IYqAnalysisService.java', 'analysis/service/impl/YqAnalysisServiceImpl.java',
    'controller/YqAnalysisController.java', 'job/YqAnalysisJobExecutor.java',
  ];
  const aMiss = A_JAVA.filter((r2) => !fs.existsSync(path.join(JAVA_DIR, r2)));
  aMiss.length ? bad(`F-007 后端产物缺失 ${aMiss.length} 个: ${aMiss.join(', ')}`)
               : ok(`F-007 后端产物齐备（${A_JAVA.length} 个类）`);

  /* 15.3 权限码零新增：控制器里出现的权限码必须都能在菜单里找到 */
  const ctrl = jread('controller/YqAnalysisController.java');
  if (!ctrl) {
    bad('YqAnalysisController 未落盘');
  } else {
    const ctrlPerms = [...new Set([...ctrl.matchAll(/@SaCheckPermission\("([^"]+)"\)/g)].map((m) => m[1]))];
    const orphan = ctrlPerms.filter((p) => !menuSql.includes(p));
    orphan.length ? bad(`控制器权限码未在菜单登记（角色永远勾不到）: ${orphan.join(', ')}`)
                  : ok(`控制器 ${ctrlPerms.length} 枚权限码全部已在菜单登记，无孤儿权限`);
    /* 单段字面量路径（如 /list）若排在 /{opinionId} 之后，会被路径变量吞掉。
     * 两个必须收窄的条件，否则全是误报：
     *   ① 只查「单段」—— Spring 按段数匹配，/cluster/list 有两段，
     *      与单段的 /{opinionId} 天然不冲突；
     *   ② 只查「同一 HTTP 方法」—— /{opinionId} 是 GET，
     *      POST /batch 与它根本不在一个匹配空间里。
     * 另外必须先剥注释：本文件的类注释里按文档顺序列举了全部端点。 */
    const ctrlCode = deComment(ctrl);
    const varM = ctrlCode.match(/@(Get|Post|Put|Delete)Mapping\("\/\{opinionId\}"\)/);
    if (!varM) {
      bad('控制器未找到 /{opinionId} 端点');
    } else {
      const verb = varM[1];
      const varPos = varM.index;
      const sameVerb = [...ctrlCode.matchAll(new RegExp(`@${verb}Mapping\\("(\\/[A-Za-z0-9_-]+)"\\)`, 'g'))];
      const afterVar = sameVerb.filter((m) => m.index > varPos).map((m) => m[1]);
      if (afterVar.length) {
        bad(`单段字面量 ${verb} 路径声明在 /{opinionId} 之后（会被当成 opinionId 解析而 400）: ${afterVar.join(', ')}`);
      } else {
        ok(`同方法单段字面量路径（${sameVerb.length} 个 ${verb}）均声明在 /{opinionId} 之前，不会被路径变量吞掉`);
      }
    }
  }

  /* 15.4 失败隔离与跨库事务（本模块两条硬约束） */
  const engine = jread('analysis/engine/AnalysisEngine.java');
  if (!engine) {
    bad('AnalysisEngine 未落盘，无法校验失败隔离');
  } else {
    const catches = /catch\s*\(\s*RuntimeException/.test(engine);
    catches ? ok('processOne 捕获 RuntimeException 并转为 failed（单条失败不阻塞整批）')
            : bad('processOne 未见 RuntimeException 兜底：单条异常会中断整批研判');
    const finalDone = /"completed"/.test(engine) || /ST_COMPLETED/.test(engine);
    finalDone ? ok('研判成功落 analyze_status = completed（与字典 yq_analyze_status 一致）')
              : bad('未写入 completed 终态：台账将永远显示 pending');
  }
  const impl = jread('analysis/service/impl/YqAnalysisServiceImpl.java');
  if (!impl) {
    bad('YqAnalysisServiceImpl 未落盘');
  } else {
    const txCount = (deComment(impl).match(/@Transactional/g) || []).length;
    txCount === 1
      ? ok('全类仅 1 处 @Transactional（rollbackModel 单库真事务）；跨库写入用幂等+固定顺序+终态兜底')
      : bad(`@Transactional 出现 ${txCount} 处：跨数据源事务是假事务，超过 1 处即有误用风险`);
    const visibleCheck = /isVisible\s*\(/.test(impl);
    visibleCheck ? ok('写操作前调用 isVisible 做数据权限前置校验（不信请求体）')
                 : bad('写操作未见数据权限前置校验：用户可能通过构造 opinionId 越权变更他人数据');
  }
  const daoDoris = jread('analysis/dao/AnalysisOpinionDao.java');
  const daoMeta = jread('analysis/dao/AnalysisMetaDao.java');
  if (daoDoris && daoMeta) {
    const dsOk = /@DS\("doris"\)/.test(daoDoris) && /@DS\("master"\)/.test(daoMeta);
    dsOk ? ok('双库 DAO 分离：Doris 读写只在 AnalysisOpinionDao，MySQL 只在 AnalysisMetaDao')
         : bad('@DS 注解未按双库分离：动态数据源是线程级上下文，混用会把 MySQL 语句路由到 Doris');
    const noTx = !/@Transactional/.test(deComment(daoDoris)) && !/@Transactional/.test(deComment(daoMeta));
    noTx ? ok('两个 DAO 均无 @Transactional（跨库写入不假装事务）')
         : bad('DAO 上出现 @Transactional：跨数据源事务无效，只会造成误解');
  } else {
    bad('AnalysisOpinionDao / AnalysisMetaDao 未落盘');
  }

  /* 15.5 大模型通道零额外依赖（JDK 自带 HttpClient，不引入第三方 SDK） */
  const llmCli = jread('analysis/llm/OpenAiCompatibleLlmClient.java');
  if (!llmCli) {
    bad('OpenAiCompatibleLlmClient 未落盘');
  } else {
    const jdkHttp = /java\.net\.http\.HttpClient/.test(llmCli) && !/com\.(openai|alibaba|zhipu)/.test(llmCli);
    jdkHttp ? ok('大模型通道用 JDK 自带 java.net.http.HttpClient（零额外依赖）')
            : bad('大模型通道引入了第三方 SDK 或未使用 JDK HttpClient');
    const interrupt = /Thread\.currentThread\(\)\.interrupt\(\)/.test(llmCli);
    interrupt ? ok('InterruptedException 处恢复中断标志（不吞中断）')
              : bad('未恢复中断标志：线程池里的中断信号会被静默吞掉');
  }

  /* 15.6 提示词注入防护（验收标准 1 的前置条件） */
  const builder = jread('analysis/prompt/AnalysisPromptBuilder.java');
  if (!builder) {
    bad('AnalysisPromptBuilder 未落盘');
  } else {
    const delim = /RAW_BEGIN/.test(builder) && /neutralize/.test(builder) && /stripControl/.test(builder);
    delim ? ok('提示词把原文夹在定界符之间，且构建前先 neutralize + stripControl')
          : bad('提示词缺少定界符或净化步骤：正文里的伪指令会被当成控制段');
    const roleStrip = /FAKE_ROLE/.test(builder);
    roleStrip ? ok('行首伪角色标记（system:/assistant:）在净化时被剥除')
              : bad('未剥离伪角色标记：可诱导模型切换角色');
  }

  /* 15.7 PC 前端产物与 api/types 具名导出闭环（vue-tsc TS2304 的前置拦截） */
  const A_VIEWS = ['index.vue', 'AnalysisDetailDrawer.vue', 'AnalysisCorrectDialog.vue', 'ClusterViewDrawer.vue'];
  const vMiss = A_VIEWS.filter((f) => !fs.existsSync(path.join(AVIEW, f)));
  vMiss.length ? bad(`研判中心页面缺失: ${vMiss.join(', ')}`)
               : ok(`研判中心页面齐备（${A_VIEWS.length} 个 .vue）`);
  const A_API = ['analysis/index.ts', 'analysis/types.ts'];
  const apiMiss = A_API.filter((f) => !fs.existsSync(path.join(PC_API_DIR, f)));
  apiMiss.length ? bad(`研判中心接口层缺失: ${apiMiss.join(', ')}`)
                 : ok('研判中心接口层齐备（analysis/index.ts + types.ts）');

  const srcOf = (mod) => (mod === 'analysis' ? aread('analysis/index.ts') : aread('ledger/index.ts'));
  const typesOf = (mod) => (mod === 'analysis' ? aread('analysis/types.ts') : aread('ledger/types.ts'));
  const exportsOf = (src) => new Set([...src.matchAll(/export\s+const\s+(\w+)/g)].map((x) => x[1]));
  const typeExportsOf = (src) => new Set([
    ...[...src.matchAll(/export\s+interface\s+(\w+)/g)].map((x) => x[1]),
    ...[...src.matchAll(/export\s+type\s+(\w+)/g)].map((x) => x[1]),
  ]);

  const brokenImports = [];
  const vHtml = [];
  let importChecked = 0;
  if (fs.existsSync(AVIEW)) {
    for (const f of fs.readdirSync(AVIEW)) {
      if (!f.endsWith('.vue')) continue;
      const src = read(path.join(AVIEW, f));
      /* 正文来自外部采集与模型，一律纯文本渲染；出现 v-html 属性即存储型 XSS 入口。
       * 判据用 `v-html=` 而不是裸词 `v-html` —— 模板注释里会写「绝不使用 v-html」，
       * 按裸词判会把这条注释误报成违规。 */
      if (/\sv-html\s*=/.test(src)) vHtml.push(f);
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/api\/yuqing\/(analysis|ledger)'/g)) {
        const pool = exportsOf(srcOf(m[2]));
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].trim();
          if (!name) continue;
          importChecked++;
          if (!pool.has(name)) brokenImports.push(`${f}: ${name}（api/yuqing/${m[2]}/index.ts 未导出）`);
        }
      }
      for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'@\/api\/yuqing\/(analysis|ledger)\/types'/g)) {
        const pool = typeExportsOf(typesOf(m[2]));
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim();
          if (!name) continue;
          importChecked++;
          if (!pool.has(name)) brokenImports.push(`${f}: ${name}（api/yuqing/${m[2]}/types.ts 未导出）`);
        }
      }
    }
  }
  brokenImports.length
    ? bad(`研判中心页面 import 了不存在的导出（vue-tsc TS2304）: ${brokenImports.join('; ')}`)
    : ok(`研判中心页面 import 与接口导出闭环一致（校验 ${importChecked} 个具名导入）`);
  vHtml.length
    ? bad(`研判中心页面出现 v-html（模型/外采文本会直接进 DOM，存储型 XSS 入口）: ${vHtml.join(', ')}`)
    : ok('研判中心页面全部纯文本渲染，无 v-html');

  const aTypes = aread('analysis/types.ts');
  const pageQueryLeak = /^\s*import[^\n]*PageQuery/m.test(aTypes)
    || /from\s+['"][^'"]*common\/mybatis\/core\/page['"]/.test(aTypes);
  pageQueryLeak ? bad('types.ts 引入了 PageQuery：它是全局接口，import 即 TS2305 + TS2339')
                : ok('types.ts 未引入 PageQuery（避免 TS2305/TS2339）');
  const axiosTypesOk = /from\s+'@\/utils\/api-types'/.test(aread('analysis/index.ts'))
    && /from\s+'@\/api\/types'/.test(aread('analysis/index.ts'));
  axiosTypesOk ? ok('api 层 AxiosPromise 取自 @/utils/api-types，PageResult 取自 @/api/types')
               : bad('api 层 import 来源不对：AxiosPromise 不能从 axios 拉，PageResult 不是全局的');

  /* 15.8 状态机常量与字典口径一致（LevelResolver.ANALYZED 曾是死常量 "done"） */
  const dictHasStatus = /'yq_analyze_status'/.test(dictSql);
  dictHasStatus ? ok('字典 yq_analyze_status 已登记（pending/processing/completed/failed）')
                : bad('字典缺 yq_analyze_status：状态列会显示裸编码');
  const level = jread('alert/LevelResolver.java');
  if (level) {
    const analyzed = (level.match(/ANALYZED\s*=\s*"([^"]+)"/) || [])[1];
    analyzed === 'completed'
      ? ok('LevelResolver.ANALYZED = "completed"，与字典口径一致（原来的 "done" 从未被写入，是死常量）')
      : bad(`LevelResolver.ANALYZED = "${analyzed}"，与字典 yq_analyze_status 不一致（"done" 是死常量）`);
  }
  const daoStatus = (daoDoris.match(/ST_COMPLETED\s*=\s*"([^"]+)"/) || [])[1];
  daoStatus === 'completed'
    ? ok('AnalysisOpinionDao.ST_COMPLETED = "completed"，与 LevelResolver / 字典三方对齐')
    : bad(`AnalysisOpinionDao.ST_COMPLETED = "${daoStatus}"，与字典口径不一致`);
}

/* ---------------- 汇总 ---------------- */
console.log('\n🔎 舆情监测平台 SQL 交付前校验\n' + '='.repeat(64));
console.log(R.join('\n'));
console.log('\n' + '='.repeat(64));
console.log(`结果: ${fails === 0 ? '✅ ALL PASS' : `❌ ${fails} 项失败`}   警告 ${warns} 项`);
process.exit(fails ? 1 : 0);
