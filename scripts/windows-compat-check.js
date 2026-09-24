#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
const CHINESE_PATTERN = /[\u{4e00}-\u{9fff}]/gu;

function checkFile(filePath) {
  const issues = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    if (content.includes('import chalk from') || content.includes("require('chalk')")) {
      const emojiMatches = content.match(EMOJI_PATTERN);
      const chineseMatches = content.match(CHINESE_PATTERN);

      if (emojiMatches && chineseMatches) {
        issues.push({
          type: 'emoji_chinese_mix',
          file: filePath,
          message: '检测到 chalk + emoji + 中文混合使用，可能导致 Windows 终端乱码',
          suggestion: '使用 emojiToAscii() 包装 emoji 字符'
        });
      }
    }

    if (content.includes('console.log') && EMOJI_PATTERN.test(content)) {
      if (!content.includes('emojiToAscii') && !content.includes('formatConsoleText')) {
        issues.push({
          type: 'unescaped_emoji',
          file: filePath,
          message: '检测到未包装的 emoji 字符输出',
          suggestion: '使用 safeEmoji() 或 emojiToAscii() 包装'
        });
      }
    }
  } catch (e) {
  }
  return issues;
}

function scanDirectory(dir, extensions = ['.js', '.ts', '.mjs']) {
  const issues = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (entry.isDirectory()) {
        issues.push(...scanDirectory(fullPath, extensions));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        issues.push(...checkFile(fullPath));
      }
    }
  } catch (e) {
  }
  return issues;
}

function main() {
  const projectRoot = process.argv[2] || path.join(__dirname, '..', '..');
  const srcDir = path.join(projectRoot, 'src');

  console.log('\n🔍 Windows 兼容性检查...\n');

  if (!fs.existsSync(srcDir)) {
    console.log('  未找到 src 目录，跳过检查');
    return;
  }

  const issues = scanDirectory(srcDir);

  if (issues.length === 0) {
    console.log('  ✅ 未检测到 Windows 兼容性问题');
  } else {
    console.log(`  ⚠️ 检测到 ${issues.length} 个潜在问题:\n`);
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.type}] ${issue.file}`);
      console.log(`     ${issue.message}`);
      console.log(`     💡 ${issue.suggestion}\n`);
    });
  }
}

main();