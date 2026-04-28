/**
 * PDD Dependency Chain Engine / 依赖链感知引擎
 * 
 * Lightweight file relationship indexer that scans project code to build
 * dependency graphs between backend controllers, frontend API calls,
 * and status mapping files.
 * 
 * Usage:
 *   import { DependencyChainEngine } from './lib/dependency-chain/index.js';
 *   const engine = new DependencyChainEngine('/path/to/project');
 *   await engine.scan();
 *   const graph = engine.getGraph();
 *   const impact = engine.analyzeImpact('src/main/java/xxx/Controller.java');
 */

import { ControllerScanner } from './controller-scanner.js';
import { ApiScanner } from './api-scanner.js';
import { StatusScanner } from './status-scanner.js';
import { log } from '../utils/logger.js';

export class DependencyChainEngine {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      backendDir: options.backendDir || 'src/main/java',
      frontendDir: options.frontendDir || 'src',
      frontendApiDir: options.frontendApiDir || 'src/api',
      ...options
    };

    // Scanners
    this.controllerScanner = new ControllerScanner(projectRoot, this.options);
    this.apiScanner = new ApiScanner(projectRoot, this.options);
    this.statusScanner = new StatusScanner(projectRoot, this.options);

    // Graph data
    this.graph = {
      controllers: [],      // Backend controller endpoints
      frontendApis: [],      // Frontend API calls
      statusMaps: [],        // Status mapping locations
      edges: [],             // Dependency edges
      metadata: { scannedAt: null, projectRoot }
    };
  }

  /**
   * Run full project scan / 执行全项目扫描
   */
  async scan() {
    log('info', '🔗 Starting dependency chain scan / 开始依赖链扫描...');

    // Phase 1: Scan backend controllers
    log('info', '  [1/4] Scanning backend controllers...');
    this.graph.controllers = await this.controllerScanner.scan();
    log('success', `  Found ${this.graph.controllers.length} controller endpoints`);

    // Phase 2: Scan frontend API calls
    log('info', '  [2/4] Scanning frontend API calls...');
    this.graph.frontendApis = await this.apiScanner.scan();
    log('success', `  Found ${this.graph.frontendApis.length} frontend API calls`);

    // Phase 3: Scan status mappings
    log('info', '  [3/4] Scanning status mappings...');
    this.graph.statusMaps = await this.statusScanner.scan();
    log('success', `  Found ${this.graph.statusMaps.length} status mapping locations`);

    // Phase 4: Build edges
    log('info', '  [4/4] Building dependency edges...');
    this.buildEdges();
    log('success', `  Built ${this.graph.edges.length} dependency edges`);

    this.graph.metadata.scannedAt = new Date().toISOString();
    log('success', '🔗 Dependency chain scan complete / 依赖链扫描完成');

    return this.graph;
  }

  /**
   * Build dependency edges between backend and frontend / 构建前后端依赖边
   */
  buildEdges() {
    this.graph.edges = [];

    // Edge Type 1: Controller → Frontend API (path matching)
    for (const controller of this.graph.controllers) {
      for (const api of this.graph.frontendApis) {
        if (this.pathsMatch(controller.fullPath, api.url)) {
          this.graph.edges.push({
            type: 'controller-api',
            source: { file: controller.file, path: controller.fullPath, method: controller.httpMethod },
            target: { file: api.file, url: api.url, line: api.line },
            confidence: 'high'
          });
        }
      }
    }

    // Edge Type 2: Status value shared across files
    const statusGroups = this.groupByStatusValue(this.graph.statusMaps);
    for (const [value, locations] of Object.entries(statusGroups)) {
      if (locations.length > 1) {
        for (let i = 0; i < locations.length; i++) {
          for (let j = i + 1; j < locations.length; j++) {
            this.graph.edges.push({
              type: 'status-shared',
              source: { file: locations[i].file, line: locations[i].line, value },
              target: { file: locations[j].file, line: locations[j].line, value },
              confidence: 'medium'
            });
          }
        }
      }
    }
  }

  /**
   * Analyze impact of modifying a specific file / 分析修改某文件的影响范围
   * Returns all files that may need to be updated together.
   */
  analyzeImpact(filePath) {
    const impacted = new Map(); // file -> reasons[]

    for (const edge of this.graph.edges) {
      const sourceFile = edge.source.file;
      const targetFile = edge.target.file;

      if (this.normalizePath(sourceFile) === this.normalizePath(filePath)) {
        this.addImpact(impacted, targetFile, edge);
      }
      if (this.normalizePath(targetFile) === this.normalizePath(filePath)) {
        this.addImpact(impacted, sourceFile, edge);
      }
    }

    return {
      modifiedFile: filePath,
      impactedFiles: Array.from(impacted.entries()).map(([file, edges]) => ({
        file,
        reasons: edges.map(e => this.edgeToReason(e)),
        edgeTypes: [...new Set(edges.map(e => e.type))]
      })),
      totalImpacted: impacted.size
    };
  }

  /**
   * Find orphaned frontend API calls (no matching backend) / 查找孤立的前端API调用
   * These are potential PATTERN-R008 violations.
   */
  findOrphanedApis() {
    const matchedApis = new Set(
      this.graph.edges
        .filter(e => e.type === 'controller-api')
        .map(e => `${e.target.file}:${e.target.line}`)
    );

    return this.graph.frontendApis.filter(
      api => !matchedApis.has(`${api.file}:${api.line}`)
    );
  }

  /**
   * Find status values that exist in some files but not others / 查找不完整的状态映射
   * These are potential PATTERN-R011 violations.
   */
  findIncompleteStatusMaps() {
    const statusGroups = this.groupByStatusValue(this.graph.statusMaps);
    const allFiles = [...new Set(this.graph.statusMaps.map(m => m.file))];
    const issues = [];

    for (const [value, locations] of Object.entries(statusGroups)) {
      const filesWithValue = new Set(locations.map(l => l.file));
      const filesMissing = allFiles.filter(f => !filesWithValue.has(f));
      if (filesMissing.length > 0) {
        issues.push({
          statusValue: value,
          presentIn: [...filesWithValue],
          missingFrom: filesMissing,
          severity: 'warning'
        });
      }
    }

    return issues;
  }

  /**
   * Generate impact declaration for bug-fixer / 生成影响范围声明（供 expert-bug-fixer 使用）
   */
  generateImpactDeclaration(filePaths) {
    const allImpacted = new Map();

    for (const fp of filePaths) {
      const result = this.analyzeImpact(fp);
      for (const item of result.impactedFiles) {
        if (!allImpacted.has(item.file)) {
          allImpacted.set(item.file, []);
        }
        allImpacted.get(item.file).push(...item.reasons);
      }
    }

    // Format as markdown
    const lines = ['## 影响范围声明 / Impact Scope Declaration', ''];
    lines.push('本次修复将修改以下文件，请确认 / This fix will modify the following files:');
    lines.push('');

    // Group by backend/frontend
    const backend = [];
    const frontend = [];
    for (const [file, reasons] of allImpacted.entries()) {
      const entry = { file, reasons: [...new Set(reasons)] };
      if (file.endsWith('.java') || file.endsWith('.xml')) {
        backend.push(entry);
      } else {
        frontend.push(entry);
      }
    }

    if (backend.length > 0) {
      lines.push('### 后端 / Backend');
      backend.forEach((item, i) => {
        lines.push(`${i + 1}. \`${item.file}\` — ${item.reasons.join(', ')}`);
      });
      lines.push('');
    }

    if (frontend.length > 0) {
      lines.push('### 前端 / Frontend');
      frontend.forEach((item, i) => {
        lines.push(`${i + 1}. \`${item.file}\` — ${item.reasons.join(', ')}`);
      });
      lines.push('');
    }

    const total = backend.length + frontend.length + filePaths.length;
    lines.push(`⚠️ 本次修改涉及 ${total} 个文件。确认后开始修复。`);
    lines.push(`⚠️ This fix involves ${total} files. Confirm to proceed.`);

    return lines.join('\n');
  }

  /** Get the full dependency graph */
  getGraph() { return this.graph; }

  /** Export graph as JSON */
  toJSON() { return JSON.stringify(this.graph, null, 2); }

  // ─── Private helpers ───

  pathsMatch(controllerPath, apiUrl) {
    // Normalize both paths and compare
    const norm = (p) => p.replace(/\{[^}]+\}/g, '*').replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
    return norm(controllerPath) === norm(apiUrl);
  }

  normalizePath(p) {
    return p.replace(/\\/g, '/').toLowerCase();
  }

  addImpact(map, file, edge) {
    if (!map.has(file)) map.set(file, []);
    map.get(file).push(edge);
  }

  edgeToReason(edge) {
    switch (edge.type) {
      case 'controller-api':
        return `调用了该接口 / Calls this API (${edge.source.path || edge.target.url})`;
      case 'status-shared':
        return `共享状态值 / Shares status value "${edge.source.value || edge.target.value}"`;
      default:
        return `依赖关系 / Dependency (${edge.type})`;
    }
  }

  groupByStatusValue(statusMaps) {
    const groups = {};
    for (const item of statusMaps) {
      for (const value of (item.values || [])) {
        if (!groups[value]) groups[value] = [];
        groups[value].push(item);
      }
    }
    return groups;
  }
}
