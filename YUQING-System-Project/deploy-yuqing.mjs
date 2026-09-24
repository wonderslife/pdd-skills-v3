#!/usr/bin/env node
/**
 * 舆情监测平台（YUQING）三端代码部署脚本
 *
 * 把 yq-code/ 的生成产物落到三个真实工程：
 *   --be  RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java/org/dromara/yuqing/
 *         RuoYi-Vue-Plus-v6.0.0/script/sql/yuqing/            （建表/字典/菜单脚本）
 *   --pc  plus-ui-v6.0.0-Vue/src/{api,views}/yuqing/
 *   --h5  RuoYi-App-Plus/src/api/yuqing/
 *
 * 用法:
 *   node deploy-yuqing.mjs --dry-run          # 先预览（+新增 / ~覆盖 / 未变）
 *   node deploy-yuqing.mjs                    # 全量部署
 *   node deploy-yuqing.mjs --be-only          # 只部署后端
 *   node deploy-yuqing.mjs --pc-only
 *   node deploy-yuqing.mjs --no-h5
 *   node deploy-yuqing.mjs --clean-bak        # 覆盖不留备份，并清掉历史 *.bak-<时间戳>
 *
 * 安全约定（与 ruoyi-v6-fullstack-codegen 技能一致）：
 *   - 只写入/覆盖「生成器自己的产物」，绝不删除既有文件
 *   - 覆盖前备份为 <file>.bak-<时间戳>（--clean-bak 时改为不备份）
 *   - 内容相同则跳过（幂等，重跑安全）
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'yq-code');

const TARGETS = {
  be_java: {
    label: '后端 Java',
    from: path.join(SRC, 'java', 'org', 'dromara', 'yuqing'),
    to: 'D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/main/java/org/dromara/yuqing',
  },
  be_sql: {
    label: '后端 SQL / 配置',
    from: path.join(SRC, 'sql'),
    to: 'D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/script/sql/yuqing',
  },
  be_test: {
    label: '后端测试',
    from: path.join(SRC, 'test', 'java', 'org', 'dromara', 'yuqing'),
    to: 'D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/ruoyi-admin/src/test/java/org/dromara/yuqing',
  },
  be_cfg: {
    label: '数据源配置片段',
    from: path.join(SRC, 'config'),
    to: 'D:/APPPROJECTS/RuoYi-Vue-Plus-v6.0.0/script/sql/yuqing/config',
  },
  pc_api: {
    label: 'PC api',
    from: path.join(SRC, 'pc', 'api', 'yuqing'),
    to: 'D:/APPPROJECTS/plus-ui-v6.0.0-Vue/src/api/yuqing',
  },
  pc_views: {
    label: 'PC views',
    from: path.join(SRC, 'pc', 'views', 'yuqing'),
    to: 'D:/APPPROJECTS/plus-ui-v6.0.0-Vue/src/views/yuqing',
  },
  h5_api: {
    label: 'H5 api',
    from: path.join(SRC, 'h5', 'api', 'yuqing'),
    to: 'D:/APPPROJECTS/RuoYi-App-Plus/src/api/yuqing',
  },
  h5_pages: {
    label: 'H5 pages',
    from: path.join(SRC, 'h5', 'pages', 'yuqing'),
    to: 'D:/APPPROJECTS/RuoYi-App-Plus/src/pages/yuqing',
  },
  h5_utils: {
    label: 'H5 utils',
    from: path.join(SRC, 'h5', 'utils'),
    to: 'D:/APPPROJECTS/RuoYi-App-Plus/src/utils',
  },
};

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const ONLY = ['--be-only', '--pc-only', '--h5-only'].filter(a => args.has(a));
if (ONLY.length > 1) {
  console.error(`✗ 范围开关互斥，最多给一个: ${ONLY.join(', ')}`);
  process.exit(1);
}
const NO_H5 = args.has('--no-h5');
/** 覆盖不留备份，并在收尾清掉历史备份 —— 交付前跑一次即可清干净 */
const CLEAN_BAK = args.has('--clean-bak');

function pickTargets() {
  const keys = Object.keys(TARGETS);
  if (ONLY[0] === '--be-only') return keys.filter(k => k.startsWith('be_'));
  if (ONLY[0] === '--pc-only') return keys.filter(k => k.startsWith('pc_'));
  if (ONLY[0] === '--h5-only') return keys.filter(k => k.startsWith('h5_'));
  return NO_H5 ? keys.filter(k => !k.startsWith('h5_')) : keys;
}

function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.includes('.bak-')) continue; // 不搬运历史备份
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
let added = 0, over = 0, same = 0, bytes = 0;
const log = [];

for (const key of pickTargets()) {
  const t = TARGETS[key];
  if (!fs.existsSync(t.from)) { log.push(`  ! ${t.label}: 源目录不存在，跳过 (${t.from})`); continue; }
  const files = walk(t.from);
  let a = 0, o = 0, s = 0;
  for (const rel of files) {
    const src = path.join(t.from, rel);
    const dst = path.join(t.to, rel);
    const buf = fs.readFileSync(src);
    let action;
    if (!fs.existsSync(dst)) { action = '+'; a++; }
    else if (Buffer.compare(fs.readFileSync(dst), buf) === 0) { action = '='; s++; }
    else { action = '~'; o++; }
    if (action !== '=') {
      if (!DRY) {
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        if (action === '~' && !CLEAN_BAK) fs.copyFileSync(dst, `${dst}.bak-${stamp}`);
        fs.writeFileSync(dst, buf);
      }
      bytes += buf.length;
    }
  }
  added += a; over += o; same += s;
  log.push(`  ✓ ${t.label.padEnd(16)} ${files.length} 文件  ->  ${t.to.replace('D:/APPPROJECTS/', '')}   (+${a} ~${o} =${s})`);
}

/* 收尾清理：--clean-bak 时扫掉历史 *.bak-<时间戳>（只删备份，不碰正式产物） */
let cleaned = 0;
if (CLEAN_BAK && !DRY) {
  const bakRe = /\.bak-\d{14}$/;
  for (const key of pickTargets()) {
    const to = TARGETS[key].to;
    if (!fs.existsSync(to)) continue;
    const stack = [to];
    while (stack.length) {
      const dir = stack.pop();
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (bakRe.test(e.name)) { fs.rmSync(full); cleaned++; }
      }
    }
  }
}

console.log(`\n🚚 舆情监测平台代码部署${DRY ? '（dry-run，不落盘）' : ''}`);
console.log(`   时间戳: ${stamp}\n`);
console.log(log.join('\n'));
console.log(`\n   合计: +${added} 新增 / ~${over} 覆盖 / =${same} 未变`);
if (CLEAN_BAK) console.log(`   备份策略: 不留新备份，已清理历史备份 ${cleaned} 个`);
else if (!DRY && over) console.log(`   覆盖文件已备份为 <file>.bak-${stamp}（交付后请清理，或改用 --clean-bak）`);
console.log('');
