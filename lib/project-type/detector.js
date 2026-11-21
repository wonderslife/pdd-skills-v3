/**
 * Project Type Detector - 工程类型探测器
 *
 * 统一的技术栈识别入口，替代各模块硬编码的 src/main/java 判断。
 * 识别规则见 docs/plans/04-kotlin-android-capability-enhancement.md §2.2。
 *
 * 兼容性约定：Java/Vue 规则先匹配先返回；Android 规则追加在末尾。
 * 对既有 Java 工程返回的判定与 3.3.x 语义一致（javaBackendDir 恒为 'src/main/java'）。
 */

import fs from 'fs-extra';
import path from 'path';

const SKIP_DIRS = new Set([
  'node_modules', 'build', '.gradle', '.git', 'dist', '.pdd', '.trae', 'openspec'
]);

const EXCLUDED_ROOT_HINTS = new Set(['examples', 'testcases', 'tests', 'docs', 'scripts']);

/** 在目录树中查找（默认最大深度 3） */
export async function findFilesByName(rootDir, fileName, { maxDepth = 3, exclude = SKIP_DIRS } = {}) {
  const results = [];
  async function walk(dir, depth) {
    if (depth > maxDepth || results.length > 50) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.pdd') continue;
      if (exclude.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.name === fileName) {
        results.push(full);
        if (results.length > 50) return;
      }
    }
  }
  await walk(rootDir, 0);
  return results;
}

async function readIfExists(p) {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

/** 从 settings.gradle(.kts) 提取 include ':module' 声明 */
function parseSettingsIncludes(content) {
  if (!content) return [];
  const modules = [];
  const re = /(?:^|\n)\s*(?:include|includeProjects?)\s*\(?([^)]*)\)?/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    for (const token of m[1].split(',')) {
      const t = token.trim().replace(/^['"]|['"]$/g, '').replace(/"/g, "'");
      if (!t) continue;
      // include ':app', ':feature-login' 或 include(":core-network")
      const parts = t.split(/['"],?\s*['"]|^\s*['"]/).map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        for (const p of parts) if (p.startsWith(':')) modules.push(p);
      } else if (t.startsWith(':')) {
        modules.push(t);
      }
    }
  }
  return [...new Set(modules)];
}

/** 判断单个模块的类型 */
async function classifyModule(rootDir, moduleName) {
  for (const ext of ['.kts', '']) {
    const buildFile = path.join(rootDir, moduleName.replace(/^:/, ''), `build.gradle${ext}`);
    const content = await readIfExists(buildFile);
    if (content === null) continue;
    if (/com\.android\.application/.test(content)) return 'application';
    if (/com\.android\.library|com\.android\.feature/.test(content)) return 'library';
    if (/java-library|kotlin\("jvm"\)|org\.jetbrains\.kotlin\.jvm/.test(content)) return 'kotlin';
    return 'kotlin';
  }
  return 'unknown';
}

/** 探测 Android 工程信号 */
async function detectAndroidSignals(rootDir) {
  const settingsGradle = await readIfExists(path.join(rootDir, 'settings.gradle.kts'))
    || await readIfExists(path.join(rootDir, 'settings.gradle'));
  if (!settingsGradle) return null;

  const manifests = await findFilesByName(rootDir, 'AndroidManifest.xml', { maxDepth: 3 });
  if (manifests.length === 0) return null;

  const modules = parseSettingsIncludes(settingsGradle);
  const modulesDetailed = [];
  let composeEnabled = false;
  let versionCatalog = false;

  for (const mod of (modules.length ? modules : [':app'])) {
    const type = await classifyModule(rootDir, mod);
    modulesDetailed.push({ name: mod, type });
  }

  // Compose / 版本目录探测
  const buildFiles = [path.join(rootDir, 'build.gradle.kts'), path.join(rootDir, 'build.gradle')];
  for (const mod of modulesDetailed) {
    for (const ext of ['.kts', '']) {
      buildFiles.push(path.join(rootDir, mod.name.replace(/^:/, ''), `build.gradle${ext}`));
    }
  }
  for (const bf of buildFiles) {
    const content = await readIfExists(bf);
    if (!content) continue;
    if (/org\.jetbrains\.compose|kotlin\("compose"\)|androidx\.compose/.test(content)) composeEnabled = true;
  }
  versionCatalog = fs.existsSync(path.join(rootDir, 'gradle', 'libs.versions.toml'));

  return {
    modules: modulesDetailed,
    composeEnabled,
    versionCatalog,
    manifestCount: manifests.length
  };
}

/**
 * 探测工程类型
 *
 * @param {string} rootDir 工程根目录
 * @returns {Promise<{
 *   type: 'spring-boot'|'ruoyi'|'vue3'|'android-kotlin'|'android-compose'|'mixed'|'unknown',
 *   modules: Array<{name: string, type: string}>,
 *   buildSystem: 'maven'|'gradle'|'gradle-kts'|null,
 *   javaBackendDir: string,   // Java 后端契约扫描目录（既有工程恒为 'src/main/java'）
 *   androidDir: string|null,  // Android 工程根目录（mixed 时指向子目录）
 *   composeEnabled: boolean,
 *   versionCatalog: boolean,
 *   confidence: number
 * }>}
 */
export async function detectProjectType(rootDir) {
  const result = {
    type: 'unknown',
    modules: [],
    buildSystem: null,
    javaBackendDir: 'src/main/java',
    androidDir: null,
    composeEnabled: false,
    versionCatalog: false,
    confidence: 0
  };

  // ---------- 既有 Java / Vue 规则（保持 3.3.x 语义，先行返回） ----------
  const pom = await readIfExists(path.join(rootDir, 'pom.xml'));
  const hasJavaBackend = fs.existsSync(path.join(rootDir, 'src', 'main', 'java'));
  const rootAndroid = await detectAndroidSignals(rootDir);

  // 子目录中的 Android 工程（mixed / 单仓多栈布局）
  let childAndroidDir = null;
  let childAndroid = null;
  if (!rootAndroid) {
    let entries = [];
    try {
      entries = await fs.readdir(rootDir, { withFileTypes: true });
    } catch { /* ignore */ }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name) || EXCLUDED_ROOT_HINTS.has(entry.name)) continue;
      const signals = await detectAndroidSignals(path.join(rootDir, entry.name));
      if (signals) {
        childAndroidDir = path.join(rootDir, entry.name);
        childAndroid = signals;
        break;
      }
    }
  }

  if (pom && hasJavaBackend) {
    result.buildSystem = 'maven';
    const pomContent = pom.toLowerCase();
    result.type = pomContent.includes('ruoyi') ? 'ruoyi' : 'spring-boot';
    result.confidence = 0.95;
    if (childAndroid) {
      result.type = 'mixed';
      result.androidDir = childAndroidDir;
      result.modules = childAndroid.modules;
      result.composeEnabled = childAndroid.composeEnabled;
      result.versionCatalog = childAndroid.versionCatalog;
      result.confidence = 0.9;
    }
    return result;
  }

  if (rootAndroid) {
    // 根目录同时存在 Android 与 Java 后端 → mixed
    if (hasJavaBackend) {
      result.type = 'mixed';
    } else {
      result.type = rootAndroid.composeEnabled ? 'android-compose' : 'android-kotlin';
    }
    result.buildSystem = fs.existsSync(path.join(rootDir, 'settings.gradle.kts')) ? 'gradle-kts' : 'gradle';
    result.modules = rootAndroid.modules;
    result.composeEnabled = rootAndroid.composeEnabled;
    result.versionCatalog = rootAndroid.versionCatalog;
    result.androidDir = rootDir;
    result.confidence = 0.95;
    return result;
  }

  if (childAndroid) {
    // 根目录是 Java 后端（无 pom 但有 src/main/java）+ 子目录 Android
    if (hasJavaBackend) {
      result.type = 'mixed';
      result.buildSystem = 'maven';
      result.androidDir = childAndroidDir;
      result.modules = childAndroid.modules;
      result.composeEnabled = childAndroid.composeEnabled;
      result.versionCatalog = childAndroid.versionCatalog;
      result.confidence = 0.85;
      return result;
    }
    // 仅子目录有 Android 工程 → 视为 Android 工程，androidDir 指向子目录
    result.type = childAndroid.composeEnabled ? 'android-compose' : 'android-kotlin';
    result.buildSystem = 'gradle-kts';
    result.androidDir = childAndroidDir;
    result.modules = childAndroid.modules;
    result.composeEnabled = childAndroid.composeEnabled;
    result.versionCatalog = childAndroid.versionCatalog;
    result.confidence = 0.8;
    return result;
  }

  if (hasJavaBackend) {
    result.type = 'spring-boot';
    result.buildSystem = pom ? 'maven' : 'gradle';
    result.confidence = 0.7;
    return result;
  }

  // Vue3 判定
  const pkgJson = await readIfExists(path.join(rootDir, 'package.json'));
  if (pkgJson && /"vue"\s*:/.test(pkgJson)) {
    result.type = 'vue3';
    result.confidence = 0.85;
    return result;
  }

  return result;
}

export default detectProjectType;
