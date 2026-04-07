// lib/quality/rules/readability.js - 可读性规则集
// 评估代码可读性: 命名规范、注释质量、函数复杂度、行长度等

/**
 * 可读性规则集
 *
 * 规则列表：
 * - namingConvention: 命名规范检查（驼峰/下划线/常量大写）
 * - functionLength: 函数长度检查
 * - lineLength: 行长度检查
 * - cyclomaticComplexity: 圈复杂度检查
 * - commentCoverage: 注释覆盖率检查
 * - magicNumbers: 魔法数字检查
 * - consistentIndentation: 缩进一致性检查
 */

const rules = [
  {
    name: 'namingConvention',
    description: '命名规范: 变量/函数使用camelCase，常量使用UPPER_SNAKE_CASE，类使用PascalCase',
    maxScore: 15,
    check(code, ext) {
      const issues = [];
      const lines = code.split('\n');

      // 检测变量声明 (let/const/var)
      const varDeclarations = code.match(/(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      let badVarCount = 0;

      for (const decl of varDeclarations) {
        const name = decl.split(/\s+/)[1];
        // 排除常量(全大写)和单个字符
        if (/^[a-z]$/.test(name)) continue;
        if (/^[A-Z_]+$/.test(name)) continue; // 常量允许

        // 检查是否为有效的camelCase或snake_case
        if (!/^[a-z][a-zA-Z0-9]*$/.test(name) && !/^[a-z][a-z0-9_]*[a-z0-9]$/.test(name)) {
          badVarCount++;
        }
      }

      // 检测函数声明
      const funcDeclarations = code.match(/(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\(|function))/g) || [];
      let badFuncCount = 0;

      for (const decl of funcDeclarations) {
        const match = decl.match(/(?:function\s+|=\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (match && match[1]) {
          const name = match[1];
          // 函数应该是camelCase（构造函数/PascalCase除外）
          if (!/^[a-z][a-zA-Z0-9]*$/.test(name) && /^[A-Z]/.test(name)) {
            // PascalCase可能是类或构造函数，不算违规
          } else if (!/^[a-z][a-zA-Z0-9]*$/i.test(name)) {
            badFuncCount++;
          }
        }
      }

      // 检测类声明
      const classDeclarations = code.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      let badClassCount = 0;

      for (const decl of classDeclarations) {
        const name = decl.replace('class ', '');
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
          badClassCount++;
          issues.push({ line: this._findLine(lines, decl), message: `类名"${name}"应使用PascalCase` });
        }
      }

      const totalBad = badVarCount + badFuncCount + badClassCount;

      return {
        passed: totalBad <= 2,
        deduction: Math.min(totalBad * 2, 15),
        message: totalBad > 0
          ? `发现${totalBad}个命名不规范问题 (${badVarCount}变量, ${badFuncCount}函数, ${badClassCount}类)`
          : '命名规范符合要求',
        suggestion: '使用camelCase命名变量和函数，UPPER_SNAKE_CASE命名常量，PascalCase命名类'
      };
    },

    _findLine(lines, pattern) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) return i + 1;
      }
      return null;
    }
  },

  {
    name: 'functionLength',
    description: '函数长度: 单个函数体不超过50行',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const longFunctions = [];

      // 匹配函数定义
      const funcPatterns = [
        /(?:function\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*\{)/g,
        /^(?:async\s+)?function\s+\w+\s*\(/gm,
        /^\s*(?:\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/gm
      ];

      let braceStack = 0;
      let funcStartLine = null;
      let funcName = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // 检测函数开始
        if ((trimmed.match(/^(?:async\s+)?function\s+/) ||
             trimmed.match(/^(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(?/) ||
             trimmed.match(/^\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/)) &&
            braceStack === 0) {
          funcStartLine = i + 1;
          const nameMatch = trimmed.match(/(?:function|const|let|var)\s+(\w+)/);
          funcName = nameMatch ? nameMatch[1] : 'anonymous';
        }

        // 跟踪大括号
        for (const char of line) {
          if (char === '{') braceStack++;
          if (char === '}') {
            braceStack--;
            if (braceStack === 0 && funcStartLine !== null) {
              const funcLength = i - funcStartLine + 1;
              if (funcLength > 50) {
                longFunctions.push({
                  name: funcName,
                  startLine: funcStartLine,
                  endLine: i + 1,
                  length: funcLength
                });
              }
              funcStartLine = null;
              funcName = '';
            }
          }
        }
      }

      return {
        passed: longFunctions.length === 0,
        deduction: Math.min(longFunctions.length * 5, 15),
        message: longFunctions.length > 0
          ? `发现${longFunctions.length}个超长函数(${longFunctions.map(f => `${f.name}:${f.length}行`).join(', ')})`
          : '所有函数长度符合要求',
        suggestion: '将超过50行的函数拆分为更小的子函数，每个函数只做一件事',
        line: longFunctions.length > 0 ? longFunctions[0].startLine : null
      };
    }
  },

  {
    name: 'lineLength',
    description: '行长度: 单行不超过120字符',
    maxScore: 10,
    check(code, ext) {
      const lines = code.split('\n');
      const longLines = [];

      for (let i = 0; i < lines.length; i++) {
        // 排除注释中的长URL或import语句
        if (lines[i].length > 120 &&
            !lines[i].trim().startsWith('http') &&
            !lines[i].trim().startsWith('import') &&
            !lines[i].includes('://')) {
          longLines.push({
            line: i + 1,
            length: lines[i].length,
            preview: lines[i].substring(0, 80) + '...'
          });
        }
      }

      return {
        passed: longLines.length <= 3,
        deduction: Math.min(longLines.length * 2, 10),
        message: longLines.length > 0
          ? `发现${longLines.length}行超过120字符`
          : '所有行长度符合要求',
        suggestion: '将长行拆分为多行，或提取为有意义的变量名',
        line: longLines.length > 0 ? longLines[0].line : null
      };
    }
  },

  {
    name: 'cyclomaticComplexity',
    description: '圈复杂度: 单个函数不超过10',
    maxScore: 20,
    check(code, ext) {
      const complexFunctions = [];

      // 简化的圈复杂度检测：统计分支语句数量
      const branchPatterns = [
        /\bif\b/g,
        /\belse\s+if\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bswitch\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\?\./g,   // 可选链
        /\|\|/g,    // 逻辑或
        /\&\&/g     // 逻辑与
      ];

      // 按函数分割并计算复杂度
      const functions = this._extractFunctions(code);

      for (const func of functions) {
        let complexity = 1; // 基础复杂度

        for (const pattern of branchPatterns) {
          const matches = func.body.match(pattern);
          complexity += matches ? matches.length : 0;
        }

        // 三元运算符也增加复杂度
        const ternaries = func.body.match(/\?[^:]+:/g);
        complexity += ternaries ? ternaries.length : 0;

        if (complexity > 10) {
          complexFunctions.push({
            name: func.name || 'anonymous',
            complexity,
            startLine: func.startLine
          });
        }
      }

      return {
        passed: complexFunctions.length === 0,
        deduction: Math.min(complexFunctions.reduce((sum, f) => sum + (f.complexity - 10), 0), 20),
        message: complexFunctions.length > 0
          ? `发现${complexFunctions.length}个高复杂度函数(${complexFunctions.map(f => `${f.name}:复杂度${f.complexity}`).join(', ')})`
          : '所有函数复杂度符合要求',
        suggestion: '通过提前返回、策略模式、多态等方式降低复杂度',
        line: complexFunctions.length > 0 ? complexFunctions[0].startLine : null
      };
    },

    _extractFunctions(code) {
      const functions = [];
      const lines = code.split('\n');
      let braceStack = 0;
      let funcStart = null;
      let funcName = '';
      let funcBodyLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (braceStack === 0 && (
          line.match(/^(?:async\s+)?function\s+\w+/) ||
          line.match(/^(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\(|function)/)
        )) {
          funcStart = i;
          const nameMatch = line.match(/(?:function|const|let|var)\s+(\w+)/);
          funcName = nameMatch ? nameMatch[1] : 'anonymous';
          funcBodyLines = [];
        }

        if (funcStart !== null) {
          funcBodyLines.push(line);
        }

        for (const ch of line) {
          if (ch === '{') braceStack++;
          if (ch === '}') {
            braceStack--;
            if (braceStack === 0 && funcStart !== null) {
              functions.push({
                name: funcName,
                startLine: funcStart + 1,
                body: funcBodyLines.join('\n')
              });
              funcStart = null;
              funcBodyLines = [];
            }
          }
        }
      }

      return functions;
    }
  },

  {
    name: 'commentCoverage',
    description: '注释覆盖: 公共API应有JSDoc注释',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const exportedFunctions = [];
      const commentedExports = [];

      // 查找导出的函数/类
      const exportPatterns = [
        /export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g,
        /export\s+(?:const|let|var)\s+(\w+)\s*=/g,
        /export\s+class\s+(\w+)/g
      ];

      for (const pattern of exportPatterns) {
        let match;
        while ((match = pattern.exec(code)) !== null) {
          exportedFunctions.push({
            name: match[1],
            position: match.index
          });
        }
      }

      // 检查是否有前置注释
      for (const func of exportedFunctions) {
        const lineIndex = code.substring(0, func.position).split('\n').length - 1;
        const precedingLines = lines.slice(Math.max(0, lineIndex - 5), lineIndex);

        const hasComment = precedingLines.some(line =>
          line.trim().startsWith('*') ||
          line.trim().startsWith('//') ||
          line.trim().startsWith('/**') ||
          line.includes('@param') ||
          line.includes('@returns')
        );

        if (hasComment) {
          commentedExports.push(func.name);
        }
      }

      const missingComments = exportedFunctions.length - commentedExports.length;

      return {
        passed: missingComments === 0 || exportedFunctions.length === 0,
        deduction: Math.min(missingComments * 3, 15),
        message: exportedFunctions.length > 0
          ? `已注释 ${commentedExports.length}/${exportedFunctions.length} 个导出项`
          : '无导出项需要注释',
        suggestion: '为导出的函数和类添加JSDoc注释，包含@description/@param/@returns标签'
      };
    }
  },

  {
    name: 'magicNumbers',
    description: '魔法数字: 避免在代码中直接使用未命名的数字字面量',
    maxScore: 10,
    check(code, ext) {
      // 排除常见合法数字: 0, 1, -1, 100, 数组索引, 版本号等
      const allowedNumbers = new Set(['0', '1', '-1', '100', '0.0', '1.0']);
      const magicNumbers = [];

      // 匹配数字字面量（排除字符串内、对象属性等场景）
      const lines = code.split('\n');
      const numberPattern = /(?<![\w."'])\b(\d{2,}|0\.\d+)\b(?![\w."'])/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 排除注释行
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        // 排除import/export语句
        if (line.match(/^(?:import|export)/)) continue;

        let match;
        while ((match = numberPattern.exec(line)) !== null) {
          const num = match[1];
          if (!allowedNumbers.has(num)) {
            magicNumbers.push({
              value: num,
              line: i + 1,
              context: line.trim().substring(0, 60)
            });
          }
        }
      }

      // 去重
      const uniqueMagic = [...new Set(magicNumbers.map(m => m.value))];

      return {
        passed: uniqueMagic.length <= 2,
        deduction: Math.min(uniqueMagic.length * 2, 10),
        message: uniqueMagic.length > 0
          ? `发现${uniqueMagic.length}个可能的魔法数字: [${uniqueMagic.join(', ')}]`
          : '未发现明显的魔法数字',
        suggestion: '将魔法数字提取为有意义的常量，如 MAX_RETRY_COUNT=3, TIMEOUT_MS=5000',
        line: magicNumbers.length > 0 ? magicNumbers[0].line : null
      };
    }
  },

  {
    name: 'consistentIndentation',
    description: '缩进一致性: 文件内缩进风格统一（空格数一致）',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const indentStyles = new Set();
      let inconsistentCount = 0;

      for (const line of lines) {
        if (line.trim().length === 0) continue;
        if (line.trim().startsWith('//')) continue;
        if (line.trim().startsWith('*')) continue;

        // 计算前导空格数
        const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
        if (leadingSpaces === 0) continue;

        // 检测是空格还是tab
        const hasTab = line.startsWith('\t');
        indentStyles.add(hasTab ? 'tab' : 'space');

        // 检查缩进是否为2或4的倍数
        if (!hasTab && leadingSpaces % 2 !== 0 && leadingSpaces % 4 !== 0) {
          inconsistentCount++;
        }
      }

      const isConsistent = indentStyles.size <= 1 && inconsistentCount <= 2;

      return {
        passed: isConsistent,
        deduction: isConsistent ? 0 : Math.min(inconsistentCount + (indentStyles.size - 1) * 5, 15),
        message: isConsistent
          ? '缩进风格一致'
          : `发现缩进不一致: 使用了[${[...indentStyles].join(',')}]混合风格, ${inconsistentCount}处异常缩进`,
        suggestion: '统一使用2空格或4空格缩进，不要混用Tab和Space'
      };
    }
  }
];

export default rules;
