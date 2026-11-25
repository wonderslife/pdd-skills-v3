#!/usr/bin/env node
// scripts/prefix-stability-audit.js - 前缀稳定化审计脚本（FP-TOKO-005 §1.1 stability-audit 报告 / B2）
//
// 职责（FP-TOKO-005 §3.1 处理流程）：
//   对任意装配计划运行 auditOrder（§1.2 顺序校验 + R1 Tier 0/1 易变内容扫描），
//   产出 stability-audit 报告（docs/reviews/ 惯例可落盘，默认 stdout）。
//
// 用法：
//   node scripts/prefix-stability-audit.js --plan <file.json> [--report <file>]
//     审计计划文件：形态 A（CAG 装配计划 {tiers,...}，即 assemble() 返回的 plan）或
//                   形态 B（宿主自定义序列 {blocks:[{key,content}]}）
//   node scripts/prefix-stability-audit.js --live [--phase impl] [--session <id>] [--report <file>]
//     实时装配（默认技能树，openai 家族基线）并审计产出的计划
//
// 退出码：审计通过 0；存在违规（CRITICAL/HIGH）时非 0（报告已先输出，便于 CI 直接消费）。

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { auditOrder, getAssemblyOrder, CANONICAL_ORDER } from '../lib/context-assembly/prefix-stability.js';
import { assemble } from '../lib/context-assembly/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { phase: 'impl' };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--plan': args.plan = argv[++i]; break;
      case '--live': args.live = true; break;
      case '--phase': args.phase = argv[++i]; break;
      case '--session': args.session = argv[++i]; break;
      case '--report': args.report = argv[++i]; break;
      default:
        throw new Error(`未知参数: ${argv[i]}`);
    }
  }
  return args;
}

/**
 * 审计入口（导出供测试复用）
 * @param {string[]} argv
 * @returns {Object} stability-audit 报告
 */
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  let plan;
  let planSource;
  if (args.plan) {
    const file = path.resolve(args.plan);
    if (!fs.existsSync(file)) {
      throw new Error(`PLAN_NOT_FOUND: 计划文件不存在 ${file}`);
    }
    plan = JSON.parse(fs.readFileSync(file, 'utf-8'));
    planSource = file;
  } else if (args.live) {
    const sessionId = args.session || `stability-audit-${Date.now()}`;
    const { plan: assembled } = assemble({ phase: args.phase, sessionId, family: 'openai' });
    plan = assembled;
    planSource = `live-assemble(session=${sessionId})`;
  } else {
    throw new Error('USAGE_MISSING: 需要 --plan <file> 或 --live 之一');
  }

  const audit = auditOrder(plan);
  const report = {
    tool: 'prefix-stability-audit',
    generated_at: new Date().toISOString(),
    plan_source: planSource,
    canonical_order: getAssemblyOrder(args.phase).map(b => `${b.position}:${b.key}（${b.stability}）`),
    passed: audit.passed,
    violations: audit.violations,
    block_hashes: audit.block_hashes,
    verdict: audit.passed ? 'pass' : `reject（${audit.violations.map(v => `${v.severity}/${v.code}`).join(', ')}）`
  };

  const json = JSON.stringify(report, null, 2);
  if (args.report) {
    const out = path.resolve(args.report);
    fs.ensureDirSync(path.dirname(out));
    fs.writeFileSync(out, json + '\n', 'utf-8');
    console.log(`stability-audit 报告已写入: ${out}`);
  } else {
    console.log(json);
  }

  if (!audit.passed) {
    throw new Error(
      `AUDIT_FAILED: ${audit.violations.length} 项违规（${audit.violations.map(v => `${v.severity}/${v.code}`).join(', ')}）；` +
      `规范顺序: ${CANONICAL_ORDER.map(b => b.key).join(' → ')}`
    );
  }
  return report;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch(err => {
    console.error(`prefix-stability-audit: ${err.message}`);
    process.exit(1);
  });
}

export default { main };
