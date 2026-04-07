import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const CATEGORIES = {
  core: { name: '核心技能', description: 'PDD工作流核心技能' },
  entropy: { name: '熵减技能', description: '技术债务管理和代码质量维护' },
  expert: { name: '专家技能', description: '领域专家级深度分析能力' },
  openspec: { name: 'OpenSpec技能', description: '规格变更管理流程' },
  pr: { name: 'PR技能', description: 'Pull Request全流程管理' }
};

export async function listSkills(options = {}) {
  const category = options.category;
  const asJson = options.json;

  if (category && !CATEGORIES[category]) {
    console.log(chalk.red(`\n❌ 未知分类: ${category}`));
    console.log(chalk.gray(`  可用分类: ${Object.keys(CATEGORIES).join(', ')}`));
    return;
  }

  const skills = await collectSkills(category);

  if (asJson) {
    console.log(JSON.stringify(skills, null, 2));
    return;
  }

  displaySkills(skills, category);
}

async function collectSkills(filterCategory) {
  const result = [];

  for (const [catKey, catInfo] of Object.entries(CATEGORIES)) {
    if (filterCategory && catKey !== filterCategory) continue;

    const catPath = path.join(SKILLS_ROOT, catKey);
    if (!fs.existsSync(catPath)) continue;

    const entries = fs.readdirSync(catPath).filter(f => {
      const fullPath = path.join(catPath, f);
      return fs.statSync(fullPath).isDirectory();
    });

    const skills = entries.map(name => {
      const skillDir = path.join(catPath, name);
      const metaPath = path.join(skillDir, '_meta.json');
      const skillMdPath = path.join(skillDir, 'SKILL.md');

      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')); } catch {}
      }

      let description = meta.description || '';
      if (!description && fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, 'utf-8');
        const match = content.match(/^description:\s*(.+)$/m);
        if (match) description = match[1].trim();
      }

      return {
        name,
        category: catKey,
        categoryName: catInfo.name,
        description,
        version: meta.version || '1.0.0',
        triggers: meta.triggers || [],
        hasEvals: fs.existsSync(path.join(skillDir, 'evals'))
      };
    });

    if (skills.length > 0) {
      result.push({
        category: catKey,
        ...catInfo,
        skills
      });
    }
  }

  return result;
}

function displaySkills(skills, filterCategory) {
  console.log(chalk.blue.bold('\n📋 PDD-Skills 技能列表\n'));

  if (skills.length === 0) {
    console.log(chalk.gray('  暂无可用技能'));
    return;
  }

  let totalSkills = 0;

  for (const cat of skills) {
    console.log(chalk.cyan.bold(`  ${cat.name} (${cat.category})`));
    console.log(chalk.gray(`  ${'─'.repeat(50)}`));

    for (const skill of cat.skills) {
      totalSkills++;
      const statusIcon = skill.hasEvals ? chalk.green('✓') : chalk.gray('·');
      const desc = skill.description
        ? skill.description.substring(0, 60) + (skill.description.length > 60 ? '...' : '')
        : chalk.gray('(无描述)');

      console.log(`  ${statusIcon} ${chalk.white.bold(skill.name)}`);
      console.log(`     ${chalk.gray(desc)}`);

      if (skill.triggers.length > 0) {
        console.log(`     ${chalk.dim('触发词:')} ${chalk.yellow(skill.triggers.slice(0, 3).join(', '))}${skill.triggers.length > 3 ? '...' : ''}`);
      }
    }

    console.log('');
  }

  console.log(chalk.gray(`${'─'.repeat(50)}`));
  console.log(chalk.green(`  共 ${totalSkills} 个技能, ${skills.length} 个分类`));

  if (!filterCategory) {
    console.log(chalk.gray('\n  使用 pdd list -c <分类> 按分类筛选'));
    console.log(chalk.gray('  使用 pdd list --json 输出JSON格式'));
  }
}
