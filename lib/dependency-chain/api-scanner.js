/**
 * Frontend API Scanner / 前端 API 调用扫描器
 * 
 * Scans JavaScript/Vue files in the frontend api/ directory to extract
 * request() call URLs and their locations.
 */

import fs from 'fs-extra';
import path from 'path';

export class ApiScanner {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.frontendApiDir = options.frontendApiDir || 'src/api';
    this.frontendDir = options.frontendDir || 'src';
  }

  /**
   * Scan all frontend API files and extract request URLs
   */
  async scan() {
    const apis = [];
    const apiPath = path.join(this.projectRoot, this.frontendApiDir);

    if (!fs.existsSync(apiPath)) return apis;

    const files = this.findJsFiles(apiPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileApis = this.parseApiFile(content, file);
        apis.push(...fileApis);
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return apis;
  }

  /**
   * Find all .js and .ts files recursively
   */
  findJsFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...this.findJsFiles(fullPath));
      } else if (/\.(js|ts|vue)$/.test(item.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Parse a JS/TS file to extract request() call URLs
   */
  parseApiFile(content, filePath) {
    const apis = [];
    const lines = content.split('\n');
    const relativePath = path.relative(this.projectRoot, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Pattern 1: request({ url: '/xxx/yyy', method: 'get' })
      const urlMatch = line.match(/url:\s*['"`]([^'"`]+)['"`]/);
      if (urlMatch) {
        const url = urlMatch[1];
        // Try to find the method
        let method = 'GET';
        const methodMatch = line.match(/method:\s*['"`](\w+)['"`]/);
        if (methodMatch) {
          method = methodMatch[1].toUpperCase();
        } else {
          // Check next few lines for method
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const mMatch = lines[j].match(/method:\s*['"`](\w+)['"`]/);
            if (mMatch) {
              method = mMatch[1].toUpperCase();
              break;
            }
          }
        }

        // Extract the function name (look backwards for export function)
        let funcName = '';
        for (let j = i; j >= Math.max(0, i - 10); j--) {
          const fnMatch = lines[j].match(/(?:export\s+)?(?:function|const|let|var)\s+(\w+)/);
          if (fnMatch) {
            funcName = fnMatch[1];
            break;
          }
        }

        apis.push({
          file: relativePath,
          line: i + 1,
          url: this.normalizeUrl(url),
          rawUrl: url,
          method,
          funcName,
          hasDynamicSegment: url.includes("' +") || url.includes('` +') || url.includes('${')
        });
      }

      // Pattern 2: axios.get('/xxx/yyy') or this.$http.get('/xxx')
      const axiosMatch = line.match(/(?:axios|this\.\$http|http)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (axiosMatch) {
        apis.push({
          file: relativePath,
          line: i + 1,
          url: this.normalizeUrl(axiosMatch[2]),
          rawUrl: axiosMatch[2],
          method: axiosMatch[1].toUpperCase(),
          funcName: '',
          hasDynamicSegment: false
        });
      }
    }

    return apis;
  }

  /**
   * Normalize URL by removing dynamic path segments for matching
   */
  normalizeUrl(url) {
    return url
      .replace(/['"`]\s*\+\s*\w+/g, '*')   // '/' + id → /*
      .replace(/\$\{[^}]+\}/g, '*')          // ${id} → *
      .replace(/\/+$/g, '');                  // Remove trailing slash
  }
}
