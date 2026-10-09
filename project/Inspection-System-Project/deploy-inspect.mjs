#!/usr/bin/env node
/**
 * 机房巡检系统 —— 一键部署脚本
 *
 * 把 inspect-code/ 下生成的代码拷贝到三个真实工程：
 *   1. PC 后端  -> RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java/org/dromara/inspect/
 *   2. PC 前端  -> plus-ui-v6.0.0-Vue/src/api/inspect/ + src/views/inspect/
 *   3. 手机 H5  -> RuoYi-App-Plus/src/api/inspect/ + src/pages/inspect/ + src/utils/inspectDict.js
 *
 * 用法：
 *   node deploy-inspect.mjs --dry-run     # 只打印将要写入的文件，不落盘（推荐先跑）
 *   node deploy-inspect.mjs               # 实际拷贝（已存在且内容不同时覆盖）
 *   node deploy-inspect.mjs --no-h5       # 跳过 H5（H5 页面已直接写在 RuoYi-App-Plus 里）
 *   node deploy-inspect.mjs --pc-only     # 只部署 PC 前端（api + views），不动后端与 H5
 *   node deploy-inspect.mjs --be-only     # 只部署 PC 后端（java），不动前端与 H5
 *   node deploy-inspect.mjs --pc-only --dry-run
 *
 * 说明：
 *   - 只覆盖脚本自己生成的文件，不删除任何既有文件。
 *   - 覆盖前会把旧文件备份为 <name>.bak-<时间戳>，便于回滚。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, 'inspect-code');

const APPS = 'D:/APPPROJECTS';
const BACKEND_ROOT = path.join(APPS, 'RuoYi-Vue-Plus-v6.0.0');
const PC_ROOT = path.join(APPS, 'plus-ui-v6.0.0-Vue');
const H5_ROOT = path.join(APPS, 'RuoYi-App-Plus');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const SKIP_H5 = argv.includes('--no-h5');
const PC_ONLY = argv.includes('--pc-only');
const BE_ONLY = argv.includes('--be-only');
// 互斥保护：同时给两个只读范围开关时，按 --be-only 优先会让人困惑，直接报错更安全
if (PC_ONLY && BE_ONLY) {
  console.error('错误: --pc-only 与 --be-only 不能同时使用');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);

/** 递归列出目录下所有文件（相对路径） */
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return out;
}

/** 拷贝单个文件，返回动作类型 */
function copyFile(srcFile, destFile) {
  const exists = fs.existsSync(destFile);
  if (exists) {
    const a = fs.readFileSync(srcFile);
    const b = fs.readFileSync(destFile);
    if (a.equals(b)) return 'same';
    if (!DRY) {
      fs.copyFileSync(destFile, `${destFile}.bak-${stamp}`);
    }
    if (!DRY) fs.copyFileSync(srcFile, destFile);
    return 'overwrite';
  }
  if (!DRY) {
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
  }
  return 'create';
}

/** 按目录映射拷贝 */
function copyDir(srcDir, destDir, label) {
  const files = walk(srcDir);
  const stats = { create: 0, overwrite: 0, same: 0 };
  console.log(`\n[${label}]`);
  console.log(`  ${srcDir}`);
  console.log(`  -> ${destDir}`);
  if (!files.length) {
    console.log('  (源目录为空，跳过)');
    return stats;
  }
  for (const rel of files) {
    const action = copyFile(path.join(srcDir, rel), path.join(destDir, rel));
    stats[action]++;
    if (action !== 'same') console.log(`    ${action === 'create' ? '+' : '~'} ${rel}`);
  }
  console.log(`  合计: 新增 ${stats.create} / 覆盖 ${stats.overwrite} / 未变 ${stats.same}`);
  return stats;
}

console.log('==============================================');
console.log(' 机房巡检系统代码部署');
console.log(` 模式: ${DRY ? 'DRY-RUN（仅预览，不写盘）' : '实际写入'}`);
console.log('==============================================');

const total = { create: 0, overwrite: 0, same: 0 };

// ---------- 1. PC 后端 ----------
function merge(s) {
  total.create += s.create;
  total.overwrite += s.overwrite;
  total.same += s.same;
}

if (!PC_ONLY) {
  merge(copyDir(
    path.join(SRC, 'java'),
    path.join(BACKEND_ROOT, 'ruoyi-admin/src/main/java'),
    'PC 后端 (ruoyi-admin)',
  ));
} else {
  console.log('\n[PC 后端] 已按 --pc-only 跳过');
}

// ---------- 2. PC 前端 ----------
if (BE_ONLY) {
  console.log('\n[PC 前端] 已按 --be-only 跳过');
} else {
  merge(copyDir(
    path.join(SRC, 'pc/api'),
    path.join(PC_ROOT, 'src/api'),
    'PC 前端 API',
  ));
  merge(copyDir(
    path.join(SRC, 'pc/views'),
    path.join(PC_ROOT, 'src/views'),
    'PC 前端页面',
  ));
}

// ---------- 3. 手机 H5 ----------
if (PC_ONLY || BE_ONLY) {
  console.log('\n[H5] 已按只读范围开关跳过');
} else if (!SKIP_H5) {
  merge(copyDir(
    path.join(SRC, 'h5/api'),
    path.join(H5_ROOT, 'src/api'),
    'H5 API',
  ));
  merge(copyDir(
    path.join(SRC, 'h5/pages'),
    path.join(H5_ROOT, 'src/pages'),
    'H5 页面',
  ));
  merge(copyDir(
    path.join(SRC, 'h5/utils'),
    path.join(H5_ROOT, 'src/utils'),
    'H5 工具（字典映射）',
  ));
} else {
  console.log('\n[H5] 已按 --no-h5 跳过');
}

console.log('\n==============================================');
console.log(` 总计: 新增 ${total.create} / 覆盖 ${total.overwrite} / 未变 ${total.same}`);
console.log('==============================================');

console.log(`
后续手工步骤（脚本不代劳）：
  1) zxing 依赖：本仓库 RuoYi-Vue-Plus-v6.0.0 已在根 pom 的 dependencyManagement
     声明 com.google.zxing:core:\${zxing.version}（3.5.3），并在 ruoyi-admin/pom.xml
     中引入，本地仓库 /d/repository 也有该版本，无需再改。
  2) application.yml 增加巡检二维码配置（可参考 inspect-code/config/application-inspect.yml）：
       inspect:
         qrcode:
           secret: 请替换为你的密钥
           content-prefix: https://你的前端域名/#/pages/inspect/scan?p=
           size: 300
     注意 content-prefix 必须指向 H5 的扫码页，手机相机扫码后会自动带上 p 参数进入巡检流程。
  3) 执行 SQL（顺序不可颠倒）：
       inspect-code/sql/insp_schema.sql    -- 建表
       inspect-code/sql/insp_dict.sql      -- 字典
       inspect-code/sql/insp_menu.sql      -- 菜单按钮权限
  4) 给角色分配「机房巡检」菜单权限后重新登录。
  5) H5 端：src/uni.scss 需 @import 'uview-plus/theme.scss';（本项目已补上，
     否则 uview-plus 的 u-album.vue 会报 "[sass] Undefined mixin" 导致构建失败）。
`);
