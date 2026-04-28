/**
 * Status Mapping Scanner / 状态映射扫描器
 * 
 * Scans frontend Vue/JS files for status mapping methods like
 * getStatusLabel, statusMap, getNodeLabel, getStatusTagType.
 * Detects which status values each file knows about.
 */

import fs from 'fs-extra';
import path from 'path';

export class StatusScanner {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.frontendDir = options.frontendDir || 'src';

    // Patterns to detect status mapping methods
    this.patterns = [
      /getStatusLabel/,
      /getNodeLabel/,
      /getStatusTagType/,
      /statusMap/,
      /STATUS_MAP/,
      /status_map/,
      /dict\.type\./
    ];
  }

  /**
   * Scan all frontend files for status mappings
   */
  async scan() {
    const mappings = [];
    const frontendPath = path.join(this.projectRoot, this.frontendDir);

    if (!fs.existsSync(frontendPath)) return mappings;

    const files = this.findFrontendFiles(frontendPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileMappings = this.parseStatusMappings(content, file);
        mappings.push(...fileMappings);
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return mappings;
  }

  /**
   * Find all Vue and JS files recursively (excluding node_modules)
   */
  findFrontendFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules' || item.name === 'dist') continue;

      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...this.findFrontendFiles(fullPath));
      } else if (/\.(vue|js|ts|jsx|tsx)$/.test(item.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Parse a file for status mapping patterns and extract the mapped values
   */
  parseStatusMappings(content, filePath) {
    const results = [];
    const lines = content.split('\n');
    const relativePath = path.relative(this.projectRoot, filePath);

    // Check if file contains any status mapping pattern
    const hasPattern = this.patterns.some(p => p.test(content));
    if (!hasPattern) return results;

    // Extract status values from map-like structures
    const values = new Set();

    // Pattern: { draft: '草稿', pending: '待审批', ... }
    const mapBlockRegex = /\{([^{}]*(?:draft|pending|approved|rejected|review|submitted|completed|cancelled|processing)[^{}]*)\}/gi;
    let match;
    while ((match = mapBlockRegex.exec(content)) !== null) {
      const block = match[1];
      // Extract keys from the map
      const keyRegex = /['"]?(\w+)['"]?\s*:/g;
      let keyMatch;
      while ((keyMatch = keyRegex.exec(block)) !== null) {
        const key = keyMatch[1];
        // Filter out common non-status keys
        if (!['const', 'let', 'var', 'function', 'return', 'default', 'type', 'class'].includes(key)) {
          values.add(key);
        }
      }
    }

    // Pattern: case 'draft': or status === 'draft'
    const caseRegex = /(?:case\s+|===?\s*)['"](\w+)['"]/g;
    while ((match = caseRegex.exec(content)) !== null) {
      const val = match[1];
      // Only include if it looks like a status value
      if (this.looksLikeStatusValue(val)) {
        values.add(val);
      }
    }

    // Find the line numbers where mappings occur
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (this.patterns.some(p => p.test(line))) {
        results.push({
          file: relativePath,
          line: i + 1,
          method: this.extractMethodName(line),
          values: [...values],
          context: line.trim().substring(0, 100)
        });
      }
    }

    // If we found values but no specific method lines, record at file level
    if (values.size > 0 && results.length === 0) {
      results.push({
        file: relativePath,
        line: 0,
        method: 'inline-map',
        values: [...values],
        context: `Contains ${values.size} status values`
      });
    }

    return results;
  }

  /**
   * Check if a string looks like a status value
   */
  looksLikeStatusValue(val) {
    const statusKeywords = [
      'draft', 'pending', 'approved', 'rejected', 'review',
      'submitted', 'completed', 'cancelled', 'processing',
      'active', 'inactive', 'closed', 'open', 'archived',
      'waiting', 'assigned', 'overdue', 'expired'
    ];
    return statusKeywords.includes(val.toLowerCase());
  }

  /**
   * Extract the method/function name from a line
   */
  extractMethodName(line) {
    const fnMatch = line.match(/(?:function\s+)?(\w+)\s*\(/);
    if (fnMatch) return fnMatch[1];

    const constMatch = line.match(/(?:const|let|var)\s+(\w+)/);
    if (constMatch) return constMatch[1];

    // Check for known patterns
    for (const p of this.patterns) {
      const m = line.match(p);
      if (m) return m[0];
    }

    return 'unknown';
  }
}
