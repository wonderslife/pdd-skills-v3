export { initProject } from './lib/init.js';
export { showVersion } from './lib/version.js';
export { updateSkills } from './lib/update.js';
export { listSkills } from './lib/list.js';
export { log, loadConfig, findProjectRoot, resolveConfigPath } from './lib/utils/logger.js';
export { HookExecutor } from './hooks/hook-executor.js';
export { ReportGenerator } from './scripts/linter/report-generator.js';

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getSkillsRoot() {
  return path.join(__dirname, 'skills');
}

export function getConfigRoot() {
  return path.join(__dirname, 'config');
}

export function getTemplatesRoot() {
  return path.join(__dirname, 'templates');
}

export async function getSkillList() {
  const skillsRoot = getSkillsRoot();
  const categories = ['core', 'entropy', 'expert', 'openspec', 'pr'];
  const result = {};

  for (const cat of categories) {
    const catPath = path.join(skillsRoot, cat);
    if (!fs.existsSync(catPath)) continue;

    result[cat] = fs.readdirSync(catPath).filter(f => {
      const fullPath = path.join(catPath, f);
      return fs.statSync(fullPath).isDirectory();
    });
  }

  return result;
}
