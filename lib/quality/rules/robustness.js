// lib/quality/rules/robustness.js - 健壮性规则集
// 评估代码健壮性: 错误处理、边界条件、异常覆盖、null检查等

/**
 * 健壮性规则集
 *
 * 规则列表：
 * - nullCheck: null/undefined检查
 * - errorHandling: 异常处理完整性
 * - boundaryValidation: 边界值校验
 * - asyncErrorHandling: 异步错误处理
 * - typeChecking: 类型检查
 * - resourceCleanup: 资源清理（文件句柄/连接）
 */

const rules = [
  {
    name: 'nullCheck',
    description: 'Null/Undefined检查: 对可能为空的值进行防御性检查',
    maxScore: 20,
    check(code, ext) {
      const lines = code.split('\n');
      const riskyPatterns = [];
      let safePatterns = 0;

      // 检测可能为空但未检查的访问模式
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 排除注释和空行
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.length === 0) continue;
        if (trimmed.startsWith('if') || trimmed.startsWith('return')) continue;

        // 检测链式访问未保护: obj.prop.subProp
        const chainAccess = line.match(/\w+\.\w+(\.\w+)+/g);
        if (chainAccess) {
          for (const access of chainAccess) {
            // 检查是否有可选链保护
            if (!line.includes('?.') && !access.includes('?.')) {
              // 检查前面几行是否有if守卫
              const baseVar = access.split('.')[0];
              const hasGuard = this._checkPrecedingGuard(lines, i, baseVar);

              if (!hasGuard) {
                riskyPatterns.push({
                  pattern: access,
                  line: i + 1,
                  context: trimmed.substring(0, 60)
                });
              } else {
                safePatterns++;
              }
            }
          }
        }

        // 检测数组访问无边界检查: arr[index]
        const arrayAccess = line.match(/\w+\[\w+(?!\s*\?\s*\.)/g);
        if (arrayAccess && !trimmed.includes('.length')) {
          for (const access of arrayAccess) {
            if (!/^\d+$/.test(access.match(/\[(\w+)\]/)?.[1])) { // 非字面量索引
              const arrVar = access.split('[')[0];
              const hasBoundCheck = this._checkPrecedingGuard(lines, i, arrVar, ['length', 'size', '>']);
              if (!hasBoundCheck) {
                riskyPatterns.push({
                  pattern: access,
                  line: i + 1,
                  context: trimmed.substring(0, 60)
                });
              }
            }
          }
        }
      }

      // 去重
      const uniqueRisky = [...new Set(riskyPatterns.map(r => r.pattern))];

      return {
        passed: uniqueRisky.length <= 2,
        deduction: Math.min(uniqueRisky.length * 4, 20),
        message: uniqueRisky.length > 0
          ? `发现${uniqueRisky.length}处可能的空值风险访问`
          : '空值处理良好',
        suggestion: '使用可选链(?.)、空值合并(??)运算符，或添加前置null检查',
        line: riskyPatterns.length > 0 ? riskyPatterns[0].line : null
      };
    },

    _checkPrecedingGuard(lines, currentLineIndex, varName, extraKeywords = []) {
      // 检查前10行是否有对该变量的守卫
      const searchRange = lines.slice(Math.max(0, currentLineIndex - 10), currentLineIndex);
      return searchRange.some(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('if') || trimmed.startsWith('&&')) {
          const conditions = [varName, `${varName} !==`, `${varName} !=`, ...extraKeywords];
          return conditions.some(cond => trimmed.includes(cond));
        }
        return false;
      });
    }
  },

  {
    name: 'errorHandling',
    description: '异常处理: 关键操作应有try-catch或错误回调',
    maxScore: 25,
    check(code, ext) {
      const lines = code.split('\n');
      const riskyOperations = [];
      let protectedOperations = 0;

      // 需要错误保护的操作模式
      const dangerousPatterns = [
        { pattern: /JSON\.parse\s*\(/, name: 'JSON.parse' },
        { pattern: /fs\.(readFile|writeFile|readFileSync|writeFileSync)\s*\(/, name: 'FS操作' },
        { pattern: /\.(fetch|axios|request|get|post|put|delete)\s*\(/, name: 'HTTP请求' },
        { pattern: /require\s*\(/, name: '模块加载' },
        { pattern: /new\s+\w+.*\(/, name: '构造函数调用' },
        { pattern: /\.exec\(|\.spawn\(|\.fork\(/, name: '子进程操作' },
        { pattern: /database|\.query\(|\.execute\(/i, name: '数据库操作' },
        { pattern: /localStorage|sessionStorage/i, name: '存储操作' }
      ];

      let inTryBlock = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 追踪try块
        if (/^\s*try\s*{/.test(line)) inTryBlock++;
        if (/^\s*}\s*(catch|finally)\s*\(?.*?\)?\s*{/.test(line)) inTryBlock = Math.max(0, inTryBlock - 1);

        for (const { pattern, name } of dangerousPatterns) {
          if (pattern.test(line)) {
            if (inTryBlock > 0 || this._hasPromiseCatch(lines, i)) {
              protectedOperations++;
            } else {
              // 排除简单的赋值语句（可能是默认值）
              if (!(line.includes('=') && !line.includes('await'))) {
                riskyOperations.push({
                  operation: name,
                  line: i + 1,
                  context: line.trim().substring(0, 60)
                });
              }
            }
          }
        }
      }

      // 检查函数整体是否有catch
      const hasGlobalErrorHandler = /catch\s*\(/.test(code) || /\.catch\s*\(/.test(code);

      return {
        passed: riskyOperations.length === 0 || (riskyOperations.length <= 2 && hasGlobalErrorHandler),
        deduction: Math.min(riskyOperations.length * 5, 25),
        message: riskyOperations.length > 0
          ? `发现${riskyOperations.length}个未保护的易错操作: ${[...new Set(riskyOperations.map(r => r.operation))].join(', ')}`
          : `所有${protectedOperations}个危险操作均有错误处理`,
        suggestion: '使用try-catch包装危险操作，或使用Promise.catch()链式处理异步错误',
        line: riskyOperations.length > 0 ? riskyOperations[0].line : null
      };
    },

    _hasPromiseCatch(lines, currentIndex) {
      // 检查后续3行内是否有.catch()
      for (let j = currentIndex; j < Math.min(currentIndex + 4, lines.length); j++) {
        if (/\.catch\s*\(/.test(lines[j])) return true;
      }
      return false;
    }
  },

  {
    name: 'boundaryValidation',
    description: '边界值校验: 函数参数和外部输入应验证范围和类型',
    maxScore: 20,
    check(code, ext) {
      const functions = this._extractFunctionSignatures(code);
      const unvalidatedFunctions = [];

      for (const func of functions) {
        // 跳过没有参数的函数
        if (func.params.length === 0) continue;

        // 跳过极短的函数体（可能是简单封装）
        if (func.bodyLines < 5) continue;

        // 检查函数体内是否有校验逻辑
        const hasValidation = this._hasParameterValidation(func.body);

        // 如果有多个参数且无校验，标记为问题
        if (!hasValidation && func.params.length >= 1) {
          unvalidatedFunctions.push({
            name: func.name,
            params: func.params,
            line: func.startLine
          });
        }
      }

      return {
        passed: unvalidatedFunctions.length === 0,
        deduction: Math.min(unvalidatedFunctions.length * 4, 20),
        message: unvalidatedFunctions.length > 0
          ? `${unvalidatedFunctions.length}个函数缺少参数校验: ${unvalidatedFunctions.map(f => f.name).join(', ')}`
          : '函数参数校验完善',
        suggestion: '在函数入口处添加参数类型和范围校验，使用typeof、instanceof或专门的校验库',
        line: unvalidatedFunctions.length > 0 ? unvalidatedFunctions[0].line : null
      };
    },

    _extractFunctionSignatures(code) {
      const functions = [];
      const lines = code.split('\n');

      const patterns = [
        /(?:^|\s)(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*\w+)?\s*=>/g
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          const name = match[1];
          const paramsStr = match[2] || '';
          const params = paramsStr.split(',').map(p => p.trim().split('=').shift()?.trim()).filter(Boolean);

          // 简单估算函数体行数
          const startPos = match.index;
          const lineNum = code.substring(0, startPos).split('\n').length;

          functions.push({ name, params, startLine: lineNum, body: '', bodyLines: 0 });
        }
      }

      // 补充函数体信息（简化版）
      let braceStack = 0;
      let currentFunc = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 检测是否是某个记录的函数开始
        const funcRecord = functions.find(f => f.startLine === i + 1);
        if (funcRecord && braceStack === 0) {
          currentFunc = funcRecord;
          funcRecord.bodyLines = 0;
        }

        if (currentFunc) {
          currentFunc.body += line + '\n';
          currentFunc.bodyLines++;
        }

        for (const ch of line) {
          if (ch === '{') braceStack++;
          if (ch === '}') {
            braceStack--;
            if (braceStack === 0) currentFunc = null;
          }
        }
      }

      return functions;
    },

    _hasParameterValidation(body) {
      const validationPatterns = [
        /typeof\s+\w+\s*!==?/,
        /instanceof\s+/,
        /Array\.isArray/,
        /===\s*(undefined|null|''|NaN)/,
        /!==\s*(undefined|null|''|NaN)/,
        /==\s*null/,
        /!=\s*null/,
        /\bguard\b/,
        /\bassert\b/,
        /\bvalidate\b/,
        /\bcheck\b/,
        /throw new.*Error/,
        /Number\.(isFinite|isInteger|isNaN)/,
        /\.isRequired/,
        /joi|yup|zod/
      ];

      return validationPatterns.some(p => p.test(body));
    }
  },

  {
    name: 'asyncErrorHandling',
    description: '异步错误处理: async/await应有错误处理机制',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const unprotectedAsyncs = [];

      // 查找async函数
      const asyncFuncPattern = /async\s+function\s+(\w+)/g;
      const asyncArrowPattern = /(?:const|let|var)\s+(\w+)\s*=\s*async/g;

      let asyncMatch;
      while ((asyncMatch = asyncFuncPattern.exec(code)) !== null) {
        const funcStart = code.substring(0, asyncMatch.index).split('\n').length;
        const funcBody = this._extractBlockBody(lines, funcStart - 1);

        if (funcBody && !this._blockHasTryCatch(funcBody)) {
          unprotectedAsyncs.push({
            name: asyncMatch[1],
            type: 'function',
            line: funcStart
          });
        }
      }

      while ((asyncMatch = asyncArrowPattern.exec(code)) !== null) {
        const arrowStart = code.substring(0, asyncMatch.index).split('\n').length;
        const arrowBody = this._extractBlockBody(lines, arrowStart - 1);

        if (arrowBody && !this._blockHasTryCatch(arrowBody)) {
          unprotectedAsyncs.push({
            name: asyncMatch[1],
            type: 'arrow',
            line: arrowStart
          });
        }
      }

      // 检查独立的await调用（不在async函数内的await）
      const standaloneAwaits = [];
      for (let i = 0; i < lines.length; i++) {
        if (/^\s*await\s+/.test(lines[i]) || /(?<!async\s)\bawait\s+/.test(lines[i])) {
          // 检查是否在async函数上下文中
          const precedingContext = lines.slice(Math.max(0, i - 20), i).join('\n');
          if (!/async\s+function|=\s*async/.test(precedingContext)) {
            standaloneAwaits.push(i + 1);
          }
        }
      }

      return {
        passed: unprotectedAsyncs.length === 0 && standaloneAwaits.length === 0,
        deduction: Math.min((unprotectedAsyncs.length + standaloneAwaits.length) * 3, 15),
        message: unprotectedAsyncs.length > 0 || standaloneAwaits.length > 0
          ? `${unprotectedAsyncs.length}个async函数缺少try-catch, ${standaloneAwaits.length}处独立await调用`
          : '异步错误处理完善',
        suggestion: '在async函数中使用try-catch-finally，或返回Promise并让调用者处理错误',
        line: unprotectedAsyncs.length > 0 ? unprotectedAsyncs[0].line :
               standaloneAwaits.length > 0 ? standaloneAwaits[0] : null
      };
    },

    _extractBlockBody(lines, startIndex) {
      let braceCount = 0;
      let started = false;
      const body = [];

      for (let i = startIndex; i < lines.length; i++) {
        for (const ch of lines[i]) {
          if (ch === '{') { braceCount++; started = true; }
          if (ch === '}') braceCount--;
        }
        if (started) body.push(lines[i]);
        if (started && braceCount === 0) break;
      }

      return body.join('\n');
    },

    _blockHasTryCatch(block) {
      return /\btry\s*{/.test(block) && /\bcatch\s*\(/.test(block);
    }
  },

  {
    name: 'typeChecking',
    description: '类型检查: 关键位置应进行运行时类型验证',
    maxScore: 10,
    check(code, ext) {
      const issues = [];
      const lines = code.split('\n');

      // 检测可能需要类型检查的位置
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 函数参数解构但无默认值
        const destructureNoDefault = line.match(/function\s*\w*\((\{[^}]+\})\)/);
        if (destructureNoDefault && !line.includes('=') && !line.includes('??')) {
          // 检查后续几行是否有类型检查
          const nextLines = lines.slice(i + 1, Math.min(i + 6, lines.length));
          const hasTypeCheck = nextLines.some(l =>
            /typeof|instanceof|=== (undefined|null)|\?\.|??/.test(l)
          );
          if (!hasTypeCheck) {
            issues.push({
              type: 'destructure_no_check',
              line: i + 1,
              context: line.substring(0, 50)
            });
          }
        }

        // 使用可能为非数组的对象的方法
        const arrayMethodCall = line.match(/\w+\.(map|filter|reduce|forEach|find|some|every)\s*\(/);
        if (arrayMethodCall) {
          const varName = arrayMethodCall[0].split('.')[0];
          const prevLines = lines.slice(Math.max(0, i - 3), i);
          const isArrayCheck = prevLines.some(l =>
            l.includes(`Array.isArray(${varName})`) ||
            l.includes(`${varName} instanceof Array`) ||
            l.includes(`${varName}?.`)
          );
          if (!isArrayCheck && !line.includes('?.')) {
            issues.push({
              type: 'array_method_no_type_check',
              var: varName,
              line: i + 1,
              method: arrayMethodCall[1]
            });
          }
        }
      }

      const uniqueIssues = [...new Set(issues.map(i => `${i.type}:${i.line}`))];

      return {
        passed: uniqueIssues.length <= 1,
        deduction: Math.min(uniqueIssues.length * 3, 10),
        message: uniqueIssues.length > 0
          ? `发现${uniqueIssues.length}处缺少类型检查`
          : '关键位置的类型检查到位',
        suggestion: '对用户输入和外部API返回值进行类型和存在性检查',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  },

  {
    name: 'resourceCleanup',
    description: '资源清理: 文件句柄、数据库连接、网络连接应在使用后关闭',
    maxScore: 10,
    check(code, ext) {
      const lines = code.split('\n');
      const resources = [];
      let cleanedResources = 0;

      // 检测资源获取模式
      const resourcePatterns = [
        { open: /createReadStream|createWriteStream|openSync/, close: /\.close\(\)|\.destroy\(\)/, name: '流' },
        { open: /createConnection|getConnection|getClient/, close: /\.(close|end|release|disconnect)\(\)/, name: '数据库连接' },
        { open: /new\s+Server|listen\s*\(/, close: /\.close\(\)/, name: '服务器' },
        { open: /setTimeout|setInterval/, close: /(clearTimeout|clearInterval)\(/, name: '定时器' },
        { open: /addEventListener|on\s*\(/, close: /removeEventListener|off\s*\(/, name: '事件监听器' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { open, close, name } of resourcePatterns) {
          if (open.test(line)) {
            // 检查后续代码中是否有对应的清理操作
            const remainingCode = lines.slice(i).join('\n');
            const hasCleanup = close.test(remainingCode);

            if (hasCleanup) {
              cleanedResources++;
            } else {
              // 检查是否使用了自动管理模式（如using声明、try-finally）
              const nextLines = lines.slice(i, Math.min(i + 30, lines.length)).join('\n');
              const autoManaged = /try\s*{[\s\S]*?}\s*finally/.test(nextLines) ||
                                 /using\s+/.test(nextLines) ||
                                 /\.finally\(/.test(nextLines);

              if (!autoManaged) {
                resources.push({
                  type: name,
                  openLine: i + 1,
                  context: line.trim().substring(0, 50)
                });
              } else {
                cleanedResources++;
              }
            }
          }
        }
      }

      return {
        passed: resources.length === 0,
        deduction: Math.min(resources.length * 3, 10),
        message: resources.length > 0
          ? `发现${resources.length}处资源可能未正确释放: ${[...new Set(resources.map(r => r.type))].join(', ')}`
          : `所有${cleanedResources}个资源均有清理逻辑`,
        suggestion: '使用try-finally确保资源释放，或使用using声明（Node.js 16+）管理资源生命周期'
      };
    }
  }
];

export default rules;
