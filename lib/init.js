import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initProject(targetPath = '.', options = {}) {
  const absolutePath = path.resolve(targetPath);
  const pddDir = path.join(absolutePath, '.pdd');
  const skillsDir = path.join(absolutePath, '.trae', 'skills');

  console.log(chalk.gray(`  目标目录: ${absolutePath}`));

  if (fs.existsSync(pddDir) && !options.force) {
    console.log(chalk.yellow('\n⚠️  .pdd目录已存在，使用 -f 参数强制覆盖'));
    return;
  }

  const template = options.template || 'default';

  console.log(chalk.blue('📁 创建目录结构...'));

  const dirs = [
    '.pdd',
    '.pdd/cache',
    '.pdd/cache/specs',
    '.pdd/cache/reports',
    'docs',
    'docs/plans',
    'docs/specs',
    'specs'
  ];

  if (!options.noSkills) {
    dirs.push('.trae/skills');
  }

  for (const dir of dirs) {
    const dirPath = path.join(absolutePath, dir);
    await fs.ensureDir(dirPath);
    console.log(chalk.gray(`  ✓ ${dir}/`));
  }

  console.log(chalk.blue('\n📝 生成配置文件...'));

  await generateConfig(pddDir, template);
  await updateGitignore(absolutePath);

  if (!options.noSkills) {
    console.log(chalk.blue('\n📦 复制核心技能文件...'));
    await copyCoreSkills(skillsDir);
  }

  console.log('');
}

async function generateConfig(pddDir, template) {
  const configTemplate = `# PDD Configuration
project:
  name: ""
  version: "1.0.0"
  description: ""
  template: ${template}

pdd:
  features:
    output_dir: specs/features
    naming_pattern: "{id}-{name}"
  spec:
    output_dir: specs
    template: default
    include_tests: true
  verify:
    dimensions:
      - completeness
      - correctness
      - consistency
    auto_fix: false

linter:
  enabled: true
  types:
    - code
    - prd
    - sql
    - activiti
  fail_on_error: false
  report_format: markdown

hooks:
  enabled: true
  events:
    - session_start
    - pre_feature
    - post_feature

cache:
  enabled: true
  ttl: 3600
  max_size: 100

logging:
  level: info
`;

  await fs.writeFile(path.join(pddDir, 'config.yaml'), configTemplate);
  console.log(chalk.gray('  ✓ .pdd/config.yaml'));

  const hooksTemplate = `# PDD Hooks Configuration
session_start:
  enabled: true
  description: "会话启动时执行，加载项目上下文"

pre_feature:
  enabled: true
  checks:
    - spec_exists
    - dependencies_met

post_feature:
  enabled: true
  actions:
    - run_linter
    - run_tests

pre_commit:
  enabled: true
  checks:
    - linter_pass
    - tests_pass
`;

  await fs.writeFile(path.join(pddDir, 'hooks.yaml'), hooksTemplate);
  console.log(chalk.gray('  ✓ .pdd/hooks.yaml'));
}

async function updateGitignore(projectDir) {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const pddIgnore = '\n# PDD\n.pdd/cache/\n.specs/.cache/\n*.pdd-report.md\n';

  if (fs.existsSync(gitignorePath)) {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    if (!content.includes('# PDD')) {
      await fs.appendFile(gitignorePath, pddIgnore);
      console.log(chalk.gray('  ✓ 更新 .gitignore'));
    }
  } else {
    await fs.writeFile(gitignorePath, pddIgnore);
    console.log(chalk.gray('  ✓ 创建 .gitignore'));
  }
}

async function copyCoreSkills(skillsDir) {
  const coreSkillsSource = path.join(__dirname, '../skills/core');

  if (!fs.existsSync(coreSkillsSource)) {
    console.log(chalk.gray('  ℹ 核心技能源目录不存在，跳过复制'));
    return;
  }

  const skillDirs = fs.readdirSync(coreSkillsSource).filter(f =>
    fs.statSync(path.join(coreSkillsSource, f)).isDirectory()
  );

  for (const skill of skillDirs) {
    const src = path.join(coreSkillsSource, skill);
    const dest = path.join(skillsDir, skill);
    await fs.copy(src, dest);
    console.log(chalk.gray(`  📦 ${skill}`));
  }
}
