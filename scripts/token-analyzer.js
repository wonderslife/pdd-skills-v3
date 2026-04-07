#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

export async function analyzeTokenEfficiency(category) {
  const categories = category ? [category] : ['core', 'entropy', 'expert', 'openspec', 'pr'];
  const results = [];

  for (const cat of categories) {
    const catPath = path.join(SKILLS_ROOT, cat);
    if (!fs.existsSync(catPath)) continue;

    const entries = fs.readdirSync(catPath).filter(f =>
      fs.statSync(path.join(catPath, f)).isDirectory()
    );

    for (const entry of entries) {
      const skillPath = path.join(catPath, entry);
      const analysis = analyzeSkillTokens(entry, skillPath);
      results.push({ ...analysis, category: cat });
    }
  }

  printTokenReport(results);
  return results;
}

function estimateTokenCount(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
}

function analyzeSkillTokens(name, skillPath) {
  const skillMd = path.join(skillPath, 'SKILL.md');
  const metaJson = path.join(skillPath, '_meta.json');

  if (!fs.existsSync(skillMd)) {
    return { name, error: 'SKILL.md not found', tokens: 0, grade: 'F' };
  }

  const content = fs.readFileSync(skillMd, 'utf-8');
  const totalTokens = estimateTokenCount(content);
  const fileSizeKB = Buffer.byteLength(content, 'utf-8') / 1024;

  const lines = content.split('\n');
  const lineCount = lines.length;
  const maxSectionLength = getMaxSectionLength(lines);

  const sections = countSections(content);
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
  const tables = (content.match(/\|.+\|/g) || []).length / 2;

  const descMatch = content.match(/^description:\s*(.+)$/m);
  const descLen = descMatch ? descMatch[1].trim().length : 0;

  const hasLayering = /layer/i.test(content) || /##\s*\d+/i.test(content);
  const hasBehaviorShaping = /iron\s*law|red\s*flags|rationalization/i.test(content);

  let score = 100;
  if (totalTokens > 8000) score -= Math.min(30, (totalTokens - 8000) / 200);
  if (totalTokens > 5000) score -= Math.min(15, (totalTokens - 5000) / 400);
  if (descLen > 200) score -= Math.min(10, (descLen - 200) / 20);
  if (maxSectionLength > 150) score -= Math.min(10, (maxSectionLength - 150) / 10);
  if (!hasLayering) score -= 5;
  if (!hasBehaviorShaping) score -= 10;
  if (lineCount > 300) score -= Math.min(10, (lineCount - 300) / 30);

  score = Math.max(0, Math.min(100, score));

  return {
    name,
    tokens: totalTokens,
    fileSizeKB: Math.round(fileSizeKB * 10) / 10,
    lineCount,
    sections,
    codeBlocks,
    tables: Math.round(tables),
    descLength: descLen,
    maxSectionLines: maxSectionLength,
    hasLayering,
    hasBehaviorShaping,
    score,
    grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
    suggestions: generateSuggestions(totalTokens, descLen, maxSectionLength, hasLayering, hasBehaviorShaping)
  };
}

function getMaxSectionLength(lines) {
  let maxLength = 0;
  let currentLength = 0;
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      maxLength = Math.max(maxLength, currentLength);
      currentLength = 0;
    }
    currentLength++;
  }
  return Math.max(maxLength, currentLength);
}

function countSections(content) {
  return (content.match(/^#{1,3}\s+.+$/gm) || []).length;
}

function generateSuggestions(tokens, descLen, maxSec, hasLayering, hasBS) {
  const suggestions = [];
  if (tokens > 8000) suggestions.push('⚠️ 文件过大，建议拆分为 Layer 1/2/3 渐进式加载');
  if (tokens > 5000) suggestions.push('📝 文件较大，考虑将参考文档移至 references/ 目录');
  if (descLen > 200) suggestions.push('✂️ description 过长，建议精简至200字以内');
  if (maxSec > 150) suggestions.push('📐 存在超长章节(>' + maxSec + '行)，建议拆分');
  if (!hasLayering) suggestions.push('📚 缺少分层结构，建议添加 Layer 1/2/3 标记');
  if (!hasBS) suggestions.push('🛡️ 缺少行为塑造章节(Iron Law/Red Flags)');
  return suggestions;
}

function printTokenReport(results) {
  const avgTokens = results.reduce((s, r) => s + (r.tokens || 0), 0) / results.length;
  const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
  const gradeDist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  results.forEach(r => gradeDist[r.grade]++);

  console.log('\n📊 Token 效率分析报告\n');
  console.log(`  总技能数: ${results.length}`);
  console.log(`  平均Token数: ${Math.round(avgTokens)}`);
  console.log(`  平均效率分: ${avgScore.toFixed(1)}/100`);
  console.log(`  等级分布: A:${gradeDist.A} B:${gradeDist.B} C:${gradeDist.C} D:${gradeDist.D} F:${gradeDist.F}\n`);

  console.log('  ┌────────────────────────┬────────┬───────┬──────┬────────┐');
  console.log('  │ 技能名称               │ Tokens │ 大小  │ 等级  │ 建议   │');
  console.log('  ├────────────────────────┼────────┼───────┼──────┼────────┤');

  const sorted = [...results].sort((a, b) => a.tokens - b.tokens);
  for (const r of sorted) {
    const icon = r.grade === 'A' ? '🟢' : r.grade === 'B' ? '🟡' : r.grade === 'C' ? '🟠' : r.grade === 'D' ? '🔴' : '⬛';
    const name = r.name.padEnd(24).substring(0, 24);
    const size = (r.fileSizeKB + 'KB').padStart(6);
    const suggestCount = r.suggestions ? r.suggestions.length : 0;
    console.log(`  │ ${icon} ${name} │ ${(r.tokens || 0).toString().padStart(6)} │ ${size} │  ${r.grade}   │ ${suggestCount.toString().padStart(4)} │`);
  }

  console.log('  └────────────────────────┴────────┴───────┴──────┴────────┘');

  const needOptimization = results.filter(r => r.score < 60);
  if (needOptimization.length > 0) {
    console.log('\n  ⚠️ 需要优化的技能:');
    for (const r of needOptimization) {
      console.log(`    ${r.name} (${r.tokens} tokens, ${r.grade}级)`);
      for (const s of (r.suggestions || [])) {
        console.log(`      ${s}`);
      }
    }
  }
}
