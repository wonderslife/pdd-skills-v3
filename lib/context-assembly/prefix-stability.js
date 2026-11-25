// lib/context-assembly/prefix-stability.js - 前缀稳定化（FP-TOKO-005 / doc 05 §3.1.4、路线图 T1）
//
// 职责（FP-TOKO-005 §3.1 处理流程）：
//   1. 提供规范装配顺序（§1.2 五区块）→ 2. 对装配计划做稳定化审计（auditOrder）→
//   3. 扫描 Tier 0/1 稳定区易变内容（时间戳/uuid/随机 id）→ 4. 违规清单交由调用方退回重排 →
//   5. 运行期观测缓存命中（cache read/write 用量比，§3.1 步骤 6）。
//
// 红线：
//   - R1：Tier 0/1 区块禁止时间戳、随机 id 等易变内容（检出即 VOLATILE_CONTENT/HIGH）；
//   - R2：技能一旦装配会话内不回溯移除（由 FP-TOKO-003 会话态保证，本模块只审计不重排）；
//   - R3：Tier 3 工件一律置尾（blocks 形态按序位校验；CAG tiers 形态由构造顺序保证）；
//   - R4：既有模块零改动——本模块为 additive 兄弟模块，仅被 index.js 以门禁方式调用（I1）。
//
// 易变内容模式口径（重要）：skills/ 全树实测（2026-11-25）——RFC3339/uuid/epoch-ms 及
// volatile-key([:=] 后缀) 在 SKILL.md 正文与 front matter description 中零命中；命中的
// 时间戳/uuid 全部位于 references/（Tier 2，不在 R1 扫描范围）或 `{timestamp}` 占位符形式
// （无 [:=] 后缀，不匹配）。因此字面扫描可安全嵌入 assemble 主流程（I1），无误伤风险；
// 裸日期（如 2026-11-24，无 T 时间分量）不算易变内容，避免误伤静态正文。

import crypto from 'crypto';
import { PHASES } from '../token/budget-manager.js';

/**
 * §1.2 规范装配顺序（强制；§2.1 区块顺序表）
 * position 即序位：装配计划中各区块序位必须非递减，tier23_content（序位 4）必须置尾。
 */
export const CANONICAL_ORDER = Object.freeze([
  { key: 'system_prompt', label: '系统提示', position: 0, stability: '会话内逐字节不变' },
  { key: 'tier0_index', label: 'Tier 0 索引（会话内不变）', position: 1, stability: '会话内逐字节不变' },
  { key: 'tier1_skills', label: 'Tier 1 已触发技能', position: 2, stability: '只增不改（追加不重写）' },
  { key: 'conversation_history', label: '对话历史', position: 3, stability: '自然追加' },
  { key: 'tier23_content', label: 'Tier 2/3 按需内容', position: 4, stability: '允许变化，必须位于末尾' }
]);

/** 规范区块键集合（序位校验与别名归一的合法域） */
const CANONICAL_KEYS = CANONICAL_ORDER.map(b => b.key);

/** 宿主/上游常用区块名 → 规范键（auditOrder blocks 形态归一用） */
const BLOCK_KEY_ALIASES = Object.freeze({
  'system-prompt': 'system_prompt',
  system_prompt: 'system_prompt',
  system: 'system_prompt',
  systemprompt: 'system_prompt',
  'tier0-index': 'tier0_index',
  tier0_index: 'tier0_index',
  tier0: 'tier0_index',
  t0: 'tier0_index',
  'tier1-skills': 'tier1_skills',
  tier1_skills: 'tier1_skills',
  tier1: 'tier1_skills',
  t1: 'tier1_skills',
  skills: 'tier1_skills',
  'conversation-history': 'conversation_history',
  conversation_history: 'conversation_history',
  history: 'conversation_history',
  messages: 'conversation_history',
  'tier23-content': 'tier23_content',
  tier23_content: 'tier23_content',
  tier23: 'tier23_content',
  'tier2-3': 'tier23_content',
  tier2: 'tier23_content',
  tier3: 'tier23_content',
  artifacts: 'tier23_content'
});

/**
 * R1 易变内容模式表（Tier 0/1 稳定区禁入）。
 * id 用于审计 detail 与测试锚定；口径见文件头实测说明。
 */
export const VOLATILE_PATTERNS = Object.freeze([
  { id: 'rfc3339-timestamp', regex: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ },
  { id: 'uuid', regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/ },
  { id: 'epoch-millis', regex: /\b1[7-9]\d{11}\b/ },
  {
    id: 'volatile-key',
    regex: /\b(generated_at|updated_at|timestamp|request_id|trace_id|nonce|uuid|random_id|correlation_id)\b\s*[:=]/
  }
]);

/** 会话缓存观测内存态（T5：sessionId → 轮次记录[]；不落盘，同 FP-003 会话态口径） */
const cacheObservations = new Map();

/**
 * 规范装配顺序（FP-TOKO-005 §1.1）
 * @param {string} phase - 5 阶段枚举（复用 budget-manager PHASES；非法抛 PHASE_UNKNOWN）
 * @returns {Array<{key:string,label:string,position:number,stability:string}>} 区块序列（深拷贝，防调用方篡改常量）
 * @throws {Error} PHASE_UNKNOWN
 */
export function getAssemblyOrder(phase) {
  if (!Object.values(PHASES).includes(phase)) {
    throw new Error(`PHASE_UNKNOWN: phase 必须为 ${Object.values(PHASES).join('/')}，得到 ${phase}`);
  }
  // 顺序与 phase 无关（五区块恒定）；phase 入参用于接口对未来分阶段顺序演化的兼容
  return CANONICAL_ORDER.map(b => ({ ...b }));
}

/**
 * 扫描文本中的易变内容（R1 模式表；导出供测试与脚本复用）
 * @param {string} text
 * @returns {Array<{pattern_id:string, match:string}>} 命中清单（同模式多次命中只记首个样本）
 */
export function scanVolatileContent(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const hits = [];
  for (const { id, regex } of VOLATILE_PATTERNS) {
    const m = text.match(regex);
    if (m) {
      hits.push({ pattern_id: id, match: m[0].length > 64 ? m[0].slice(0, 64) + '…' : m[0] });
    }
  }
  return hits;
}

/** @private 区块内容 sha256（T3/T4 前缀稳定性比对基准；十六进制 64 位） */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** @private 归一区块键；未知键返回 null */
function resolveBlockKey(key) {
  if (typeof key !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(BLOCK_KEY_ALIASES, key) ? BLOCK_KEY_ALIASES[key] : null;
}

/** @private 对 Tier 0/1 稳定区块内容做 R1 易变内容扫描，产出 HIGH 违规 */
function scanStableBlock(blockKey, content, violations) {
  const hits = scanVolatileContent(content);
  for (const hit of hits) {
    violations.push({
      severity: 'HIGH',
      code: 'VOLATILE_CONTENT',
      block: blockKey,
      detail: `稳定区检出易变内容（${hit.pattern_id}）: "${hit.match}"；按 §1.3 要求移至尾部区块（tier23_content）`
    });
  }
}

/**
 * 装配计划稳定化审计（FP-TOKO-005 §1.1 auditOrder）
 *
 * 支持两种计划形态：
 * - 形态 A（FP-TOKO-003 CAG 装配计划，含 plan.tiers）：区块顺序由 assemble 构造序保证
 *   （t0→t1→t2→t3 对应序位 1→2→4→4，Tier 3 置尾由构造保证），本形态做 R1 易变内容
 *   扫描（t0.index 文本 + t1.skills 正文）与 Tier 0/1 区块哈希（T3/T4 比对基准）；
 *   plan.generated_at 属计划元数据而非载荷区块，不参与前缀哈希与扫描。
 * - 形态 B（宿主自定义序列，plan.blocks = [{key, content}]）：按 §2.1 序位逐块校验
 *   （非递增即 ORDER_VIOLATION/CRITICAL；未知区块键同理），Tier 0/1 块做 R1 扫描。
 *
 * @param {Object} plan - 装配计划（形态 A：{tiers:{t0,t1,t2,t3}}；形态 B：{blocks:[{key,content}]}）
 * @returns {{passed:boolean, violations:Array<{severity:string,code:string,block?:string,detail:string}>,
 *            order:string[], block_hashes:Object}} 审计结果；
 *            block_hashes：形态 A 为 {tier0, tier1}（sha256），形态 B 为 {sequence:[{key,hash}]}
 * @throws {Error} AUDIT_PLAN_MALFORMED（两种形态均不匹配）
 */
export function auditOrder(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('AUDIT_PLAN_MALFORMED: plan 必须为对象');
  }

  const violations = [];
  const order = CANONICAL_KEYS;

  // ===== 形态 A：FP-TOKO-003 CAG 装配计划（tiers）=====
  if (plan.tiers && typeof plan.tiers === 'object') {
    const t0 = plan.tiers.t0 || { index: [] };
    const t1 = plan.tiers.t1 || { skills: [] };
    const t0Text = Array.isArray(t0.index) ? t0.index.map(item => (item && typeof item.text === 'string' ? item.text : '')).join('\n') : '';
    const t1Text = Array.isArray(t1.skills) ? t1.skills.map(s => (s && typeof s.content === 'string' ? s.content : '')).join('\n') : '';
    scanStableBlock('tier0_index', t0Text, violations);
    scanStableBlock('tier1_skills', t1Text, violations);
    return {
      passed: violations.length === 0,
      violations,
      order,
      block_hashes: { tier0: sha256(t0Text), tier1: sha256(t1Text) }
    };
  }

  // ===== 形态 B：宿主自定义区块序列（blocks）=====
  if (Array.isArray(plan.blocks)) {
    const hashes = [];
    let prevPos = -1;
    let lastTailKey = null; // 最近出现的尾部区块键（R3 置尾校验：尾部之后不得再出现非尾部区块）
    plan.blocks.forEach((block, idx) => {
      const canonical = resolveBlockKey(block && block.key);
      const content = block && typeof block.content === 'string' ? block.content : '';
      if (!canonical) {
        violations.push({
          severity: 'CRITICAL',
          code: 'ORDER_VIOLATION',
          block: block ? String(block.key) : `blocks[${idx}]`,
          detail: `未知区块键，合法键域（含别名）: ${CANONICAL_KEYS.join('/')} 等`
        });
        return;
      }
      const pos = CANONICAL_ORDER.find(b => b.key === canonical).position;
      if (pos < prevPos) {
        if (prevPos === 4 && pos < 4 && lastTailKey) {
          // R3 专用语义：尾部区块（Tier 2/3）之后又出现稳定区/历史区块 → 标记尾部区块本身
          violations.push({
            severity: 'CRITICAL',
            code: 'ORDER_VIOLATION',
            block: lastTailKey,
            detail: `Tier 2/3 置尾违规（R3）：${lastTailKey} 位于 ${block.key} 之前；按需内容必须位于末尾`
          });
        } else {
          violations.push({
            severity: 'CRITICAL',
            code: 'ORDER_VIOLATION',
            block: block.key,
            detail: `区块序位非递增：${block.key}（序位 ${pos}）出现在序位 ${prevPos} 区块之后；规范顺序 ${order.join(' → ')}`
          });
        }
      } else {
        prevPos = pos;
        if (pos === 4) lastTailKey = block.key;
      }
      if (canonical === 'tier0_index' || canonical === 'tier1_skills') {
        scanStableBlock(canonical, content, violations);
      }
      hashes.push({ key: canonical, hash: sha256(content) });
    });
    return { passed: violations.length === 0, violations, order, block_hashes: { sequence: hashes } };
  }

  throw new Error('AUDIT_PLAN_MALFORMED: plan 必须为 CAG 装配计划（{tiers}）或区块序列（{blocks:[{key,content}]}）');
}

// ==================== 缓存命中观测（T5 / §3.1 步骤 6） ====================

/**
 * 记录一轮缓存用量观测（供应商用量报表回填；R4 折扣计费收益核算的数据源）
 * @param {{sessionId:string, cacheReadTokens:number, cacheWriteTokens:number}} record
 * @returns {{cache_read:number, cache_write:number, hit_ratio:number, at:string}} 本轮记录
 * @throws {Error} RECORD_MALFORMED
 */
export function observeCacheUsage(record = {}) {
  const { sessionId, cacheReadTokens, cacheWriteTokens } = record || {};
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('RECORD_MALFORMED: sessionId 必须为非空字符串');
  }
  if (!Number.isFinite(cacheReadTokens) || cacheReadTokens < 0 || !Number.isFinite(cacheWriteTokens) || cacheWriteTokens < 0) {
    throw new Error('RECORD_MALFORMED: cacheReadTokens/cacheWriteTokens 必须为非负数值');
  }
  let rounds = cacheObservations.get(sessionId);
  if (!rounds) {
    rounds = [];
    cacheObservations.set(sessionId, rounds);
  }
  const total = cacheReadTokens + cacheWriteTokens;
  const entry = {
    cache_read: cacheReadTokens,
    cache_write: cacheWriteTokens,
    hit_ratio: total > 0 ? cacheReadTokens / total : 0,
    at: new Date().toISOString()
  };
  rounds.push(entry);
  return entry;
}

/**
 * 会话缓存命中统计（T5：命中率随会话轮次提升）
 * @param {string} sessionId
 * @returns {{session_id:string, rounds:number, hit_ratio_first:(number|null),
 *            hit_ratio_latest:(number|null), hit_ratio_best:(number|null), improved:boolean}}
 */
export function getCacheStats(sessionId) {
  const rounds = cacheObservations.get(sessionId) || [];
  if (rounds.length === 0) {
    return { session_id: sessionId, rounds: 0, hit_ratio_first: null, hit_ratio_latest: null, hit_ratio_best: null, improved: false };
  }
  const ratios = rounds.map(r => r.hit_ratio);
  return {
    session_id: sessionId,
    rounds: rounds.length,
    hit_ratio_first: ratios[0],
    hit_ratio_latest: ratios[ratios.length - 1],
    hit_ratio_best: Math.max(...ratios),
    improved: ratios[ratios.length - 1] > ratios[0]
  };
}

/**
 * 清空缓存观测内存态（会话结束/测试隔离用；不触碰 FP-003 装配会话态）
 * @param {string} sessionId
 */
export function clearSession(sessionId) {
  cacheObservations.delete(sessionId);
}

export default {
  CANONICAL_ORDER,
  VOLATILE_PATTERNS,
  getAssemblyOrder,
  scanVolatileContent,
  auditOrder,
  observeCacheUsage,
  getCacheStats,
  clearSession
};
