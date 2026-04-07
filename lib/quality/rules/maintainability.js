// lib/quality/rules/maintainability.js - 可维护性规则集
// 评估代码可维护性: 重复代码、模块化、耦合度、内聚性等

/**
 * 可维护性规则集
 *
 * 规则列表：
 * - duplicateCode: 重复代码检测
 * - moduleCohesion: 模块内聚性
 * - coupling: 耦合度检测
 * - singleResponsibility: 单一职责原则
 * - deadCode: 死代码检测
 * - dependencyDirection: 依赖方向检查
 */

const rules = [
  {
    name: 'duplicateCode',
    description: '重复代码: 避免复制粘贴的代码块（相似度>70%视为重复）',
    maxScore: 25,
    check(code, ext) {
      const lines = code.split('\n');
      const normalizedLines = lines.map(l => l.trim()).filter(l => l.length > 5);
      const duplicates = [];

      // 使用滑动窗口检测重复代码块（至少3行）
      const minBlockSize = 3;
      const similarityThreshold = 0.7;

      for (let i = 0; i < normalizedLines.length - minBlockSize; i++) {
        for (let j = i + minBlockSize; j < normalizedLines.length - minBlockSize; j++) {
          let matchCount = 0;
          let totalLen = 0;

          for (let k = 0; k < minBlockSize && i + k < normalizedLines.length && j + k < normalizedLines.length; k++) {
            const lineA = normalizedLines[i + k];
            const lineB = normalizedLines[j + k];
            totalLen += Math.max(lineA.length, lineB.length);

            if (this._similarity(lineA, lineB) >= similarityThreshold) {
              matchCount++;
            }
          }

          if (matchCount >= minBlockSize) {
            const similarity = matchCount / minBlockSize;
            if (similarity >= similarityThreshold) {
              // 检查是否已经记录过这个重复对
              const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
              if (!duplicates.find(d => d.key === key)) {
                duplicates.push({
                  key,
                  startLine1: i + 1,
                  startLine2: j + 1,
                  blockSize: matchCount,
                  similarity: Math.round(similarity * 100)
                });
              }
            }
          }
        }
      }

      return {
        passed: duplicates.length <= 1,
        deduction: Math.min(duplicates.length * 8, 25),
        message: duplicates.length > 0
          ? `发现${duplicates.length}处代码重复(>=${minBlockSize}行, 相似度>=${Math.round(similarityThreshold * 100)}%)`
          : '未发现明显代码重复',
        suggestion: '将重复代码提取为公共函数或工具方法，遵循DRY原则',
        line: duplicates.length > 0 ? duplicates[0].startLine1 : null
      };
    },

    _similarity(strA, strB) {
      if (strA === strB) return 1.0;
      if (!strA || !strB) return 0;

      // 简化的相似度计算：基于共同子序列比例
      const lenA = strA.length;
      const lenB = strB.length;
      const maxLen = Math.max(lenA, lenB);

      if (maxLen === 0) return 1.0;

      // 计算编辑距离的近似值
      let matches = 0;
      for (let i = 0; i < Math.min(lenA, lenB); i++) {
        if (strA[i] === strB[i]) matches++;
      }

      return matches / maxLen;
    }
  },

  {
    name: 'moduleCohesion',
    description: '模块内聚性: 单个文件应专注于单一功能领域',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const concerns = new Set();

      // 通过关键词识别关注点
      const concernPatterns = [
        { pattern: /\b(database|db|query|sql|mysql|postgres|mongodb|redis)\b/i, name: '数据访问' },
        { pattern: /\b(http|request|response|express|koa|router|api|rest|graphql)\b/i, name: 'HTTP/路由' },
        { pattern: /\b(auth|token|jwt|session|login|password|hash|bcrypt|crypto)\b/i, name: '认证/安全' },
        { pattern: /\b(validate|schema|joi|yup|zod|type-check|assert)\b/i, name: '数据校验' },
        { pattern: /\b(log|logger|winston|pino|debug|console\.(log|error))\b/i, name: '日志' },
        { pattern: /\b(cache|memoize|lru|ttl|expire)\b/i, name: '缓存' },
        { pattern: /\b(config|env|environment|setting)\b/i, name: '配置' },
        { pattern: /\b(file|fs\.|readFile|writeFile|path\.join)\b/i, name: '文件操作' },
        { pattern: /\b(date|time|moment|dayjs|cron|schedule)\b/i, name: '时间处理' },
        { pattern: /\b(email|sendmail|smtp|nodemailer)\b/i, name: '邮件服务' }
      ];

      for (const line of lines) {
        // 排除注释和字符串
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        for (const { pattern, name } of concernPatterns) {
          if (pattern.test(line)) {
            concerns.add(name);
          }
        }
      }

      // 小文件允许更多关注点混合
      const isLargeFile = lines.length > 200;
      const maxConcerns = isLargeFile ? 2 : 3;

      return {
        passed: concerns.size <= maxConcerns,
        deduction: concerns.size > maxConcerns ? Math.min((concerns.size - maxConcerns) * 4, 15) : 0,
        message: concerns.size <= maxConcerns
          ? `模块内聚良好，专注${concerns.size}个关注点`
          : `模块涉及过多关注点(${[...concerns].join(', ')})，建议拆分`,
        suggestion: '按职责拆分模块，每个文件只负责一个明确的功能领域'
      };
    }
  },

  {
    name: 'coupling',
    description: '耦合度: 减少对外部模块的直接依赖，使用依赖注入',
    maxScore: 20,
    check(code, ext) {
      const importStatements = [];
      const requireCalls = [];
      const lines = code.split('\n');

      // 收集所有import/require语句
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const importMatch = line.match(/^import\s+.+?\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          importStatements.push({ module: importMatch[1], line: i + 1 });
        }

        const requireMatch = line.match(/(?:const|let|var)\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\)/);
        if (requireMatch) {
          requireCalls.push({ module: requireMatch[1], line: i + 1 });
        }
      }

      const totalDependencies = importStatements.length + requireCalls.length;

      // 分类依赖类型
      const externalDeps = [...importStatements, ...requireCalls].filter(dep =>
        !dep.module.startsWith('.') &&
        !dep.module.startsWith('/') &&
        !dep.module.startsWith('node:') &&
        dep.module !== 'fs' &&
        dep.module !== 'path' &&
        dep.module !== 'url' &&
        dep.module !== 'http' &&
        dep.module !== 'https'
      );

      // 高耦合指标：外部依赖过多或循环导入风险
      const highCoupling = totalDependencies > 10 || externalDeps.length > 6;

      return {
        passed: !highCoupling,
        deduction: highCoupling ? Math.min((totalDependencies - 8) * 2 + (externalDeps.length - 4) * 2, 20) : 0,
        message: totalDependencies <= 10
          ? `依赖数量合理 (${totalDependencies}个，其中${externalDeps.length}个外部)`
          : `高耦合警告: ${totalDependencies}个依赖(${externalDeps.length}个外部模块)`,
        suggestion: '通过依赖注入、工厂模式或门面模式降低耦合；考虑引入IoC容器',
        line: externalDeps.length > 4 ? externalDeps[0]?.line : null
      };
    }
  },

  {
    name: 'singleResponsibility',
    description: '单一职责: 类/函数应只有一个变更原因',
    maxScore: 15,
    check(code, ext) {
      const violations = [];
      const lines = code.split('\n');

      // 检测类中的多种行为模式
      const classBlocks = this._extractClassBlocks(code);

      for (const cls of classBlocks) {
        const behaviors = new Set();

        // 检测不同的行为模式
        if (/get|fetch|find|read|query|select/i.test(cls.body)) behaviors.add('数据读取');
        if (/set|update|save|write|insert|create|add/i.test(cls.body)) behaviors.add('数据写入');
        if (/delete|remove|destroy|drop/i.test(cls.body)) behaviors.add('数据删除');
        if (/validate|check|verify|ensure|guard/i.test(cls.body)) behaviors.add('数据验证');
        if (/log|report|notify|emit|publish|send/i.test(cls.body)) behaviors.add('通知/日志');
        if (/calculate|compute|transform|convert|parse|format/i.test(cls.body)) behaviors.add('数据处理');
        if (/connect|open|close|disconnect|init|dispose/i.test(cls.body)) behaviors.add('资源管理');
        if (/config|setup|configure|option|setting/i.test(cls.body)) behaviors.add('配置管理');

        if (behaviors.size > 3) {
          violations.push({
            name: cls.name,
            line: cls.startLine,
            behaviorCount: behaviors.size,
            behaviors: [...behaviors]
          });
        }
      }

      return {
        passed: violations.length === 0,
        deduction: Math.min(violations.length * 5, 15),
        message: violations.length > 0
          ? `${violations.length}个类可能违反SRP: ${violations.map(v => `${v.name}(${v.behaviorCount}种行为)`).join(', ')}`
          : '类和函数职责划分合理',
        suggestion: '将具有多种行为的类拆分为更小的、职责单一的类',
        line: violations.length > 0 ? violations[0].line : null
      };
    },

    _extractClassBlocks(code) {
      const classes = [];
      const lines = code.split('\n');
      let braceStack = 0;
      let classStart = null;
      let className = '';
      let classBodyLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (braceStack === 0 && line.match(/^class\s+(\w+)/)) {
          classStart = i;
          className = line.match(/^class\s+(\w+)/)[1];
          classBodyLines = [];
        }

        if (classStart !== null) {
          classBodyLines.push(line);
        }

        for (const ch of line) {
          if (ch === '{') braceStack++;
          if (ch === '}') {
            braceStack--;
            if (braceStack === 0 && classStart !== null) {
              classes.push({
                name: className,
                startLine: classStart + 1,
                body: classBodyLines.join('\n')
              });
              classStart = null;
              classBodyLines = [];
            }
          }
        }
      }

      return classes;
    }
  },

  {
    name: 'deadCode',
    description: '死代码: 未使用的变量、函数、import语句',
    maxScore: 15,
    check(code, ext) {
      const issues = [];

      // 检查未使用的import
      const imports = [];
      const importRegex = /^import\s+(?:(\{[^}]+\})|(\w+)|(\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/gm;
      let importMatch;

      while ((importMatch = importRegex.exec(code)) !== null) {
        const namedImports = importMatch[1];   // { foo, bar }
        const defaultImport = importMatch[2];   // Foo
        const starAs = importMatch[4];         // *
        const source = importMatch[5];         // 'module'

        if (namedImports) {
          const names = namedImports.replace(/[{}]/g, '').split(',').map(s => s.trim().split(/\s+as\s+/).pop());
          for (const name of names) {
            if (name === 'default') continue;
            // 检查是否在代码中使用（排除声明本身）
            const usagePattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            const usages = code.match(usagePattern) || [];
            if (usages.length <= 1) { // 只有import语句本身
              issues.push({
                type: 'unused_import',
                name,
                source,
                line: code.substring(0, importMatch.index).split('\n').length
              });
            }
          }
        } else if (defaultImport || starAs) {
          const name = defaultImport || starAs;
          const usagePattern = new RegExp(`\\b${name}\\b`, 'g');
          const usages = code.match(usagePattern) || [];
          if (usages.length <= 2) { // import + 可能的一次赋值
            issues.push({
              type: 'unused_import',
              name,
              source,
              line: code.substring(0, importMatch.index).split('\n').length
            });
          }
        }
      }

      // 检查未使用的函数声明（简化版：查找定义但未调用的函数）
      const funcDeclarations = code.match(/^(?:async\s+)?function\s+(\w+)\s*\(/gm) || [];
      for (const decl of funcDeclarations) {
        const name = decl.match(/function\s+(\w+)/)[1];
        if (name === 'constructor') continue;

        const usagePattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
        const usages = code.match(usagePattern) || [];
        if (usages.length <= 1) {
          // 排除exported函数
          const isExported = new RegExp(`export\\s+(?:default\\s+)?(?:async\\s+)?function\\s+${name}`).test(code);
          if (!isExported) {
            issues.push({
              type: 'unused_function',
              name,
              line: code.substring(0, code.indexOf(decl)).split('\n').length + 1
            });
          }
        }
      }

      // 去重并限制数量
      const uniqueIssues = issues.filter((v, i, a) =>
        a.findIndex(t => t.name === v.name && t.type === v.type) === i
      ).slice(0, 5);

      return {
        passed: uniqueIssues.length === 0,
        deduction: Math.min(uniqueIssues.length * 3, 15),
        message: uniqueIssues.length > 0
          ? `发现${uniqueIssues.length}处可能的死代码: ${uniqueIssues.map(i => i.name).join(', ')}`
          : '未发现明显的死代码',
        suggestion: '删除未使用的import和函数，保持代码整洁',
        line: uniqueIssues.length > 0 ? uniqueIssues[0].line : null
      };
    }
  },

  {
    name: 'dependencyDirection',
    description: '依赖方向: 低层模块不应依赖高层模块，避免循环依赖',
    maxScore: 10,
    check(code, ext) {
      const filePath = ''; // 实际使用时需要传入文件路径
      const issues = [];

      // 检测可能的问题依赖模式
      const lines = code.split('\n');
      const importedModules = [];

      for (let i = 0; i < lines.length; i++) {
        const impMatch = lines[i].match(/from\s+['"](\.\.[\/][^'"]+)['"]/);
        if (impMatch) {
          importedModules.push({
            path: impMatch[1],
            line: i + 1,
            depth: (impMatch[1].match(/\.\./g) || []).length
          });
        }
      }

      // 检测深层相对路径引用（可能是架构问题）
      const deepImports = importedModules.filter(m => m.depth >= 3);

      if (deepImports.length > 0) {
        issues.push({
          type: 'deep_import',
          count: deepImports.length,
          details: deepImports.map(m => m.path),
          line: deepImports[0].line
        });
      }

      return {
        passed: deepImports.length === 0,
        deduction: Math.min(deepImports.length * 3, 10),
        message: deepImports.length > 0
          ? `发现${deepImports.length}处深层路径引用(../..及以上)，可能存在依赖方向问题`
          : '依赖方向正常',
        suggestion: '使用别名路径(@/)替代深层相对路径；考虑重构目录结构以减少层级'
      };
    }
  }
];

export default rules;
