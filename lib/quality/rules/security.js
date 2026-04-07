// lib/quality/rules/security.js - 安全规则集
// 评估代码安全性: 输入验证、SQL注入、XSS、硬编码密钥、权限控制等

/**
 * 安全规则集
 *
 * 规则列表：
 * - sqlInjection: SQL注入风险检测
 * - xssRisk: XSS跨站脚本攻击风险
 * - hardcodedSecrets: 硬编码敏感信息
 * - inputValidation: 用户输入校验
 * - dependencySecurity: 依赖安全
 * - insecureConfig: 不安全配置
 */

const rules = [
  {
    name: 'sqlInjection',
    description: 'SQL注入: 使用参数化查询，禁止字符串拼接SQL',
    maxScore: 25,
    check(code, ext) {
      const lines = code.split('\n');
      const vulnerabilities = [];

      // 危险的SQL拼接模式
      const dangerousPatterns = [
        { pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*\+\s*["']/i, desc: '字符串拼接SQL' },
        { pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+.*`\$\{.*?\}`/i, desc: '模板字面量拼接SQL' },
        { pattern: /\.(query|execute|raw|run)\s*\(\s*["`][^"]*\$\{|[^"]*\+/, desc: '动态构建SQL语句' },
        { pattern: /"[\s\S]*(?:SELECT|INSERT|UPDATE|DELETE)[\s\S]*"\s*\+/i, desc: '字符串连接包含SQL关键字' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { pattern, desc } of dangerousPatterns) {
          if (pattern.test(line)) {
            // 排除注释行
            if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
              vulnerabilities.push({
                type: 'sql_injection',
                description: desc,
                line: i + 1,
                context: line.trim().substring(0, 70)
              });
            }
          }
        }
      }

      // 检测未使用参数化查询的ORM操作
      const unsafeOrmPatterns = [
        { pattern: /\.where\s*\(\s*["`].*\$\{/, desc: 'where条件使用插值' },
        { pattern: /sequelize\.query\s*\(\s*[^,)]*\+/, desc: 'sequelize.query使用拼接' },
        { pattern: /knex\.raw\s*\(/, desc: 'knex原始查询（需确认参数化）' },
        { pattern: /mongoose\.aggregate\s*\(\s*\[.*\$where/i, desc: 'MongoDB $where操作符' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, desc } of unsafeOrmPatterns) {
          if (pattern.test(line) && !line.trim().startsWith('//')) {
            vulnerabilities.push({
              type: 'unsafe_orm',
              description: desc,
              line: i + 1,
              context: line.trim().substring(0, 60)
            });
          }
        }
      }

      // 检查是否有安全的替代方案存在
      const hasParameterizedQuery =
        /\?/.test(code) && /(?:prepare|bind|execute|run)/.test(code) ||
        /sequelize\.query\(.*replacements/.test(code) ||
        /knex\(.*)\.where\([^)]*\)/.test(code);

      return {
        passed: vulnerabilities.length === 0,
        deduction: Math.min(vulnerabilities.length * 8, 25),
        message: vulnerabilities.length > 0
          ? `发现${vulnerabilities.length}个潜在的SQL注入风险点`
          : hasParameterizedQuery ? '使用了参数化查询' : '未检测到明显的SQL拼接',
        suggestion: '始终使用参数化查询(prepared statement)或ORM提供的参数绑定方法；绝对不要将用户输入直接拼接到SQL中',
        line: vulnerabilities.length > 0 ? vulnerabilities[0].line : null
      };
    }
  },

  {
    name: 'xssRisk',
    description: 'XSS攻击: 对用户输入进行转义和过滤后再输出到HTML',
    maxScore: 20,
    check(code, ext) {
      const lines = code.split('\n');
      const risks = [];

      // 危险模式：直接输出未经处理的数据
      const dangerousPatterns = [
        { pattern: /innerHTML\s*=.*(?:req|request|params|query|body|input|user|form|data)\b/, desc: 'innerHTML赋值含用户数据' },
        { pattern: /document\.write\s*\(/, desc: 'document.write使用' },
        { pattern: /eval\s*\(/, desc: 'eval()使用' },
        { pattern: /new\s+Function\s*\(/, desc: 'new Function()使用' },
        { pattern: /setTimeout\s*\(\s*["'`]/, desc: 'setTimeout传入字符串' },
        { pattern: /setInterval\s*\(\s*["'`]/, desc: 'setInterval传入字符串' },
        { pattern: /\.outerHTML\s*=/, desc: 'outerHTML赋值' },
        { pattern: /jquery|\$\(.*\)\.html\s*\(/i, desc: 'jQuery.html()使用' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, desc } of dangerousPatterns) {
          if (pattern.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*')) {
            risks.push({
              type: 'xss_risk',
              description: desc,
              line: i + 1,
              context: line.trim().substring(0, 65)
            });
          }
        }
      }

      // 检查URL中的用户输入（开放重定向风险）
      if (/location\.(href|assign|replace)\s*=/.test(code) &&
          /(req|request|params|query|body|input)/.test(code)) {
        risks.push({
          type: 'open_redirect',
          description: '可能存在开放重定向风险',
          severity: 'high'
        });
      }

      // 检查是否有安全措施
      const hasSanitization =
        /sanitize|escape|encodeURI|encodeURIComponent|DOMPurify|he\.encode|xss/i.test(code);

      return {
        passed: risks.filter(r => r.severity === 'high').length === 0 && risks.length <= 1,
        deduction: Math.min(
          risks.filter(r => r.severity === 'high').length * 10 +
          risks.filter(r => r.severity !== 'high').length * 4,
          20
        ),
        message: risks.length > 0
          ? `发现${risks.length}个潜在XSS风险点`
          : hasSanitization ? '有基本的XSS防护措施' : '未发现明显XSS风险',
        suggestion: '使用textContent代替innerHTML；对动态内容使用DOMPurify等库进行HTML净化；对所有用户输入进行编码后输出',
        line: risks.length > 0 ? risks[0].line : null
      };
    }
  },

  {
    name: 'hardcodedSecrets',
    description: '硬编码敏感信息: 密钥、密码、Token不应写在源码中',
    maxScore: 25,
    check(code, ext) {
      const lines = code.split('\n');
      const secrets = [];

      // 敏感信息模式
      const secretPatterns = [
        { regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{3,}["']/i, label: '密码' },
        { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']{5,}["']/i, label: 'API Key' },
        { regex: /(?:secret|token|auth[_-]?token|access[_-]?token)\s*[:=]\s*["'][^"']{10,}["']/i, label: 'Secret/Token' },
        { regex: /(?:private[_-]?key|privkey)\s*[:=]\s*["']BEGIN/i, label: '私钥' },
        { regex: /(?:connection[_-]?string|connstr|mongodb|mysql|redis)[:\s]*["'][^"']+password/i, label: '数据库连接串(含密码)' },
        { regex: /aws_access_key_id\s*[:=]\s*["'][A-Z0-9]{16,}["']/i, label: 'AWS Access Key' },
        { regex: /aws_secret_access_key\s*[:=]\s*["'][A-Za-z0-9\/+=]{30,}["']/i, label: 'AWS Secret Key' },
        { regex: /(?:jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*["'][^"']{10,}["']/i, label: 'JWT Secret' },
        { regex: /bcrypt\.genSaltSync\(\)|bcrypt\.hashSync\(/, label: '同步加密调用' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { regex, label } of secretPatterns) {
          if (regex.test(line)) {
            // 排除示例代码、注释、占位符
            if (this._isRealSecret(line)) {
              secrets.push({
                type: label,
                line: i + 1,
                context: this._maskSensitive(line.trim())
              });
            }
          }
        }
      }

      // 检查是否正确使用环境变量
      const usesEnvVars = /process\.env\.\w+/.test(code);
      const usesConfigModule = /config\.\w+/.test(code) || /require\(['"]config['"]\)/.test(code);
      const hasSecretManagement = usesEnvVars || usesConfigModule;

      return {
        passed: secrets.length === 0,
        deduction: Math.min(secrets.length * 6, 25),
        message: secrets.length > 0
          ? `发现${secrets.length}处可能的硬编码敏感信息: ${[...new Set(secrets.map(s => s.type))].join(', ')}`
          : hasSecretManagement ? '敏感信息通过环境变量/配置管理' : '未发现硬编码密钥',
        suggestion: '使用process.env或配置管理服务存储敏感信息；将密钥移至.env文件并加入.gitignore；使用密钥管理服务(AWS KMS/Vault)',
        line: secrets.length > 0 ? secrets[0].line : null
      };
    },

    _isRealSecret(line) {
      // 排除以下情况：
      // 注释行
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) return false;
      // 占位符
      if (/your-|<.*>|xxx|TODO|FIXME|placeholder|change.me|replace/i.test(line)) return false;
      // 空值
      if (/["']\s*["']|""|''/.test(line)) return false;
      // 示例值
      if (/example|sample|test|demo|fake|mock/i.test(line)) return false;

      return true;
    },

    _maskSensitive(str) {
      // 隐藏敏感值的中间部分
      return str.replace(/(["'])([^"']{2})([^"]*)(\1)/g, '$1$2***$4');
    }
  },

  {
    name: 'inputValidation',
    description: '输入验证: 所有外部输入必须经过校验和清理',
    maxScore: 15,
    check(code, ext) {
      const lines = code.split('\n');
      const unvalidatedInputs = [];

      // 外部输入来源
      const inputSources = [
        { pattern: /req\.body\b/, source: '请求体(req.body)' },
        { pattern: /req\.query\b/, source: '查询参数(req.query)' },
        { pattern: /req\.params\b/, source: '路径参数(req.params)' },
        { pattern: /req\.headers\b/, source: '请求头(req.headers)' },
        { pattern: /request\.body\b/, source: '请求体(request.body)' },
        { pattern: /urlSearchParams|URLSearchParams|searchParams/, source: 'URL参数' },
        { pattern: /formData|FormData/, source: '表单数据' },
        { pattern: /process\.argv/, source: '命令行参数' },
        { pattern: /localStorage|sessionStorage|cookie/i, source: '浏览器存储' }
      ];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const { pattern, source } of inputSources) {
          if (pattern.test(line)) {
            // 检查后续几行是否有校验逻辑
            const nextLines = lines.slice(i, Math.min(i + 8, lines.length));
            const hasValidation = nextLines.some(l =>
              /validate|check|verify|schema|joi|yup|zod|sanitiz|escape|trim|typeof|instanceof|guard|assert/.test(l)
            );

            // 检查是否有类型检查
            const hasTypeCheck = nextLines.some(l =>
              /===|!==|typeof |instanceof |Number\(|parseInt|parseFloat/.test(l)
            );

            if (!hasValidation && !hasTypeCheck) {
              // 排除简单的属性访问（如 req.body.user）
              if (!/req\.(body|query|params)\.\w+$/.test(line.trim())) {
                unvalidatedInputs.push({
                  source,
                  line: i + 1,
                  context: line.trim().substring(0, 55)
                });
              }
            }
          }
        }
      }

      // 去重：同一来源只报告一次
      const uniqueSources = [...new Set(unvalidatedInputs.map(u => u.source))];

      return {
        passed: unvalidatedInputs.length <= 1,
        deduction: Math.min(unvalidatedInputs.length * 3, 15),
        message: unvalidatedInputs.length > 0
          ? `${unvalidatedInputs.length}处外部输入缺少校验: ${uniqueSources.join(', ')}`
          : '外部输入均有适当的校验',
        suggestion: '在路由入口层使用Joi/Yup/Zod等Schema验证库；对用户输入进行类型强制转换和白名单过滤',
        line: unvalidatedInputs.length > 0 ? unvalidatedInputs[0].line : null
      };
    }
  },

  {
    name: 'dependencySecurity',
    description: '依赖安全: 使用已知安全的依赖版本，避免有漏洞的包',
    maxScore: 10,
    check(code, ext) {
      const issues = [];

      // 已知的有安全问题或废弃的依赖
      const vulnerableDeps = [
        { pkg: 'lodash', versionPattern: /^<4\.17\.21/, reason: '原型污染漏洞(CVE-2021-23337)' },
        { pkg: 'express', versionPattern: /^<4\.18\.2/, reason: '旧版本可能有已知漏洞' },
        { pkg: 'debug', versionPattern: /^<4\.3\.3/, reason: '远程代码执行风险' },
        { pkg: 'minimist', versionPattern: /^<1\.2\.6/, reason: '原型链污染' },
        { pkg: 'ws', versionPattern: /^<8\.5\.0/, reason: '多个安全修复' }
      ];

      // 检测使用的危险函数
      const dangerousFunctions = [
        { pattern: /eval\s*\(/, name: 'eval()', risk: '代码注入' },
        { pattern: /child_process|exec\s*\(|spawn\s*\(/, name: '子进程执行', risk: '命令注入' },
        { pattern: /vm\.runIn|vm\.Script/, name: 'VM模块', risk: '沙箱逃逸' },
        { pattern: /fs\.\w+File.*req\.|fs\.\w+File.*input/, name: '文件路径来自用户', risk: '路径遍历' }
      ];

      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, name, risk } of dangerousFunctions) {
          if (pattern.test(line) && !line.trim().startsWith('//')) {
            issues.push({
              type: 'dangerous_function',
              function: name,
              risk,
              line: i + 1
            });
          }
        }
      }

      // 检查package.json中的依赖（简化版：仅检测import）
      const importedPackages = new Set();
      const importMatches = code.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const pkg = match[1].split('/')[0];
        if (!pkg.startsWith('.') && pkg !== 'node:' && !pkg.startsWith('@types/')) {
          importedPackages.add(pkg);
        }
      }

      // 检查是否有已知的废弃或不安全依赖
      for (const pkg of importedPackages) {
        const vulnDep = vulnerableDeps.find(v => v.pkg === pkg);
        if (vulnDep) {
          issues.push({
            type: 'vulnerable_dependency',
            package: pkg,
            reason: vulnDep.reason
          });
        }
      }

      return {
        passed: issues.filter(i => i.type === 'dangerous_function').length === 0,
        deduction: Math.min(
          issues.filter(i => i.type === 'dangerous_function').length * 4 +
          issues.filter(i => i.type === 'vulnerable_dependency').length * 2,
          10
        ),
        message: issues.length > 0
          ? `发现${issues.length}个依赖安全问题`
          : '依赖使用看起来安全',
        suggestion: '避免使用eval()和child_process.exec()处理用户输入；定期运行npm audit修复已知漏洞；使用npm outdated检查过时依赖',
        line: issues.length > 0 ? issues[0].line : null
      };
    }
  },

  {
    name: 'insecureConfig',
    description: '不安全配置: CORS、Cookie、HTTPS等安全相关配置检查',
    maxScore: 5,
    check(code, ext) {
      const issues = [];
      const lines = code.split('\n');

      // CORS通配符
      if (/origin\s*:\s*["']\*["']|Access-Control-Allow-Origin\s*:\s*\*/.test(code)) {
        // 检查是否是开发环境
        const isDevEnv = /development|dev|local/i.test(code);
        if (!isDevEnv) {
          issues.push({ type: 'cors_wildcard', detail: 'CORS允许所有来源(*)' });
        }
      }

      // Cookie安全设置缺失
      if (/cookie|Cookie/.test(code)) {
        const hasSecureFlag = /secure\s*:\s*true|{.*secure:.*true/.test(code);
        const hasHttpOnly = /httpOnly\s*:\s*true|{.*httpOnly:.*true/.test(code);
        const hasSameSite = /sameSite|same-site/.test(code);

        if (!hasSecureFlag || !hasHttpOnly || !hasSameSite) {
          issues.push({
            type: 'insecure_cookie',
            detail: `Cookie缺少安全选项: ${[
              !hasSecureFlag ? 'secure标志' : null,
              !hasHttpOnly ? 'httpOnly标志' : null,
              !hasSameSite ? 'SameSite属性' : null
            ].filter(Boolean).join(', ')}`,
            severity: 'medium'
          });
        }
      }

      // HTTPS强制跳转缺失（Web应用）
      if (/express|koa|fastify|http\.createServer/.test(code)) {
        const hasHttpsEnforcement = /forceSSL|enforceHTTPS|helmet|hsts|strict-transport-security/.test(code);
        if (!hasHttpsEnforcement) {
          issues.push({
            type: 'no_https_enforcement',
            detail: '未检测到HTTPS强制跳转/HSTS设置',
            severity: 'low'
          });
        }
      }

      // 错误信息泄露
      if (/err\.stack|error\.stack|console\.(log|error)\(err/.test(code)) {
        const isInProductionHandler = /production|NODE_ENV\s*===\s*['"]production['"]/.test(code);
        if (!isInProductionHandler) {
          issues.push({
            type: 'error_info_leak',
            detail: '可能向客户端暴露详细错误堆栈'
          });
        }
      }

      return {
        passed: issues.filter(i => i.severity !== 'low').length === 0,
        deduction: Math.min(issues.length * 2, 5),
        message: issues.length > 0
          ? `发现${issues.length}项安全配置问题`
          : '安全配置基本合理',
        suggestion: 'CORS限制为特定域名；Cookie设置secure/httpOnly/sameSite属性；生产环境隐藏错误详情；启用HSTS',
        line: issues.length > 0 ? issues[0]?.line || null : null
      };
    }
  }
];

export default rules;
