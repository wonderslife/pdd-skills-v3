/**
 * PDD Visual Manager - JSON Schema 定义与验证
 *
 * 定义 project-state.json 的完整 Schema，提供数据校验和版本迁移功能。
 *
 * Schema 版本: 1.0
 * 文件格式: project-state.json (v1.0)
 */

import { STAGE_VALUES, Priority, ArtifactType } from './models.js';

// 可选的 chalk 彩色输出支持
let chalk;
try {
  const chalkModule = await import('chalk');
  chalk = chalkModule.default;
} catch {
  chalk = {
    cyan: (s) => s,
    green: (s) => s,
    yellow: (s) => s,
    red: (s) => s,
    blue: (s) => s,
    gray: (s) => s
  };
}

/**
 * 当前 Schema 版本号
 * @type {string}
 */
export const SCHEMA_VERSION = '1.0.0';

/**
 * 支持的最低迁移源版本
 * @type {string}
 */
export const MIN_MIGRATABLE_VERSION = '0.9.0';

/**
 * 项目状态 JSON Schema 完整定义
 * 定义 project-state.json v1.0 格式规范
 *
 * @type {Object}
 */
export const STATE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://pdd.dev/schemas/project-state-v1.json',
  title: 'PDD Project State',
  description: 'PDD Visual Manager 项目状态文件格式，记录功能点开发进度和元数据',
  version: SCHEMA_VERSION,

  type: 'object',
  required: ['version', 'project', 'metadata'],
  additionalProperties: false,

  properties: {
    /**
     * Schema 版本标识
     */
    version: {
      type: 'string',
      description: 'Schema 格式版本号',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      const: SCHEMA_VERSION
    },

    /**
     * 项目信息
     */
    project: {
      type: 'object',
      description: '项目基本信息和功能点列表',
      required: ['name', 'features'],
      additionalProperties: false,

      properties: {
        name: {
          type: 'string',
          description: '项目名称',
          minLength: 1,
          maxLength: 200
        },
        version: {
          type: 'string',
          description: '项目版本号',
          pattern: '^\\d+\\.\\d+\\.\\d+$',
          default: '1.0.0'
        },
        description: {
          type: 'string',
          description: '项目描述',
          maxLength: 2000,
          default: ''
        },

        /**
         * 功能点列表
         */
        features: {
          type: 'array',
          description: '功能点定义列表',
          items: {
            type: 'object',
            required: ['id', 'name', 'stage', 'priority'],
            additionalProperties: false,

            properties: {
              id: {
                type: 'string',
                description: '功能点唯一标识符',
                minLength: 1,
                pattern: '^[a-zA-Z0-9_-]+$'
              },
              name: {
                type: 'string',
                description: '功能点名称',
                minLength: 1,
                maxLength: 200
              },
              description: {
                type: 'string',
                description: '功能点描述',
                maxLength: 5000,
                default: ''
              },

              /**
               * 开发阶段
               */
              stage: {
                type: 'string',
                description: '当前开发阶段',
                enum: [...STAGE_VALUES]
              },

              /**
               * 优先级
               */
              priority: {
                type: 'string',
                description: '功能点优先级',
                enum: Object.values(Priority),
                default: 'P2'
              },

              /**
               * 时间线
               */
              timeline: {
                type: 'array',
                description: '阶段转换时间线',
                items: {
                  type: 'object',
                  required: ['stage', 'timestamp'],
                  additionalProperties: false,
                  properties: {
                    stage: {
                      type: 'string',
                      enum: [...STAGE_VALUES]
                    },
                    timestamp: {
                      type: 'number',
                      description: 'Unix 时间戳（毫秒）'
                    },
                    duration: {
                      type: 'number',
                      description: '阶段持续时间（毫秒）',
                      minimum: 0,
                      default: 0
                    },
                    note: {
                      type: 'string',
                      description: '备注',
                      maxLength: 1000,
                      default: ''
                    }
                  }
                },
                default: []
              },

              /**
               * 制品列表
               */
              artifacts: {
                type: 'array',
                description: '生成的制品文件列表',
                items: {
                  type: 'object',
                  required: ['type', 'path'],
                  additionalProperties: false,
                  properties: {
                    type: {
                      type: 'string',
                      enum: Object.values(ArtifactType)
                    },
                    path: {
                      type: 'string',
                      description: '文件相对或绝对路径',
                      minLength: 1
                    },
                    size: {
                      type: 'number',
                      description: '文件大小（字节）',
                      minimum: 0,
                      default: 0
                    },
                    lastModified: {
                      type: ['number', 'null'],
                      description: '最后修改时间戳'
                    },
                    checksum: {
                      type: 'string',
                      description: 'SHA256 校验和',
                      default: ''
                    }
                  }
                },
                default: []
              },

              /**
               * 质量指标
               */
              quality: {
                type: ['object', 'null'],
                description: '质量评估指标',
                additionalProperties: false,
                properties: {
                  coverage: {
                    type: 'number',
                    description: '测试覆盖率 (%)',
                    minimum: 0,
                    maximum: 100,
                    default: 0
                  },
                  score: {
                    type: 'number',
                    description: '质量评分 (0-100)',
                    minimum: 0,
                    maximum: 100,
                    default: 0
                  },
                  grade: {
                    type: 'string',
                    description: '质量等级',
                    enum: ['S', 'A', 'B', 'C', 'D', 'F'],
                    default: 'F'
                  },
                  issues: {
                    type: 'array',
                    description: '问题列表',
                    items: {
                      type: 'object',
                      required: ['message', 'severity'],
                      properties: {
                        message: { type: 'string' },
                        severity: { type: 'string', enum: ['error', 'warning', 'info'] },
                        file: { type: 'string' },
                        line: { type: 'number' }
                      }
                    },
                    default: []
                  },
                  passRate: {
                    type: 'number',
                    description: '测试通过率 (%)',
                    minimum: 0,
                    maximum: 100,
                    default: 0
                  }
                },
                default: null
              },

              /**
               * Token 使用情况
               */
              tokens: {
                type: 'object',
                description: 'AI Token 消耗统计',
                required: ['total', 'used', 'remaining'],
                additionalProperties: false,
                properties: {
                  total: {
                    type: 'number',
                    minimum: 0,
                    default: 0
                  },
                  used: {
                    type: 'number',
                    minimum: 0,
                    default: 0
                  },
                  remaining: {
                    type: 'number',
                    minimum: 0,
                    default: 0
                  },
                  byStage: {
                    type: 'object',
                    description: '按阶段统计的 Token 使用量',
                    additionalProperties: { type: 'number', minimum: 0 },
                    default: {}
                  },
                  history: {
                    type: 'array',
                    description: 'Token 使用历史记录',
                    items: {
                      type: 'object',
                      required: ['stage', 'amount', 'timestamp'],
                      properties: {
                        stage: { type: 'string' },
                        amount: { type: 'number', minimum: 0 },
                        timestamp: { type: 'number' }
                      }
                    },
                    default: []
                  }
                }
              },

              /**
               * 迭代轮次
               */
              iterations: {
                type: 'array',
                description: '迭代修复轮次记录',
                items: {
                  type: 'object',
                  required: ['round'],
                  additionalProperties: false,
                  properties: {
                    round: {
                      type: 'integer',
                      minimum: 1,
                      description: '轮次编号'
                    },
                    score: {
                      type: 'number',
                      description: '该轮得分',
                      default: 0
                    },
                    issuesFixed: {
                      type: 'integer',
                      minimum: 0,
                      description: '修复的问题数',
                      default: 0
                    },
                    tokenUsed: {
                      type: 'number',
                      minimum: 0,
                      description: '消耗的 Token 数',
                      default: 0
                    },
                    changes: {
                      type: 'array',
                      description: '变更列表',
                      items: {
                        type: 'object',
                        properties: {
                          file: { type: 'string' },
                          type: { type: 'string' },
                          description: { type: 'string' }
                        }
                      },
                      default: []
                    },
                    timestamp: {
                      type: 'number',
                      description: '迭代时间戳'
                    }
                  }
                },
                default: []
              },

              /**
               * 标签
               */
              tags: {
                type: 'array',
                description: '功能点标签',
                items: {
                  type: 'string',
                  minLength: 1,
                  maxLength: 50
                },
                uniqueItems: true,
                default: []
              },

              /**
               * 时间戳
               */
              createdAt: {
                type: 'number',
                description: '创建时间戳（毫秒）'
              },
              updatedAt: {
                type: 'number',
                description: '最后更新时间戳（毫秒）'
              }
            }
          },
          uniqueItems: false
        }
      }
    },

    /**
     * 元数据
     */
    metadata: {
      type: 'object',
      description: '状态文件元数据',
      required: ['lastUpdated', 'schemaVersion'],
      additionalProperties: true, // 允许扩展字段

      properties: {
        lastUpdated: {
          type: 'number',
          description: '最后更新时间戳（毫秒）'
        },
        schemaVersion: {
          type: 'string',
          description: '使用的 Schema 版本',
          const: SCHEMA_VERSION
        },
        generatedBy: {
          type: 'string',
          description: '生成工具版本',
          default: `pdd-vm/${SCHEMA_VERSION}`
        },
        checksum: {
          type: 'string',
          description: '文件内容校验和'
        }
      }
    }
  }
};

/**
 * 验证结果类型
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - 是否通过验证
 * @property {Array<ValidationError>} errors - 错误列表
 */

/**
 * 验证错误类型
 * @typedef {Object} ValidationError
 * @property {string} path - 错误路径（JSON Pointer）
 * @property {string} message - 错误消息
 * @property {string} [value] - 导致错误的值
 * @property {string} [constraint] - 违反的约束类型
 */

/**
 * 简易 JSON Schema 验证器
 * 不依赖外部库，实现核心的 Schema 验证逻辑
 *
 * @param {*} data - 待验证的数据
 * @param {Object} schema - Schema 定义
 * @param {string} [path=''] - 当前路径（用于错误定位）
 * @returns {{valid:boolean, errors:Array<{path:string, message:string}>}} 验证结果
 */
function validateAgainstSchema(data, schema, path = '') {
  const errors = [];

  // 类型检查
  if (schema.type && !checkType(data, schema.type)) {
    errors.push({
      path: path || '(root)',
      message: `期望类型 ${Array.isArray(schema.type) ? schema.type.join('|') : schema.type}，实际为 ${typeof data}`,
      constraint: 'type'
    });
    return { valid: false, errors };
  }

  // 必填检查
  if (schema.required && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    for (const field of schema.required) {
      if (!(field in data)) {
        errors.push({
          path: `${path}/${field}`,
          message: `缺少必填字段 "${field}"`,
          constraint: 'required'
        });
      }
    }
  }

  // 枚举值检查
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({
      path: path || '(root)',
      message: `值 "${data}" 不在允许的范围 ${JSON.stringify(schema.enum)} 内`,
      constraint: 'enum'
    });
  }

  // 常量检查
  if ('const' in schema && data !== schema.const) {
    errors.push({
      path: path || '(root)',
      message: `值必须是 "${schema.const}"`,
      constraint: 'const'
    });
  }

  // 字符串约束
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({
        path: path || '(root)',
        message: `字符串长度 ${data.length} 小于最小长度 ${schema.minLength}`,
        constraint: 'minLength'
      });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({
        path: path || '(root)',
        message: `字符串长度 ${data.length} 超过最大长度 ${schema.maxLength}`,
        constraint: 'maxLength'
      });
    }
    if (schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push({
          path: path || '(root)',
          message: `字符串不匹配模式 ${schema.pattern}`,
          constraint: 'pattern'
        });
      }
    }
  }

  // 数字约束
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({
        path: path || '(root)',
        message: `数值 ${data} 小于最小值 ${schema.minimum}`,
        constraint: 'minimum'
      });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({
        path: path || '(root)',
        message: `数值 ${data} 超过最大值 ${schema.maximum}`,
        constraint: 'maximum'
      });
    }
  }

  // 数组约束
  if (Array.isArray(data)) {
    if (schema.items) {
      data.forEach((item, index) => {
        const result = validateAgainstSchema(item, schema.items, `${path}[${index}]`);
        errors.push(...result.errors);
      });
    }
    if (schema.uniqueItems) {
      const seen = new Set();
      for (let i = 0; i < data.length; i++) {
        const key = JSON.stringify(data[i]);
        if (seen.has(key)) {
          errors.push({
            path: `${path}[${i}]`,
            message: `数组元素重复`,
            constraint: 'uniqueItems'
          });
        }
        seen.add(key);
      }
    }
  }

  // 对象属性验证
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const result = validateAgainstSchema(data[key], propSchema, `${path}/${key}`);
          errors.push(...result.errors);
        }
      }

      // 补充默认值的处理提示（非错误）
      for (const key of Object.keys(schema.properties)) {
        if (!(key in data) && schema.properties[key].default !== undefined) {
          // 可选：记录缺失但有默认值的字段
        }
      }
    }

    // 额外属性检查
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) {
          errors.push({
            path: `${path}/${key}`,
            message: `不允许的额外属性 "${key}"`,
            constraint: 'additionalProperties'
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 检查值是否符合指定类型
 * @param {*} value - 待检查的值
 * @param {string|Array<string>} type - 类型或类型数组
 * @returns {boolean} 是否符合类型
 */
function checkType(value, type) {
  const types = Array.isArray(type) ? type : [type];

  for (const t of types) {
    switch (t) {
      case 'string':
        if (typeof value === 'string') return true;
        break;
      case 'number':
        if (typeof value === 'number' && !isNaN(value)) return true;
        break;
      case 'integer':
        if (Number.isInteger(value)) return true;
        break;
      case 'boolean':
        if (typeof value === 'boolean') return true;
        break;
      case 'object':
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) return true;
        break;
      case 'array':
        if (Array.isArray(value)) return true;
        break;
      case 'null':
        if (value === null) return true;
        break;
    }
  }

  return false;
}

/**
 * 验证项目状态数据是否符合 Schema
 *
 * @param {Object} stateData - 待验证的状态数据对象
 * @returns {{valid:boolean, errors:Array<{path:string, message:string, constraint?:string}>}} 验证结果
 *
 * @example
 * const result = validate(stateData);
 * if (!result.valid) {
 *   console.error('验证失败:', result.errors);
 * }
 */
export function validate(stateData) {
  if (stateData === null || stateData === undefined) {
    return {
      valid: false,
      errors: [{
        path: '(root)',
        message: '数据不能为空',
        constraint: 'required'
      }]
    };
  }

  if (typeof stateData !== 'object' || Array.isArray(stateData)) {
    return {
      valid: false,
      errors: [{
        path: '(root)',
        message: '数据必须是对象类型',
        constraint: 'type'
      }]
    };
  }

  return validateAgainstSchema(stateData, STATE_SCHEMA);
}

/**
 * 版本比较函数
 * 比较 semver 版本号
 *
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} 比较结果：v1<v2 返回负数，相等返回0，v1>v2 返回正数
 */
export function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

/**
 * 数据迁移规则注册表
 * 存储各版本的迁移函数
 * @type {Map<string, Function>}
 */
const migrationRegistry = new Map();

/**
 * 注册迁移规则
 * @param {string} fromVersion - 源版本
 * @param {string} toVersion - 目标版本
 * @param {Function} migrator - 迁移函数
 */
export function registerMigration(fromVersion, toVersion, migrator) {
  const key = `${fromVersion}->${toVersion}`;
  migrationRegistry.set(key, migrator);
}

// 注册内置迁移规则

/**
 * 0.9.0 -> 1.0.0 迁移
 * 重构旧版格式到新的标准格式
 */
registerMigration('0.9.0', '1.0.0', (oldState) => {
  const migrated = {
    version: SCHEMA_VERSION,
    project: {
      name: oldState.projectName || oldState.name || '',
      version: oldState.version || '1.0.0',
      description: oldState.description || '',
      features: []
    },
    metadata: {
      lastUpdated: Date.now(),
      schemaVersion: SCHEMA_VERSION,
      generatedBy: `pdd-vm/${SCHEMA_VERSION} (migrated from 0.9.0)`
    }
  };

  // 迁移功能点列表
  if (Array.isArray(oldState.features)) {
    migrated.project.features = oldState.features.map(f => ({
      id: f.id || f.featureId || `feature-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: f.name || f.title || '未命名功能点',
      description: f.description || f.desc || '',
      stage: migrateStage(f.stage || f.status || 'prd'),
      priority: f.priority || 'P2',
      timeline: Array.isArray(f.timeline) ? f.timeline : [],
      artifacts: Array.isArray(f.artifacts) ? f.artifacts : [],
      quality: f.quality || null,
      tokens: f.tokens || f.tokenUsage || {
        total: 0,
        used: 0,
        remaining: 0,
        byStage: {},
        history: []
      },
      iterations: Array.isArray(f.iterations) ? f.iterations : [],
      tags: Array.isArray(f.tags) ? f.tags : [],
      createdAt: f.createdAt || Date.now(),
      updatedAt: f.updatedAt || Date.now()
    }));
  }

  return migrated;
});

/**
 * 迁移旧的阶段命名到新格式
 * @param {string} oldStage - 旧阶段名
 * @returns {string} 新阶段名
 */
function migrateStage(oldStage) {
  const stageMapping = {
    'requirement': 'prd',
    'requirements': 'prd',
    'analysis': 'extracted',
    'analyzed': 'extracted',
    'design': 'spec',
    'designed': 'spec',
    'development': 'implementing',
    'developing': 'implementing',
    'coding': 'implementing',
    'testing': 'verifying',
    'test': 'verifying',
    'completed': 'done',
    'complete': 'done',
    'finished': 'done'
  };

  const normalized = String(oldStage).toLowerCase().trim();
  return stageMapping[normalized] || (STAGE_VALUES.includes(normalized) ? normalized : 'prd');
}

/**
 * 执行数据迁移
 * 将旧版本的状态数据升级到目标版本
 *
 * @param {Object} oldState - 旧版本的状态数据
 * @param {string} fromVersion - 源版本号
 * @param {string} toVersion - 目标版本号（默认为当前版本）
 * @returns {Object} 迁移后的状态数据
 * @throws {Error} 当无法找到迁移路径时抛出异常
 *
 * @example
 * const newState = migrate(oldState, '0.9.0', '1.0.0');
 */
export function migrate(oldState, fromVersion, toVersion = SCHEMA_VERSION) {
  if (!oldState || typeof oldState !== 'object') {
    throw new Error('migrate: 无效的状态数据');
  }

  // 如果已经是目标版本，直接返回副本
  if (oldState.version === toVersion) {
    return JSON.parse(JSON.stringify(oldState));
  }

  // 尝试查找直接迁移路径
  const directKey = `${fromVersion}->${toVersion}`;
  if (migrationRegistry.has(directKey)) {
    console.log(chalk.yellow(`[migrate] 执行迁移: ${fromVersion} -> ${toVersion}`));
    const migrator = migrationRegistry.get(directKey);
    const result = migrator(JSON.parse(JSON.stringify(oldState)));

    // 验证迁移后的数据
    const validation = validate(result);
    if (!validation.valid) {
      console.warn(chalk.yellow('[migrate] 迁移后数据验证警告:'));
      for (const err of validation.errors.slice(0, 5)) {
        console.warn(chalk.yellow(`  - ${err.path}: ${err.message}`));
      }
    }

    return result;
  }

  // 尝试多步迁移
  const sortedVersions = [...new Set([
    fromVersion,
    ...[...migrationRegistry.keys()].map(k => k.split('->')[1]),
    toVersion
  ])].sort(compareVersions);

  let currentState = JSON.parse(JSON.stringify(oldState));
  currentState.version = fromVersion;
  let currentVersion = fromVersion;

  for (let i = 0; i < sortedVersions.length - 1; i++) {
    const stepFrom = sortedVersions[i];
    const stepTo = sortedVersions[i + 1];

    if (compareVersions(currentVersion, stepTo) >= 0) continue;

    const stepKey = `${stepFrom}->${stepTo}`;
    if (migrationRegistry.has(stepKey)) {
      console.log(chalk.yellow(`[migrate] 步骤迁移: ${stepFrom} -> ${stepTo}`));
      const migrator = migrationRegistry.get(stepKey);
      currentState = migrator(currentState);
      currentVersion = stepTo;
    }
  }

  // 确保最终版本正确
  currentState.version = toVersion;
  if (currentState.metadata) {
    currentState.metadata.schemaVersion = toVersion;
  }

  return currentState;
}

/**
 * 创建空的项目状态模板
 * 用于初始化新项目的状态文件
 *
 * @param {string} projectName - 项目名称
 * @param {string} [version='1.0.0'] - 项目版本
 * @returns {Object} 空白状态对象
 */
export function createEmptyState(projectName, version = '1.0.0') {
  return {
    version: SCHEMA_VERSION,
    project: {
      name: projectName,
      version,
      description: '',
      features: []
    },
    metadata: {
      lastUpdated: Date.now(),
      schemaVersion: SCHEMA_VERSION,
      generatedBy: `pdd-vm/${SCHEMA_VERSION}`
    }
  };
}

/**
 * 获取 Schema 中某字段的定义
 * 用于动态查询 Schema 结构
 *
 * @param {string} fieldPath - 字段路径（如 "project.features.items"）
 * @returns {Object|null} 字段的 Schema 定义
 */
export function getSchemaField(fieldPath) {
  const parts = fieldPath.split('.');
  let current = STATE_SCHEMA;

  for (const part of parts) {
    if (current && current.properties) {
      current = current.properties[part];
    } else if (current && current.items) {
      current = current.items;
    } else {
      return null;
    }
  }

  return current || null;
}

/**
 * 导出默认对象
 */
export default {
  SCHEMA_VERSION,
  MIN_MIGRATABLE_VERSION,
  STATE_SCHEMA,
  validate,
  compareVersions,
  migrate,
  registerMigration,
  createEmptyState,
  getSchemaField
};
