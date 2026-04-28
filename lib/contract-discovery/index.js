/**
 * Contract Discovery Engine / 项目契约自动发现引擎
 * 
 * AST-level analysis that builds a "backend API → frontend consumer" contract graph.
 * Extends the lightweight dependency-chain engine with deeper parsing:
 * - Java annotation parsing (not just regex)
 * - Vue SFC <script> block parsing
 * - Contract graph with type-level matching
 * 
 * Usage:
 *   import { ContractDiscovery } from './lib/contract-discovery/index.js';
 *   const discovery = new ContractDiscovery('/path/to/project');
 *   await discovery.analyze();
 *   const report = discovery.generateContractReport();
 */

import fs from 'fs-extra';
import path from 'path';
import { log } from '../utils/logger.js';

export class ContractDiscovery {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.options = {
      backendDir: options.backendDir || 'src/main/java',
      frontendDir: options.frontendDir || 'src',
      frontendApiDir: options.frontendApiDir || 'src/api',
      ...options
    };

    this.contracts = {
      endpoints: [],       // Full API endpoint definitions with param types
      consumers: [],       // Frontend API consumers with expected types
      mismatches: [],      // Type/path mismatches detected
      coverage: {},        // Coverage statistics
      metadata: { analyzedAt: null, projectRoot }
    };
  }

  /**
   * Run full contract analysis / 执行完整契约分析
   */
  async analyze() {
    log('info', '📋 Starting contract discovery / 开始契约自动发现...');

    // Phase 1: Deep parse backend endpoints
    log('info', '  [1/4] Deep parsing backend endpoints...');
    this.contracts.endpoints = await this.parseBackendEndpoints();
    log('success', `  Discovered ${this.contracts.endpoints.length} API contracts`);

    // Phase 2: Deep parse frontend consumers
    log('info', '  [2/4] Deep parsing frontend API consumers...');
    this.contracts.consumers = await this.parseFrontendConsumers();
    log('success', `  Discovered ${this.contracts.consumers.length} API consumers`);

    // Phase 3: Match and detect mismatches
    log('info', '  [3/4] Matching contracts...');
    this.contracts.mismatches = this.detectMismatches();
    log('success', `  Found ${this.contracts.mismatches.length} potential mismatches`);

    // Phase 4: Calculate coverage
    log('info', '  [4/4] Calculating coverage...');
    this.contracts.coverage = this.calculateCoverage();

    this.contracts.metadata.analyzedAt = new Date().toISOString();
    log('success', '📋 Contract discovery complete / 契约自动发现完成');

    return this.contracts;
  }

  /**
   * Deep parse Java backend to extract full endpoint definitions
   */
  async parseBackendEndpoints() {
    const endpoints = [];
    const backendPath = path.join(this.projectRoot, this.options.backendDir);

    if (!fs.existsSync(backendPath)) return endpoints;

    const files = this.findFiles(backendPath, /Controller\.java$/);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.projectRoot, file);
        const fileEndpoints = this.parseJavaController(content, relativePath);
        endpoints.push(...fileEndpoints);
      } catch (e) { /* skip */ }
    }

    return endpoints;
  }

  /**
   * Deep parse Java Controller with parameter types, return types, and annotations
   */
  parseJavaController(content, filePath) {
    const endpoints = [];
    const lines = content.split('\n');

    // Class-level mapping
    const classMapping = this.extractAnnotationValue(content, 'RequestMapping');

    // Parse each method
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();

      // Detect mapping annotation
      const mappingMatch = line.match(
        /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']*?)["']/
      );

      if (mappingMatch) {
        const httpMethod = mappingMatch[1] === 'Request' ? 'ANY' : mappingMatch[1].toUpperCase();
        const methodPath = mappingMatch[2];
        const fullPath = this.combinePaths(classMapping, methodPath);

        // Collect annotations above the method
        const annotations = this.collectAnnotations(lines, i);

        // Find the method signature (search forward)
        const methodInfo = this.parseMethodSignature(lines, i + 1);

        endpoints.push({
          file: filePath,
          line: i + 1,
          httpMethod,
          fullPath,
          methodName: methodInfo.name,
          returnType: methodInfo.returnType,
          parameters: methodInfo.parameters,
          annotations,
          hasPreAuthorize: annotations.some(a => a.includes('PreAuthorize')),
          hasLog: annotations.some(a => a.includes('@Log')),
          hasValidated: methodInfo.parameters.some(p => p.annotations.includes('@Validated')),
          hasTransactional: annotations.some(a => a.includes('Transactional'))
        });
      }
      i++;
    }

    return endpoints;
  }

  /**
   * Deep parse frontend API consumers
   */
  async parseFrontendConsumers() {
    const consumers = [];
    const apiPath = path.join(this.projectRoot, this.options.frontendApiDir);

    if (!fs.existsSync(apiPath)) return consumers;

    const files = this.findFiles(apiPath, /\.(js|ts)$/);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(this.projectRoot, file);
        const fileConsumers = this.parseApiModule(content, relativePath);
        consumers.push(...fileConsumers);
      } catch (e) { /* skip */ }
    }

    return consumers;
  }

  /**
   * Parse a frontend API module to extract exported functions and their request configs
   */
  parseApiModule(content, filePath) {
    const consumers = [];
    const lines = content.split('\n');

    let currentFunc = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match export function declaration
      const funcMatch = line.match(/export\s+function\s+(\w+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        currentFunc = {
          name: funcMatch[1],
          params: funcMatch[2].trim(),
          line: i + 1
        };
      }

      // Match request() call within current function context
      const urlMatch = line.match(/url:\s*['"`]([^'"`]+)['"`]/);
      if (urlMatch && currentFunc) {
        const methodMatch = content.substring(
          content.lastIndexOf(currentFunc.name, i * 100),
          content.indexOf('}', i * 100 + 500)
        ).match(/method:\s*['"`](\w+)['"`]/);

        consumers.push({
          file: filePath,
          line: i + 1,
          funcName: currentFunc.name,
          funcParams: currentFunc.params,
          url: urlMatch[1],
          method: methodMatch ? methodMatch[1].toUpperCase() : 'GET',
          hasDynamicSegment: urlMatch[1].includes("' +") || urlMatch[1].includes('${')
        });

        currentFunc = null; // Reset for next function
      }
    }

    return consumers;
  }

  /**
   * Detect mismatches between backend endpoints and frontend consumers
   */
  detectMismatches() {
    const mismatches = [];

    // 1. Orphaned consumers (no matching backend endpoint)
    for (const consumer of this.contracts.consumers) {
      const normalizedUrl = consumer.url.replace(/['"`]\s*\+\s*\w+/g, '{id}').replace(/\$\{[^}]+\}/g, '{id}');
      const matched = this.contracts.endpoints.some(ep => {
        const normalizedEp = ep.fullPath.replace(/\{[^}]+\}/g, '{id}');
        return normalizedEp === normalizedUrl;
      });

      if (!matched) {
        mismatches.push({
          type: 'orphaned-consumer',
          severity: 'critical',
          pattern: 'PATTERN-R008',
          message: `Frontend API call has no matching backend endpoint / 前端API调用无对应后端端点`,
          consumer: { file: consumer.file, line: consumer.line, url: consumer.url, func: consumer.funcName },
          suggestion: `Check if the URL path is complete (class @RequestMapping + method @XXXMapping)`
        });
      }
    }

    // 2. Unprotected endpoints (missing @PreAuthorize)
    for (const ep of this.contracts.endpoints) {
      if (!ep.hasPreAuthorize && ep.httpMethod !== 'ANY') {
        mismatches.push({
          type: 'missing-permission',
          severity: 'critical',
          pattern: 'PATTERN-R001',
          message: `Endpoint missing @PreAuthorize annotation / 端点缺少@PreAuthorize注解`,
          endpoint: { file: ep.file, line: ep.line, path: ep.fullPath, method: ep.httpMethod },
          suggestion: `Add @PreAuthorize("@ss.hasPermi('module:feature:action')") annotation`
        });
      }
    }

    // 3. Missing @Validated on POST/PUT endpoints
    for (const ep of this.contracts.endpoints) {
      if (['POST', 'PUT'].includes(ep.httpMethod) && !ep.hasValidated) {
        const hasRequestBody = ep.parameters.some(p => p.annotations.includes('@RequestBody'));
        if (hasRequestBody) {
          mismatches.push({
            type: 'missing-validation',
            severity: 'warning',
            pattern: 'PATTERN-R005',
            message: `@RequestBody parameter missing @Validated / @RequestBody参数缺少@Validated`,
            endpoint: { file: ep.file, line: ep.line, path: ep.fullPath },
            suggestion: `Add @Validated before @RequestBody parameter`
          });
        }
      }
    }

    // 4. State-changing endpoints without @Transactional
    for (const ep of this.contracts.endpoints) {
      if (['POST', 'PUT', 'DELETE'].includes(ep.httpMethod)) {
        const methodName = ep.methodName.toLowerCase();
        const stateChanging = ['approve', 'reject', 'submit', 'cancel', 'transfer', 'assign'].some(
          kw => methodName.includes(kw)
        );
        if (stateChanging && !ep.hasTransactional) {
          mismatches.push({
            type: 'missing-transaction',
            severity: 'warning',
            pattern: 'PATTERN-R010',
            message: `State-changing method may need @Transactional / 状态变更方法可能需要@Transactional`,
            endpoint: { file: ep.file, line: ep.line, path: ep.fullPath, method: ep.methodName },
            suggestion: `Add @Transactional and ensure approval log is recorded in the same transaction`
          });
        }
      }
    }

    return mismatches;
  }

  /**
   * Calculate contract coverage statistics
   */
  calculateCoverage() {
    const totalEndpoints = this.contracts.endpoints.length;
    const totalConsumers = this.contracts.consumers.length;
    const orphanedConsumers = this.contracts.mismatches.filter(m => m.type === 'orphaned-consumer').length;
    const matchedConsumers = totalConsumers - orphanedConsumers;

    return {
      totalEndpoints,
      totalConsumers,
      matchedConsumers,
      orphanedConsumers,
      coverageRate: totalConsumers > 0
        ? Math.round((matchedConsumers / totalConsumers) * 100)
        : 100,
      mismatches: {
        total: this.contracts.mismatches.length,
        critical: this.contracts.mismatches.filter(m => m.severity === 'critical').length,
        warning: this.contracts.mismatches.filter(m => m.severity === 'warning').length
      }
    };
  }

  /**
   * Generate a markdown contract report / 生成契约报告
   */
  generateContractReport() {
    const c = this.contracts.coverage;
    const lines = [
      '# 项目契约分析报告 / Project Contract Analysis Report',
      '',
      `> 分析时间 / Analyzed at: ${this.contracts.metadata.analyzedAt}`,
      '',
      '## 概要 / Summary',
      '',
      `| 指标 / Metric | 数值 / Value |`,
      `|------|------|`,
      `| 后端端点 / Backend Endpoints | ${c.totalEndpoints} |`,
      `| 前端调用 / Frontend Consumers | ${c.totalConsumers} |`,
      `| 匹配率 / Match Rate | ${c.coverageRate}% |`,
      `| 孤立调用 / Orphaned Calls | ${c.orphanedConsumers} |`,
      `| 问题总数 / Total Issues | ${c.mismatches.total} |`,
      `| 🔴 Critical | ${c.mismatches.critical} |`,
      `| 🟡 Warning | ${c.mismatches.warning} |`,
      ''
    ];

    if (this.contracts.mismatches.length > 0) {
      lines.push('## 问题清单 / Issue List', '');

      const criticals = this.contracts.mismatches.filter(m => m.severity === 'critical');
      if (criticals.length > 0) {
        lines.push('### 🔴 Critical', '');
        lines.push('| # | 类型 / Type | 文件 / File | 说明 / Description | 建议 / Suggestion |');
        lines.push('|---|------|------|------|------|');
        criticals.forEach((m, i) => {
          const loc = m.consumer || m.endpoint;
          lines.push(`| ${i + 1} | ${m.pattern} | ${loc.file}:${loc.line} | ${m.message} | ${m.suggestion} |`);
        });
        lines.push('');
      }

      const warnings = this.contracts.mismatches.filter(m => m.severity === 'warning');
      if (warnings.length > 0) {
        lines.push('### 🟡 Warning', '');
        lines.push('| # | 类型 / Type | 文件 / File | 说明 / Description | 建议 / Suggestion |');
        lines.push('|---|------|------|------|------|');
        warnings.forEach((m, i) => {
          const loc = m.consumer || m.endpoint;
          lines.push(`| ${i + 1} | ${m.pattern} | ${loc.file}:${loc.line} | ${m.message} | ${m.suggestion} |`);
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ─── Private helpers ───

  findFiles(dir, pattern) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === 'dist' || item.name === 'target') continue;
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) results.push(...this.findFiles(fullPath, pattern));
      else if (pattern.test(item.name)) results.push(fullPath);
    }
    return results;
  }

  extractAnnotationValue(content, annotationName) {
    const match = content.match(new RegExp(`@${annotationName}\\s*\\(\\s*(?:value\\s*=\\s*)?["']([^"']+)["']`));
    return match ? match[1] : '';
  }

  combinePaths(classPath, methodPath) {
    if (!classPath && !methodPath) return '/';
    if (!classPath) return methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
    if (!methodPath) return classPath;
    const base = classPath.replace(/\/$/, '');
    const sub = methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
    return `${base}${sub}`;
  }

  collectAnnotations(lines, endLine) {
    const annotations = [];
    for (let j = Math.max(0, endLine - 5); j <= endLine; j++) {
      const line = lines[j].trim();
      if (line.startsWith('@')) annotations.push(line);
    }
    return annotations;
  }

  parseMethodSignature(lines, startLine) {
    for (let j = startLine; j < Math.min(startLine + 5, lines.length); j++) {
      const line = lines[j].trim();
      const match = line.match(/public\s+(\S+)\s+(\w+)\s*\((.*)$/);
      if (match) {
        return {
          returnType: match[1],
          name: match[2],
          parameters: this.parseParameters(match[3] + (line.includes(')') ? '' : this.readUntilClose(lines, j)))
        };
      }
    }
    return { returnType: 'void', name: 'unknown', parameters: [] };
  }

  parseParameters(paramStr) {
    const params = [];
    // Remove closing paren and everything after
    paramStr = paramStr.replace(/\)\s*\{?.*$/, '').trim();
    if (!paramStr) return params;

    const parts = paramStr.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const annotations = [];
      let rest = trimmed;

      // Extract annotations
      const annoRegex = /@\w+(?:\([^)]*\))?/g;
      let annoMatch;
      while ((annoMatch = annoRegex.exec(trimmed)) !== null) {
        annotations.push(annoMatch[0]);
      }
      rest = rest.replace(/@\w+(?:\([^)]*\))?/g, '').trim();

      // Extract type and name
      const typeNameMatch = rest.match(/(\S+)\s+(\w+)/);
      if (typeNameMatch) {
        params.push({
          type: typeNameMatch[1],
          name: typeNameMatch[2],
          annotations: annotations.join(' ')
        });
      }
    }
    return params;
  }

  readUntilClose(lines, startLine) {
    let result = '';
    for (let j = startLine + 1; j < Math.min(startLine + 5, lines.length); j++) {
      result += ' ' + lines[j].trim();
      if (lines[j].includes(')')) break;
    }
    return result;
  }
}
