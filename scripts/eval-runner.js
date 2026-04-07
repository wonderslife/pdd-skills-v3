import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const EVAL_RESULT = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIP: 'skip',
  ERROR: 'error'
};

export async function runEvals(options = {}) {
  const skillName = options.skill;
  const category = options.category;
  const verbose = options.verbose || false;

  console.log(chalk.blue.bold('\n🧪 PDD Evals - 技能评估测试\n'));

  const targets = findEvalTargets(skillName, category);

  if (targets.length === 0) {
    console.log(chalk.yellow('  未找到可测试的目标'));
    return;
  }

  const results = [];

  for (const target of targets) {
    const result = await runSkillEvals(target, verbose);
    results.push(result);
    printSkillResult(result, verbose);
  }

  printSummary(results);
  return results;
}

function findEvalTargets(skillName, category) {
  if (skillName) {
    for (const cat of ['core', 'entropy', 'expert', 'openspec', 'pr']) {
      const p = path.join(SKILLS_ROOT, cat, skillName);
      if (fs.existsSync(p)) return [{ name: skillName, path: p }];
    }
    return [];
  }

  if (category) {
    const catPath = path.join(SKILLS_ROOT, category);
    if (!fs.existsSync(catPath)) return [];
    return fs.readdirSync(catPath)
      .filter(f => fs.statSync(path.join(catPath, f)).isDirectory())
      .map(f => ({ name: f, path: path.join(catPath, f) }));
  }

  const all = [];
  for (const cat of ['core', 'entropy', 'expert']) {
    const catPath = path.join(SKILLS_ROOT, cat);
    if (!fs.existsSync(catPath)) continue;
    for (const entry of fs.readdirSync(catPath).filter(f =>
      fs.statSync(path.join(catPath, f)).isDirectory()
    )) {
      all.push({ name: entry, path: path.join(catPath, entry) });
    }
  }
  return all;
}

async function runSkillEvals(target, verbose) {
  const start = Date.now();
  const evalDir = path.join(target.path, 'evals');
  const testCases = loadTestCases(evalDir);

  const skillResult = {
    skill: target.name,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
    cases: []
  };

  if (testCases.length === 0) {
    skillResult.totalTests = 1;
    skillResult.skipped = 1;
    skillResult.cases.push({
      name: 'evals-not-found',
      status: EVAL_RESULT.SKIP,
      message: '该技能暂无evals定义',
      duration: 0
    });
    skillResult.duration = Date.now() - start;
    return skillResult;
  }

  for (const tc of testCases) {
    const caseStart = Date.now();
    try {
      const result = await executeTestCase(tc, target.path);
      const caseDuration = Date.now() - caseStart;

      skillResult.totalTests++;
      skillResult.cases.push({
        name: tc.name,
        status: result.pass ? EVAL_RESULT.PASS : EVAL_RESULT.FAIL,
        message: result.message,
        details: result.details,
        duration: caseDuration
      });

      if (result.pass) skillResult.passed++;
      else skillResult.failed++;

    } catch (e) {
      skillResult.totalTests++;
      skillResult.errors++;
      skillResult.cases.push({
        name: tc.name,
        status: EVAL_RESULT.ERROR,
        message: e.message,
        duration: Date.now() - caseStart
      });
    }
  }

  skillResult.duration = Date.now() - start;
  return skillResult;
}

function loadTestCases(evalDir) {
  if (!fs.existsSync(evalDir)) return [];

  const cases = [];
  const files = fs.readdirSync(evalDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(evalDir, file), 'utf-8'));
      if (Array.isArray(content)) {
        cases.push(...content.map(c => ({ ...c, _source: file })));
      } else if (content.name && content.expect) {
        cases.push({ ...content, _source: file });
      }
    } catch {}
  }

  return cases.length > 0 ? cases : getDefaultTestCases();
}

function getDefaultTestCases() {
  return [
    {
      name: 'SKILL.md-exists',
      description: '技能文件存在且格式正确',
      type: 'structure',
      expect: { exists: true, hasDescription: true, hasIronLaw: false },
      check: (skillPath) => {
        const mdPath = path.join(skillPath, 'SKILL.md');
        if (!fs.existsSync(mdPath)) return { pass: false, message: 'SKILL.md不存在' };
        const content = fs.readFileSync(mdPath, 'utf-8');
        const hasDesc = /^description:/m.test(content);
        const hasIronLaw = /##\s*Iron\s*Law/mi.test(content);
        return {
          pass: hasDesc,
          message: hasDesc ? 'description字段存在' : '缺少description字段',
          details: { hasDescription: hasDesc, hasIronLaw: hasIronLaw }
        };
      }
    },
    {
      name: '_meta.json-valid',
      description: '元数据文件格式正确',
      type: 'structure',
      expect: { exists: true, hasTriggers: true },
      check: (skillPath) => {
        const metaPath = path.join(skillPath, '_meta.json');
        if (!fs.existsSync(metaPath)) return { pass: false, message: '_meta.json不存在' };
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          const valid = meta.name && meta.version;
          const hasTriggers = Array.isArray(meta.triggers) && meta.triggers.length > 0;
          return {
            pass: valid,
            message: valid ? '元数据格式正确' : '元数据缺少必要字段',
            details: { name: !!meta.name, version: !!meta.version, triggersCount: meta.triggers?.length || 0 }
          };
        } catch (e) {
          return { pass: false, message: `JSON解析失败: ${e.message}` };
        }
      }
    },
    {
      name: 'triggers-effective',
      description: '触发词有效且不冲突',
      type: 'cso',
      expect: { minTriggers: 3, maxGeneric: 1 },
      check: (skillPath) => {
        const metaPath = path.join(skillPath, '_meta.json');
        if (!fs.existsSync(metaPath)) return { pass: false, skip: true, message: '无_meta.json' };
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        const triggers = meta.triggers || [];
        const generic = ['help', 'do', 'make', 'create'].filter(t =>
          triggers.includes(t)
        );
        return {
          pass: triggers.length >= 3 && generic.length === 0,
          message: `${triggers.length}个触发词${generic.length > 0 ? `, ${generic.length}个过于通用` : ''}`,
          details: { triggerCount: triggers.length, genericTriggers: generic }
        };
      }
    },
    {
      name: 'behavior-shaping-complete',
      description: '行为塑造章节完整(Iron Law + Rationalization + Red Flags)',
      type: 'quality',
      expect: { ironLaw: true, rationalization: true, redFlags: true },
      check: (skillPath) => {
        const mdPath = path.join(skillPath, 'SKILL.md');
        if (!fs.existsSync(mdPath)) return { pass: false, message: 'SKILL.md不存在' };
        const content = fs.readFileSync(mdPath, 'utf-8');
        const hasIronLaw = /##\s*Iron\s*Law/mi.test(content);
        const hasRationalization = /##\s*Rationalization/mi.test(content);
        const hasRedFlags = /##\s*Red\s*Flags/mi.test(content);
        const allPresent = hasIronLaw && hasRationalization && hasRedFlags;
        return {
          pass: allPresent,
          message: allPresent ? '行为塑造完整' : `缺少: ${[
            !hasIronLaw ? 'Iron Law' : null,
            !hasRationalization ? 'Rationalization Table' : null,
            !hasRedFlags ? 'Red Flags' : null
          ].filter(Boolean).join(', ')}`,
          details: { ironLaw: hasIronLaw, rationalization: hasRationalization, redFlags: hasRedFlags }
        };
      }
    }
  ];
}

async function executeTestCase(tc, skillPath) {
  if (typeof tc.check === 'function') {
    return tc.check(skillPath);
  }

  if (tc.type === 'structure') {
    return runStructureCheck(tc, skillPath);
  }

  if (tc.type === 'content') {
    return runContentCheck(tc, skillPath);
  }

  return { pass: true, message: `未实现的测试类型: ${tc.type}` };
}

function runStructureCheck(tc, skillPath) {
  const checks = tc.checks || {};
  const results = {};
  let allPass = true;

  for (const [key, expected] of Object.entries(checks)) {
    switch (key) {
      case 'file_exists': {
        const p = path.join(skillPath, expected);
        results[key] = fs.existsSync(p);
        break;
      }
      case 'dir_exists': {
        const d = path.join(skillPath, expected);
        results[key] = fs.existsSync(d) && fs.statSync(d).isDirectory();
        break;
      }
      default:
        results[key] = null;
    }
    if (results[key] === false) allPass = false;
  }

  return {
    pass: allPass,
    message: allPass ? '结构检查通过' : Object.entries(results).filter(([, v]) => v === false).map(([k]) => `${k}失败`).join(', '),
    details: results
  };
}

function runContentCheck(tc, skillPath) {
  const filePath = tc.file ? path.join(skillPath, tc.file) : path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(filePath)) {
    return { pass: false, message: `文件不存在: ${tc.file || 'SKILL.md'}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  let matchCount = 0;
  let totalPatterns = 0;

  if (tc.contains) {
    const patterns = Array.isArray(tc.contains) ? tc.contains : [tc.contains];
    totalPatterns = patterns.length;
    for (const pattern of patterns) {
      if (new RegExp(pattern, tc.flags || 'i').test(content)) matchCount++;
    }
  }

  if (tc.notContains) {
    const npatterns = Array.isArray(tc.notContains) ? tc.notContains : [tc.notContains];
    for (const pattern of npatterns) {
      if (new RegExp(pattern, tc.flags || 'i').test(content)) {
        return { pass: false, message: `不应包含: ${pattern}` };
      }
    }
  }

  const requiredMatches = tc.minMatches || 1;
  return {
    pass: matchCount >= requiredMatches,
    message: matchCount >= requiredMatches
      ? `内容匹配通过 (${matchCount}/${totalPatterns || '?'})`
      : `匹配不足 (${matchCount}/${requiredMatches})`,
    details: { matchCount, requiredMatches }
  };
}

function printSkillResult(result, verbose) {
  const icon = result.failed === 0 && result.errors === 0
    ? chalk.green('✅')
    : result.errors > 0
      ? chalk.red('💥')
      : chalk.yellow('⚠️');

  console.log(`  ${icon} ${result.skill} (${result.passed}/${result.totalTests}) [${result.duration}ms]`);

  if (verbose) {
    for (const c of result.cases) {
      const ci = c.status === EVAL_RESULT.PASS ? chalk.green('✓')
        : c.status === EVAL_RESULT.FAIL ? chalk.red('✗')
          : c.status === EVAL_RESULT.ERROR ? chalk.red('💥') : chalk.gray('·');
      console.log(`    ${ci} ${c.name}${c.message ? ` — ${c.message}` : ''}`);
    }
  }
}

function printSummary(results) {
  const total = results.reduce((s, r) => s + r.totalTests, 0);
  const passed = results.reduce((s, r) => s + r.passed, 0);
  const failed = results.reduce((s, r) => s + r.failed, 0);
  const errors = results.reduce((s, r) => s + r.errors, 0);
  const skipped = results.reduce((s, r) => s + r.skipped, 0);
  const duration = results.reduce((s, r) => s + r.duration, 0);

  console.log(chalk.bold('\n━━━ Eval Summary ━━━'));
  console.log(`  总测试: ${total} | 通过: ${chalk.green(passed.toString())} | 失败: ${chalk.red(failed.toString())} | 错误: ${chalk.red(errors.toString())} | 跳过: ${skipped}`);
  console.log(`  总耗时: ${duration}ms`);
  console.log(`  通过率: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);
}
