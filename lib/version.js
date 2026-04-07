import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function showVersion(verbose = false) {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  const currentVersion = pkg.version;

  if (verbose) {
    console.log(chalk.blue('\nPDD-Skills 版本信息:'));
    console.log(`  当前版本: ${chalk.green(currentVersion)}`);
    console.log(`  描述: ${pkg.description}`);
    console.log(`  许可证: ${pkg.license}`);

    try {
      const latestVersion = execSync(
        'npm view pdd-skills version',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      console.log(`\n  最新版本: ${latestVersion}`);

      if (compareVersions(latestVersion, currentVersion) > 0) {
        console.log(chalk.yellow('\n💡 有新版本可用，运行 pdd update 更新'));
      } else {
        console.log(chalk.green('\n✅ 已是最新版本'));
      }
    } catch (e) {
      console.log(chalk.gray('  (无法检查最新版本)'));
    }
  }

  return currentVersion;
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
