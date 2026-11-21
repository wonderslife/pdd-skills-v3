/**
 * Gradle Inspector - Android Gradle 工程解析与体检
 *
 * inspect(rootDir)  → 结构化工程模型（模块/依赖/版本目录/AGP/构建变体）
 * diagnose(model)   → 体检报告（KSP 迁移、版本目录一致性、依赖冲突、变体配置）
 *
 * 默认静态解析（离线可用）；mode='dynamic' 且 gradlew 可用时补充依赖树。
 * 见 docs/plans/04-kotlin-android-capability-enhancement.md §4.2.1。
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

const BUILD_FILES = ['build.gradle.kts', 'build.gradle'];

async function readIfExists(p) {
  try { return await fs.readFile(p, 'utf-8'); } catch { return null; }
}

function parseTomlVersions(content) {
  const versions = new Map();
  const inVersions = content?.match(/\[versions\]([\s\S]*?)(\n\[|$)/);
  if (inVersions) {
    for (const line of inVersions[1].split('\n')) {
      const m = line.match(/^\s*([\w-]+)\s*=\s*"([^"]+)"/);
      if (m) versions.set(m[1], m[2]);
    }
  }
  const inLibraries = content?.match(/\[libraries\]([\s\S]*?)(\n\[|$)/);
  const libraries = [];
  if (inLibraries) {
    for (const line of inLibraries[1].split('\n')) {
      const m = line.match(/^\s*([\w-]+)\s*=\s*\{[^}]*module\s*=\s*"([^"]+)"/);
      if (m) libraries.push({ alias: m[1], module: m[2] });
    }
  }
  return { versions, libraries };
}

function parseBuildFile(content) {
  const info = {
    plugins: [],
    dependencies: [],
    buildVariants: [],
    usesKapt: false,
    usesCompose: false
  };
  if (!content) return info;

  // plugins 块
  const pluginBlock = content.match(/plugins\s*\{([\s\S]*?)\n\}/);
  if (pluginBlock) {
    for (const m of pluginBlock[1].matchAll(/(?:id|alias)\s*\(?\s*["']?([\w.\-]+)/g)) {
      info.plugins.push(m[1]);
    }
  }
  info.usesKapt = /(?:^|\s)kapt\b|kotlin-kapt|org\.jetbrains\.kotlin\.kapt/.test(content);
  info.usesCompose = /org\.jetbrains\.compose|androidx\.compose|kotlin\("compose"\)|buildFeatures\s*\{[^}]*compose\s*=\s*true/.test(content);

  // 依赖声明：implementation("g:a:v") / implementation "g:a:v" / implementation(libs.xxx)
  for (const m of content.matchAll(
    /^\s*(\w[\w-]*)\s*\(?\s*(?:"([\w.\-/]+:[\w.\-/]+:[\w.\-{}$]+)"|(libs\.[\w.]+))\s*\)?/gm
  )) {
    const scope = m[1];
    if (!/^(implementation|api|compileOnly|runtimeOnly|testImplementation|debugImplementation|kapt|ksp|coreLibraryDesugaring)$/.test(scope)) continue;
    if (m[2]) info.dependencies.push({ scope, notation: m[2] });
    else if (m[3]) info.dependencies.push({ scope, notation: m[3], fromCatalog: true });
  }

  // buildTypes / productFlavors → 构建变体
  const bt = content.match(/buildTypes\s*\{([\s\S]*?)\n\s{4}\}/);
  if (bt) {
    for (const m of bt[1].matchAll(/^\s*(getByName|create)\s*\(\s*(\w+)/gm)) {
      info.buildVariants.push(m[2]);
    }
  }
  return info;
}

async function findAgpVersion(rootDir, moduleBuilds, catalog) {
  // 1. 版本目录 [plugins] android.application → ref versions.agp
  const toml = await readIfExists(path.join(rootDir, 'gradle', 'libs.versions.toml'));
  if (toml) {
    const pluginsBlock = toml.match(/\[plugins\]([\s\S]*?)(\n\[|$)/);
    if (pluginsBlock) {
      const agpAlias = pluginsBlock[1].match(/android-application\s*=\s*\{[^}]*version\.ref\s*=\s*"([\w-]+)"/);
      if (agpAlias && catalog.versions.has(agpAlias[1])) return catalog.versions.get(agpAlias[1]);
    }
    if (catalog.versions.has('agp')) return catalog.versions.get('agp');
  }
  // 2. 根 build 文件 plugins 块 id("com.android.application") version "8.x"
  for (const { content } of moduleBuilds) {
    const m = content?.match(/com\.android\.(?:application|library)["']?\s*version\s+["']([\d.]+)/);
    if (m) return m[1];
  }
  // 3. buildscript classpath
  const rootBuild = readIfExists(path.join(rootDir, 'build.gradle.kts')) || readIfExists(path.join(rootDir, 'build.gradle'));
  const cp = rootBuild?.match(/com\.android\.tools\.build:gradle:([\d.]+)/);
  return cp ? cp[1] : null;
}

/**
 * 解析 Android 工程
 * @param {string} rootDir Android 工程根目录（settings.gradle 所在处）
 * @param {{mode?: 'static'|'dynamic'}} options
 */
export async function inspect(rootDir, options = {}) {
  const mode = options.mode || 'static';
  const catalog = parseTomlVersions(await readIfExists(path.join(rootDir, 'gradle', 'libs.versions.toml')));

  const settings = await readIfExists(path.join(rootDir, 'settings.gradle.kts'))
    || await readIfExists(path.join(rootDir, 'settings.gradle'));
  let moduleNames = [];
  if (settings) {
    moduleNames = [...settings.matchAll(/include\s*\(?\s*["'](:?[\w-]+)["']/g)].map(m => m[1]);
  }
  if (moduleNames.length === 0) moduleNames = [':app'];

  const modules = [];
  const moduleBuilds = [];
  for (const name of moduleNames) {
    const dir = path.join(rootDir, name.replace(/^:/, ''));
    let content = null;
    let buildFile = null;
    for (const bf of BUILD_FILES) {
      content = await readIfExists(path.join(dir, bf));
      if (content !== null) { buildFile = bf; break; }
    }
    const parsed = parseBuildFile(content);
    moduleBuilds.push({ name, content, parsed });
    modules.push({
      name,
      type: parsed.plugins.includes('com.android.application') ? 'application'
        : parsed.plugins.includes('com.android.library') ? 'library'
        : parsed.plugins.length ? 'kotlin' : 'unknown',
      dependencies: parsed.dependencies,
      buildVariants: parsed.buildVariants,
      usesKapt: parsed.usesKapt,
      usesCompose: parsed.usesCompose,
      buildFile
    });
  }

  const agpVersion = await findAgpVersion(rootDir, moduleBuilds, catalog);
  const composeEnabled = modules.some(m => m.usesCompose);
  const kaptUsage = modules.filter(m => m.usesKapt).map(m => m.name);

  // 动态模式：gradlew 可用时尝试拉取依赖树（失败降级静态，不抛错）
  let dependencyTree = null;
  if (mode === 'dynamic' && fs.existsSync(path.join(rootDir, 'gradlew'))) {
    try {
      dependencyTree = execSync(
        './gradlew -q :app:dependencies --configuration releaseRuntimeClasspath',
        { cwd: rootDir, encoding: 'utf-8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 }
      );
    } catch { /* 降级静态 */ }
  }

  return {
    rootDir,
    mode: dependencyTree ? 'dynamic' : 'static',
    modules,
    versionCatalog: Object.fromEntries(catalog.versions),
    catalogLibraries: catalog.libraries,
    agpVersion,
    composeEnabled,
    kaptUsage
  };
}

const SEVERITY_WEIGHT = { HIGH: 12, MEDIUM: 5, LOW: 1 };

/**
 * 体检：依赖冲突、版本目录一致性、KAPT→KSP、构建变体配置
 * @returns {{score: number, issues: Array<{severity: string, module?: string, message: string}>}}
 */
export function diagnose(model) {
  const issues = [];

  // 1. KAPT → KSP 迁移
  for (const name of model.kaptUsage) {
    issues.push({
      severity: 'HIGH',
      module: name,
      message: `module "${name.replace(/^:/, '')}" 仍使用 KAPT —— 建议 KSP 迁移（缩短编译时间）`
    });
  }

  // 2. 版本目录一致性：构建文件硬编码版本，而版本目录已有同名版本
  if (model.versionCatalog && Object.keys(model.versionCatalog).length > 0) {
    for (const mod of model.modules) {
      for (const dep of mod.dependencies) {
        if (dep.fromCatalog) continue;
        const parts = dep.notation.split(':');
        if (parts.length >= 3) {
          const version = parts[2];
          if (version.startsWith('$')) continue;
          const hit = Object.entries(model.versionCatalog)
            .find(([, v]) => v === version);
          if (hit) {
            issues.push({
              severity: 'MEDIUM',
              module: mod.name,
              message: `${mod.name} 硬编码 ${parts[0]}:${parts[1]}:${version}，libs.versions.toml 已有 ${hit[0]}=${hit[1]}，建议改为 libs.* 引用`
            });
          }
        }
      }
    }
  }

  // 3. 传递依赖版本冲突（同 artifact 不同版本）
  const byArtifact = new Map();
  for (const mod of model.modules) {
    for (const dep of mod.dependencies) {
      if (dep.fromCatalog || dep.notation.startsWith('libs.')) continue;
      const parts = dep.notation.split(':');
      if (parts.length >= 3) {
        const key = `${parts[0]}:${parts[1]}`;
        if (!byArtifact.has(key)) byArtifact.set(key, new Map());
        const vmap = byArtifact.get(key);
        if (!vmap.has(parts[2])) vmap.set(parts[2], []);
        vmap.get(parts[2]).push(mod.name);
      }
    }
  }
  for (const [artifact, vmap] of byArtifact) {
    if (vmap.size > 1) {
      const detail = [...vmap.entries()].map(([v, mods]) => `${v} (${mods.join(',')})`).join(' vs ');
      issues.push({
        severity: 'LOW',
        message: `依赖版本冲突: ${artifact} —— ${detail}（Gradle 将取最高版本，请确认）`
      });
    }
  }

  // 4. 构建变体配置：模块间 buildVariants 不一致
  const variantsPerModule = model.modules
    .filter(m => m.buildVariants.length > 0)
    .map(m => ({ name: m.name, variants: [...m.buildVariants].sort() }));
  if (variantsPerModule.length >= 1) {
    const variantsInApp = model.modules.find(m => m.type === 'application')?.buildVariants || [];
    if (variantsInApp.length > 1) {
      for (const mod of model.modules) {
        if (mod.type === 'library' && mod.buildVariants.length === 0) {
          issues.push({
            severity: 'MEDIUM',
            module: mod.name,
            message: `app 存在多构建变体 [${variantsInApp.join('/')}]，但 ${mod.name} 未声明 matchingFallbacks，release 变体可能解析失败`
          });
        }
      }
    }
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (SEVERITY_WEIGHT[i.severity] || 0), 0));
  return { score, issues };
}

export default { inspect, diagnose };
