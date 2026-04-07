/**
 * PDD 配置管理模块
 * 管理项目配置的读取、写入和验证
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 默认配置
const DEFAULT_CONFIG = {
  project: {
    name: '',
    version: '1.0.0',
    description: ''
  },
  development: {
    specDir: 'dev-specs',
    outputDir: './generated',
    codeDir: './src',
    testDir: './tests'
  },
  linter: {
    types: ['java', 'js', 'python', 'sql', 'prd', 'skill'],
    strictMode: false,
    failOnError: true
  },
  api: {
    port: 3000,
    host: 'localhost',
    cors: false,
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000
    }
  },
  report: {
    defaultFormat: 'md',
    includeStats: true,
    includeCharts: false,
    outputDir: './reports'
  },
  skills: {
    autoUpdate: false,
    categories: ['core', 'analysis', 'development', 'quality']
  },
  vm: {
    port: 3001,
    refreshInterval: 30,
    theme: 'light',
    autoOpen: true,
    maxSSEConnections: 100,
    tuiRefreshInterval: 5
  }
};

// 配置文件路径
const CONFIG_FILE_PATHS = [
  path.join(process.cwd(), 'config', 'config.yaml'),
  path.join(process.cwd(), '.pddrc.yaml'),
  path.join(process.cwd(), '.pddrc.json')
];

/**
 * 获取配置文件路径
 * @returns {string|null} 找到的配置文件路径
 */
function findConfigFile() {
  for (const configPath of CONFIG_FILE_PATHS) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * 加载配置文件
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 配置对象
 */
async function loadConfig(configPath) {
  try {
    if (!configPath || !fs.existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const content = await fs.promises.readFile(configPath, 'utf-8');
    
    // 根据文件扩展名选择解析方式
    if (configPath.endsWith('.json')) {
      const userConfig = JSON.parse(content);
      return deepMerge(DEFAULT_CONFIG, userConfig);
    } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      // 使用yaml模块解析（如果可用）
      try {
        const yaml = await import('yaml');
        const userConfig = yaml.parse(content);
        return deepMerge(DEFAULT_CONFIG, userConfig);
      } catch {
        console.warn('警告: YAML解析失败，使用默认配置');
        return { ...DEFAULT_CONFIG };
      }
    }

    return { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error(`加载配置文件失败: ${error.message}`);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 保存配置到文件
 * @param {Object} config - 配置对象
 * @param {string} configPath - 配置文件路径
 */
async function saveConfig(config, configPath) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    let content;
    if (configPath.endsWith('.json')) {
      content = JSON.stringify(config, null, 2);
    } else {
      // 默认使用YAML格式
      try {
        const yaml = await import('yaml');
        content = yaml.stringify(config);
      } catch {
        content = JSON.stringify(config, null, 2);
      }
    }

    await fs.promises.writeFile(configPath, content, 'utf-8');
    console.log(`✅ 配置已保存到: ${configPath}`);
  } catch (error) {
    console.error(`保存配置失败: ${error.message}`);
    throw error;
  }
}

/**
 * 深度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * 设置配置项（支持点号路径）
 * @param {Object} config - 配置对象
 * @param {string} keyPath - 配置键路径（如 "api.port"）
 * @param {*} value - 配置值
 */
function setConfigValue(config, keyPath, value) {
  const keys = keyPath.split('.');
  let current = config;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  // 尝试转换值类型
  const lastKey = keys[keys.length - 1];
  current[lastKey] = parseValue(value);
}

/**
 * 解析值类型
 * @param {string} value - 字符串值
 * @returns {*} 解析后的值
 */
function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (!isNaN(Number(value)) && value !== '') return Number(value);
  
  // 尝试解析JSON数组或对象
  if ((value.startsWith('[') && value.endsWith(']')) ||
      (value.startsWith('{') && value.endsWith('}'))) {
    try {
      return JSON.parse(value);
    } catch {
      // 不是有效的JSON，返回字符串
    }
  }

  return value;
}

/**
 * 获取配置项（支持点号路径）
 * @param {Object} config - 配置对象
 * @param {string} keyPath - 配置键路径
 * @returns {*} 配置值
 */
function getConfigValue(config, keyPath) {
  const keys = keyPath.split('.');
  let current = config;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * 格式化显示配置
 * @param {Object} config - 配置对象
 * @param {number} indent - 缩进级别
 * @returns {string} 格式化后的配置字符串
 */
function formatConfig(config, indent = 0) {
  const prefix = '  '.repeat(indent);
  let output = '';

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      output += `${prefix}${chalk.cyan(key)}:\n`;
      output += formatConfig(value, indent + 1);
    } else {
      const formattedValue = Array.isArray(value) ? value.join(', ') : String(value);
      output += `${prefix}${chalk.cyan(key)}: ${chalk.green(formattedValue)}\n`;
    }
  }

  return output;
}

// 引入chalk用于彩色输出
let chalk;
try {
  chalkModule = await import('chalk');
  chalk = chalkModule.default;
} catch {
  // 如果chalk不可用，使用简单的格式化
  chalk = {
    cyan: (s) => s,
    green: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    blue: (s) => s
  };
}

/**
 * CLI配置管理入口函数
 * @param {Object} options - 命令行选项
 */
export async function configManager(options) {
  const configPath = findConfigFile() || path.join(process.cwd(), 'config', 'config.yaml');

  try {
    // 列出配置
    if (options.list) {
      console.log(chalk.blue('\n📋 当前PDD配置:\n'));
      const config = await loadConfig(configPath);
      console.log(formatConfig(config));
      console.log(chalk.yellow(`\n配置文件位置: ${configPath}\n`));
      return;
    }

    // 获取指定配置项
    if (options.get) {
      const config = await loadConfig(configPath);
      const value = getConfigValue(config, options.get);
      
      if (value !== undefined) {
        if (typeof value === 'object') {
          console.log(JSON.stringify(value, null, 2));
        } else {
          console.log(String(value));
        }
      } else {
        console.log(chalk.red(`\n❌ 配置项 "${options.get}" 不存在\n`));
        process.exit(1);
      }
      return;
    }

    // 设置配置项
    if (options.set) {
      const [keyPath, ...valueParts] = options.set.split('=');
      const value = valueParts.join('='); // 支持值中包含等号

      if (!keyPath || value === undefined) {
        console.log(chalk.red('\n❌ 格式错误: 请使用 -s key=value 格式\n'));
        process.exit(1);
      }

      const config = await loadConfig(configPath);
      setConfigValue(config, keyPath, value);
      await saveConfig(config, configPath);
      console.log(chalk.green(`\n✅ 已设置 ${keyPath} = ${value}\n`));
      return;
    }

    // 重置配置
    if (options.reset) {
      await saveConfig({ ...DEFAULT_CONFIG }, configPath);
      console.log(chalk.green('\n✅ 配置已重置为默认值\n'));
      return;
    }

    // 无参数时显示帮助信息
    console.log(chalk.blue('\nPDD 配置管理\n'));
    console.log('用法:');
    console.log('  pdd config --list              列出所有配置');
    console.log('  pdd config --get <key>         获取指定配置项');
    console.log('  pdd config --set <key=value>   设置配置项');
    console.log('  pdd config --reset             重置为默认配置\n');
    console.log('示例:');
    console.log('  pdd config --set api.port=8080');
    console.log('  pdd config --get linter.types');
    console.log('  pdd config --list\n');

  } catch (error) {
    console.error(chalk.red(`\n❌ 配置操作失败: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * 导出工具函数供其他模块使用
 */
export {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  findConfigFile,
  setConfigValue,
  getConfigValue,
  deepMerge
};

export default configManager;
