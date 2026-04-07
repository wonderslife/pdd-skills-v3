import chalk from 'chalk';
import { execSync } from 'child_process';
import { showVersion } from './version.js';

export async function updateSkills(options) {
  console.log(chalk.blue('\n📦 检查更新...\n'));

  const currentVersion = await showVersion(false);

  try {
    const latestVersion = execSync(
      'npm view pdd-skills version',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();

    if (options.check) {
      if (compareVersions(latestVersion, currentVersion) > 0) {
        console.log(chalk.yellow(`📦 有新版本可用: ${latestVersion}`));
        console.log(chalk.gray(`  当前版本: ${currentVersion}`));
      } else {
        console.log(chalk.green('✅ 已是最新版本'));
      }
      return;
    }

    if (compareVersions(latestVersion, currentVersion) <= 0 && !options.version) {
      console.log(chalk.green('✅ 已是最新版本，无需更新'));
      return;
    }

    const versionSpec = options.version || '@latest';
    console.log(chalk.blue(`🔄 正在更新到 ${versionSpec}...`));

    console.log(chalk.gray('\n提示: 运行以下命令手动更新:'));
    console.log(chalk.gray(`  npm install -g pdd-skills${versionSpec}`));
    console.log(chalk.gray(`  或使用 npx: npx pdd-skills${versionSpec} <command>`));

  } catch (e) {
    console.log(chalk.red('❌ 无法检查更新，请检查网络连接'));
  }
}

function compareVersions(a, b) {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}
