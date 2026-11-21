#!/usr/bin/env node
/**
 * PDD MCP Server 启动入口
 * 用法: node bin/pdd-mcp.js [端口]
 * 环境变量: PDD_MCP_PORT 可指定端口（默认 9090）
 * 配置为 MCP Server 后，AI 工具可通过 http://localhost:9090/mcp 调用 PDD 能力
 */
import { PDDMCPServer } from '../lib/mcp-server.js';

const port = parseInt(process.argv[2] || process.env.PDD_MCP_PORT || '9090', 10);

const server = new PDDMCPServer({ port });
await server.initialize();
await server.start(port);

// 优雅退出
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await server.stop();
  process.exit(0);
});
