import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';

export function log(level, message, data) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✅'),
    warn: chalk.yellow('⚠️'),
    error: chalk.red('❌'),
    debug: chalk.gray('🔍')
  };

  const icon = prefix[level] || prefix.info;
  const line = `[${timestamp}] ${icon} ${message}`;

  if (level === 'error') {
    console.error(line);
    if (data) console.error(chalk.red(`   ${JSON.stringify(data, null, 2)}`));
  } else if (level === 'debug') {
    console.debug(line);
  } else {
    console.log(line);
  }
}

export function loadConfig(projectDir) {
  const configPaths = [
    path.join(projectDir, '.pdd', 'config.yaml'),
    path.join(projectDir, '.pdd', 'config.json')
  ];

  for (const cfgPath of configPaths) {
    if (fs.existsSync(cfgPath)) {
      try {
        const content = fs.readFileSync(cfgPath, 'utf-8');
        if (cfgPath.endsWith('.yaml') || cfgPath.endsWith('.yml')) {
          return yaml.parse(content);
        }
        return JSON.parse(content);
      } catch (e) {
        log('warn', `配置文件解析失败: ${cfgPath}`, e.message);
      }
    }
  }

  return getDefaultConfig();
}

function getDefaultConfig() {
  return {
    project: { name: '', version: '1.0.0' },
    pdd: {
      features: { output_dir: 'specs/features' },
      spec: { output_dir: 'specs', include_tests: true },
      verify: { dimensions: ['completeness', 'correctness', 'consistency'] }
    },
    linter: {
      enabled: true,
      types: ['code', 'prd', 'sql', 'activiti'],
      fail_on_error: false,
      report_format: 'markdown'
    },
    hooks: { enabled: true },
    cache: { enabled: true, ttl: 3600 }
  };
}

export function resolveConfigPath(projectDir, relativePath) {
  const absolute = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(projectDir, relativePath);
  return absolute;
}

export async function findProjectRoot(startDir) {
  let current = path.resolve(startDir);

  while (current !== path.dirname(current)) {
    const pddDir = path.join(current, '.pdd');
    if (fs.existsSync(pddDir)) return current;
    current = path.dirname(current);
  }

  return path.resolve(startDir);
}
