#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const CSO_RULES = {
  description: {
    minLength: 20,
    maxLength: 200,
    mustContain: ['trigger', 'invoke', 'call', 'when', '触发', '调用', '当用户'],
    shouldAvoid: ['very', 'really', 'basically', 'stuff', 'things', 'etc']
  },
  triggers: {
    minCount: 3,
    maxCount: 8,
    avoidGeneric: ['help', 'do', 'make', 'create', 'fix', 'check', 'run']
  }
};

export async function analyzeSkillCSO(skillDir) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  const metaJson = path.join(skillDir, '_meta.json');

  if (!fs.existsSync(skillMd)) return { error: 'SKILL.md not found' };

  const content = fs.readFileSync(skillMd, 'utf-8');
  let meta = {};
  if (fs.existsSync(metaJson)) {
    try { meta = JSON.parse(fs.readFileSync(metaJson, 'utf-8')); } catch {}
  }

  const issues = [];
  const scores = { description: 0, triggers: 0, overall: 0 };
  const suggestions = [];

  const descMatch = content.match(/^description:\s*(.+)$/m);
  let description = '';
  if (descMatch) {
    const raw = descMatch[1].trim();
    if (raw === '|' || raw === '>') {
      const lines = content.split('\n');
      const descLineIdx = lines.findIndex(l => l.startsWith('description:'));
      if (descLineIdx >= 0) {
        const mlLines = [];
        for (let i = descLineIdx + 1; i < lines.length; i++) {
          if (lines[i].match(/^[a-zA-Z_-]+:/) || (!lines[i].startsWith(' ') && !lines[i].startsWith('\t') && lines[i].trim() !== '')) break;
          mlLines.push(lines[i].trim());
        }
        description = mlLines.join(' ');
      }
    } else {
      description = raw.replace(/^["']|["']$/g, '');
    }
  }
  if (!description) description = meta.description || '';

  if (!description) {
    issues.push({ level: 'error', rule: 'CSO-D001', message: '缺少description字段' });
  } else {
    if (description.length < CSO_RULES.description.minLength) {
      issues.push({ level: 'warn', rule: 'CSO-D002', message: `description过短(${description.length}字)，建议至少${CSO_RULES.description.minLength}字` });
      scores.description -= 20;
    } else {
      scores.description += 30;
    }

    if (description.length > CSO_RULES.description.maxLength) {
      issues.push({ level: 'warn', rule: 'CSO-D003', message: `description过长(${description.length}字)，建议不超过${CSO_RULES.description.maxLength}字` });
      scores.description -= 10;
    }

    const hasTriggerWords = CSO_RULES.description.mustContain.some(w =>
      description.toLowerCase().includes(w.toLowerCase())
    );
    if (!hasTriggerWords) {
      issues.push({ level: 'warn', rule: 'CSO-D004', message: 'description缺少触发词(when/invoke/call/trigger等)' });
      scores.description -= 15;
    } else {
      scores.description += 20;
    }

    const vagueWords = CSO_RULES.description.shouldAvoid.filter(w =>
      new RegExp(`\\b${w}\\b`, 'i').test(description)
    );
    if (vagueWords.length > 0) {
      issues.push({ level: 'info', rule: 'CSO-D005', message: `检测到模糊词汇: ${vagueWords.join(', ')}` });
      scores.description -= vagueWords.length * 5;
    }
  }

  const triggers = meta.triggers || [];
  const allTriggers = [...triggers];

  if (allTriggers.length === 0) {
    issues.push({ level: 'warn', rule: 'CSO-T001', message: '未定义触发词(triggers)' });
  } else {
    if (allTriggers.length < CSO_RULES.triggers.minCount) {
      issues.push({ level: 'warn', rule: 'CSO-T002', message: `触发词数量不足(${allTriggers.length})，建议至少${CSO_RULES.triggers.minCount}个` });
    } else {
      scores.triggers += 25;
    }

    if (allTriggers.length > CSO_RULES.triggers.maxCount) {
      issues.push({ level: 'info', rule: 'CSO-T003', message: `触发词过多(${allTriggers.length})，可能降低精确度` });
    }

    const genericTriggers = allTriggers.filter(t =>
      CSO_RULES.triggers.avoidGeneric.includes(t.toLowerCase())
    );
    if (genericTriggers.length > 0) {
      issues.push({ level: 'warn', rule: 'CSO-T004', message: `触发词过于通用: ${genericTriggers.join(', ')}` });
      scores.triggers -= genericTriggers.length * 8;
    }

    const specificTriggers = allTriggers.filter(t => t.length >= 4);
    if (specificTriggers.length > 0) {
      scores.triggers += Math.min(specificTriggers.length * 5, 25);
    }
  }

  scores.overall = Math.max(0, Math.min(100, (scores.description + scores.triggers) / 2));

  return {
    skillName: path.basename(skillDir),
    description: description.substring(0, 100),
    triggers: allTriggers,
    scores,
    score: scores.overall,
    grade: scores.overall >= 80 ? 'A' : scores.overall >= 60 ? 'B' : scores.overall >= 40 ? 'C' : 'D',
    issues,
    suggestions
  };
}

export async function analyzeAllSkills(category) {
  const categories = category ? [category] : ['core', 'entropy', 'expert', 'openspec', 'pr'];
  const results = [];

  for (const cat of categories) {
    const catPath = path.join(SKILLS_ROOT, cat);
    if (!fs.existsSync(catPath)) continue;

    const entries = fs.readdirSync(catPath).filter(f => {
      const p = path.join(catPath, f);
      return fs.statSync(p).isDirectory();
    });

    for (const entry of entries) {
      const result = await analyzeSkillCSO(path.join(catPath, entry));
      results.push(result);
    }
  }

  return results;
}

export function printCSOReport(results) {
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const gradeDist = { A: 0, B: 0, C: 0, D: 0 };
  results.forEach(r => gradeDist[r.grade]++);

  console.log('\n📊 CSO (Claude Search Optimization) 分析报告\n');
  console.log(`  总技能数: ${results.length}`);
  console.log(`  平均分: ${avgScore.toFixed(1)}/100`);
  console.log(`  等级分布: A:${gradeDist.A} B:${gradeDist.B} C:${gradeDist.C} D:${gradeDist.D}\n`);

  const sorted = [...results].sort((a, b) => a.score - b.score);

  console.log('  ┌────────────────────────┬───────┬────────┬──────────┐');
  console.log('  │ 技能名称               │ 等级  │ 分数   │ 问题数   │');
  console.log('  ├────────────────────────┼───────┼────────┼──────────┤');

  for (const r of sorted) {
    const icon = r.grade === 'A' ? '🟢' : r.grade === 'B' ? '🟡' : r.grade === 'C' ? '🟠' : '🔴';
    const name = r.skillName.padEnd(24).substring(0, 24);
    console.log(`  │ ${icon} ${name} │  ${r.grade}  │ ${r.score.toString().padStart(5)} │ ${r.issues.length.toString().padStart(6)} │`);
  }

  console.log('  └────────────────────────┴───────┴────────┴──────────┘');

  if (results.some(r => r.issues.length > 0)) {
    console.log('\n  主要问题:');
    const allIssues = results.flatMap(r => r.issues.map(i => ({ ...i, skill: r.skillName })));
    const byRule = {};
    for (const issue of allIssues) {
      byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
    }
    Object.entries(byRule)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([rule, count]) => {
        console.log(`    ${rule}: ${count}次`);
      });
  }
}
