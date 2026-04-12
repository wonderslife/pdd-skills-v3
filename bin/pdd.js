#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initProject } from '../lib/init.js';
import { updateSkills } from '../lib/update.js';
import { listSkills } from '../lib/list.js';
import { showVersion } from '../lib/version.js';
import { initConsole, formatConsoleText } from '../lib/utils/console.js';

initConsole();

const safeChalk = (text) => formatConsoleText(text, { fallbackEmoji: true });

const program = new Command();

program
  .name('pdd')
  .description('PDD-Skills - PRD Driven Development Skills')
  .version(await showVersion());

program
  .command('init [path]')
  .description('Initialize PDD project directory structure')
  .option('-f, --force', 'Force overwrite existing directory')
  .option('-t, --template <name>', 'Project template (business-analysis/ruoyi/generic)')
  .option('-i, --ide <name>', 'Target IDE (trae/cursor/vscode/claude/codex/generic)')
  .option('--no-skills', 'Do not copy skill files')
  .action(async (path = '.', options) => {
    console.log(chalk.blue('\n>> Initializing PDD project...\n'));
    await initProject(path, options);
    console.log(chalk.green('\n[OK] Project initialized!'));
  });

program
  .command('update')
  .description('更新PDD技能到最新版本')
  .option('-v, --version <version>', '指定版本号')
  .option('--check', '仅检查是否有更新')
  .action(async (options) => {
    await updateSkills(options);
  });

program
  .command('list')
  .description('列出所有可用技能')
  .option('-c, --category <name>', '按分类筛选')
  .option('--json', 'JSON格式输出')
  .action(async (options) => {
    await listSkills(options);
  });

program
  .command('linter')
  .description('运行代码质量门禁检查')
  .option('-t, --type <type>', 'linter类型: java/js/python/sql/prd/skill/all', 'all')
  .option('-f, --file <path>', '指定文件或目录')
  .option('--incremental', '增量检查模式')
  .option('-o, --output <format>', '输出格式: text/json/html', 'text')
  .action(async (options) => {
    const linterModule = await import('../scripts/linter/run-linters.js');
    await linterModule.default(options);
  });

program
  .command('generate')
  .description('基于开发规格生成代码')
  .option('-s, --spec <path>', '规格文件路径', 'dev-specs/spec.md')
  .option('-o, --output <dir>', '输出目录', './generated')
  .option('-f, --feature <name>', '指定功能点名称')
  .option('--dry-run', '仅显示将要执行的操作，不实际生成')
  .action(async (options) => {
    const { generateCode } = await import('../lib/generate.js');
    console.log(chalk.blue('\n🔨 基于开发规格生成代码...\n'));
    await generateCode(options);
    console.log(chalk.green('\n✅ 代码生成完成!'));
  });

program
  .command('verify')
  .description('验证功能实现是否符合规格和验收标准')
  .option('-s, --spec <path>', '规格文件路径')
  .option('-c, --code <dir>', '代码目录', './src')
  .option('-v, --verbose', '显示详细验证信息')
  .option('--json', '输出JSON格式的验证报告')
  .action(async (options) => {
    const { verifyFeature } = await import('../lib/verify.js');
    console.log(chalk.blue('\n🔍 验证功能实现...\n'));
    await verifyFeature(options);
  });

program
  .command('report')
  .description('生成分析报告(MD/JSON/HTML)')
  .option('-t, --type <type>', '报告类型: md/json/html', 'md')
  .option('-o, --output <path>', '输出路径', './reports/pdd-report')
  .option('--include-stats', '包含统计信息')
  .option('--include-charts', '包含图表(仅HTML)')
  .action(async (options) => {
    const { generateReport } = await import('../lib/report.js');
    console.log(chalk.blue('\n📊 生成分析报告...\n'));
    await generateReport(options);
    console.log(chalk.green('\n✅ 报告生成完成!'));
  });

program
  .command('config')
  .description('管理PDD配置')
  .option('-l, --list', '列出当前配置')
  .option('-s, --set <key=value>', '设置配置项')
  .option('-g, --get <key>', '获取指定配置项')
  .option('--reset', '重置为默认配置')
  .action(async (options) => {
    const configManager = await import('../lib/config-manager.js');
    await configManager.default(options);
  });

program
  .command('cso')
  .description('CSO分析 - 评估技能触发准确率和Token效率')
  .option('-c, --category <name>', '分析指定分类')
  .option('--token-analyze', 'Token效率分析模式')
  .option('--fix', '自动优化description和triggers')
  .action(async (options) => {
    const { analyzeAllSkills, printCSOReport } = await import('../scripts/cso-analyzer.js');
    const results = await analyzeAllSkills(options.category);
    printCSOReport(results);
  });

program
  .command('eval')
  .description('运行技能评估测试')
  .option('-s, --skill <name>', '测试指定技能')
  .option('-c, --category <name>', '测试指定分类的所有技能')
  .option('--verbose', '显示详细输出')
  .action(async (options) => {
    const { runEvals } = await import('../scripts/eval-runner.js');
    await runEvals(options);
  });

program
  .command('token')
  .description('Token效率分析')
  .option('-c, --category <name>', '分析指定分类')
  .action(async (options) => {
    const { analyzeTokenEfficiency } = await import('../scripts/token-analyzer.js');
    await analyzeTokenEfficiency(options.category);
  });

program
  .command('i18n')
  .description('i18n双语化检查 - 验证技能的中英文双语覆盖')
  .option('-c, --category <name>', '检查指定分类', 'core')
  .action(async (options) => {
    const { analyzeAllI18N, printI18NReport } = await import('../scripts/i18n-checker.js');
    const results = await analyzeAllI18N(options.category);
    printI18NReport(results);
  });

program
  .command('api')
  .description('启动PDD API服务器')
  .option('-p, --port <port>', '监听端口号', '3000')
  .option('-h, --host <host>', '绑定地址', 'localhost')
  .option('--cors', '启用CORS跨域支持')
  .action(async (options) => {
    const { startApiServer } = await import('../lib/api-server.js');
    await startApiServer({
      port: parseInt(options.port, 10),
      host: options.host,
      cors: options.cors
    });
  });

program
  .command('openclaw [command]')
  .description('OpenClaw AI Agent 编排平台集成')
  .addCommand(
    new Command()
      .name('start')
      .description('启动 OpenClaw 服务')
      .option('-p, --port <port>', '监听端口号', '8080')
      .option('-t, --token <token>', '认证令牌')
      .option('--daemon', '以守护进程模式运行')
      .action(async (options) => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('start', options);
      })
  )
  .addCommand(
    new Command()
      .name('stop')
      .description('停止 OpenClaw 服务')
      .action(async () => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('stop');
      })
  )
  .addCommand(
    new Command()
      .name('status')
      .description('查看 OpenClaw 连接状态')
      .action(async () => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('status');
      })
  )
  .addCommand(
    new Command()
      .name('list-tools')
      .description('列出已暴露给 OpenClaw 的工具')
      .action(async () => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('list-tools');
      })
  )
  .addCommand(
    new Command()
      .name('test')
      .description('测试工具调用')
      .option('-n, --tool-name <name>', '指定要测试的工具名称', 'pdd_list_skills')
      .action(async (options) => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('test', options);
      })
  )
  .addCommand(
    new Command()
      .name('logs')
      .description('查看 OpenClaw 通信日志')
      .option('--tail', '持续跟踪输出')
      .option('-l, --limit <number>', '显示条数', '50')
      .action(async (options) => {
        const { createCLI } = await import('../lib/openclaw/cli-integration.js');
        const cli = createCLI();
        await cli.execute('logs', options);
      })
  );

// === dashboard 子命令 (VM-D001) ===
program
  .command('dashboard')
  .description('启动 PDD Web 可视化管理面板')
  .option('-p, --port <port>', '监听端口号', '3001')
  .option('--no-browser', '不自动打开浏览器')
  .option('--no-open', '不自动打开浏览器（别名）')
  .option('-r, --refresh <sec>', '自动刷新间隔(秒)', '30')
  .action(async (options) => {
    const { DashboardServer } = await import('../lib/vm/dashboard/server.js');
    const { PDDDataProvider } = await import('../lib/vm/data-provider.js');
    const dataProvider = new PDDDataProvider(process.cwd());
    const server = new DashboardServer(dataProvider);
    await server.start(parseInt(options.port, 10), {
      open: !options.noBrowser && !options.noOpen,
      refreshInterval: parseInt(options.refresh, 10) * 1000
    });

    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n 正在关闭 Dashboard...'));
      await server.stop();
      process.exit(0);
    });
  });

// === tui 子命令 (VM-D002) ===
program
  .command('tui')
  .description('启动 PDD 终端可视化管理界面')
  .option('-r, --refresh <sec>', '自动刷新间隔(秒)', '5')
  .option('-t, --theme <theme>', '颜色主题', 'auto')  // auto/dark/light
  .action(async (options) => {
    const { TUIApp } = await import('../lib/vm/tui/tui.js');
    const app = new TUIApp(process.cwd(), {
      refresh: parseInt(options.refresh, 10),
      theme: options.theme
    });
    await app.start();
  });

// === vm 子命令组 (VM-D003) ===
const vmCmd = new Command()
  .name('vm')
  .description('PDD Visual Manager 状态查询命令');

vmCmd
  .command('status')
  .description('查看项目状态摘要')
  .option('--json', 'JSON格式输出')
  .action(async (options) => {
    const { PDDDataProvider } = await import('../lib/vm/data-provider.js');
    const provider = new PDDDataProvider(process.cwd());
    await provider.init();
    const summary = provider.getSummary();
    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      // 终端表格输出
      console.log(chalk.bold('\n📊 PDD 项目状态\n'));
      console.log(`   项目名: ${summary.name}`);
      console.log(`   总功能点: ${summary.totalFeatures}`);
      console.log(`   整体进度: ${summary.overallProgress}%`);
      console.log(`   平均质量分: ${summary.avgQualityScore}`);
      console.log(`   Token消耗: ${summary.totalTokens}`);
      console.log(`   平均迭代: ${summary.avgIterations}`);
      console.log(`\n   阶段分布:`);
      Object.entries(summary.stageDistribution || {}).forEach(([stage, count]) => {
        console.log(`     ${stage.padEnd(12)} ${count} 个功能点`);
      });
    }
  });

vmCmd
  .command('features')
  .description('列出所有功能点')
  .option('--stage <stage>', '按阶段筛选')
  .option('--json', 'JSON格式输出')
  .action(async (options) => {
    const { PDDDataProvider } = await import('../lib/vm/data-provider.js');
    const provider = new PDDDataProvider(process.cwd());
    await provider.init();
    let features = options.stage ? provider.getFeaturesByStage(options.stage) : provider.getFeatures();
    if (options.json) {
      console.log(JSON.stringify(features.map(f => f.toJSON()), null, 2));
    } else {
      console.log(chalk.bold(`\n📋 功能点列表 (${features.length}个)\n`));
      features.forEach((f, i) => {
        const stageColor = { prd:'magenta', extracted:'blue', spec:'green', implementing:'yellow', verifying:'red', done:'cyan' }[f.stage] || 'white';
        console.log(`   ${String(i+1).padStart(2)}. ${chalk[stageColor](f.name.padEnd(30))} [${f.stage.toUpperCase().padEnd(12)}] ${f.quality?.score ? chalk.bold(f.quality.score+'('+f.quality.grade+')') : '-'}  tok:${f.tokens?.used||0}`);
      });
    }
  });

vmCmd
  .command('export')
  .description('导出项目数据')
  .option('-f, --format <format>', '导出格式: json/md/csv', 'json')
  .option('-o, --output <path>', '输出路径')
  .action(async (options) => {
    const { PDDDataProvider } = await import('../lib/vm/data-provider.js');
    const fs = await import('fs');
    const path_mod = await import('path');
    const provider = new PDDDataProvider(process.cwd());
    await provider.init();
    let content = '';
    const ext = options.format;
    if (ext === 'json') content = provider.exportJSON({ mode: 'full' });
    else if (ext === 'md') content = provider.exportMarkdown();
    else if (ext === 'csv') content = provider.exportCSV();
    else { console.error(chalk.red(`不支持格式: ${ext}`)); return; }
    const outPath = options.output || `pdd-vm-export.${ext}`;
    fs.writeFileSync(outPath, content, 'utf-8');
    console.log(chalk.green(`✅ 已导出到: ${outPath} (${content.length} bytes)`));
  });

program.addCommand(vmCmd);

program.parse();
