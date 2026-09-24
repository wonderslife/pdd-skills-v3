#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const I18N_RULES = {
  meta: {
    hasZhDescription: { desc: '_meta.json description contains zh field', check: (m) => m.description && (m.description.includes('zh:') || /[\u4e00-\u9fa5]/.test(m.description)) },
    hasEnDescription: { desc: '_meta.json description contains en content', check: (m) => m.description && /[a-zA-Z]{10,}/.test(m.description) },
    minZhTriggers: { desc: 'At least 3 Chinese triggers', minCount: 3, pattern: /[\u4e00-\u9fa5]/ },
    minEnTriggers: { desc: 'At least 3 English triggers', minCount: 3, pattern: /^[a-zA-Z\s-]{3,}$/ }
  },
  skillMd: {
    hasCnSection: { desc: 'SKILL.md contains ## 🇨🇳 section', pattern: /##\s*🇨🇳/ },
    hasEnSection: { desc: 'SKILL.md contains ## 🇺🇸 section', pattern: /##\s*🇺🇸/ },
    hasBilingualIronLaw: { desc: 'Iron Law has bilingual content', pattern: /Iron Law.*铁律|铁律.*Iron Law|🇺🇸/s },
    hasBilingualRedFlags: { desc: 'Red Flags have bilingual content', pattern: /Red Flags.*[红旗警告三层防御]|🇺🇸.*Red Flag|Layer \d:.*Guards/s }
  }
};

export async function analyzeI18N(skillDir) {
  const name = path.basename(skillDir);
  const metaPath = path.join(skillDir, '_meta.json');
  const skillPath = path.join(skillDir, 'SKILL.md');
  
  const result = { name, score: 0, maxScore: 100, issues: [], checks: {} };
  
  if (!fs.existsSync(metaPath)) { result.issues.push({ rule: 'META-001', msg: '_meta.json missing' }); return result; }
  if (!fs.existsSync(skillPath)) { result.issues.push({ rule: 'SKILL-001', msg: 'SKILL.md missing' }); return result; }
  
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const content = fs.readFileSync(skillPath, 'utf-8');
  
  // Meta checks (50 points)
  let metaScore = 0;
  if (I18N_RULES.meta.hasZhDescription.check(meta)) { metaScore += 15; result.checks.zhDesc = true; } else { result.issues.push({ rule: 'META-ZH', msg: 'No Chinese in description' }); }
  if (I18N_RULES.meta.hasEnDescription.check(meta)) { metaScore += 15; result.checks.enDesc = true; } else { result.issues.push({ rule: 'META-EN', msg: 'No English in description' }); }
  
  const zhTriggers = (meta.triggers || []).filter(t => I18N_RULES.meta.minZhTriggers.pattern.test(t)).length;
  const enTriggers = (meta.triggers || []).filter(t => I18N_RULES.meta.minEnTriggers.pattern.test(t)).length;
  if (zhTriggers >= 3) { metaScore += 10; result.checks.zhTriggers = zhTriggers; } else { result.issues.push({ rule: 'META-TZ', msg: `Only ${zhTriggers} Chinese triggers (need >=3)` }); }
  if (enTriggers >= 3) { metaScore += 10; result.checks.enTriggers = enTriggers; } else { result.issues.push({ rule: 'META-TE', msg: `Only ${enTriggers} English triggers (need >=3)` }); }
  result.metaScore = metaScore;
  result.score += metaScore;
  
  // SKILL.md checks (50 points)
  let mdScore = 0;
  if (I18N_RULES.skillMd.hasCnSection.pattern.test(content)) { mdScore += 15; result.checks.cnSection = true; } else { result.issues.push({ rule: 'MD-CN', msg: 'Missing ## 🇨🇳 section' }); }
  if (I18N_RULES.skillMd.hasEnSection.pattern.test(content)) { mdScore += 15; result.checks.enSection = true; } else { result.issues.push({ rule: 'MD-EN', msg: 'Missing ## 🇺🇸 section' }); }
  if (I18N_RULES.skillMd.hasBilingualIronLaw.pattern.test(content)) { mdScore += 10; result.checks.bilingualIL = true; } else { result.issues.push({ rule: 'MD-IL', msg: 'Iron Law not bilingual' }); }
  if (I18N_RULES.skillMd.hasBilingualRedFlags.pattern.test(content)) { mdScore += 10; result.checks.bilingualRF = true; } else { result.issues.push({ rule: 'MD-RF', msg: 'Red Flags not bilingual' }); }
  result.mdScore = mdScore;
  result.score += mdScore;
  
  // Grade
  if (result.score >= 90) result.grade = 'A';
  else if (result.score >= 70) result.grade = 'B';
  else if (result.score >= 50) result.grade = 'C';
  else result.grade = 'D';
  
  return result;
}

export async function analyzeAllI18N(category) {
  const categories = category ? [category] : ['core', 'expert', 'entropy', 'pr', 'openspec'];
  const results = [];
  for (const cat of categories) {
    const catDir = path.join(SKILLS_ROOT, cat);
    if (!fs.existsSync(catDir)) continue;
    const skills = fs.readdirSync(catDir).filter(f => fs.statSync(path.join(catDir, f)).isDirectory());
    for (const skill of skills) {
      const r = await analyzeI18N(path.join(catDir, skill));
      r.category = cat;
      results.push(r);
    }
  }
  return results;
}

export function printI18NReport(results) {
  console.log('\n━━━ i18n Bilingual Report ━━━');
  console.log(`  Total Skills: ${results.length}`);
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
  console.log(`  Average Score: ${avg.toFixed(1)}/100`);
  const grades = { A: 0, B: 0, C: 0, D: 0 };
  results.forEach(r => grades[r.grade]++);
  console.log(`  Grades: A:${grades.A} B:${grades.B} C:${grades.C} D:${grades.D}`);
  console.log('\n' + '─'.repeat(65));
  console.log(`  ${'Skill'.padEnd(30)} ${'Score'.padStart(6)} ${'Grade'.padStart(6)} Issues`);
  console.log('─'.repeat(65));
  for (const r of results.sort((a, b) => b.score - a.score)) {
    const issues = r.issues.length > 0 ? ` (${r.issues.length})` : '';
    console.log(`${r.name.padEnd(30)} ${String(r.score).padStart(6)} ${r.grade.padStart(6)}${issues}`);
    if (r.issues.length > 0) {
      for (const issue of r.issues) {
        console.log(`    ⚠ ${issue.rule}: ${issue.msg}`);
      }
    }
  }
  if (results.some(r => r.issues.length > 0)) {
    console.log('\n  Main Issues:');
    const issueCounts = {};
    results.forEach(r => r.issues.forEach(i => { issueCounts[i.rule] = (issueCounts[i.rule] || 0) + 1; }));
    Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${k}: ${v}x`));
  }
}
