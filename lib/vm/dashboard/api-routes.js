/**
 * PDD Visual Manager - REST API Routes (VM-B003)
 *
 * Dashboard 的 RESTful API 路由处理函数集合
 * 提供项目数据、功能点、质量矩阵等数据的查询接口
 *
 * @module vm/dashboard/api-routes
 */

import { URL } from 'url';

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
    red: (s) => s
  };
}

// ============================================================
// 路由表定义
// ============================================================

/**
 * 路由配置表
 * 每个路由包含：method, pattern, handler
 */
const ROUTES = [
  // 项目信息
  {
    method: 'GET',
    pattern: /^\/api\/project$/,
    handler: getProject
  },
  // 功能点列表
  {
    method: 'GET',
    pattern: /^\/api\/features$/,
    handler: getFeatures
  },
  // 功能点详情
  {
    method: 'GET',
    pattern: /^\/api\/feature\/(.+)$/,
    handler: getFeatureDetail
  },
  // 项目摘要
  {
    method: 'GET',
    pattern: /^\/api\/summary$/,
    handler: getSummary
  },
  // 质量矩阵
  {
    method: 'GET',
    pattern: /^\/api\/quality$/,
    handler: getQualityMatrix
  },
  // Token 统计
  {
    method: 'GET',
    pattern: /^\/api\/tokens$/,
    handler: getTokenStats
  },
  // 缓存统计
  {
    method: 'GET',
    pattern: /^\/api\/cache$/,
    handler: getCacheStats
  },
  // 迭代列表
  {
    method: 'GET',
    pattern: /^\/api\/iterations$/,
    handler: getIterationList
  },
  // 系统健康状态
  {
    method: 'GET',
    pattern: /^\/api\/system$/,
    handler: getSystemHealth
  },
  // 数据导出
  {
    method: 'GET',
    pattern: /^\/api\/export$/,
    handler: getExport
  },
  // 手动刷新数据
  {
    method: 'POST',
    pattern: /^\/api\/refresh$/,
    handler: postRefresh
  }
];

// ============================================================
// API 处理函数
// ============================================================

/**
 * 获取项目基本信息
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getProject(req, dataProvider) {
  try {
    const summary = dataProvider.getSummary();
    return {
      success: true,
      data: {
        summary: summary || {},
        schemaVersion: dataProvider.schemaVersion || '1.0.0',
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        summary: {},
        schemaVersion: '1.0.0',
        timestamp: new Date().toISOString(),
        notice: '项目尚未初始化'
      }
    };
  }
}

/**
 * 获取功能点列表
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getFeatures(req, dataProvider) {
  try {
    const features = dataProvider.getFeatures() || [];
    return {
      success: true,
      data: {
        features: features.map(f => ({
          id: f.id,
          name: f.name,
          stage: f.stage,
          status: f.status,
          priority: f.priority,
          grade: f.grade,
          progress: f.progress || 0
        })),
        total: features.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        features: [],
        total: 0,
        timestamp: new Date().toISOString(),
        notice: '项目尚未初始化'
      }
    };
  }
}

/**
 * 获取功能点详情
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getFeatureDetail(req, dataProvider) {
  try {
    // 从 URL 中提取功能点 ID
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const match = pathname.match(/^\/api\/feature\/(.+)$/);

    if (!match || !match[1]) {
      return { success: false, error: '缺少功能点 ID' };
    }

    const featureId = decodeURIComponent(match[1]);
    const feature = dataProvider.getFeatureById(featureId);

    if (!feature) {
      return {
        success: false,
        error: `未找到功能点: ${featureId}`,
        code: 'NOT_FOUND'
      };
    }

    return {
      success: true,
      data: {
        feature: feature,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    throw new Error(`获取功能点详情失败: ${err.message}`);
  }
}

/**
 * 获取项目摘要信息
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getSummary(req, dataProvider) {
  try {
    const summary = dataProvider.getSummary() || {};
    return {
      success: true,
      data: {
        summary: summary,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        summary: { totalFeatures: 0, doneCount: 0, avgScore: 0, tokensUsed: 0, tokensTotal: 0 },
        timestamp: new Date().toISOString(),
        notice: '项目尚未初始化'
      }
    };
  }
}

/**
 * 获取质量矩阵数据
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getQualityMatrix(req, dataProvider) {
  try {
    const matrix = dataProvider.getQualityMatrix() || {};
    return {
      success: true,
      data: {
        matrix: matrix,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        matrix: {},
        timestamp: new Date().toISOString(),
        notice: '项目尚未初始化'
      }
    };
  }
}

/**
 * 获取 Token 使用统计
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getTokenStats(req, dataProvider) {
  try {
    const stats = dataProvider.getTokenStats() || null;
    return {
      success: true,
      data: {
        stats: stats,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    throw new Error(`获取 Token 统计失败: ${err.message}`);
  }
}

/**
 * 获取缓存统计信息
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getCacheStats(req, dataProvider) {
  try {
    const stats = dataProvider.getCacheStats() || null;
    return {
      success: true,
      data: {
        stats: stats,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    throw new Error(`获取缓存统计失败: ${err.message}`);
  }
}

/**
 * 获取迭代列表
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getIterationList(req, dataProvider) {
  try {
    let iterations = [];

    if (typeof dataProvider.getIterations === 'function') {
      iterations = dataProvider.getIterations() || [];
    } else if (dataProvider.summary && dataProvider.summary.iterations) {
      iterations = dataProvider.summary.iterations || [];
    }

    return {
      success: true,
      data: {
        iterations: iterations,
        total: iterations.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        iterations: [],
        total: 0,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * 获取系统健康状态
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getSystemHealth(req, dataProvider) {
  try {
    const health = dataProvider.getSystemHealth() || {};

    return {
      success: true,
      data: {
        health: {
          status: health.status || 'unknown',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
          ...health
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    return {
      success: true,
      data: {
        health: {
          status: 'ok',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version
        },
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * 数据导出接口
 * 支持 JSON、Markdown、CSV 三种格式
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @returns {Promise<Object>}
 */
async function getExport(req, dataProvider) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();

    let result;
    let contentType;

    switch (format) {
      case 'md':
      case 'markdown':
        if (typeof dataProvider.exportMarkdown === 'function') {
          result = dataProvider.exportMarkdown();
        } else {
          result = _generateMarkdownExport(dataProvider);
        }
        contentType = 'text/markdown; charset=utf-8';
        break;

      case 'csv':
        if (typeof dataProvider.exportCSV === 'function') {
          result = dataProvider.exportCSV();
        } else {
          result = _generateCSVExport(dataProvider);
        }
        contentType = 'text/csv; charset=utf-8';
        break;

      case 'json':
      default:
        if (typeof dataProvider.exportJSON === 'function') {
          result = dataProvider.exportJSON();
        } else {
          result = _generateJSONExport(dataProvider);
        }
        contentType = 'application/json; charset=utf-8';
        break;
    }

    // 返回特殊标记，让调用者知道这是文件下载
    return {
      success: true,
      isDownload: true,
      contentType: contentType,
      filename: `pdd-export-${Date.now()}.${format === 'markdown' ? 'md' : format}`,
      data: result
    };
  } catch (err) {
    throw new Error(`导出数据失败: ${err.message}`);
  }
}

/**
 * 触发数据刷新
 * @param {http.IncomingMessage} req
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @param {SSEManager} sseManager - SSE 管理器实例（可选）
 * @returns {Promise<Object>}
 */
async function postRefresh(req, dataProvider, sseManager) {
  try {
    console.log(chalk.cyan('[API] 收到手动刷新请求'));

    // 触发数据刷新
    if (typeof dataProvider.refresh === 'function') {
      await dataProvider.refresh();
    }

    // 获取刷新后的数据
    const summary = dataProvider.getSummary() || {};
    const features = dataProvider.getFeatures() || [];

    // 通过 SSE 广播刷新事件
    if (sseManager && typeof sseManager.broadcastDataRefreshed === 'function') {
      sseManager.broadcastDataRefreshed(summary);
    }

    return {
      success: true,
      message: '数据已刷新',
      data: {
        featuresCount: features.length,
        summary: summary,
        timestamp: new Date().toISOString()
      }
    };
  } catch (err) {
    throw new Error(`刷新数据失败: ${err.message}`);
  }
}

// ============================================================
// 导出格式生成辅助函数
// ============================================================

/**
 * 生成 JSON 格式导出数据
 * @param {Object} dataProvider
 * @returns {string}
 * @private
 */
function _generateJSONExport(dataProvider) {
  const exportData = {
    project: dataProvider.getSummary() || {},
    features: dataProvider.getFeatures() || [],
    quality: dataProvider.getQualityMatrix() || {},
    exportedAt: new Date().toISOString()
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * 生成 Markdown 格式导出数据
 * @param {Object} dataProvider
 * @returns {string}
 * @private
 */
function _generateMarkdownExport(dataProvider) {
  const summary = dataProvider.getSummary() || {};
  const features = dataProvider.getFeatures() || [];

  let md = '# PDD 项目报告\n\n';
  md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  // 项目概览
  md += '## 项目概览\n\n';
  if (summary.totalFeatures !== undefined) {
    md += `- **总功能点**: ${summary.totalFeatures}\n`;
  }
  if (summary.completedFeatures !== undefined) {
    md += `- **已完成**: ${summary.completedFeatures}\n`;
  }
  if (summary.progress !== undefined) {
    md += `- **进度**: ${(summary.progress * 100).toFixed(1)}%\n`;
  }
  md += '\n';

  // 功能点列表
  md += '## 功能点列表\n\n';
  md += '| ID | 名称 | 阶段 | 状态 | 优先级 | 质量 |\n';
  md += '|-----|------|------|------|--------|------|\n';

  for (const f of features) {
    md += `| ${f.id} | ${f.name} | ${f.stage || '-'} | ${f.status || '-'} | ${f.priority || '-'} | ${f.grade || '-'} |\n`;
  }

  return md;
}

function _escapeCSVField(str) {
  if (!str) return '""';
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return str;
}

/**
 * 生成 CSV 格式导出数据
 * @param {Object} dataProvider
 * @returns {string}
 * @private
 */
function _generateCSVExport(dataProvider) {
  const features = dataProvider.getFeatures() || [];

  // BOM + 表头（确保 Excel 正确识别 UTF-8）
  let csv = '\uFEFFID,名称,阶段,状态,优先级,质量,进度\n';

  for (const f of features) {
    csv += [
      f.id,
      _escapeCSVField(f.name),
      f.stage || '',
      f.status || '',
      f.priority || '',
      f.grade || '',
      (f.progress || 0) * 100 + '%'
    ].join(',') + '\n';
  }

  return csv;
}

// ============================================================
// 路由匹配与请求处理
// ============================================================

/**
 * 匹配路由并返回对应的处理函数
 * @param {http.IncomingMessage} req - HTTP 请求对象
 * @returns {{ route: Object|null, params: string[]|null }}
 */
function routeMatcher(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodedURI(url.pathname);
  const method = req.method.toUpperCase();

  for (const route of ROUTES) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (match) {
      // 提取路径参数（排除第一个完整匹配项）
      const params = match.slice(1);
      return { route, params };
    }
  }

  return { route: null, params: null };
}

/**
 * 处理 API 请求的主入口函数
 * 由 server.js 调用，统一处理所有 /api/* 请求
 * @param {http.IncomingMessage} req - HTTP 请求对象
 * @param {http.ServerResponse} res - HTTP 响应对象
 * @param {string} pathname - 请求路径
 * @param {Object} dataProvider - PDDDataProvider 实例
 * @param {SSEManager} [sseManager] - SSE 管理器实例（可选）
 */
async function handleAPIRequest(req, res, pathname, dataProvider, sseManager) {
  const startTime = Date.now();

  try {
    // 匹配路由
    const { route, params } = routeMatcher(req);

    if (!route) {
      sendJSON(res, 404, {
        success: false,
        error: 'API endpoint not found',
        path: pathname
      });
      return;
    }

    // 调用处理函数
    let result;
    if (route.handler === postRefresh) {
      // POST /api/refresh 需要传入 sseManager
      result = await route.handler(req, dataProvider, sseManager);
    } else {
      result = await route.handler(req, dataProvider);
    }

    // 处理下载类型的响应
    if (result.isDownload) {
      const buffer = Buffer.from(typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
      res.writeHead(200, {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': buffer.length
      });
      res.end(buffer);
      return;
    }

    // 正常 JSON 响应
    sendJSON(res, 200, result);

    // 记录日志
    const duration = Date.now() - startTime;
    console.log(
      chalk.gray(`[API] ${req.method} ${pathname} → ${duration}ms`)
    );

  } catch (err) {
    console.error(chalk.red(`[API] 请求处理错误:`), err.message);
    sendJSON(res, 500, {
      success: false,
      error: 'Internal Server Error',
      message: err.message
    });
  }
}

/**
 * 发送 JSON 响应
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {Object} data
 */
function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

/**
 * 解码 URI（处理中文路径）
 * @param {string} uri
 * @returns {string}
 */
function decodedURI(uri) {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

// 导出
export {
  routeMatcher,
  handleAPIRequest,
  // 导出各个处理函数供测试使用
  getProject,
  getFeatures,
  getFeatureDetail,
  getSummary,
  getQualityMatrix,
  getTokenStats,
  getCacheStats,
  getIterationList,
  getSystemHealth,
  getExport,
  postRefresh
};

export default {
  routeMatcher,
  handleAPIRequest
};
