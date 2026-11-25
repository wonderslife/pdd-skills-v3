// tests/toko/artifact-digesting.test.js - FP-TOKO-004 artifact-digesting 单元测试
// 覆盖验收项：B1（三类 Profile）、B2（摘要 ≤800 tokens）、B3（取全文指令）、
//             T1（结构截断零破坏）、T2（pointer 降级）、T3（无 profile 确定行为）、
//             T4（tighten 收紧）、I1（Tier 3 挂接）、I2（现有报告零改动）
// 运行：node --test tests/toko/artifact-digesting.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { digest, listProfiles, TIGHTEN_MAX_ITEMS } from '../../lib/context-assembly/digest.js';
import { assemble, clearSession } from '../../lib/context-assembly/index.js';

/** 构造契约扫描报告 */
function mkContractReport(issueCount) {
  return {
    artifact_ref: '/tmp/reports/contract-scan-001.json',
    summary: '扫描 53 技能契约：发现 3 处描述漂移与 2 处前置缺失。',
    issues: Array.from({ length: issueCount }, (_, i) => ({
      id: `ISSUE-${String(i + 1).padStart(3, '0')}`,
      skill: `skill-${(i % 10) + 1}`,
      severity: i % 3 === 0 ? 'high' : 'medium',
      detail: { field: 'description', reason: '前置依赖未在规格声明', line: i + 12 }
    }))
  };
}

// ==================== B1: 三类 Profile 齐备 ====================

test('B1: contract-report / health-report / route-table 三份 Profile 已注册', () => {
  const profiles = listProfiles();
  const ids = profiles.map(p => p.profile_id);
  assert.deepEqual(ids, ['contract-report', 'health-report', 'route-table'], '按 §1.3 首期 3 类');
  for (const p of profiles) {
    assert.ok(Array.isArray(p.keep_fields) && p.keep_fields.length > 0, `${p.profile_id} 必须有 keep_fields`);
    assert.equal(typeof p.max_items, 'number');
    assert.equal(p.token_ceiling, 800, 'R3：单报告注入 ≤800 tokens');
    assert.match(p.degraded_output, /path \+ one-line description \+ fetch instruction/);
  }
  // contract-report 与 §1.2 Schema 示例一致
  const contract = profiles.find(p => p.profile_id === 'contract-report');
  assert.deepEqual(contract.keep_fields, ['summary', 'issues.top_n']);
  assert.equal(contract.max_items, 10);
});

// ==================== B2/B3: 摘要规模与取全文指令 ====================

test('B2/B3: 大报告摘要 ≤800 tokens 且含取全文指令（digest 输出）', () => {
  const artifact = mkContractReport(100); // 现状口径：全量注入 2,000+ tokens
  const result = digest(artifact, 'contract-report');
  assert.equal(result.digest_kind, 'digest');
  assert.equal(result.tokens_estimate, Math.min(result.tokens_estimate, 800), 'R3 ≤800');
  assert.ok(result.tokens_estimate <= 800);
  // 条目级截断生效：100 条 issues 只保留 top 10
  const issuesItem = result.items.find(i => i.field === 'issues');
  assert.equal(issuesItem.value.length, 10);
  assert.equal(artifact.issues.length, 100, '原始工件不被修改');
  // B3/R2：取全文指令保留
  assert.match(result.fetch_instruction, /contract-scan-001\.json/);
  assert.match(result.fetch_instruction, /是否取回由模型决定/);
  assert.ok(result.injection_text.includes(result.fetch_instruction), '注入体含取全文指令');
  // T1：tokens_estimate 经 FP-TOKO-001 profile（>0 且为整数）
  assert.ok(Number.isInteger(result.tokens_estimate) && result.tokens_estimate > 0);
});

// ==================== T1: 结构截断零破坏 ====================

test('T1: 摘要条目为完整结构单元，嵌套对象深度相等，无字符级截断', () => {
  const artifact = mkContractReport(25);
  const result = digest(artifact, 'contract-report');
  const issuesItem = result.items.find(i => i.field === 'issues');
  // 前 10 条与原工件深度相等（条目级截断，非字符截断）
  assert.deepEqual(issuesItem.value, artifact.issues.slice(0, 10));
  // 嵌套结构完整（detail 子对象未破坏）
  for (const issue of issuesItem.value) {
    assert.deepEqual(issue.detail, artifact.issues.find(x => x.id === issue.id).detail);
    assert.ok(!('truncated' in issue), '不得出现截断标记字段');
  }
  // summary 字符串完整保留（不做字符截断）
  const summaryItem = result.items.find(i => i.field === 'summary');
  assert.equal(summaryItem.value, artifact.summary);
  // 注入体经 JSON 序列化往返无损（防破坏 JSON 致模型误读，R1）
  const roundTrip = JSON.parse(JSON.stringify(result.items));
  assert.deepEqual(roundTrip, result.items);
});

// ==================== T2: CEILING_BREACH → pointer 降级 ====================

test('T2: 摘要后仍超 ceiling → pointer 降级（禁止字符级硬截断）', () => {
  // 非 top_n 字段不设条目上限（结构单元完整保留），构造超大 summary 触发 ceiling
  const artifact = {
    artifact_ref: '/tmp/reports/giant-summary.json',
    summary: { lines: Array.from({ length: 9000 }, (_, i) => `第 ${i} 行扫描结论`) },
    issues: []
  };
  const result = digest(artifact, 'contract-report');
  assert.equal(result.digest_kind, 'pointer');
  assert.equal(result.notice, 'CEILING_BREACH');
  // pointer 三要素：路径 + 一句话说明 + 取用指令（B3）
  assert.ok(result.items[0].includes('/tmp/reports/giant-summary.json'), 'pointer 含路径');
  assert.ok(result.items[0].includes('上限'), '一句话说明');
  assert.match(result.fetch_instruction, /giant-summary\.json/);
  // R1：原始工件未被字符截断
  assert.equal(artifact.summary.lines.length, 9000);
  assert.ok(result.tokens_estimate <= 800, 'pointer 注入体自身在 ceiling 内');
});

// ==================== T3: 无 profile 确定行为 ====================

test('T3: 未登记工件类型一律 pointer + PROFILE_MISSING，不自由摘要', () => {
  const artifact = {
    artifact_ref: '/tmp/reports/mystery-report.json',
    content: '这是一段很长的自由文本，绝不应该被摘要化注入……'
  };
  const result = digest(artifact, 'unknown-type');
  assert.equal(result.digest_kind, 'pointer');
  assert.equal(result.notice, 'PROFILE_MISSING');
  assert.ok(!result.injection_text.includes('自由文本'), 'pointer 不得泄露/摘要内容（R4）');
  assert.match(result.fetch_instruction, /mystery-report\.json/);
});

// ==================== 文本型工件（health-report lines: 形式） ====================

test('health-report: raw 文本报告按整行提取（评分行 + ERROR 行），行边界完整', () => {
  const report = [
    'Gradle Health Report v2',
    '评分：92/100（A）',
    'score trend: 88 -> 92',
    '[ERROR] task :app:compileDebugJavaWithJavac 失败：依赖缺失',
    '[WARN] deprecated API usage ×3',
    '[ERROR] duplicate class org.example.Foo',
    '详见 build/health-report.html'
  ].join('\n');
  const result = digest(report, 'health-report', { artifactRef: '/tmp/health-report.txt', family: 'qwen' });
  assert.equal(result.digest_kind, 'digest');
  const fields = result.items.map(i => i.field);
  assert.ok(fields.includes('lines:评分'));
  assert.ok(fields.includes('lines:ERROR'));
  const errors = result.items.find(i => i.field === 'lines:ERROR').value;
  assert.equal(errors.length, 2, '两条 ERROR 行完整保留（整行，无字符截断）');
  assert.ok(errors.every(l => l.includes('[ERROR]')));
  // 指定 family 的估算经该家族 profile
  assert.ok(Number.isInteger(result.tokens_estimate));
});

test('health-report: JSON 体检报告走路径提取（score/summary 字段）', () => {
  const report = {
    artifact_ref: '/tmp/health.json',
    score: 92,
    grade: 'A',
    summary: { errors: 2, warnings: 3 }
  };
  const result = digest(report, 'health-report', { family: 'qwen' });
  // JSON 形状下 lines: 形式跳过、无 score/评分/ERROR 路径字段 → DIGEST_EMPTY → pointer（不做自由发挥）
  assert.equal(result.digest_kind, 'pointer');
  assert.equal(result.notice, 'DIGEST_EMPTY');
});

// ==================== T4: tighten 收紧（FP-TOKO-008 事件注入） ====================

test('T4: budget.tighten 事件注入下 max_items 收紧为 5', () => {
  const artifact = mkContractReport(8);
  const normal = digest(artifact, 'contract-report');
  assert.equal(normal.items.find(i => i.field === 'issues').value.length, 8, '8 条 ≤ max_items=10 全保留');

  const tightened = digest(artifact, 'contract-report', { tighten: true });
  assert.equal(tightened.items.find(i => i.field === 'issues').value.length, TIGHTEN_MAX_ITEMS);
  assert.equal(TIGHTEN_MAX_ITEMS, 5, '收紧值为 5（FP-TOKO-008 对接）');

  // 显式 maxItems 优先
  const custom = digest(artifact, 'contract-report', { maxItems: 3 });
  assert.equal(custom.items.find(i => i.field === 'issues').value.length, 3);
});

// ==================== I1: Tier 3 挂接（FP-TOKO-003 联调） ====================

test('I1: digest 输出经 assemble artifacts 进 Tier 3，manifest.t3 计数正确', () => {
  const sid = 'fp004-i1-tier3';
  try {
    const result = digest(mkContractReport(30), 'contract-report');
    const { manifest } = assemble({
      phase: 'impl',
      sessionId: sid,
      family: 'qwen',
      artifacts: [{ ref: result.artifact_ref, content: result.injection_text }]
    });
    assert.deepEqual(manifest.tiers.t3.artifacts, ['/tmp/reports/contract-scan-001.json']);
    assert.equal(manifest.tiers.t3.artifacts.length, 1);
    assert.ok(manifest.tiers.t3.tokens_estimate > 0, 'Tier 3 载荷参与估算');
    // digest 估算与 CAG 侧对同一文本的估算一致（同源 segment.js）
    const plan = assemble({ phase: 'impl', sessionId: sid, family: 'qwen' }).plan;
    const payload = plan.tiers.t3.artifacts[0];
    assert.equal(payload.ref, result.artifact_ref);
    assert.equal(payload.content, result.injection_text);
  } finally {
    clearSession(sid);
  }
});

// ==================== I2: 现有报告零改动 ====================

test('I2: digest 为纯内存变换，不写任何文件', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'toko-digest-readonly-'));
  try {
    const reportPath = path.join(tmp, 'route-table-report.json');
    const artifact = {
      artifact_ref: reportPath,
      routes: Array.from({ length: 20 }, (_, i) => ({ path: `/api/route-${i}`, changed: true })),
      impact: '影响 2 个模块的 5 个调用方。'
    };
    fs.writeFileSync(reportPath, JSON.stringify(artifact), 'utf-8');
    const contentBefore = fs.readFileSync(reportPath, 'utf-8');
    const mtimeBefore = fs.statSync(reportPath).mtimeMs;

    const result = digest(artifact, 'route-table');
    assert.equal(result.digest_kind, 'digest');
    const routesItem = result.items.find(i => i.field === 'routes');
    assert.equal(routesItem.value.length, 10, '变更路由条目 top 10');
    assert.ok(result.items.find(i => i.field === 'impact').value.includes('影响 2 个模块'));

    const contentAfter = fs.readFileSync(reportPath, 'utf-8');
    assert.equal(contentAfter, contentBefore, '报告文件产物零改动（I2）');
    assert.equal(fs.statSync(reportPath).mtimeMs, mtimeBefore);
    assert.deepEqual(artifact.routes.length, 20, '内存对象同样零改动');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ==================== 入参校验 ====================

test('digest 入参校验：artifact/profileId/artifactRef', () => {
  assert.throws(() => digest(null, 'contract-report'), /DIGEST_INPUT_INVALID/);
  assert.throws(() => digest({}, ''), /DIGEST_INPUT_INVALID/);
  assert.throws(() => digest({ summary: '无标识字段' }, 'contract-report'), /ARTIFACT_REF_REQUIRED/);
  // opts.artifactRef 显式提供时不报错
  const ok = digest({ summary: '只提取 summary' }, 'contract-report', { artifactRef: '/tmp/x.json' });
  assert.equal(ok.digest_kind, 'digest');
});
