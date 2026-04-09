import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { emojiToAscii } from './utils/console.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(__dirname, '..', 'skills');

const safeEmoji = (text) => emojiToAscii(text);

const CATEGORIES = {
  core: { name: 'Core Skills', description: 'PDD workflow core skills' },
  entropy: { name: 'Entropy Skills', description: 'Technical debt management and code quality' },
  expert: { name: 'Expert Skills', description: 'Domain expert level analysis capabilities' },
  openspec: { name: 'OpenSpec Skills', description: 'Specification change management workflow' },
  pr: { name: 'PR Skills', description: 'Pull Request lifecycle management' }
};

export async function listSkills(options = {}) {
  const category = options.category;
  const asJson = options.json;

  if (category && !CATEGORIES[category]) {
    console.log(chalk.red(`\n[X] Unknown category: ${category}`));
    console.log(chalk.gray(`  Available: ${Object.keys(CATEGORIES).join(', ')}`));
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
  console.log(chalk.blue.bold('\n[LIST] PDD-Skills\n'));

  if (skills.length === 0) {
    console.log(chalk.gray('  No skills available'));
    return;
  }

  let totalSkills = 0;

  for (const cat of skills) {
    console.log(chalk.cyan.bold(`  ${safeEmoji(cat.name)} (${cat.category})`));
    console.log(chalk.gray(`  ${'-'.repeat(50)}`));

    for (const skill of cat.skills) {
      totalSkills++;
      const statusIcon = skill.hasEvals ? chalk.green(safeEmoji('[v]')) : chalk.gray('[.]');
      const desc = skill.description
        ? skill.description.substring(0, 60) + (skill.description.length > 60 ? '...' : '')
        : chalk.gray('(no description)');

      console.log(`  ${statusIcon} ${chalk.white.bold(skill.name)}`);
      console.log(`     ${chalk.gray(desc)}`);

      if (skill.triggers.length > 0) {
        console.log(`     ${chalk.dim('Triggers:')} ${chalk.yellow(skill.triggers.slice(0, 3).join(', '))}${skill.triggers.length > 3 ? '...' : ''}`);
      }
    }

    console.log('');
  }

  console.log(chalk.gray(`${'-'.repeat(50)}`));
  console.log(chalk.green(`  Total: ${totalSkills} skills, ${skills.length} categories`));

  if (!filterCategory) {
    console.log(chalk.gray('\n  Use pdd list -c <category> to filter'));
    console.log(chalk.gray('  Use pdd list --json for JSON output'));
  }
}
