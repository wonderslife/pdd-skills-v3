#!/usr/bin/env node
/**
 * 从 dev-specs/ 自动生成 specs/spec.md
 *
 * 用法:
 *   node gen-spec.mjs                       # 默认 dev-specs/*.md -> specs/spec.md
 *   node gen-spec.mjs out/spec.md           # 指定输出路径（位置参数，兼容旧用法）
 *   node gen-spec.mjs --prd my-feature.prd  # 指定 PRD（默认自动探测 my-feature.prd）
 *   node gen-spec.mjs --no-api              # 关闭接口自动补充（回到纯占位行为）
 *   node gen-spec.mjs --list-apis           # 打印 PRD 中解析到的接口清单（含 anchor/特征词）后退出
 *   node gen-spec.mjs --debug-match         # 打印功能点画像与每条接口的匹配过程（校准用）
 *   node gen-spec.mjs --api-map api-map.json  # 用外置映射表覆盖自动匹配
 *   node gen-spec.mjs --dry-run             # 只输出统计，不写文件
 *
 * 原理:
 *   1) 扫描 dev-specs/*.md（每个文件 = 一个功能点），提取 标题/ID/优先级/描述/验收标准；
 *   2) 解析 PRD 中的 API 表格（表头含「方法 + 路径」的 Markdown 表格），提取 方法/路径/权限标识/说明；
 *   3) 将接口按「功能点归属」自动匹配，填入每个功能点的「#### 接口定义」表格。
 *
 * 接口归属匹配分层规则（自上而下，命中即止；详见 matchApisToFeatures）:
 *   A. 显式声明   —— dev-spec 内写了 `接口: GET /x` 或已有人工填写的接口表，最高优先级，永不覆盖
 *   B. 特征词独占 —— 接口路径/权限中的「非通用、非模块锚」特征词命中某功能点
 *   C. 模块锚兜底 —— 用路径业务段（anchor）匹配功能点的 slug/标题词（基础 CRUD 接口走这条）
 *   D. 说明文本   —— 接口说明里的中文关键词命中功能点标题
 *   E. 未匹配     —— 保留占位并在控制台报告，绝不硬塞
 *
 * 设计取舍: 自动匹配无法保证 100% 准确（PRD 的功能需求章节通常不含接口归属信息）。
 *   本脚本对高置信结果直接填入，对未匹配结果如实报告，
 *   并提供 --api-map 与 dev-spec 内显式声明两个确定性覆盖入口。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();

// ============================================================================
// 参数解析
// ============================================================================
const argv = process.argv.slice(2);
const hasFlag = (f) => argv.includes(f);
const getFlag = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const DRY_RUN = hasFlag('--dry-run');
const NO_API = hasFlag('--no-api');
const LIST_APIS = hasFlag('--list-apis');
const DEBUG_MATCH = hasFlag('--debug-match');
const API_MAP_PATH = getFlag('--api-map', null);
const PRD_ARG = getFlag('--prd', null);

// 位置参数（非 -- 开头）= 输出路径，保持旧用法兼容
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const OUT_ARG = positional[0] || null;

const SPECS_DIR = path.join(projectRoot, 'dev-specs');
const OUTPUT = OUT_ARG
  ? path.resolve(projectRoot, OUT_ARG)
  : path.join(projectRoot, 'specs', 'spec.md');

// ============================================================================
// 词表：中文关键词 -> 路径/权限中可能出现的英文标识
// 说明: PRD 用中文写业务名，接口路径用英文标识符，此表是两者之间的桥梁。
//       项目可按需扩展，或在 <project>/prd-api-map.json 中做精确覆盖。
// ============================================================================
const ZH2EN = {
  // —— 巡检域 ——
  机房: ['room'],
  区域: ['area', 'zone'],
  点位: ['point'],
  二维码: ['qrcode', 'qr'],
  模板: ['template'],
  巡检项: ['item'],
  扫码: ['scan'],
  扫描: ['scan'],
  巡检: ['inspect', 'patrol'],
  记录: ['record'],
  补录: ['supplement', 'makeup'],
  逾期: ['supplement', 'overdue'],
  统计: ['stats'],
  报表: ['stats', 'report'],
  异常: ['abnormal', 'exception'],
  照片: ['photo', 'image'],
  拍照: ['photo', 'camera'],
  上传: ['upload'],
  导入: ['import'],
  导出: ['export'],
  执行: ['submit', 'draft', 'execute'],
  草稿: ['draft'],
  提交: ['submit'],
  处理: ['process'],
  提醒: ['notice', 'alert'],
  生成: ['generate'],
  // —— 若依通用域 ——
  用户: ['user'],
  角色: ['role'],
  部门: ['dept'],
  菜单: ['menu'],
  字典: ['dict'],
  参数: ['config'],
  公告: ['notice'],
  日志: ['log'],
  岗位: ['post'],
  // —— 商城/预售域 ——
  订单: ['order'],
  商品: ['goods'],
  定金: ['deposit'],
  尾款: ['tail', 'balance'],
  支付: ['pay'],
  预售: ['presale'],
  库存: ['stock'],
  发货: ['deliver', 'ship'],
  退款: ['refund'],
};

/** 通用动作词：不承载「功能点特征」语义，参与匹配会引入噪声 */
const GENERIC_WORDS = new Set([
  'list', 'add', 'edit', 'update', 'remove', 'delete', 'del', 'query', 'get', 'save',
  'create', 'modify', 'select', 'optionselect', 'option', 'options', 'tree', 'detail',
  'details', 'page', 'pages', 'paged', 'info', 'status', 'change', 'batch', 'all',
  'data', 'do', 'api', 'controller', 'service', 'impl', 'my', 'by', 'id', 'ids',
  'new', 'view', 'index', 'main', 'base', 'common',
]);

/**
 * 路径前缀段兜底表：出现在业务段之前、不参与 anchor 判定。
 * 注意: 这里只是兜底 —— 真正的全局前缀由 detectGlobalPrefixes() 从接口数据中自动识别，
 *       因为不同项目的 API 前缀不同（/inspect、/system、/api、/portal…），硬编码必然漏。
 */
const PATH_PREFIXES = new Set([
  'api', 'v1', 'v2', 'rest', 'admin', 'system', 'portal', 'h5', 'pc', 'app', 'web',
]);

/** 首段出现比例达到该阈值即判定为全局前缀 */
const PREFIX_RATIO_THRESHOLD = 0.6;

/** 一个词出现在不少于该数量的不同模块下，即判定为跨模块通用动作词 */
const CROSS_MODULE_THRESHOLD = 2;

// ============================================================================
// 通用工具
// ============================================================================

/**
 * 把任意标识符切成小写 token 数组。
 * 支持: kebab-case / snake_case / camelCase / PascalCase / 斜杠路径 / 中文（原样保留）
 * @param {string} input
 * @returns {string[]}
 */
function splitTokens(input) {
  if (!input) return [];
  return String(input)
    .replace(/[{}()[\]"'`]/g, ' ')
    .split(/[^A-Za-z0-9\u4e00-\u9fa5]+/)
    .filter(Boolean)
    .flatMap((seg) => seg.split(/(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

/**
 * 中文文本 -> 英文 token（查词表，按包含关系匹配）。
 * @param {string} text
 * @returns {string[]}
 */
function zhToTokens(text) {
  if (!text) return [];
  const out = [];
  for (const [zh, ens] of Object.entries(ZH2EN)) {
    if (text.includes(zh)) out.push(...ens);
  }
  return [...new Set(out)];
}

/** 去掉 Markdown 行内代码反引号与首尾空白 */
function stripInline(s) {
  return String(s || '').replace(/`/g, '').trim();
}

/**
 * 解析 Markdown 表格行 -> 单元格数组
 * @param {string} line
 * @returns {string[]|null}
 */
function parseTableRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  let s = t;
  if (s.endsWith('|')) s = s.slice(0, -1);
  if (s.startsWith('|')) s = s.slice(1);
  return s.split('|').map((c) => c.trim());
}

/** 是否为表格分隔行（|---|:--:|） */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '');
}

// ============================================================================
// PRD 解析
// ============================================================================

/**
 * 探测 PRD 文件。
 * 顺序: --prd 参数 > my-feature.prd > *.prd > *PRD*.md / *prd*.md > docs/ 下的同类文件
 * @returns {string|null} 绝对路径
 */
function discoverPrd() {
  if (PRD_ARG) {
    const p = path.resolve(projectRoot, PRD_ARG);
    return fs.existsSync(p) ? p : null;
  }
  const candidates = [];
  const roots = [projectRoot, path.join(projectRoot, 'docs')];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    const preferred = entries.find((f) => f.toLowerCase() === 'my-feature.prd');
    if (preferred) candidates.push(path.join(root, preferred));
    for (const f of entries.sort()) {
      if (f === preferred) continue;
      if (/\.prd$/i.test(f)) candidates.push(path.join(root, f));
      else if (/prd.*\.md$/i.test(f) || /.*prd\.md$/i.test(f)) candidates.push(path.join(root, f));
    }
  }
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/**
 * 解析 PRD 中所有 API 表格，提取接口清单。
 * 识别条件: 表头同时含「方法」类列与「路径」类列，其余列按表头名动态定位。
 * 会跳过 ``` 代码块内的内容，避免 SQL/JSON 被误判。
 *
 * @param {string} content PRD 全文
 * @returns {{apis: Array<{method:string,path:string,perm:string,desc:string,line:number}>, tables:number}}
 */
function parsePrdApis(content) {
  const lines = content.split(/\r?\n/);
  const apis = [];
  let tables = 0;
  let inCodeBlock = false;
  let currentHeading = '';

  // 表头识别用的列名候选
  const METHOD_COLS = ['方法', 'method', 'http方法', '请求方法', '动词'];
  const PATH_COLS = ['路径', 'path', 'url', '接口路径', '请求路径', 'endpoint'];
  const PERM_COLS = ['权限标识', '权限', 'perms', 'permission', '权限码'];
  const DESC_COLS = ['说明', '描述', '备注', '功能', 'desc', 'description'];
  const VALID_METHODS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/i;

  const findCol = (headers, names) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().replace(/[\s*]/g, '');
      if (names.some((n) => h === n || h.includes(n))) return i;
    }
    return -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // 跟踪代码块围栏（``` 成对）
    if (/^\s*```/.test(raw)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // 记录最近的小节标题，用于报告可读性
    if (/^#{2,6}\s+/.test(raw)) {
      currentHeading = raw.replace(/^#{2,6}\s+/, '').trim();
      continue;
    }

    const cells = parseTableRow(raw);
    if (!cells) continue;

    // 只把「表格首行」当表头：下一行必须是分隔行
    const nextCells = parseTableRow(lines[i + 1] || '');
    if (!nextCells || !isSeparatorRow(nextCells)) continue;

    const mi = findCol(cells, METHOD_COLS);
    const pi = findCol(cells, PATH_COLS);
    if (mi < 0 || pi < 0) continue; // 不是 API 表（如「接口名称|路径|返回格式|...」会被排除）

    tables++;
    const permi = findCol(cells, PERM_COLS);
    const di = findCol(cells, DESC_COLS);

    // 读取数据行
    let j = i + 2;
    for (; j < lines.length; j++) {
      const rc = parseTableRow(lines[j]);
      if (!rc || isSeparatorRow(rc)) break;
      if (rc.length < 2) continue;

      let method = stripInline(rc[mi] || '').toUpperCase();
      let p = stripInline(rc[pi] || '');

      // 方法列可能写成 "GET/POST" 或 "GET 列表"，取第一个合法动词
      const mm = method.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/);
      if (!mm) continue; // 非接口行（如说明文字、占位）
      method = mm[1];

      // 路径清洗：去掉行内注释、尾部标点
      p = p.replace(/[，,；;。]+$/, '').trim();
      if (!p.startsWith('/') || p.length < 2) continue;

      apis.push({
        method,
        path: p,
        perm: permi >= 0 ? stripInline(rc[permi] || '') : '',
        desc: di >= 0 ? stripInline(rc[di] || '') : '',
        line: j + 1,
        section: currentHeading,
      });
    }
    i = j - 1; // 跳过已消费的数据行
  }

  return { apis, tables };
}

// ============================================================================
// 接口画像：anchor（模块锚）+ features（特征词）
// ============================================================================

/**
 * 自动识别全局路径前缀：统计所有接口路径首段，出现比例达阈值的即视为前缀。
 * 如巡检项目全部接口都是 /inspect/xxx，则 'inspect' 是前缀而非业务模块。
 * @param {Array} apis
 * @returns {Set<string>}
 */
function detectGlobalPrefixes(apis) {
  const prefixes = new Set(PATH_PREFIXES);
  if (apis.length === 0) return prefixes;

  const count = new Map();
  for (const api of apis) {
    const first = (api.path.split('/').filter(Boolean)[0] || '').toLowerCase();
    if (first) count.set(first, (count.get(first) || 0) + 1);
  }
  for (const [seg, n] of count) {
    if (n / apis.length >= PREFIX_RATIO_THRESHOLD) prefixes.add(seg);
  }
  return prefixes;
}

/**
 * 为全部接口构建画像。分阶段处理：
 *   1) 自动识别全局前缀 -> 2) 提取 anchor（模块锚）
 *   3) 收集模块锚名 -> 4) 识别跨模块通用动作词 -> 5) 得出特征词
 *
 * 关键设计: 模块锚名与跨模块通用词都从数据中自动推导，而非硬编码。
 *   否则会把 "room"/"record" 这类模块名误当特征词（导致同一模块内所有接口被同一功能点全吃），
 *   或让 "export" 这种在多个模块都出现的动作词成为归属证据（导致跨模块误抢）。
 *
 * @param {Array} apis
 * @returns {Array} 附加 anchor / anchorTokens / features / crossModuleTokens 的接口数组
 */
function buildApiProfiles(apis) {
  // ---- 1. 自动识别全局前缀 ----
  const prefixes = detectGlobalPrefixes(apis);

  // ---- 2. anchor = 路径中第一个非前缀业务段 ----
  const staged = apis.map((api) => {
    const segs = api.path.split('/').filter(Boolean);
    const real = segs.filter((s) => !/^\{.*\}$/.test(s)); // 去掉 {pointId} 占位段
    const idx = real.findIndex((s) => !prefixes.has(s.toLowerCase()));
    const anchor = idx >= 0 ? real[idx] : real[0] || '';
    const afterAnchor = idx >= 0 ? real.slice(idx + 1) : real;

    // 候选特征词 = anchor 之后的路径段 + 权限标识段
    const candidateFeatures = [
      ...new Set([
        ...afterAnchor.flatMap((seg) => splitTokens(seg)),
        ...splitTokens(api.perm || ''),
      ]),
    ];

    return {
      ...api,
      realSegs: real,
      anchorIdx: idx,
      anchor,
      anchorTokens: splitTokens(anchor),
      afterAnchor,
      candidateFeatures,
    };
  });

  // ---- 3. 模块锚名集合（全部 anchor 展开成 token） ----
  const moduleAnchorNames = new Set();
  for (const s of staged) {
    for (const t of s.anchorTokens) moduleAnchorNames.add(t);
  }

  // ---- 4. 跨模块通用动作词：如 export 在 abnormal/record/point 都出现，则不承载归属语义 ----
  const tokenModules = new Map();
  for (const s of staged) {
    for (const t of s.candidateFeatures) {
      if (!tokenModules.has(t)) tokenModules.set(t, new Set());
      tokenModules.get(t).add(s.anchor.toLowerCase());
    }
  }
  const crossModuleTokens = new Set();
  for (const [t, mods] of tokenModules) {
    if (mods.size >= CROSS_MODULE_THRESHOLD) crossModuleTokens.add(t);
  }

  // ---- 5. 最终特征词 ----
  return staged.map((s) => {
    const features = s.candidateFeatures.filter(
      (t) =>
        !GENERIC_WORDS.has(t) &&
        !prefixes.has(t) &&
        !s.anchorTokens.includes(t) && // 本接口自己的锚不算特征
        !moduleAnchorNames.has(t) && // 模块名不构成归属证据
        !crossModuleTokens.has(t) // 跨模块通用动作词不构成归属证据
    );
    return { ...s, features, crossModuleTokens };
  });
}

// ============================================================================
// 功能点画像
// ============================================================================

/**
 * 为功能点构建匹配画像。
 * tokens 来源: 文件名 slug + dev-spec 标题（中文经词表映射）+ 描述里的英文标识
 * @param {Object} feature parseSpecFile 的结果
 * @param {string} fileName
 * @returns {Object}
 */
function buildFeatureProfile(feature, fileName) {
  const slugTokens = extractTags(fileName)
    .flatMap((t) => splitTokens(t))
    .filter((t) => !GENERIC_WORDS.has(t));

  const titleZh = zhToTokens(feature.title);
  const titleEn = splitTokens(feature.title).filter((t) => !GENERIC_WORDS.has(t));
  const descTokens = splitTokens(feature.description).filter((t) => !GENERIC_WORDS.has(t));

  const tokens = [...new Set([...slugTokens, ...titleZh, ...titleEn, ...descTokens])];

  return {
    ...feature,
    slugTokens,
    titleTokens: [...new Set([...titleZh, ...titleEn])],
    tokens,
  };
}

// ============================================================================
// 匹配引擎
// ============================================================================

/**
 * 统一匹配打分。用于 B（特征词）与 C（模块锚）两个阶段。
 *
 * 权重设计（从高到低）:
 *   hit.length      —— 命中词数量是主判据：两个词命中 > 一个词命中
 *   slugExactAnchor —— slug 与模块锚归一化后完全相等（如 F-003 slug=point vs anchor=point）。
 *                      用于同模块多功能点争抢基础 CRUD 接口时选出「主模块功能点」，
 *                      避免 point-import / qrcode 这类子功能点把 /point/list 抢走
 *   slugAnchorHit   —— slug 与模块锚有交集（子功能点，如 point-import 含 point）
 *   slugHits        —— 命中词落在 slug 中（文件名比标题更精确）
 *   titleHits       —— 命中词落在标题中
 *
 * @param {Object} f 功能点画像
 * @param {Object} api 接口画像
 * @param {string[]} hit 命中的词
 * @returns {number}
 */
function scoreMatch(f, api, hit) {
  const norm = (tokens) => tokens.join('');
  const slugExactAnchor = norm(f.slugTokens) === norm(api.anchorTokens) ? 1 : 0;
  const slugAnchorHit = f.slugTokens.some((t) => api.anchorTokens.includes(t)) ? 1 : 0;
  const slugHits = hit.filter((t) => f.slugTokens.includes(t)).length;
  const titleHits = hit.filter((t) => f.titleTokens.includes(t)).length;

  return hit.length * 10000 + slugExactAnchor * 1000 + slugAnchorHit * 100 + slugHits * 10 + titleHits;
}

/**
 * 将接口分配给功能点。
 *
 * 分层规则（自上而下，命中即止）:
 *   A. 显式声明 / api-map 覆盖 —— 最高优先级，永不覆盖人工结果
 *   B. 特征词独占 —— 接口携带的「有业务语义、非通用、非模块名」特征词命中某功能点
 *   C. 模块锚兜底 —— 用路径业务段匹配功能点 slug/标题（基础 CRUD 接口走这条）
 *   D. 说明文本 —— 接口说明的中文关键词命中功能点标题
 *   E. 未匹配 —— 如实报告，绝不硬塞
 *
 * @param {Array} features 功能点画像数组
 * @param {Array} apis 接口画像数组
 * @param {Object} apiMap 人工覆盖映射 { 'F-003': ['/path'], 'slug': ['/path'] }
 * @param {boolean} debug 是否输出逐条匹配过程
 * @returns {{assign: Map<string, Array>, unmatched: Array, detail: Array}}
 */
function matchApisToFeatures(features, apis, apiMap, debug = false) {
  const assign = new Map(); // featureKey -> api[]
  const unmatched = [];
  const detail = [];

  const keyOf = (f) => f.id || f.title;
  features.forEach((f) => assign.set(keyOf(f), []));

  // 人工覆盖表: 支持按 ID / 标题 / slug 索引
  const override = new Map(); // path -> Set<featureKey>
  if (apiMap && typeof apiMap === 'object') {
    for (const [k, paths] of Object.entries(apiMap)) {
      if (k === 'unmatched' || !Array.isArray(paths)) continue;
      const targets = features.filter(
        (f) => keyOf(f) === k || f.title === k || f.slugTokens.join('-') === k
      );
      for (const p of paths) {
        const norm = String(p).trim();
        if (!override.has(norm)) override.set(norm, new Set());
        targets.forEach((t) => override.get(norm).add(keyOf(t)));
      }
    }
  }

  for (const api of apis) {
    if (debug) {
      console.log(`\n  ${api.method} ${api.path}`);
      console.log(`     anchor=[${api.anchor}]  features=[${api.features.join(', ')}]`);
    }

    // ---- 规则 A: 显式声明 / 人工覆盖（独占，最高优先级） ----
    const declaredBy = features.filter((f) => (f.declaredApis || []).includes(api.path));
    if (declaredBy.length > 0) {
      declaredBy.forEach((f) => assign.get(keyOf(f)).push(api));
      detail.push({ api: api.path, method: api.method, rule: 'A-显式声明', to: declaredBy.map(keyOf) });
      if (debug) console.log(`     -> A 显式声明: ${declaredBy.map(keyOf).join(', ')}`);
      continue;
    }
    if (override.has(api.path)) {
      const targets = [...override.get(api.path)];
      targets.forEach((t) => assign.get(t)?.push(api));
      detail.push({ api: api.path, method: api.method, rule: 'A-api-map', to: targets });
      if (debug) console.log(`     -> A api-map: ${targets.join(', ')}`);
      continue;
    }

    // ---- 规则 B: 特征词命中（独占） ----
    if (api.features.length > 0) {
      const scored = features
        .map((f) => {
          const hit = api.features.filter((t) => f.tokens.includes(t));
          if (hit.length === 0) return null;
          return { f, hit, score: scoreMatch(f, api, hit) };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      if (debug && scored.length > 0) {
        scored.slice(0, 3).forEach((s) =>
          console.log(`       B候选 ${keyOf(s.f)}  命中[${s.hit.join(',')}]  score=${s.score}`)
        );
      }

      if (scored.length > 0) {
        const top = scored[0];
        assign.get(keyOf(top.f)).push(api);
        detail.push({
          api: api.path,
          method: api.method,
          rule: 'B-特征词',
          to: [keyOf(top.f)],
          evidence: top.hit,
        });
        if (debug) console.log(`     -> B 特征词: ${keyOf(top.f)}  证据[${top.hit.join(',')}]`);
        continue;
      }
    }

    // ---- 规则 C: 模块锚兜底（基础 CRUD 接口走这条） ----
    const byAnchor = features
      .map((f) => {
        const hit = api.anchorTokens.filter((t) => f.tokens.includes(t));
        if (hit.length === 0) return null;
        return { f, hit, score: scoreMatch(f, api, hit) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (debug && byAnchor.length > 0) {
      byAnchor.slice(0, 3).forEach((s) =>
        console.log(`       C候选 ${keyOf(s.f)}  锚命中[${s.hit.join(',')}]  score=${s.score}`)
      );
    }

    if (byAnchor.length > 0) {
      const top = byAnchor[0];
      assign.get(keyOf(top.f)).push(api);
      detail.push({
        api: api.path,
        method: api.method,
        rule: 'C-模块锚',
        to: [keyOf(top.f)],
        evidence: top.hit,
      });
      if (debug) console.log(`     -> C 模块锚: ${keyOf(top.f)}  证据[${top.hit.join(',')}]`);
      continue;
    }

    // ---- 规则 D: 说明文本命中 ----
    const descTokens = zhToTokens(api.desc);
    if (descTokens.length > 0) {
      const byDesc = features
        .map((f) => {
          const hit = descTokens.filter((t) => f.titleTokens.includes(t));
          return hit.length > 0 ? { f, hit, score: hit.length } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      if (byDesc.length > 0) {
        const top = byDesc[0];
        assign.get(keyOf(top.f)).push(api);
        detail.push({
          api: api.path,
          method: api.method,
          rule: 'D-说明文本',
          to: [keyOf(top.f)],
          evidence: top.hit,
        });
        if (debug) console.log(`     -> D 说明文本: ${keyOf(top.f)}  证据[${top.hit.join(',')}]`);
        continue;
      }
    }

    // ---- 规则 E: 未匹配 ----
    unmatched.push(api);
    detail.push({ api: api.path, method: api.method, rule: 'E-未匹配', to: [] });
    if (debug) console.log('     -> E 未匹配');
  }

  return { assign, unmatched, detail };
}

// ============================================================================
// dev-specs 解析
// ============================================================================

/**
 * 解析单个 dev-specs 文件（逐行解析，避免复杂正则的兼容性问题）
 * 同时提取: 来源(REQ-ID) / 显式声明的接口路径 / 人工填写的接口表
 */
function parseSpecFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const baseName = path.basename(filePath, '.md');

  const result = {
    title: baseName,
    id: null,
    priority: 'P2',
    source: '',
    description: '',
    criteria: [],
    declaredApis: [], // 显式声明的接口路径
    hasManualApiTable: false, // 文件内是否已有人工填写的接口表
  };

  let inCriteria = false;
  let inDeclaredApiSection = false;
  let descBuffer = [];
  let descStarted = false;
  let descEnded = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 标题（第一个 # 开头的行）
    if (result.title === baseName && /^#\s+/.test(line)) {
      result.title = trimmed.replace(/^#\s+/, '').trim();
      continue;
    }

    // 属性行（ID: / 优先级: / 来源: / 接口: 等）
    const attrMatch = trimmed.match(/^([A-Za-z\u4e00-\u9fa5]+)[:：]\s*(.+)$/);
    if (!inCriteria && attrMatch) {
      const key = attrMatch[1].toLowerCase();
      const value = attrMatch[2].trim();
      if (key === 'id' || key === 'feature id') result.id = value;
      if (key === 'priority' || key === '优先级') result.priority = value;
      if (key === '来源' || key === 'source' || key === '需求id' || key === 'req') result.source = value;
      // 显式声明接口: `接口: GET /a, POST /b` 或 `API: /a /b`
      if (key === '接口' || key === 'api' || key === 'apis' || key === '接口列表') {
        const found = value.match(/\/[A-Za-z0-9_\-{}/.]*/g) || [];
        result.declaredApis.push(...found);
      }
      continue;
    }

    // 接口小节（## 接口定义 / ## 接口 / ## API）
    if (/^#{2,4}\s*(接口定义|接口|API)\s*$/i.test(trimmed)) {
      inCriteria = false;
      inDeclaredApiSection = true;
      continue;
    }
    if (/^#{2,4}\s/.test(trimmed)) inDeclaredApiSection = false;

    // 接口小节内的路径行 / 表格行 -> 视为人工声明
    if (inDeclaredApiSection) {
      const rc = parseTableRow(trimmed);
      if (rc && !isSeparatorRow(rc)) {
        const pathCell = rc.find((c) => /^\/[^\s]*$/.test(stripInline(c)));
        if (pathCell) {
          result.hasManualApiTable = true;
          result.declaredApis.push(stripInline(pathCell));
        }
      }
      continue;
    }

    // 验收标准区域
    if (/^##\s*(?:验收标准|Acceptance\s*Criteria)/i.test(line)) {
      inCriteria = true;
      descEnded = true;
      continue;
    }
    if (inCriteria && /^##\s*/.test(line)) {
      inCriteria = false;
    }
    if (inCriteria) {
      const itemMatch = trimmed.match(/^[-*+]\s+(.+)$/);
      if (itemMatch) {
        result.criteria.push(itemMatch[1].trim());
      }
      continue;
    }

    // 描述：标题/属性行之后的段落（到第一个空行或 ## 前为止）
    if (!descEnded) {
      if (trimmed === '' && descStarted) {
        descEnded = true;
      } else if (trimmed !== '') {
        descStarted = true;
        descBuffer.push(trimmed);
      }
    }
  }

  if (descBuffer.length > 0) {
    result.description = descBuffer.join(' ').substring(0, 1000);
  }

  // 去重
  result.declaredApis = [...new Set(result.declaredApis)];
  return result;
}

/** 从文件名提取标签（如 F-101-presale-goods.md -> presale-goods，跳过数字段） */
function extractTags(fileName) {
  const base = path.basename(fileName, '.md');
  const parts = base.split('-').filter(Boolean);
  const meaningful = parts.filter((p) => !/^\d+$/.test(p) && !/^f$/i.test(p));
  const tags = meaningful.length > 0 ? [meaningful.join('-').toLowerCase()] : [];
  return tags.filter((t) => /^[a-z0-9-]+$/.test(t));
}

// ============================================================================
// 渲染
// ============================================================================

/**
 * 渲染单个功能点的「#### 接口定义」区块。
 * 有权限标识时输出 4 列；无则退回 3 列（保持兼容）。
 * @param {Array} apis
 * @returns {string[]}
 */
function renderApiSection(apis) {
  const out = ['#### 接口定义'];
  if (!apis || apis.length === 0) {
    out.push('| 方法 | 路径 | 说明 |');
    out.push('|------|------|------|');
    out.push('<!-- 待补充: 该功能点相关接口 -->');
    return out;
  }

  const withPerm = apis.some((a) => a.perm && a.perm !== '-');
  if (withPerm) {
    out.push('| 方法 | 路径 | 权限标识 | 说明 |');
    out.push('|------|------|---------|------|');
    for (const a of apis) {
      out.push(`| ${a.method} | ${a.path} | ${a.perm || '-'} | ${a.desc || '-'} |`);
    }
  } else {
    out.push('| 方法 | 路径 | 说明 |');
    out.push('|------|------|------|');
    for (const a of apis) {
      out.push(`| ${a.method} | ${a.path} | ${a.desc || '-'} |`);
    }
  }
  return out;
}

// ============================================================================
// 主流程
// ============================================================================

function main() {
  if (!fs.existsSync(SPECS_DIR)) {
    console.error(`✗ 未找到 dev-specs 目录: ${SPECS_DIR}\n  请先创建 dev-specs/ 并在其中放置功能点文件（格式见文档第 3 步）`);
    process.exit(1);
  }

  const files = fs.readdirSync(SPECS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    console.error('✗ dev-specs/ 下没有 .md 文件');
    process.exit(1);
  }

  // ---------- 1. 解析功能点 ----------
  const features = files.map((f) => {
    const spec = parseSpecFile(path.join(SPECS_DIR, f));
    spec.tags = extractTags(f, spec.title);
    return buildFeatureProfile(spec, f);
  });

  // ---------- 2. 解析 PRD 接口 ----------
  let apis = [];
  let prdPath = null;
  let prdTables = 0;
  let matchResult = null;

  if (!NO_API) {
    prdPath = discoverPrd();
    if (prdPath) {
      const content = fs.readFileSync(prdPath, 'utf-8');
      const parsed = parsePrdApis(content);
      apis = parsed.apis;
      prdTables = parsed.tables;

      if (LIST_APIS) {
        const profiles = buildApiProfiles(apis);
        console.log(`PRD: ${prdPath}`);
        console.log(`识别到 API 表: ${prdTables} 个，接口 ${apis.length} 条\n`);
        console.log('  方法   路径                                       权限标识                  anchor / 特征词');
        profiles.forEach((a) =>
          console.log(
            `  ${a.method.padEnd(6)} ${a.path.padEnd(42)} ${(a.perm || '-').padEnd(24)} ${a.anchor} / [${a.features.join(',')}]`
          )
        );
        return;
      }

      // 加载可选的 api-map 覆盖表
      let apiMap = null;
      const mapCandidates = [
        API_MAP_PATH && path.resolve(projectRoot, API_MAP_PATH),
        path.join(projectRoot, 'prd-api-map.json'),
        path.join(projectRoot, 'api-map.json'),
      ].filter(Boolean);
      for (const mc of mapCandidates) {
        if (mc && fs.existsSync(mc)) {
          try {
            apiMap = JSON.parse(fs.readFileSync(mc, 'utf-8'));
            console.log(`  · 已加载映射覆盖表: ${path.relative(projectRoot, mc)}`);
          } catch (e) {
            console.warn(`  ! 映射表解析失败，已忽略: ${mc} (${e.message})`);
          }
          break;
        }
      }

      const profiles = buildApiProfiles(apis);
      if (DEBUG_MATCH) {
        console.log('\n=== 功能点画像 ===');
        features.forEach((f) => {
          console.log(`  ${f.id || '?'} ${f.title}`);
          console.log(`     slug=[${f.slugTokens.join(',')}]  标题词=[${f.titleTokens.join(',')}]`);
          console.log(`     全部tokens=[${f.tokens.join(',')}]`);
        });
        console.log('\n=== 接口匹配过程 ===');
      }
      matchResult = matchApisToFeatures(features, profiles, apiMap, DEBUG_MATCH);
      if (DEBUG_MATCH) console.log('');
    }
  }

  // ---------- 3. 渲染 ----------
  const projectName = path.basename(projectRoot);
  const lines = [];
  lines.push(`# ${projectName} 开发规格`);
  lines.push(`版本: v1.0.0`);
  lines.push('');

  for (const f of features) {
    const tagStr = f.tags.length > 0 ? ` |${f.tags.join('|')}` : '';
    lines.push(`## ${f.title}${tagStr}`);
    lines.push(`#### 功能描述`);
    lines.push(f.description || '（待补充功能描述）');
    lines.push('');
    lines.push(`#### 验收标准`);
    if (f.criteria.length > 0) {
      f.criteria.forEach((c) => lines.push(`- ${c}`));
    } else {
      lines.push('- （待补充验收标准）');
    }
    lines.push('');

    // 接口定义：PRD 匹配结果优先，无则保留占位
    const key = f.id || f.title;
    const matched = matchResult ? matchResult.assign.get(key) || [] : [];
    renderApiSection(matched).forEach((l) => lines.push(l));
    lines.push('');
  }

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf-8');
  }

  // ---------- 4. 报告 ----------
  console.log(`${DRY_RUN ? '🔎 [dry-run] ' : '✓ '}${DRY_RUN ? '将生成' : '已生成'}: ${OUTPUT}`);
  console.log(`  共 ${features.length} 个功能点:`);
  features.forEach((f) => {
    const key = f.id || f.title;
    const n = matchResult ? (matchResult.assign.get(key) || []).length : 0;
    const suffix = matchResult ? `  [接口 ${n}]` : '';
    console.log(`   - ${f.id || '?'} ${f.title}${suffix}`);
  });

  if (matchResult) {
    const total = apis.length;
    const matchedCount = total - matchResult.unmatched.length;
    const byRule = matchResult.detail.reduce((acc, d) => {
      acc[d.rule] = (acc[d.rule] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n  PRD 接口自动补充: ${path.relative(projectRoot, prdPath)}`);
    console.log(`   识别 API 表 ${prdTables} 个，接口 ${total} 条，已归属 ${matchedCount} 条`);
    console.log(`   匹配来源: ${Object.entries(byRule).map(([k, v]) => `${k}=${v}`).join('  ')}`);

    if (total === 0) {
      console.log('   · PRD 中未识别到 API 表格，接口定义保持占位');
    } else if (matchResult.unmatched.length > 0) {
      console.log(`\n   ⚠ ${matchResult.unmatched.length} 条接口未匹配到功能点（已保留占位，未硬塞）:`);
      matchResult.unmatched.forEach((a) =>
        console.log(`     · ${a.method} ${a.path}${a.desc ? '  — ' + a.desc : ''}`)
      );
      console.log('   修正方式: 在 dev-specs 对应文件中加一行 `接口: ' + (matchResult.unmatched[0].path) + '`');
      console.log('             或创建 prd-api-map.json: { "F-00X": ["/path1"] }');
    } else {
      console.log('   ✓ 全部接口均已归属');
    }
  } else if (!NO_API) {
    console.log('\n  提示: 未找到 PRD 文件，接口定义保持占位（可用 --prd 指定）');
  } else {
    console.log('\n  提示: 已按 --no-api 关闭接口自动补充');
  }

  if (matchResult) {
    console.log(`\n提示: 请复核「#### 接口定义」中的自动匹配结果，确认后即可运行 generate。`);
  } else {
    console.log(`\n提示: 请检查每个功能点的「#### 接口定义」部分，补充实际接口后即可运行 generate。`);
  }
}

main();
