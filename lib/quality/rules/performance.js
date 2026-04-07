// lib/quality/rules/performance.js - 性能规则集
// 评估代码性能: 算法效率、内存使用、I/O操作、循环优化等

/**
 * 性能规则集
 *
 * 规则列表：
 * - loopEfficiency: 循环效率（避免嵌套循环、减少循环内操作）
 * - memoryAllocation: 内存分配优化
 * - ioOperation: I/O操作效率
 * - stringConcatenation: 字符串拼接优化
 * - asyncPattern: 异步模式最佳实践
 * - dataStructure: 数据结构选择
 */

const rules = [
  {
    name: 'loopEfficiency',
    description: '循环效率: 避免深层嵌套循环，循环内避免重复计算',
    maxScore: 25,
    check(code, ext) {
      const lines = code.split('\n');
      const issues = [];

      // 检测嵌套循环
      let maxNestingDepth = 0;
      let currentNesting = 0;
      let loopPositions = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (/\b(for|while|do)\s*\(/.test(line) || /\.forEach|\.map|\.filter|\.reduce|\.some|\.every/.test(line)) {
          currentNesting++;
          loopPositions.push({ line: i + 1, depth: currentNesting });
          maxNestingDepth = Math.max(maxNestingDepth, currentNesting);
        }

        // 简化的块结束检测
        const closeBraces = (line.match(/\}/g) || []).length;
        currentNesting = Math.max(0, currentNesting - closeBraces);
      }

      if (maxNestingDepth >= 3) {
        issues.push({
          type: 'deep_nesting',
          severity: 'high',
          detail: `检测到${maxNestingDepth}层嵌套循环`,
          line: loopPositions.find(p => p.depth === maxNestingDepth)?.line
        });
      }

      // 检测循环内的重复计算
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 在for循环条件中检测属性访问或方法调用
        const forConditionMatch = line.match(/for\s*\([^;]*;\s*([^;]+)\s*(?:<|>|<=|>=)[^;]*;/);
        if (forConditionMatch) {
          const condition = forConditionMatch[1];
          // 如果是 .length 或 .size 以外的调用/属性访问
          if (/\.\w+\(?\)?/.test(condition) && !/\.(length|size)$/.test(condition)) {
            issues.push({
              type: 'repeated_computation',
              severity: 'medium',
              detail: `循环条件中有可能的重复计算: ${condition.trim()}`,
              line: i + 1
            });
          }
        }
      }

      // 检测循环内创建新对象/数组
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const indent = line.match(/^(\s*)/)?.[1]?.length || 0;

        // 判断是否在循环内部（基于缩进）
        if (indent >= 4 && (
          /new\s+(Array|Object|Map|Set|Date)\b/.test(line) ||
          /\[\]/.test(line) && /=\s*\[/.test(line) ||
          /\{\}/.test(line) && /=\s*\{/.test(line)
        )) {
          issues.push({
            type: 'allocation_in_loop',
            severity: 'low',
            detail: '循环内可能有不必要的对象分配',
            line: i + 1
          });
        }
      }

      return {
        passed: issues.filter(i => i.severity === 'high').length === 0,
        deduction: Math.min(
          issues.filter(i => i.severity === 'high').length * 10 +
          issues.filter(i => i.severity === 'medium').length * 5 +
          issues.filter(i => i.severity === 'low').length * 2,
          25
        ),
        message: issues.length > 0
          ? `发现${issues.length}个性能问题: ${issues.map(i => i.detail).join('; ')}`
          : '循环结构效率良好',
        suggestion: '将循环不变量提取到循环外；使用Map/Set替代数组的O(n)查找；考虑用高阶函数替代嵌套循环',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  },

  {
    name: 'memoryAllocation',
    description: '内存分配: 避免不必要的对象创建和大数组操作',
    maxScore: 20,
    check(code, ext) {
      const lines = code.split('\n');
      const issues = [];

      let largeArrayCreations = 0;
      let objectCreationsInHotPath = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 大数组字面量（超过10个元素）
        const arrayLiteral = line.match(/\[(?:[^,\]]+,){10,}[^]\]]*\]/);
        if (arrayLiteral) {
          largeArrayCreations++;
          if (largeArrayCreations <= 3) {
            issues.push({
              type: 'large_array_literal',
              detail: '大数组字面量',
              line: i + 1
            });
          }
        }

        // 频繁的临时对象创建模式
        if (/new\s+Object\(|new\s+Array\(/.test(line)) {
          objectCreationsInHotPath++;
        }

        // 不必要的展开运算符复制大数组
        if (/\[\.\.\.(?!.*(?:filter|map|slice))/.test(line)) {
          issues.push({
            type: 'unnecessary_spread',
            detail: '不必要的数组展开拷贝',
            line: i + 1
          });
        }

        // 字符串拼接转数组再join的模式（低效）
        if ((line.includes('.split(') && lines.slice(i, i + 4).join('\n').includes('.join('))) ||
            (line.includes('.push(') && lines.slice(i, i + 5).join('\n').includes('"))) {
          // 可能存在低效的字符串构建模式
        }
      }

      // 检测可能的内存泄漏模式
      const hasEventListenersWithoutCleanup = /addEventListener/.test(code) && !/removeEventListener/.test(code);
      if (hasEventListenersWithoutCleanup) {
        issues.push({
          type: 'potential_memory_leak',
          detail: '事件监听器可能未清理',
          severity: 'high'
        });
      }

      // 检测闭包中引用大量数据
      const closureWithLargeData = /function\s*\([^)]*\)\s*\{[\s\S]{500,}return/.test(code);
      if (closureWithLargeData) {
        issues.push({
          type: 'heavy_closure',
          detail: '闭包可能捕获过多变量'
        });
      }

      return {
        passed: issues.filter(i => i.severity === 'high').length === 0,
        deduction: Math.min(issues.length * 3, 20),
        message: issues.length > 0
          ? `发现${issues.length}个内存相关的问题`
          : '内存使用模式良好',
        suggestion: '复用对象而非频繁创建；使用对象池管理短生命周期对象；及时解除大对象的引用',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  },

  {
    name: 'ioOperation',
    description: 'I/O操作: 批量I/O、异步I/O、避免同步阻塞',
    maxScore: 20,
    check(code, ext) {
      const lines = code.split('\n');
      const issues = [];

      // 同步I/O操作（在Node.js中应尽量避免）
      const syncPatterns = [
        { pattern: /readFileSync/, name: '同步文件读取', severity: 'high' },
        { pattern: /writeFileSync/, name: '同步文件写入', severity: 'high' },
        { pattern: /existsSync/, name: '同步文件检查', severity: 'medium' },
        { pattern: /\.execSync\(/, name: '同步子进程', severity: 'high' },
        { pattern: /require\s*\(['"]fs['"]\)/, name: 'fs模块引入', severity: 'info' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { pattern, name, severity } of syncPatterns) {
          if (pattern.test(line)) {
            // 排除在注释中的引用
            if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              issues.push({
                type: 'sync_io',
                operation: name,
                severity,
                line: i + 1
              });
            }
          }
        }
      }

      // N+1查询模式检测（简化版：循环内有数据库/I/O调用）
      let loopDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/\b(for|while|forEach|map|filter)\b/.test(line)) {
          loopDepth++;
        }

        if (loopDepth > 0 && /(\.query|\.execute|\.find|fetch\(|axios|request|readFile|writeFile)\s*\(/.test(line)) {
          issues.push({
            type: 'n_plus_one',
            detail: '循环内可能有I/O操作（N+1问题）',
            severity: 'high',
            line: i + 1
          });
        }

        const closeBraces = (line.match(/\}/g) || []).length;
        loopDepth = Math.max(0, loopDepth - closeBraces);
      }

      // 检查是否有批量处理替代方案
      const hasBatchOperation = /Promise\.all|batch|bulk|multi/.test(code);

      return {
        passed: issues.filter(i => i.severity === 'high').length === 0,
        deduction: Math.min(
          issues.filter(i => i.severity === 'high').length * 8 +
          issues.filter(i => i.severity === 'medium').length * 3,
          20
        ),
        message: issues.length > 0
          ? `发现${issues.length}个I/O相关问题`
          : 'I/O操作模式良好',
        suggestion: '使用异步API替代同步API；将循环内的I/O操作提取为批量操作；使用Promise.all并行化独立请求',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  },

  {
    name: 'stringConcatenation',
    description: '字符串拼接: 使用模板字面量或数组join替代多次+拼接',
    maxScore: 10,
    check(code, ext) {
      const lines = code.split('\n');
      const inefficientPatterns = [];

      // 检测循环内的字符串+=操作
      let inLoop = false;
      let loopIndent = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;

        // 检测循环开始
        if (/\b(for|while|do)\s*\(/.test(trimmed) || /\.forEach|\.map|\.filter|\.reduce/.test(trimmed)) {
          inLoop = true;
          loopIndent = currentIndent;
        }

        // 检测字符串拼接
        if (inLoop && currentIndent > loopIndent) {
          const concatMatch = trimmed.match(/\w+\s*\+=\s*["']/);
          if (concatMatch) {
            inefficientPatterns.push({
              type: 'concat_in_loop',
              line: i + 1,
              context: trimmed.substring(0, 50)
            });
          }
        }

        // 检测多级链式+
        const chainedPlus = trimmed.match(/\+\s*["'][^"]*["']\s*\+\s*["']/);
        if (chainedPlus && !trimmed.startsWith('//')) {
          inefficientPatterns.push({
            type: 'chained_concat',
            line: i + 1,
            context: trimmed.substring(0, 60)
          });
        }

        // 循环结束
        if (inLoop && currentIndent <= loopIndent && trimmed === '}') {
          inLoop = false;
        }
      }

      return {
        passed: inefficientPatterns.length <= 1,
        deduction: Math.min(inefficientPatterns.length * 3, 10),
        message: inefficientPatterns.length > 0
          ? `发现${inefficientPatterns.length}处低效字符串拼接`
          : '字符串操作方式高效',
        suggestion: '使用模板字符串(``)替代+拼接；循环中使用数组收集元素后join',
        line: inefficientPatterns.length > 0 ? inefficientPatterns[0].line : null
      };
    }
  },

  {
    name: 'asyncPattern',
    description: '异步模式: 正确使用async/await和Promise',
    maxScore: 10,
    check(code, ext) {
      const issues = [];

      // 检测不必要的await（非Promise值上的await）
      const unnecessaryAwaits = [];
      const lines = code.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // await常量或简单值
        if (/await\s+\d+|await\s+"|await\s+'|await\s+(true|false|null|undefined)/.test(line)) {
          unnecessaryAwaits.push({ line: i + 1, context: line.trim().substring(0, 50) });
        }

        // async函数中没有await
        if (/async\s+function|=\s*async/.test(line)) {
          const funcBody = this._extractUntilClose(lines, i);
          if (funcBody && !/\bawait\b/.test(funcBody)) {
            issues.push({
              type: 'async_without_await',
              detail: 'async函数中没有await调用',
              line: i + 1
            });
          }
        }
      }

      // 检测顺序await可并行化的场景
      const sequentialAwaits = this._findSequentialAwaits(lines);
      if (sequentialAwaits.length > 0) {
        issues.push({
          type: 'sequential_awaits',
          detail: `${sequentialAwaits.length}处顺序await可能可以并行化`,
          suggestions: sequentialAwaits
        });
      }

      // 检测未处理的Promise rejection
      if (/new Promise\(/.test(code) && !/reject\(/.test(code)) {
        issues.push({
          type: 'unhandled_rejection',
          detail: 'Promise构造缺少reject处理'
        });
      }

      return {
        passed: issues.length === 0,
        deduction: Math.min(issues.length * 3, 10),
        message: issues.length > 0
          ? `发现${issues.length}个异步模式问题`
          : '异步模式使用正确',
        suggestion: '移除不必要的await；使用Promise.all并行独立操作；确保所有Promise路径都有错误处理',
        line: issues.length > 0 ? issues[0].line : null
      };
    },

    _extractUntilClose(lines, startIndex) {
      let braces = 0;
      let started = false;
      const body = [];

      for (let i = startIndex; i < lines.length && body.length < 100; i++) {
        for (const ch of lines[i]) {
          if (ch === '{') { braces++; started = true; }
          if (ch === '}') braces--;
        }
        if (started) body.push(lines[i]);
        if (started && braces === 0) break;
      }
      return body.join('\n');
    },

    _findSequentialAwaits(lines) {
      const sequential = [];
      for (let i = 0; i < lines.length - 2; i++) {
        const line1 = lines[i].trim();
        const line2 = lines[i + 1].trim();

        if (/^await\s+/.test(line1) && /^await\s+/.test(line2)) {
          // 排除后者依赖前者结果的场景
          if (!this._isDependent(lines[i], lines[i + 1])) {
            sequential.push({
              line1: i + 1,
              line2: i + 2
            });
          }
        }
      }
      return sequential;
    },

    _isDependent(line1, line2) {
      // 简单判断：第二行是否使用了第一行的赋值结果
      const assignMatch = line1.match(/(?:const|let|var)\s+(\w+)\s*=/);
      if (assignMatch) {
        return line2.includes(assignMatch[1]);
      }
      return false;
    }
  },

  {
    name: 'dataStructure',
    description: '数据结构选择: 根据操作类型选择合适的数据结构',
    maxScore: 15,
    check(code, ext) {
      const issues = [];
      const lines = code.split('\n');

      // 数组includes/find/indexOf用于大数据集
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 在循环中使用数组的includes/find/indexOf
        if (/\b(for|while|forEach)\b/.test(lines[Math.max(0, i - 1)]?.trim() || '')) {
          if (/\.(includes|indexOf|find|findIndex)\s*\(/.test(line)) {
            const arrVar = line.match(/(\w+)\.(includes|indexOf|find)/)?.[1];
            if (arrVar) {
              issues.push({
                type: 'array_lookup_in_loop',
                detail: `循环中使用数组.${line.match(/\.\w+/)?.[0]}查找，建议改用Set`,
                line: i + 1,
                variable: arrVar
              });
            }
          }
        }
      }

      // 对象属性枚举用于频繁查找
      const objectKeysUsage = (code.match(/Object\.keys\([^)]+\)\.find/g) || []).length;
      if (objectKeysUsage > 2) {
        issues.push({
          type: 'object_keys_frequent',
          detail: `频繁使用Object.keys().find() (${objectKeysUsage}次)，考虑使用Map`,
          count: objectKeysUsage
        });
      }

      // 数组shift/unshift操作（O(n)复杂度）
      const shiftOps = (code.match(/\.\b(shift|unshift)\s*\(/g) || []).length;
      if (shiftOps > 2) {
        issues.push({
          type: 'expensive_array_ops',
          detail: `多处使用shift/unshift操作(${shiftOps}次)，时间复杂度O(n)`
        });
      }

      return {
        passed: issues.filter(i => i.type === 'array_lookup_in_loop').length === 0,
        deduction: Math.min(
          issues.filter(i => i.type === 'array_lookup_in_loop').length * 5 +
          issues.filter(i => i.type !== 'array_lookup_in_loop').length * 2,
          15
        ),
        message: issues.length > 0
          ? `发现${issues.length}个数据结构选择问题`
          : '数据结构使用合理',
        suggestion: '频繁查找场景使用Set/Map(O(1))替代数组(O(n))；队列操作考虑LinkedList；键值对优先使用Map',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  }
];

export default rules;
