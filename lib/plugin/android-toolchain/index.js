/**
 * Android Toolchain 插件
 *
 * pre-verify 钩子：Android 工程下运行 Gradle 体检（gradle-inspector diagnose），
 *                  报告写入 .pdd/cache/reports/android-gradle-doctor-*.md
 * post-generate 钩子：生成后提示可用影响面/路由扫描命令。
 *
 * 非 Android 工程一律 no-op，保证既有链路行为不变（向后兼容红线）。
 */

import fs from 'fs-extra';
import path from 'path';
import { PluginBase } from '../plugin-sdk.js';
import { detectProjectType } from '../../project-type/detector.js';
import { inspect, diagnose } from '../../android/gradle-inspector/index.js';

export default class AndroidToolchainPlugin extends PluginBase {
  constructor() {
    super({
      name: 'android-toolchain',
      version: '1.0.0',
      description: 'Android 工具链插件：Gradle 体检、构建变体感知、ADB 桥接',
      author: 'PDD Team',
      license: 'MIT',
      keywords: ['android', 'gradle', 'kotlin'],
      pddVersionRange: '>=3.4.0'
    });
  }

  async onActivate(context) {
    this._log = this._log || ((...a) => console.log('[android-toolchain]', ...a));

    this.registerHook('pre-verify', async (ctx) => {
      const rootDir = ctx?.projectRoot || process.cwd();
      try {
        const detected = await detectProjectType(rootDir);
        if (!/^(android-|mixed)/.test(detected.type)) return ctx; // 非 Android 工程：no-op

        const androidDir = detected.androidDir || rootDir;
        const model = await inspect(androidDir, { mode: 'static' });
        const { score, issues } = diagnose(model);

        const reportDir = path.join(rootDir, '.pdd', 'cache', 'reports');
        await fs.ensureDir(reportDir);
        const reportPath = path.join(reportDir, `android-gradle-doctor-${Date.now()}.md`);
        const lines = [
          '# Android Gradle 体检报告',
          '',
          `- 时间: ${new Date().toISOString()}`,
          `- 工程类型: ${detected.type}`,
          `- AGP: ${model.agpVersion || '未识别'} | Compose: ${model.composeEnabled ? '启用' : '未启用'} | 版本目录: ${model.versionCatalog ? '启用' : '未启用'}`,
          `- 模块: ${model.modules.map(m => m.name).join(', ')}`,
          `- 解析模式: ${model.mode}`,
          '',
          `## 评分: ${score}/100`,
          ''
        ];
        for (const issue of issues) {
          lines.push(`- [${issue.severity}] ${issue.module ? `(${issue.module}) ` : ''}${issue.message}`);
        }
        if (issues.length === 0) lines.push('- 无问题 🎉');
        await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');

        this._log(`Gradle 体检完成: ${score}/100, ${issues.length} 个问题 → ${path.relative(rootDir, reportPath)}`);
        if (ctx) ctx.androidGradleDoctor = { score, issues: issues.length, reportPath };
        return ctx;
      } catch (e) {
        this._log(`Gradle 体检失败（不影响 verify 流程）: ${e.message}`);
        return ctx;
      }
    }, 150);

    this.registerHook('post-generate', async (ctx) => {
      const rootDir = ctx?.projectRoot || process.cwd();
      try {
        const detected = await detectProjectType(rootDir);
        if (/^(android-|mixed)/.test(detected.type)) {
          this._log('提示: pdd scan 查看路由清单 | pdd impact <file> 分析影响面');
        }
      } catch { /* no-op */ }
      return ctx;
    }, 150);
  }
}
