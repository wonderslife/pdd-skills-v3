/**
 * Controller Scanner / 后端 Controller 扫描器
 * 
 * Scans Java Controller files to extract @RequestMapping paths and method signatures.
 * Supports RuoYi and standard Spring Boot patterns.
 */

import fs from 'fs-extra';
import path from 'path';

export class ControllerScanner {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot;
    this.backendDir = options.backendDir || 'src/main/java';
  }

  /**
   * Scan all Controller files and extract endpoints
   */
  async scan() {
    const endpoints = [];
    const backendPath = path.join(this.projectRoot, this.backendDir);

    if (!fs.existsSync(backendPath)) return endpoints;

    const files = this.findControllerFiles(backendPath);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const fileEndpoints = this.parseController(content, file);
        endpoints.push(...fileEndpoints);
      } catch (e) {
        // Skip files that can't be read
      }
    }

    return endpoints;
  }

  /**
   * Find all *Controller.java files recursively
   */
  findControllerFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        results.push(...this.findControllerFiles(fullPath));
      } else if (item.name.endsWith('Controller.java')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Parse a Controller file to extract class-level and method-level mappings
   */
  parseController(content, filePath) {
    const endpoints = [];
    const lines = content.split('\n');
    const relativePath = path.relative(this.projectRoot, filePath);

    // Extract class-level @RequestMapping
    const classMapping = this.extractClassMapping(content);

    // Extract method-level mappings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Match @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @RequestMapping
      const methodMatch = line.match(
        /@(Get|Post|Put|Delete|Patch|Request)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/
      );

      if (methodMatch) {
        const httpMethod = methodMatch[1] === 'Request' ? 'ANY' : methodMatch[1].toUpperCase();
        const methodPath = methodMatch[2];
        const fullPath = this.combinePaths(classMapping, methodPath);

        // Try to find the method name (next non-annotation line)
        let methodName = '';
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const mLine = lines[j].trim();
          const nameMatch = mLine.match(/public\s+\w+(?:<[^>]+>)?\s+(\w+)\s*\(/);
          if (nameMatch) {
            methodName = nameMatch[1];
            break;
          }
        }

        // Extract @PreAuthorize permission
        let permission = '';
        if (i > 0) {
          for (let j = Math.max(0, i - 3); j < i; j++) {
            const pMatch = lines[j].match(/@PreAuthorize\s*\(\s*"@ss\.hasPermi\('([^']+)'\)"\s*\)/);
            if (pMatch) {
              permission = pMatch[1];
              break;
            }
          }
        }

        endpoints.push({
          file: relativePath,
          line: i + 1,
          httpMethod,
          classPath: classMapping,
          methodPath,
          fullPath,
          methodName,
          permission
        });
      }

      // Also match simple @GetMapping without value (maps to "")
      const simpleMatch = line.match(/@(Get|Post|Put|Delete|Patch)Mapping\s*$/);
      if (simpleMatch) {
        const httpMethod = simpleMatch[1].toUpperCase();
        const fullPath = classMapping || '/';

        let methodName = '';
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const mLine = lines[j].trim();
          const nameMatch = mLine.match(/public\s+\w+(?:<[^>]+>)?\s+(\w+)\s*\(/);
          if (nameMatch) {
            methodName = nameMatch[1];
            break;
          }
        }

        endpoints.push({
          file: relativePath,
          line: i + 1,
          httpMethod,
          classPath: classMapping,
          methodPath: '',
          fullPath,
          methodName,
          permission: ''
        });
      }
    }

    return endpoints;
  }

  /**
   * Extract class-level @RequestMapping value
   */
  extractClassMapping(content) {
    const match = content.match(
      /@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']\s*\)/
    );
    return match ? match[1] : '';
  }

  /**
   * Combine class-level and method-level paths
   */
  combinePaths(classPath, methodPath) {
    if (!classPath && !methodPath) return '/';
    if (!classPath) return methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
    if (!methodPath) return classPath;

    const base = classPath.endsWith('/') ? classPath.slice(0, -1) : classPath;
    const sub = methodPath.startsWith('/') ? methodPath : `/${methodPath}`;
    return `${base}${sub}`;
  }
}
