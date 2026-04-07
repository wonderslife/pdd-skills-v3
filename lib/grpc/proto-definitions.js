/**
 * PDD gRPC Proto Definitions
 * Protocol Buffer 类型定义和编解码器（proto3 JSON mapping）
 *
 * 本模块实现轻量级的 Protocol Buffer 支持，无需外部依赖。
 * 遵循 proto3 JSON Mapping 规范：
 * https://protobuf.dev/programming-guides/proto3/#json
 *
 * 支持的字段类型:
 * - 标量类型: string, int32, int64, bool, float, double, bytes
 * - 复合类型: message, enum
 * - 容器类型: repeated (数组), map (键值对)
 *
 * @module lib/grpc/proto-definitions
 * @author PDD-Skills Team
 * @version 3.0.0
 */

// ==================== gRPC 状态码定义 ====================

/**
 * gRPC 标准状态码
 * 参考: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
export const GrpcStatus = {
  /** OK - 操作成功完成 */
  OK: 0,
  /** CANCELLED - 操作被调用方取消 */
  CANCELLED: 1,
  /** UNKNOWN - 未知错误 */
  UNKNOWN: 2,
  /** INVALID_ARGUMENT - 客户端指定了无效参数 */
  INVALID_ARGUMENT: 3,
  /** DEADLINE_EXCEEDED - 截止时间在操作完成前已过 */
  DEADLINE_EXCEEDED: 4,
  /** NOT_FOUND - 未找到请求的实体 */
  NOT_FOUND: 5,
  /** ALREADY_EXISTS - 尝试创建的实体已存在 */
  ALREADY_EXISTS: 6,
  /** PERMISSION_DENIED - 调用方没有权限执行指定操作 */
  PERMISSION_DENIED: 7,
  /** RESOURCE_EXHAUSTED - 资源已耗尽（如配额不足） */
  RESOURCE_EXHAUSTED: 8,
  /** FAILED_PRECONDITION - 系统未处于操作执行所需的状态 */
  FAILED_PRECONDITION: 9,
  /** ABORTED - 操作被中止 */
  ABORTED: 10,
  /** OUT_OF_RANGE - 操作尝试超出有效范围 */
  OUT_OF_RANGE: 11,
  /** UNIMPLEMENTED - 操作未实现或不支持/启用 */
  UNIMPLEMENTED: 12,
  /** INTERNAL - 内部错误 */
  INTERNAL: 13,
  /** UNAVAILABLE - 服务当前不可用 */
  UNAVAILABLE: 14,
  /** DATA_LOSS - 不可恢复的数据丢失或损坏 */
  DATA_LOSS: 15,
  /** UNAUTHENTICATED - 请求没有有效的身份验证凭据 */
  UNAUTHENTICATED: 16
};

/**
 * 状态码到描述信息的映射
 */
export const StatusMessages = {
  [GrpcStatus.OK]: 'OK',
  [GrpcStatus.CANCELLED]: 'Cancelled',
  [GrpcStatus.UNKNOWN]: 'Unknown error',
  [GrpcStatus.INVALID_ARGUMENT]: 'Invalid argument',
  [GrpcStatus.DEADLINE_EXCEEDED]: 'Deadline exceeded',
  [GrpcStatus.NOT_FOUND]: 'Not found',
  [GrpcStatus.ALREADY_EXISTS]: 'Already exists',
  [GrpcStatus.PERMISSION_DENIED]: 'Permission denied',
  [GrpcStatus.RESOURCE_EXHAUSTED]: 'Resource exhausted',
  [GrpcStatus.FAILED_PRECONDITION]: 'Failed precondition',
  [GrpcStatus.ABORTED]: 'Aborted',
  [GrpcStatus.OUT_OF_RANGE]: 'Out of range',
  [GrpcStatus.UNIMPLEMENTED]: 'Unimplemented',
  [GrpcStatus.INTERNAL]: 'Internal error',
  [GrpcStatus.UNAVAILABLE]: 'Unavailable',
  [GrpcStatus.DATA_LOSS]: 'Data loss',
  [GrpcStatus.UNAUTHENTICATED]: 'Unauthenticated'
};

// ==================== Proto3 默认值表 ====================

/**
 * Proto3 各类型的默认值
 * @private
 */
const DEFAULT_VALUES = {
  string: '',
  int32: 0,
  int64: '0',        // JSON 中 int64 使用字符串表示
  uint32: 0,
  uint64: '0',
  sint32: 0,
  sint64: '0',
  bool: false,
  float: 0.0,
  double: 0.0,
  bytes: '',         // Base64 编码字符串
  enum: 0,           // 枚举默认值为第一个值（数值 0）
  message: null      // 消息默认值为 null
};

// ==================== Schema 定义工具函数 ====================

/**
 * 创建字段 Schema
 * @param {string} type - 字段类型
 * @param {number} fieldNumber - 字段编号（proto 规范要求）
 * @param {Object} options - 可选配置
 * @returns {Object} 字段 Schema 对象
 * @private
 */
function field(type, fieldNumber, options = {}) {
  return {
    type,
    fieldNumber,
    repeated: options.repeated || false,
    mapKey: options.mapKey || null,
    mapValue: options.mapValue || null,
    required: options.required || false,
    defaultValue: options.defaultValue !== undefined ? options.defaultValue : DEFAULT_VALUES[type]
  };
}

/**
 * 创建枚举 Schema
 * @param {string} name - 枚举名称
 * @param {Object} values - 枚举值映射 { NAME: number }
 * @returns {Object} 枚举 Schema
 * @private
 */
function enumSchema(name, values) {
  return {
    kind: 'enum',
    name,
    values,
    // 确保存在值为 0 的枚举项（proto3 要求）
    defaultName: Object.entries(values).find(([, v]) => v === 0)?.[name] ||
                 Object.keys(values)[0]
  };
}

/**
 * 创建消息 Schema
 * @param {string} name - 消息名称
 * @param {Object} fields - 字段定义 { fieldName: fieldSchema }
 * @returns {Object} 消息 Schema
 * @private
 */
function messageSchema(name, fields) {
  return {
    kind: 'message',
    name,
    fields
  };
}

// ==================== PDD gRPC Service Schema 定义 ====================

/**
 * SpecService 相关 Schema
 */
export const SpecSchemas = {
  /**
   * GenerateSpec 请求消息
   * 用于基于 PRD 生成开发规格文档
   */
  SpecRequest: messageSchema('SpecRequest', {
    prdPath: field('string', 1),
    outputDir: field('string', 2),
    template: field('string', 3),
    featureId: field('string', 4),
    options: field('message', 5, { mapValue: 'string' })
  }),

  /**
   * GetSpec 请求消息
   * 获取已生成的规格文档
   */
  GetSpecRequest: messageSchema('GetSpecRequest', {
    specId: field('string', 1),
    specPath: field('string', 2)
  }),

  /**
   * ListSpecs 请求消息
   * 列出所有规格文档
   */
  ListSpecsRequest: messageSchema('ListSpecsRequest', {
    pageToken: field('string', 1),
    pageSize: field('int32', 2),
    filter: field('message', 3)
  }),

  /**
   * Spec 响应消息（通用）
   */
  SpecResponse: messageSchema('SpecResponse', {
    success: field('bool', 1),
    specId: field('string', 2),
    specPath: field('string', 3),
    content: field('string', 4),
    featuresCount: field('int32', 5),
    generatedAt: field('string', 6),     // RFC3339 格式时间戳
    metadata: field('message', 7, { mapValue: 'string' })
  }),

  /**
   * ListSpecs 响应消息
   */
  ListSpecsResponse: messageSchema('ListSpecsResponse', {
    specs: field('message', 1, { repeated: true }),
    nextPageToken: field('string', 2),
    totalSize: field('int32', 3)
  }),

  /**
   * 过滤条件消息
   */
  SpecFilter: messageSchema('SpecFilter', {
    status: field('string', 1),
    featureId: field('string', 2),
    dateFrom: field('string', 3),
    dateTo: field('string', 4)
  })
};

/**
 * CodeService 相关 Schema
 */
export const CodeSchemas = {
  /**
   * GenerateCode 请求消息
   */
  CodeRequest: messageSchema('CodeRequest', {
    specPath: field('string', 1),
    outputDir: field('string', 2),
    feature: field('string', 3),           // 可选：只生成特定功能
    dryRun: field('bool', 4),              // 预览模式
    overwrite: field('bool', 5),           // 是否覆盖已有文件
    language: field('string', 6),          // 目标语言
    framework: field('string', 7)          // 目标框架
  }),

  /**
   * Code 响应消息
   */
  CodeResponse: messageSchema('CodeResponse', {
    success: field('bool', 1),
    outputDir: field('string', 2),
    generatedFiles: field('message', 3, { repeated: true }),
    featuresProcessed: field('int32', 4),
    dryRun: field('bool', 5),
    generatedAt: field('string', 6),
    errors: field('message', 7, { repeated: true }),
    warnings: field('message', 8, { repeated: true })
  }),

  /**
   * 生成的文件信息
   */
  GeneratedFile: messageSchema('GeneratedFile', {
    path: field('string', 1),
    size: field('int64', 2),
    language: field('string', 3),
    lines: field('int32', 4)
  }),

  /**
   * 错误信息
   */
  ErrorInfo: messageSchema('ErrorInfo', {
    code: field('string', 1),
    message: field('string', 2),
    file: field('string', 3),
    line: field('int32', 4)
  })
};

/**
 * VerifyService 相关 Schema
 */
export const VerifySchemas = {
  /**
   * VerifyFeature 请求消息
   */
  VerifyRequest: messageSchema('VerifyRequest', {
    specPath: field('string', 1),
    codePath: field('string', 2),
    verbose: field('bool', 3),
    dimensions: field('string', 4, { repeated: true })  // 验证维度列表
  }),

  /**
   * Verify 响应消息
   */
  VerifyResponse: messageSchema('VerifyResponse', {
    success: field('bool', 1),
    passed: field('bool', 2),
    score: field('float', 3),            // 总体评分 0-100
    verifiedAt: field('string', 4),
    results: field('message', 5, { repeated: true }),
    summary: field('message', 6)
  }),

  /**
   * 单个维度的验证结果
   */
  DimensionResult: messageSchema('DimensionResult', {
    dimension: field('string', 1),
    passed: field('bool', 2),
    score: field('float', 3),
    details: field('string', 4),
    issues: field('message', 5, { repeated: true })
  }),

  /**
   * 验证摘要
   */
  VerifySummary: messageSchema('VerifySummary', {
    totalDimensions: field('int32', 1),
    passedDimensions: field('int32', 2),
    totalIssues: field('int32', 3),
    criticalIssues: field('int32', 4),
    passRate: field('float', 5)
  })
};

/**
 * ReportService 相关 Schema
 */
export const ReportSchemas = {
  /**
   * GenerateReport 请求消息
   */
  ReportRequest: messageSchema('ReportRequest', {
    type: field('string', 1),             // 输出格式: md, json, html, pdf
    outputPath: field('string', 2),
    includeStats: field('bool', 3),
    includeCharts: field('bool', 4),
    projectDir: field('string', 5)
  }),

  /**
   * Report 响应消息
   */
  ReportResponse: messageSchema('ReportResponse', {
    success: field('bool', 1),
    reportPath: field('string', 2),
    format: field('string', 3),
    generatedAt: field('string', 4),
    preview: field('message', 5),
    stats: field('message', 6)
  }),

  /**
   * 报告预览摘要
   */
  ReportPreview: messageSchema('ReportPreview', {
    totalFiles: field('int32', 1),
    skillsCount: field('int32', 2),
    specsCount: field('int32', 3),
    testsCount: field('int32', 4),
    codeLines: field('int64', 5)
  }),

  /**
   * 项目统计信息
   */
  ProjectStats: messageSchema('ProjectStats', {
    name: field('string', 1),
    version: field('string', 2),
    fileTypes: field('message', 3, { mapValue: 'int32' }),
    quickCounts: field('message', 4, { mapValue: 'int32' })
  })
};

/**
 * SkillService 相关 Schema
 */
export const SkillSchemas = {
  /**
   * ListSkills 请求消息
   */
  ListSkillsRequest: messageSchema('ListSkillsRequest', {
    category: field('string', 1),          // 可选过滤分类
    pageToken: field('string', 2),
    pageSize: field('int32', 3)
  }),

  /**
   * GetSkillInfo 请求消息
   */
  GetSkillInfoRequest: messageSchema('GetSkillInfoRequest', {
    category: field('string', 1),
    name: field('string', 2)
  }),

  /**
   * ListSkills 响应消息
   */
  ListSkillsResponse: messageSchema('ListSkillsResponse', {
    skills: field('message', 1, { repeated: true }),
    nextPageToken: field('string', 2),
    totalSize: field('int32', 3)
  }),

  /**
   * Skill 信息响应
   */
  SkillInfoResponse: messageSchema('SkillInfoResponse', {
    name: field('string', 1),
    category: field('string', 2),
    title: field('string', 3),
    description: field('string', 4),
    path: field('string', 5),
    triggers: field('string', 6, { repeated: true }),
    contentLength: field('int32', 7),
    lastModified: field('string', 8)
  }),

  /**
   * Skill 条目（用于列表）
   */
  SkillEntry: messageSchema('SkillEntry', {
    name: field('string', 1),
    category: field('string', 2),
    path: field('string', 3)
  })
};

/**
 * Health Check Service Schema（gRPC 标准健康检查协议）
 */
export const HealthSchemas = {
  /**
   * HealthCheck 请求
   */
  HealthCheckRequest: messageSchema('HealthCheckRequest', {
    service: field('string', 1)            // 要检查的服务名
  }),

  /**
   * HealthCheck 响应
   */
  HealthCheckResponse: messageSchema('HealthCheckResponse', {
    status: field('enum', 1)               // ServingStatus 枚举值
  }),

  /**
   * ServingStatus 枚举
   */
  ServingStatus: enumSchema('ServingStatus', {
    UNKNOWN: 0,
    SERVING: 1,
    NOT_SERVING: 2,
    SERVICE_UNKNOWN: 3  // 仅用于 Watch 的响应
  })
};

/**
 * 通用错误响应 Schema
 */
export const CommonSchemas = {
  /**
   * Google RPC Status 消息（标准错误响应格式）
   */
  GoogleRpcStatus: messageSchema('GoogleRpcStatus', {
    code: field('int32', 1),
    message: field('string', 2),
    details: field('message', 3, { repeated: true })
  }),

  /**
   * Any 类型包装器（用于 details 字段）
   */
  Any: messageSchema('Any', {
    typeUrl: field('string', 1),
    value: field('string', 2)              // Base64 编码
  }),

  /**
   * 空消息（用于无参数 RPC）
   */
  Empty: messageSchema('Empty', {})
};

// ==================== 所有 Schema 注册表 ====================

/**
 * 全局 Schema 注册表
 * 将消息名称映射到其 Schema 定义
 */
export const SchemaRegistry = {
  ...SpecSchemas,
  ...CodeSchemas,
  ...VerifySchemas,
  ...ReportSchemas,
  ...SkillSchemas,
  ...HealthSchemas,
  ...CommonSchemas
};

// ==================== 编解码器核心实现 ====================

/**
 * 将 JavaScript 对象编码为 proto3 JSON 格式
 *
 * 编码规则（遵循 proto3 JSON Mapping）:
 * - null/undefined 值不输出（使用默认值）
 * - int64 类型输出为字符串
 * - enum 输出为名称字符串或数字
 * - bytes 输出为 base64 字符串
 * - 忽略未知字段
 *
 * @param {Object} data - 要编码的数据对象
 * @param {Object} schema - 消息 Schema 定义
 * @returns {Object} 编码后的 JSON 兼容对象
 * @example
 * encode({ prdPath: './prd.md' }, SpecSchemas.SpecRequest)
 * // => { prdPath: './prd.md' }
 */
export function encode(data, schema) {
  if (!schema || schema.kind !== 'message') {
    throw new Error(`Invalid schema: expected message schema, got ${schema?.kind}`);
  }

  if (!data || typeof data !== 'object') {
    return {};
  }

  const result = {};
  const { fields } = schema;

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = data[fieldName];

    // 跳过 undefined 和 null（proto3 默认行为）
    if (value === undefined || value === null) {
      continue;
    }

    // 处理各类型
    if (fieldDef.repeated) {
      // repeated 字段
      if (Array.isArray(value) && value.length > 0) {
        result[fieldName] = value.map(item => _encodeFieldValue(item, fieldDef));
      }
      // 空数组不输出
    } else if (fieldDef.mapValue !== null && !fieldDef.repeated) {
      // map 字段
      if (value && typeof value === 'object') {
        result[fieldName] = {};
        for (const [k, v] of Object.entries(value)) {
          result[fieldName][k] = _encodeFieldValue(v, {
            type: fieldDef.mapValue
          });
        }
      }
    } else {
      // 标量或消息字段
      const encoded = _encodeFieldValue(value, fieldDef);
      // 只有非默认值才输出（可选优化）
      result[fieldName] = encoded;
    }
  }

  return result;
}

/**
 * 编码单个字段值
 * @private
 */
function _encodeFieldValue(value, fieldDef) {
  switch (fieldDef.type) {
    case 'int64':
    case 'uint64':
    case 'sint64':
      // int64 在 JSON 中必须表示为字符串
      return String(value);

    case 'bytes':
      // bytes 在 JSON 中表示为 base64 字符串
      if (typeof value === 'string') {
        return value; // 假设已经是 base64
      }
      return Buffer.from(value).toString('base64');

    case 'bool':
      return Boolean(value);

    case 'float':
    case 'double':
      return Number(value);

    case 'message':
      // 嵌套消息需要递归编码
      if (value === null || value === undefined) {
        return null;
      }
      // 查找嵌套消息的 schema
      const nestedSchema = SchemaRegistry[value.__schema] || findSchemaByContext(fieldDef);
      if (nestedSchema) {
        return encode(value, nestedSchema);
      }
      // 无法确定 schema 时直接返回
      return value;

    case 'enum':
      // enum 可以是数字或字符串名称
      return value;

    default:
      // string, int32, uint32, sint32 等
      return value;
  }
}

/**
 * 从 proto3 JSON 格式解码为 JavaScript 对象
 *
 * 解码规则:
 * - 缺失字段填充默认值
 * - int64 字符串保持为字符串
 * - 未知字段保留（可选）
 *
 * @param {Object|string} json - JSON 对象或 JSON 字符串
 * @param {Object} schema - 消息 Schema 定义
 * @returns {Object} 解码后的 JavaScript 对象
 * @example
 * decode('{ "prdPath": "./prd.md" }', SpecSchemas.SpecRequest)
 * // => { prdPath: './prd.md', outputDir: '', template: '', ... }
 */
export function decode(json, schema) {
  if (!schema || schema.kind !== 'message') {
    throw new Error(`Invalid schema: expected message schema, got ${schema?.kind}`);
  }

  // 如果传入的是字符串，先解析为对象
  let data = json;
  if (typeof json === 'string') {
    try {
      data = JSON.parse(json);
    } catch (e) {
      throw new Error(`Invalid JSON: ${e.message}`);
    }
  }

  // 确保 data 是对象
  if (!data || typeof data !== 'object') {
    data = {};
  }

  const result = {};
  const { fields } = schema;

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = data[fieldName];

    if (fieldDef.repeated) {
      // repeated 字段：缺失时为空数组
      if (Array.isArray(value)) {
        result[fieldName] = value.map(item =>
          _decodeFieldValue(item, fieldDef)
        );
      } else {
        result[fieldName] = [];
      }
    } else if (fieldDef.mapValue !== null && !fieldDef.repeated) {
      // map 字段：缺失时为空对象
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const mapResult = {};
        for (const [k, v] of Object.entries(value)) {
          mapResult[k] = _decodeFieldValue(v, {
            type: fieldDef.mapValue
          });
        }
        result[fieldName] = mapResult;
      } else {
        result[fieldName] = {};
      }
    } else {
      // 标量或消息字段：缺失时使用默认值
      if (value === undefined || value === null) {
        result[fieldName] = _getDefaultValue(fieldDef.type);
      } else {
        result[fieldName] = _decodeFieldValue(value, fieldDef);
      }
    }
  }

  return result;
}

/**
 * 解码单个字段值
 * @private
 */
function _decodeFieldValue(value, fieldDef) {
  if (value === null || value === undefined) {
    return _getDefaultValue(fieldDef.type);
  }

  switch (fieldDef.type) {
    case 'int32':
    case 'uint32':
    case 'sint32':
      return parseInt(value, 10) || 0;

    case 'int64':
    case 'uint64':
    case 'sint64':
      // 保持为字符串以避免精度丢失
      return String(value);

    case 'float':
    case 'double':
      return parseFloat(value) || 0.0;

    case 'bool':
      // 接受 "true"/"false" 字符串和布尔值
      if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
      }
      return Boolean(value);

    case 'bytes':
      // 返回 base64 字符串（实际解码由使用者决定）
      return String(value);

    case 'message':
      // 嵌套消息递归解码
      if (typeof value === 'object' && value !== null) {
        const nestedSchema = findSchemaByContext(fieldDef);
        if (nestedSchema) {
          return decode(value, nestedSchema);
        }
      }
      return value;

    case 'enum':
      // enum 可以是数字或字符串
      if (typeof value === 'string') {
        const num = parseInt(value, 10);
        if (!isNaN(num)) return num;
        return value; // 保持为字符串名称
      }
      return parseInt(value, 10) || 0;

    default:
      // string 和其他类型
      return String(value);
  }
}

/**
 * 获取类型的默认值
 * @private
 */
function _getDefaultValue(type) {
  if (type in DEFAULT_VALUES) {
    return DEFAULT_VALUES[type];
  }
  return null; // 未知类型返回 null
}

/**
 * 根据上下文查找嵌套消息的 Schema
 * 这是一个简化的实现，实际场景中可能需要更复杂的查找逻辑
 * @private
 */
function findSchemaByContext(fieldDef) {
  // 这里可以通过字段命名约定或其他方式推断 schema
  // 当前简化实现：返回 null 让调用者处理
  return null;
}

// ==================== 验证器 ====================

/**
 * 验证消息是否符合 Schema 定义
 *
 * @param {Object} data - 要验证的数据
 * @param {Object} schema - 消息 Schema 定义
 * @returns {{ valid: boolean, errors: Array<string> }} 验证结果
 * @example
 * validate({ prdPath: './prd.md' }, SpecSchemas.SpecRequest)
 * // => { valid: true, errors: [] }
 */
export function validate(data, schema) {
  const errors = [];

  if (!schema || schema.kind !== 'message') {
    return { valid: false, errors: ['Invalid schema definition'] };
  }

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data must be an object'] };
  }

  _validateMessage(data, schema.fields, '', errors);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 递归验证消息字段
 * @private
 */
function _validateMessage(data, fields, prefix, errors) {
  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const value = data[fieldName];
    const fullPath = prefix ? `${prefix}.${fieldName}` : fieldName;

    // 检查必填字段
    if (fieldDef.required && (value === undefined || value === null)) {
      errors.push(`${fullPath}: Required field is missing`);
      continue;
    }

    // 跳过可选且缺失的字段
    if (value === undefined || value === null) {
      if (fieldDef.repeated) {
        // repeated 字段的 null 应该视为空数组，但这里报错
        errors.push(`${fullPath}: Expected array, got null`);
      }
      continue;
    }

    // 类型检查
    if (fieldDef.repeated) {
      if (!Array.isArray(value)) {
        errors.push(`${fullPath}: Expected array, got ${typeof value}`);
        continue;
      }
      // 验证数组元素
      value.forEach((item, index) => {
        _validateFieldItem(item, fieldDef, `${fullPath}[${index}]`, errors);
      });
    } else if (fieldDef.mapValue !== null) {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${fullPath}: Expected object, got ${typeof value}`);
        continue;
      }
      // 验证 map 值
      for (const [k, v] of Object.entries(value)) {
        _validateFieldItem(v, { type: fieldDef.mapValue }, `${fullPath}.${k}`, errors);
      }
    } else {
      _validateFieldItem(value, fieldDef, fullPath, errors);
    }
  }
}

/**
 * 验证单个字段值的类型
 * @private
 */
function _validateFieldItem(value, fieldDef, path, errors) {
  const { type } = fieldDef;

  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${path}: Expected string, got ${typeof value}`);
      }
      break;

    case 'int32':
    case 'uint32':
    case 'sint32':
    case 'int64':
    case 'uint64':
    case 'sint64':
      if (typeof value !== 'number' && typeof value !== 'string') {
        errors.push(`${path}: Expected integer, got ${typeof value}`);
      } else if (typeof value === 'number' && !Number.isInteger(value)) {
        errors.push(`${path}: Expected integer, got float`);
      }
      break;

    case 'bool':
      if (typeof value !== 'boolean') {
        errors.push(`${path}: Expected boolean, got ${typeof value}`);
      }
      break;

    case 'float':
    case 'double':
      if (typeof value !== 'number') {
        errors.push(`${path}: Expected number, got ${typeof value}`);
      }
      break;

    case 'message':
      if (value !== null && typeof value !== 'object') {
        errors.push(`${path}: Expected object, got ${typeof value}`);
      }
      // 递归验证嵌套消息（如果有 schema）
      const nestedSchema = SchemaRegistry[type] || findSchemaForType(type);
      if (nestedSchema && value !== null) {
        _validateMessage(value, nestedSchema.fields, path, errors);
      }
      break;

    case 'enum':
      // enum 可以是数字或字符串
      if (typeof value !== 'number' && typeof value !== 'string') {
        errors.push(`${path}: Expected enum (number or string), got ${typeof value}`);
      }
      break;

    default:
      // 未知类型跳过验证
      break;
  }
}

/**
 * 根据类型名查找 Schema
 * @private
 */
function findSchemaForType(typeName) {
  // 尝试从注册表中查找
  // 这里的 typeName 可能是引用其他消息类型的名称
  return SchemaRegistry[typeName] || null;
}

// ==================== 导出汇总 ====================

/**
 * 所有可用的 gRPC Service 及其方法定义
 * 用于服务注册和反射
 */
export const ServiceDefinitions = {
  SpecService: {
    name: 'pdd.SpecService',
    methods: {
      GenerateSpec: {
        requestType: 'SpecRequest',
        responseType: 'SpecResponse',
        requestStream: false,
        responseStream: false
      },
      GetSpec: {
        requestType: 'GetSpecRequest',
        responseType: 'SpecResponse',
        requestStream: false,
        responseStream: false
      },
      ListSpecs: {
        requestType: 'ListSpecsRequest',
        responseType: 'ListSpecsResponse',
        requestStream: false,
        responseStream: false
      }
    }
  },

  CodeService: {
    name: 'pdd.CodeService',
    methods: {
      GenerateCode: {
        requestType: 'CodeRequest',
        responseType: 'CodeResponse',
        requestStream: false,
        responseStream: false
      }
    }
  },

  VerifyService: {
    name: 'pdd.VerifyService',
    methods: {
      VerifyFeature: {
        requestType: 'VerifyRequest',
        responseType: 'VerifyResponse',
        requestStream: false,
        responseStream: false
      }
    }
  },

  ReportService: {
    name: 'pdd.ReportService',
    methods: {
      GenerateReport: {
        requestType: 'ReportRequest',
        responseType: 'ReportResponse',
        requestStream: false,
        responseStream: false
      }
    }
  },

  SkillService: {
    name: 'pdd.SkillService',
    methods: {
      ListSkills: {
        requestType: 'ListSkillsRequest',
        responseType: 'ListSkillsResponse',
        requestStream: false,
        responseStream: false
      },
      GetSkillInfo: {
        requestType: 'GetSkillInfoRequest',
        responseType: 'SkillInfoResponse',
        requestStream: false,
        responseStream: false
      }
    }
  },

  HealthService: {
    name: 'grpc.health.v1.Health',
    methods: {
      Check: {
        requestType: 'HealthCheckRequest',
        responseType: 'HealthCheckResponse',
        requestStream: false,
        responseStream: false
      }
    }
  }
};
