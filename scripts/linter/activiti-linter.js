import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import xml2js from 'xml2js';
import yaml from 'yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(__dirname, '..', '..', 'config', 'bpmn-rules.yaml');

export async function runActivitiChecks(projectRoot) {
  const start = Date.now();

  const rulesContent = fs.existsSync(RULES_PATH)
    ? fs.readFileSync(RULES_PATH, 'utf-8')
    : '';
  const rules = rulesContent ? parseYAML(rulesContent) : getDefaultRules();

  const bpmnFiles = findBPMNFiles(projectRoot);

  if (bpmnFiles.length === 0) {
    return {
      runner: 'activiti-linter',
      success: true,
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
      message: '未找到BPMN文件',
      duration: Date.now() - start
    };
  }

  const allIssues = [];

  for (const filePath of bpmnFiles) {
    const fileIssues = await checkBPMNFile(filePath, rules);
    allIssues.push(...fileIssues);
  }

  return {
    runner: 'activiti-linter',
    success: allIssues.filter(i => i.severity === 'error').length === 0,
    issueCount: allIssues.length,
    errorCount: allIssues.filter(i => i.severity === 'error').length,
    warningCount: allIssues.filter(i => i.severity === 'warn').length,
    issues: allIssues.slice(0, 100),
    filesChecked: bpmnFiles.length,
    duration: Date.now() - start
  };
}

function findBPMNFiles(root) {
  const patterns = ['**/*.bpmn', '**/*.bpmn20.xml', '**/*-process.xml', '**/processes/**/*.xml'];
  const found = new Set();

  for (const pattern of patterns) {
    try {
      const files = fs.globSync(pattern, {
        cwd: root,
        ignore: ['**/node_modules/**', '**/.git/**', '**/.pdd/**', '**/target/**']
      });
      for (const f of files) found.add(path.join(root, f));
    } catch {}
  }

  return Array.from(found).filter(f => {
    try { const c = fs.readFileSync(f, 'utf-8'); return c.includes('bpmn') || c.includes('definitions'); }
    catch { return false; }
  });
}

async function checkBPMNFile(filePath, rules) {
  const issues = [];
  let xmlObj = null;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: true });
    xmlObj = await parser.parseStringPromise(content);
  } catch (e) {
    issues.push({
      ruleId: 'bpmn-parse-error',
      severity: 'error',
      message: `XML解析失败: ${e.message}`,
      file: filePath,
      line: 0,
      category: 'structure'
    });
    return issues;
  }

  const definitions = xmlObj.definitions || xmlObj['bpmn:definitions'] || {};
  const processes = definitions.process || definitions['bpmn:process'] || [];
  const processList = Array.isArray(processes) ? processes : [processes];

  for (const category of Object.keys(rules.rules || {})) {
    const catRules = rules.rules[category];
    if (!catRules.enabled) continue;

    for (const processEl of processList) {
      if (!processEl || typeof processEl !== 'object') continue;

      for (const rule of (catRules.checks || [])) {
        const result = applyBPMNRule(rule, processEl, filePath, xmlObj);
        if (!result.passed) {
          issues.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity || 'warn',
            message: rule.message,
            file: filePath,
            line: 0,
            category
          });
        }
      }
    }
  }

  const securityIssues = runSecurityChecks(filePath, fs.readFileSync(filePath, 'utf-8'));
  issues.push(...securityIssues);

  return issues;
}

function applyBPMNRule(rule, processEl, filePath, xmlObj) {
  switch (rule.id) {
    case 'bpmn-has-start-event':
      const starts = findElements(processEl, 'startEvent');
      return { passed: starts.length > 0 };

    case 'bpmn-has-end-event':
      const ends = findElements(processEl, 'endEvent');
      return { passed: ends.length > 0 };

    case 'bpmn-single-start-event':
      const allStarts = findElements(processEl, 'startEvent');
      return { passed: allStarts.length <= (rule.max_count || 1) };

    case 'bpmn-process-id-required':
      const procId = getAttr(processEl, 'id');
      if (!procId) return { passed: false };
      if (rule.pattern) return { passed: new RegExp(rule.pattern).test(procId) };
      return { passed: true };

    case 'bpmn-process-name-required':
      const procName = getAttr(processEl, 'name');
      return { passed: !!procName };

    case 'bpmn-reasonable-size': {
      const nodeCount = countAllNodes(processEl);
      return { passed: nodeCount <= (rule.max_nodes || 50) };
    }

    case 'bpmn-user-task-has-assignee': {
      const userTasks = findElements(processEl, 'userTask');
      for (const t of userTasks) {
        const assignee = getAttr(t, 'assignee');
        const candidates = getAttr(t, 'candidateUsers') || getAttr(t, 'candidateGroups');
        if (!assignee && !candidates) return { passed: false };
      }
      return { passed: true };
    }

    case 'bpmn-service-task-has-class': {
      const serviceTasks = findElements(processEl, 'serviceTask');
      for (const t of serviceTasks) {
        const cls = getAttr(t, 'class');
        const expr = getAttr(t, 'expression');
        const delegate = getAttr(t, 'delegateExpression');
        if (!cls && !expr && !delegate) return { passed: false };
      }
      return { passed: true };
    }

    default:
      return { passed: true };
  }
}

function findElements(el, tagName) {
  const results = [];
  const variants = [tagName, `bpmn:${tagName}`];

  for (const variant of variants) {
    if (el[variant]) {
      results.push(...(Array.isArray(el[variant]) ? el[variant] : [el[variant]]));
    }
  }

  return results.filter(e => e && typeof e === 'object');
}

function getAttr(el, attrName) {
  if (!el || typeof el !== 'object') return null;

  if (el.$ && el.$[attrName] !== undefined) return el.$[attrName];
  if (el[attrName] !== undefined) return el[attrName];

  return null;
}

function countAllNodes(processEl) {
  const nodeTypes = [
    'startEvent', 'endEvent', 'userTask', 'serviceTask', 'scriptTask',
    'manualTask', 'businessRuleTask', 'sendTask', 'receiveTask',
    'exclusiveGateway', 'parallelGateway', 'inclusiveGateway',
    'eventBasedGateway', 'subProcess', 'callActivity'
  ];

  let count = 0;
  for (const type of nodeTypes) {
    count += findElements(processEl, type).length;
  }
  return count;
}

function runSecurityChecks(filePath, content) {
  const issues = [];
  const lines = content.split('\n');

  const securityPatterns = [
    { pattern: /password\s*[:=]\s*["'][^"']+["']/i, severity: 'error', ruleId: 'bpmn-no-hardcoded-passwords', message: '检测到可能的硬编码密码' },
    { pattern: /\$\{.*(SELECT|INSERT|UPDATE|DELETE|DROP)/i, severity: 'error', ruleId: 'bpmn-no-sql-injection-risk', message: '检测到潜在SQL注入风险' },
    { pattern: /<script[^>]*>[^<]*(?:eval|exec|Runtime)/i, severity: 'warn', ruleId: 'bpmn-dangerous-script', message: '检测到危险脚本调用' },
    { pattern: /admin|root|sa\b/i, severity: 'info', ruleId: 'bpmn-default-account', message: '使用了默认管理员账户名' }
  ];

  for (let idx = 0; idx < lines.length; idx++) {
    for (const check of securityPatterns) {
      if (check.pattern.test(lines[idx])) {
        issues.push({
          ruleId: check.ruleId,
          severity: check.severity,
          message: check.message,
          file: filePath,
          line: idx + 1,
          category: 'security'
        });
      }
    }
  }

  return issues;
}

function parseYAML(content) {
  try {
    return yaml.parse(content);
  } catch {
    return getDefaultRules();
  }
}

function getDefaultRules() {
  return {
    rules: {
      structure: { enabled: true, checks: [
        { id: 'bpmn-has-start-event', name: '流程必须有开始事件', severity: 'error', message: 'BPMN流程缺少开始事件' },
        { id: 'bpmn-has-end-event', name: '流程必须有结束事件', severity: 'error', message: 'BPMN流程缺少结束事件' },
        { id: 'bpmn-user-task-has-assignee', name: '用户任务需指定处理人', severity: 'error', message: '用户任务必须指定处理人' },
        { id: 'bpmn-service-task-has-class', name: '服务任务需指定实现类', severity: 'error', message: '服务任务必须指定实现类' }
      ]},
      security: { enabled: true, checks: [] },
      naming: { enabled: true, checks: [] },
      best_practices: { enabled: true, checks: [] },
      documentation: { enabled: true, checks: [] },
      connectivity: { enabled: true, checks: [] }
    }
  };
}
