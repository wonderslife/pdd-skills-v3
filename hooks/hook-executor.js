import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { log } from '../lib/utils/logger.js';

const HOOK_EVENTS = {
  session_start: {
    description: '会话启动时触发',
    phase: 'pre'
  },
  pre_feature: {
    description: '功能开发前触发',
    phase: 'pre'
  },
  post_feature: {
    description: '功能开发后触发',
    phase: 'post'
  },
  pre_commit: {
    description: '提交代码前触发',
    phase: 'pre'
  },
  post_commit: {
    description: '提交代码后触发',
    phase: 'post'
  },
  linter_fail: {
    description: 'Linter检查失败时触发',
    phase: 'post'
  }
};

export class HookExecutor {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.hooksConfig = null;
    this.hooksDir = path.join(projectRoot, '.pdd', 'hooks.d');
  }

  async load() {
    const configPath = path.join(this.projectRoot, '.pdd', 'hooks.yaml');

    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const yaml = await import('yaml');
        this.hooksConfig = yaml.parse(content);
        log('info', 'Hook配置加载完成');
      } catch (e) {
        log('warn', `Hook配置解析失败: ${e.message}`);
        this.hooksConfig = {};
      }
    } else {
      this.hooksConfig = {};
    }
  }

  async trigger(eventName, context = {}) {
    if (!this.hooksConfig) await this.load();

    const eventConfig = this.hooksConfig[eventName];
    if (!eventConfig || eventConfig.enabled === false) {
      return { skipped: true, reason: '事件未启用或未配置' };
    }

    log('info', `触发Hook事件: ${eventName}`);
    console.log(chalk.gray(`  🪝 ${HOOK_EVENTS[eventName]?.description || eventName}`));

    const results = [];

    if (eventConfig.checks) {
      for (const check of eventConfig.checks) {
        const result = await this.executeCheck(check, eventName, context);
        results.push(result);

        if (!result.passed && eventConfig.fail_fast !== false) {
          break;
        }
      }
    }

    if (eventConfig.actions) {
      for (const action of eventConfig.actions) {
        const result = await this.executeAction(action, eventName, context);
        results.push(result);
      }
    }

    const customHooks = await this.loadCustomHooks(eventName);
    for (const hook of customHooks) {
      const result = await this.executeCustomHook(hook, context);
      results.push(result);
    }

    const allPassed = results.every(r => r.passed !== false);
    return { success: allPassed, results, eventName };
  }

  async executeCheck(checkName, eventName, context) {
    const checkHandlers = {
      spec_exists: () => this.checkSpecExists(context),
      dependencies_met: () => this.checkDependenciesMet(context),
      linter_pass: () => this.checkLinterPass(context),
      tests_pass: () => this.checkTestsPass(context)
    };

    const handler = checkHandlers[checkName];
    if (!handler) {
      return { check: checkName, passed: true, skipped: true, message: `未知检查项: ${checkName}` };
    }

    try {
      const result = await handler();
      log(result.passed ? 'info' : 'warn', `  Check [${checkName}]: ${result.message}`);
      return { check: checkName, ...result };
    } catch (e) {
      return { check: checkName, passed: false, error: e.message };
    }
  }

  async executeAction(actionName, eventName, context) {
    const actionHandlers = {
      run_linter: () => this.actionRunLinter(context),
      run_tests: () => this.actionRunTests(context),
      generate_report: () => this.actionGenerateReport(context),
      cache_clear: () => this.actionCacheClear(context)
    };

    const handler = actionHandlers[actionName];
    if (!handler) {
      return { action: actionName, passed: true, skipped: true, message: `未知动作: ${actionName}` };
    }

    try {
      const result = await handler();
      log('info', `  Action [${actionName}]: ${result.message}`);
      return { action: actionName, ...result };
    } catch (e) {
      return { action: actionName, passed: false, error: e.message };
    }
  }

  async loadCustomHooks(eventName) {
    const hooks = [];

    if (!fs.existsSync(this.hooksDir)) return hooks;

    try {
      const files = fs.readdirSync(this.hooksDir)
        .filter(f => f.startsWith(`${eventName}.`) || f.startsWith(`${eventName}_`));

      for (const file of files) {
        const hookPath = path.join(this.hooksDir, file);
        const ext = path.extname(file);

        if (ext === '.js') {
          hooks.push({ type: 'script', path: hookPath, language: 'javascript' });
        } else if (ext === '.py') {
          hooks.push({ type: 'script', path: hookPath, language: 'python' });
        } else if (ext === '.sh' || ext === '.cmd') {
          hooks.push({ type: 'command', path: hookPath });
        }
      }
    } catch {}

    return hooks;
  }

  async executeCustomHook(hook, context) {
    try {
      let output = '';

      if (hook.type === 'script' && hook.language === 'javascript') {
        output = execSync(`node "${hook.path}"`, {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 30000,
          env: { ...process.env, ...this.buildEnvContext(context) }
        });
      } else if (hook.type === 'script' && hook.language === 'python') {
        output = execSync(`python "${hook.path}"`, {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 30000,
          env: { ...process.env, ...this.buildEnvContext(context) }
        });
      } else if (hook.type === 'command') {
        output = execSync(`"${hook.path}"`, {
          cwd: this.projectRoot,
          encoding: 'utf-8',
          timeout: 30000,
          env: { ...process.env, ...this.buildEnvContext(context) }
        });
      }

      return {
        hook: path.basename(hook.path),
        passed: true,
        output: output.trim()
      };
    } catch (e) {
      return {
        hook: path.basename(hook.path),
        passed: false,
        error: e.message,
        output: e.stdout?.trim() || ''
      };
    }
  }

  buildEnvContext(context) {
    return {
      PDD_EVENT: context.event || '',
      PDD_FEATURE_ID: context.featureId || '',
      PDD_PROJECT_DIR: this.projectRoot || '',
      PDD_SPEC_DIR: path.join(this.projectRoot, 'specs') || ''
    };
  }

  async checkSpecExists(context) {
    const specDir = path.join(this.projectRoot, 'specs');
    const hasSpecs = fs.existsSync(specDir) && fs.readdirSync(specDir).some(
      f => f.endsWith('.md') || f.endsWith('.yaml')
    );

    return {
      passed: hasSpecs,
      message: hasSpecs ? '规格文件已存在' : '⚠ 未找到规格文件'
    };
  }

  async checkDependenciesMet(context) {
    const pkgPath = path.join(this.projectRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return { passed: true, message: '非Node.js项目，跳过依赖检查' };
    }

    try {
      execSync('npm ls --depth=0', { cwd: this.projectRoot, encoding: 'utf-8', timeout: 30000 });
      return { passed: true, message: '依赖检查通过' };
    } catch (e) {
      return { passed: false, message: '依赖安装不完整' };
    }
  }

  async checkLinterPass(context) {
    try {
      const { default: runLinters } = await import('../scripts/linter/run-linters.js');
      const results = await runLinters({ type: ['code'], incremental: true });
      const allPassed = results.every(r => r.success);
      return {
        passed: allPassed,
        message: allPassed ? 'Linter检查通过' : 'Linter检查发现问题'
      };
    } catch (e) {
      return { passed: false, message: `Linter执行异常: ${e.message}` };
    }
  }

  async checkTestsPass(context) {
    const testCommands = [
      { cmd: 'npm test', pkg: 'package.json' },
      { cmd: 'pytest', file: 'pytest.ini' },
      { cmd: 'mvn test', file: 'pom.xml' }
    ];

    for (const tc of testCommands) {
      if (tc.pkg && fs.existsSync(path.join(this.projectRoot, tc.pkg))) {
        try {
          execSync(tc.cmd, { cwd: this.projectRoot, encoding: 'utf-8', timeout: 120000 });
          return { passed: true, message: '测试通过' };
        } catch (e) {
          return { passed: false, message: '测试未通过' };
        }
      }
      if (tc.file && fs.existsSync(path.join(this.projectRoot, tc.file))) {
        try {
          execSync(tc.cmd, { cwd: this.projectRoot, encoding: 'utf-8', timeout: 120000 });
          return { passed: true, message: '测试通过' };
        } catch (e) {
          return { passed: false, message: '测试未通过' };
        }
      }
    }

    return { passed: true, skipped: true, message: '未找到测试配置，跳过' };
  }

  async actionRunLinter(context) {
    try {
      const { default: runLinters } = await import('../scripts/linter/run-linters.js');
      await runLinters({ type: ['code'] });
      return { passed: true, message: 'Linter执行完成' };
    } catch (e) {
      return { passed: false, message: e.message };
    }
  }

  async actionRunTests(context) {
    const testResult = await this.checkTestsPass(context);
    return { passed: testResult.passed, message: testResult.message };
  }

  async actionGenerateReport(context) {
    const reportDir = path.join(this.projectRoot, '.pdd', 'cache', 'reports');
    await fs.ensureDir(reportDir);

    const reportPath = path.join(reportDir, `hook-report-${Date.now()}.md`);
    const content = [
      '# Hook 执行报告',
      '',
      `- 时间: ${new Date().toISOString()}`,
      `- 项目: ${path.basename(this.projectRoot)}`,
      ''
    ].join('\n');

    await fs.writeFile(reportPath, content, 'utf-8');
    return { passed: true, message: `报告生成: ${reportPath}` };
  }

  async actionCacheClear(context) {
    const cacheDir = path.join(this.projectRoot, '.pdd', 'cache');
    if (fs.existsSync(cacheDir)) {
      const specsCache = path.join(cacheDir, 'specs');
      if (fs.existsSync(specsCache)) {
        fs.emptyDirSync(specsCache);
      }
    }
    return { passed: true, message: '缓存已清理' };
  }
}
