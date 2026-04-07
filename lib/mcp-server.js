// lib/mcp-server.js - PDD MCP Server
// 实现MCP协议的资源定义和工具定义，让AI工具可以调用PDD能力

import http from 'node:http';
import { URL } from 'node:url';
import { log } from './utils/logger.js';

/**
 * PDD资源定义
 * 定义了MCP协议中暴露的PDD核心资源
 */
const PDD_RESOURCES = {
  'pdd://specs': {
    name: 'Development Specs',
    description: 'All development specifications generated from feature matrices'
  },
  'pdd://features': {
    name: 'Feature Matrix',
    description: 'Extracted feature matrices from PRD documents'
  },
  'pdd://reviews': {
    name: 'Code Reviews',
    description: 'Code review reports and quality assessments'
  },
  'pdd://status': {
    name: 'Project Status',
    description: 'Current project status and progress tracking'
  }
};

/**
 * PDD工具定义
 * 定义了MCP协议中暴露的PDD核心工具
 */
const PDD_TOOLS = [
  {
    name: 'pdd_generate_spec',
    description: 'Generate development spec from feature matrix',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Feature matrix identifier'
        },
        outputPath: {
          type: 'string',
          description: 'Output path for the generated spec'
        }
      },
      required: ['featureId']
    }
  },
  {
    name: 'pdd_implement_feature',
    description: 'Implement feature from dev spec',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the development spec'
        },
        targetDir: {
          type: 'string',
          description: 'Target directory for implementation'
        }
      },
      required: ['specPath']
    }
  },
  {
    name: 'pdd_verify_feature',
    description: 'Verify feature against acceptance criteria',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Path to the development spec'
        },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Verification dimensions (completeness, correctness, consistency)'
        }
      },
      required: ['specPath']
    }
  },
  {
    name: 'pdd_code_review',
    description: 'Review code against development specs',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: {
          type: 'string',
          description: 'Path to review (file or directory)'
        },
        specPath: {
          type: 'string',
          description: 'Path to the development spec for comparison'
        }
      },
      required: ['targetPath']
    }
  },
  {
    name: 'pdd_analyze_business',
    description: 'Analyze business requirements using 5W1H methodology',
    inputSchema: {
      type: 'object',
      properties: {
        prdPath: {
          type: 'string',
          description: 'Path to PRD document'
        },
        outputFormat: {
          type: 'string',
          enum: ['json', 'markdown'],
          description: 'Output format for analysis results'
        }
      },
      required: ['prdPath']
    }
  },
  {
    name: 'pdd_extract_features',
    description: 'Extract features from PRD documents',
    inputSchema: {
      type: 'object',
      properties: {
        prdPath: {
          type: 'string',
          description: 'Path to PRD document'
        },
        outputDir: {
          type: 'string',
          description: 'Output directory for extracted features'
        }
      },
      required: ['prdPath']
    }
  }
];

/**
 * PDD MCP Server 类
 * 实现Model Context Protocol服务端，提供资源和工具访问能力
 */
export class PDDMCPServer {
  constructor(options = {}) {
    this.port = options.port || 9090;
    this.host = options.host || 'localhost';
    this.server = null;
    this.toolHandlers = new Map();
    this.resourceHandlers = new Map();
    this.initialized = false;

    // 注册默认的工具处理器
    this._registerDefaultHandlers();
  }

  /**
   * 注册默认的工具和资源处理器
   * @private
   */
  _registerDefaultHandlers() {
    // 工具处理器路由表
    this.toolHandlers.set('pdd_generate_spec', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Generate spec for feature: ${args.featureId}`
        }],
        isError: false
      };
    });

    this.toolHandlers.set('pdd_implement_feature', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Implement feature from spec: ${args.specPath}`
        }],
        isError: false
      };
    });

    this.toolHandlers.set('pdd_verify_feature', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Verify feature at: ${args.specPath}`
        }],
        isError: false
      };
    });

    this.toolHandlers.set('pdd_code_review', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Review code at: ${args.targetPath}`
        }],
        isError: false
      };
    });

    this.toolHandlers.set('pdd_analyze_business', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Analyze business requirements from: ${args.prdPath}`
        }],
        isError: false
      };
    });

    this.toolHandlers.set('pdd_extract_features', async (args) => {
      return {
        content: [{
          type: 'text',
          text: `Extract features from: ${args.prdPath}`
        }],
        isError: false
      };
    });
  }

  /**
   * 初始化MCP服务器
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    log('info', 'Initializing PDD MCP Server...');
    this.initialized = true;
    log('success', 'PDD MCP Server initialized successfully');
  }

  /**
   * 列出所有可用的资源
   * @returns {Object} 资源列表
   */
  async listResources() {
    if (!this.initialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    return Object.entries(PDD_RESOURCES).map(([uri, info]) => ({
      uri,
      name: info.name,
      description: info.description,
      mimeType: 'application/json'
    }));
  }

  /**
   * 列出所有可用的工具
   * @returns {Array} 工具列表
   */
  async listTools() {
    if (!this.initialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    return PDD_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * 调用指定工具
   * @param {string} name - 工具名称
   * @param {Object} args - 工具参数
   * @returns {Object} 工具执行结果
   */
  async callTool(name, args) {
    if (!this.initialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    const handler = this.toolHandlers.get(name);
    if (!handler) {
      return {
        content: [{
          type: 'text',
          text: `Unknown tool: ${name}`
        }],
        isError: true
      };
    }

    try {
      log('info', `Calling tool: ${name}`);
      const result = await handler(args);
      return result;
    } catch (error) {
      log('error', `Tool execution failed: ${name}`, error.message);
      return {
        content: [{
          type: 'text',
          text: `Error executing ${name}: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * 读取指定的资源
   * @param {string} uri - 资源URI
   * @returns {Object} 资源内容
   */
  async readResource(uri) {
    if (!this.initialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    const resourceInfo = PDD_RESOURCES[uri];
    if (!resourceInfo) {
      throw new Error(`Resource not found: ${uri}`);
    }

    // 这里可以扩展为从文件系统或数据库读取实际数据
    const handler = this.resourceHandlers.get(uri);
    if (handler) {
      return await handler(uri);
    }

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          uri,
          name: resourceInfo.name,
          description: resourceInfo.description,
          timestamp: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * 注册自定义工具处理器
   * @param {string} name - 工具名称
   * @param {Function} handler - 处理函数
   */
  registerToolHandler(name, handler) {
    this.toolHandlers.set(name, handler);
    log('info', `Registered custom tool handler: ${name}`);
  }

  /**
   * 注册自定义资源处理器
   * @param {string} uri - 资源URI
   * @param {Function} handler - 处理函数
   */
  registerResourceHandler(uri, handler) {
    this.resourceHandlers.set(uri, handler);
    log('info', `Registered custom resource handler: ${uri}`);
  }

  /**
   * 处理HTTP请求
   * @private
   */
  _handleRequest(req, res) {
    const url = new URL(req.url, `http://${this.host}:${this.port}`);

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // MCP协议端点路由
    if (url.pathname === '/mcp' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const request = JSON.parse(body);
          const response = await this._processRequest(request);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error.message,
            code: 'INVALID_REQUEST'
          }));
        }
      });
    } else if (url.pathname === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  /**
   * 处理MCP请求
   * @private
   */
  async _processRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'initialize':
        await this.initialize();
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {}
            },
            serverInfo: {
              name: 'pdd-mcp-server',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        const tools = await this.listTools();
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { tools }
        };

      case 'tools/call':
        const toolResult = await this.callTool(params.name, params.arguments);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: toolResult
        };

      case 'resources/list':
        const resources = await this.listResources();
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { resources }
        };

      case 'resources/read':
        const resourceResult = await this.readResource(params.uri);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: resourceResult
        };

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  }

  /**
   * 启动MCP服务器
   * @param {number} port - 监听端口（可选）
   */
  start(port) {
    if (port) this.port = port;

    this.server = http.createServer(this._handleRequest.bind(this));

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        log('success', `PDD MCP Server running at http://${this.host}:${this.port}`);
        log('info', `Available endpoints:`);
        log(`info`, `  - POST /mcp  - MCP protocol endpoint`);
        log(`info`, `  - GET  /health - Health check endpoint`);
        resolve(this);
      });

      this.server.on('error', (error) => {
        log('error', 'Failed to start MCP Server', error.message);
        reject(error);
      });
    });
  }

  /**
   * 停止MCP服务器
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          log('info', 'PDD MCP Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }
}

/**
 * 导出常量供外部使用
 */
export { PDD_RESOURCES, PDD_TOOLS };

/**
 * 创建并启动MCP服务器的便捷函数
 * @param {Object} options - 配置选项
 * @returns {Promise<PDDMCPServer>} 服务器实例
 */
export async function createMCPServer(options = {}) {
  const server = new PDDMCPServer(options);
  await server.initialize();
  return server;
}
