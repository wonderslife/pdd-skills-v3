/**
 * PDD Visual Manager - 看板屏幕 (VM-C021)
 *
 * KanbanScreen 展示功能点看板视图：
 * - 6列紧凑看板 (PRD → Extracted → Spec → Implementing → Verifying → Done)
 * - 每个功能点显示为一张小卡片（名称+优先级+状态）
 * - 支持键盘导航选择 (j/k 或 方向键)
 * - Enter 打开详情覆盖层
 * - 搜索过滤集成 (VM-C025)
 * - Feature Detail Overlay (VM-C024)
 *
 * 布局:
 * ┌─PRD(2)─┐┌Ext(5)──┐┌Spec(8)─┐┌Imp(4)──┐┌Ver(3)──┐┌Done(1)┐
 * │┌───────┐│┌──────┐│┌──────┐│┌──────┐│┌──────┐│┌──────┐│
 * ││auth   │││order │││cart  │││paymt │││auth  │││repo  ││
 * ││  P0 A │││  P1 B│││  P2  │││  P1  │││  S✓ │││  S✓  ││
 * │└───────┘│└──────┘│└──────┘│└──────┘│└──────┘│└──────┘│
 * └─────────┴────────┴────────┴────────┴────────┴────────┘
 * ↑ j/k 选择  Enter 查看  ← → 翻页
 */

import { ANSI } from '../renderer.js';
import { StageEnum, STAGE_ORDER, STAGE_VALUES } from '../../models.js';
import StatusLight from '../components/status-light.js';

/** 看板列定义 */
const KANBAN_COLUMNS = [
  { key: StageEnum.PRD, label: 'PRD', color: ANSI.RED },
  { key: StageEnum.EXTRACTED, label: 'Ext', color: ANSI.YELLOW },
  { key: StageEnum.SPEC, label: 'Spec', color: ANSI.BRIGHT_YELLOW },
  { key: StageEnum.IMPLEMENTING, label: 'Imp', color: ANSI.CYAN },
  { key: StageEnum.VERIFYING, label: 'Ver', color: ANSI.GREEN },
  { key: StageEnum.DONE, label: 'Done', color: ANSI.BRIGHT_GREEN }
];

/** 单张功能点卡片尺寸 */
const CARD_INNER_W = 10;  // 卡片内部宽度
const CARD_HEIGHT = 3;     // 卡片高度（不含边框）
const COL_SPACING = 1;     // 列间距

/**
 * KanbanScreen - 看板屏
 *
 * 静态方法类，支持功能点浏览、选择和详情查看。
 */
class KanbanScreen {
  /**
   * 渲染看板屏幕
   * @param {PDDDataProvider} provider - 数据提供者
   * @param {Renderer} renderer - 渲染器
   * @param {number} selectedIndex - 选中的功能点索引 (-1=无选中)
   * @param {Array} filteredFeatures - 过滤后的功能点列表
   * @returns {string} 完整的屏幕内容
   */
  static render(provider, renderer, selectedIndex = -1, filteredFeatures = null) {
    const r = renderer;
    const w = r.width;
    const h = r.height;

    // 获取功能点列表
    const allFeatures = provider.getFeatures() || [];
    const displayFeatures = filteredFeatures || allFeatures;

    // 按阶段分组
    const grouped = _groupByStage(displayFeatures);

    // 计算布局参数
    const layout = _calcLayout(w, KANBAN_COLUMNS.length);

    let output = '';

    // ========== 1. 标题栏 ==========
    output += _renderHeader(r, displayFeatures.length, allFeatures.length, w);
    output += '\n\n';

    // ========== 2. 看板列 ==========
    output += _renderColumns(r, grouped, selectedIndex, layout, displayFeatures);
    output += '\n';

    // ========== 3. 底部操作提示 ==========
    output += _renderFooter(r, selectedIndex >= 0, w);

    return output;
  }

  /**
   * 渲染 Feature Detail Overlay (VM-C024)
   * @param {Feature} feature - 选中的功能点
   * @param {Renderer} renderer - 渲染器
   * @param {number} index - 当前索引
   * @param {number} total - 总数
   * @returns {string} 详情覆盖层内容
   */
  static renderDetail(feature, renderer, index = 0, total = 1) {
    const r = renderer;
    const w = r.width;
    const h = r.height;

    if (!feature) {
      return r.red('错误: 功能点数据不可用');
    }

    const overlayW = Math.min(w - 4, 70);
    const overlayH = Math.min(h - 4, 20);

    let output = '';

    // 覆盖层边框
    const lines = [];
    const B = { t: '\u255a', tr: '\u2557', bl: '\u255d', br: '\u2559', h: '\u2550', v: '\u2551', lt: '\u2560', rt: '\u2563', bt: '\u2566', bb: '\u2569' };

    // 顶部标题
    const title = ' Feature Detail: ' + (feature.name || feature.id) + ' ';
    lines.push(B.t + B.h.repeat(overlayW - 2) + B.tr);
    lines.push(B.v + ' ' + r.bold(r.cyan(title.padEnd(overlayW - 4))) + ' ' + B.v);

    // 分隔线
    lines.push(B.lt + B.h.repeat(overlayW - 2) + B.rt);

    // 基本信息
    const infoRows = [
      ['ID', feature.id || '(none)'],
      ['Name', feature.name || '(unnamed)'],
      ['Description', feature.description || '-'],
      ['Stage', _formatStage(feature.stage)],
      ['Priority', _formatPriority(feature.priority)],
      ['Progress', (feature.progress ? feature.progress() : _calcProgress(feature.stage)) + '%'],
      ['Tags', (feature.tags || []).join(', ') || '-'],
      ['Created', feature.createdAt ? new Date(feature.createdAt).toLocaleString() : '-'],
      ['Updated', feature.updatedAt ? new Date(feature.updatedAt).toLocaleString() : '-']
    ];

    for (const [label, value] of infoRows) {
      const line = B.v + ' ' + r.bold(label.padEnd(12)) + ' ' + r.truncate(String(value), overlayW - 20) + ' ';
      lines.push(line.padEnd(overlayW - 1) + B.v);
    }

    // 分隔线
    lines.push(B.lt + B.h.repeat(overlayW - 2) + B.rt);

    // 质量信息
    if (feature.quality) {
      const q = feature.quality;
      lines.push(B.v + ' ' + r.bold('Quality') + ' '.repeat(28) + B.v);
      lines.push((B.v + '   Score: ' + q.score + ' (' + q.grade + ')  Coverage: ' + q.coverage + '%  Pass: ' + q.passRate + '%').padEnd(overlayW - 2) + B.v);
    }

    // Token 信息
    if (feature.tokens) {
      const t = feature.tokens;
      lines.push(B.v + ' ' + r.bold('Tokens') + ' '.repeat(28) + B.v);
      lines.push((B.v + '   Used: ' + t.used.toLocaleString() + ' / Total: ' + t.total.toLocaleString()).padEnd(overlayW - 2) + B.v);
    }

    // 迭代信息
    if (feature.iterations && feature.iterations.length > 0) {
      lines.push(B.lt + B.h.repeat(overlayW - 2) + B.rt);
      lines.push((B.v + ' ' + r.bold('Iterations (' + feature.iterations.length + ')')).padEnd(overlayW - 2) + B.v);
      const recentIters = feature.iterations.slice(-3);
      for (const iter of recentIters) {
        lines.push((B.v + '   #' + iter.round + ': score=' + iter.score + ', fixed=' + iter.issuesFixed + ', tokens=' + iter.tokenUsed).padEnd(overlayW - 2) + B.v);
      }
    }

    // 制品信息
    if (feature.artifacts && feature.artifacts.length > 0) {
      lines.push(B.lt + B.h.repeat(overlayW - 2) + B.rt);
      lines.push((B.v + ' ' + r.bold('Artifacts (' + feature.artifacts.length + ')')).padEnd(overlayW - 2) + B.v);
      for (const art of feature.artifacts.slice(0, 3)) {
        lines.push((B.v + '   [' + art.type + '] ' + art.path).padEnd(overlayW - 2) + B.v);
      }
    }

    // 底部导航提示
    lines.push(B.lt + B.h.repeat(overlayW - 2) + B.rt);
    const navHint = '[' + (index + 1) + '/' + total + ']  j/k: navigate  Esc/q/E: close';
    lines.push(B.v + ' ' + r.dim(navHint.padEnd(overlayW - 4)) + ' ' + B.v);
    lines.push(B.bl + B.h.repeat(overlayW - 2) + B.br);

    output = lines.join('\n');

    return output;
  }
}

// ============================================================
// 私有渲染函数
// ============================================================

/**
 * 渲染标题栏
 */
function _renderHeader(r, filteredCount, totalCount, w) {
  const searchHint = filteredCount !== totalCount
    ? r.yellow(` (filtered: ${filteredCount}/${totalCount})`)
    : '';

  const header = r.bold(r.brightCyan('▦ Kanban Board')) +
    r.dim(searchHint);

  return header;
}

/**
 * 计算看板布局参数
 */
function _calcLayout(totalWidth, numCols) {
  // 可用宽度 = 总宽 - 列间间距
  const availableWidth = totalWidth - (numCols - 1) * COL_SPACING;
  const colWidth = Math.max(CARD_INNER_W + 4, Math.floor(availableWidth / numCols)); // +4 for borders and padding
  const cardInnerWidth = colWidth - 4; // 减去两边边框和内边距

  return {
    colWidth,
    cardInnerWidth: Math.max(6, cardInnerWidth),
    numCols
  };
}

/**
 * 渲染所有看板列
 */
function _renderColumns(r, grouped, selectedIndex, layout, flatList) {
  const { colWidth, cardInnerWidth, numCols } = layout;
  const cols = KANBAN_COLUMNS;

  // 找出最高的列
  let maxRows = 0;
  for (const col of cols) {
    const items = grouped[col.key] || [];
    const rowsNeeded = items.length * (CARD_HEIGHT + 1); // 卡片高度 + 间距
    if (rowsNeeded > maxRows) maxRows = rowsNeeded;
  }
  maxRows = Math.max(maxRows, 3); // 最少3行

  // 为每列构建内容数组
  const columnContents = [];
  let globalIndex = 0;

  for (let ci = 0; ci < cols.length; ci++) {
    const col = cols[ci];
    const items = grouped[col.key] || [];
    const colLines = [];

    // 列标题
    const countTag = `(${items.length})`;
    const header = `${col.color}${col.label}${ANSI.RESET} ${countTag}`;
    colLines.push(header);

    // 列分隔线
    colLines.push('─'.repeat(colWidth));

    // 功能点卡片
    for (let ii = 0; ii < items.length; ii++) {
      const feat = items[ii];
      const isSelected = globalIndex === selectedIndex;
      const cardLines = _renderFeatureCard(r, feat, cardInnerWidth, isSelected);
      colLines.push(...cardLines);
      globalIndex++;

      // 卡片间距
      if (ii < items.length - 1) {
        colLines.push('');
      }
    }

    // 空列占位
    if (items.length === 0) {
      colLines.push(r.dim('  (empty)'));
    }

    columnContents.push(colLines);
  }

  // 合并所有列为最终输出
  return _mergeColumns(r, columnContents, colWidth, COL_SPACING);
}

/**
 * 渲染单张功能点卡片
 */
function _renderFeatureCard(r, feature, innerWidth, selected) {
  const name = r.truncate(feature.name || feature.id || '?', innerWidth);
  const priority = feature.priority || 'P2';
  const hasQuality = feature.quality && feature.quality.grade;
  const gradeChar = hasQuality ? feature.quality.grade : '';
  const converged = typeof feature.isConverged === 'function' ? feature.isConverged() : false;
  const statusMark = feature.stage === 'done' ? '✓' : (converged ? '~' : '');

  const line1 = selected
    ? `${ANSI.REVERSE}${name}${ANSI.RESET}`
    : name;
  const line2 = ` ${priority} ${gradeChar}${statusMark}`;

  // 边框盒子
  const border = selected ? ANSI.REVERSE : '';
  const lines = [
    `${border}┌${'─'.repeat(innerWidth)}┐${ANSI.RESET}`,
    `${border}│${r.pad(line1, innerWidth)}│${ANSI.RESET}`,
    `${border}│${r.pad(line2, innerWidth)}│${ANSI.RESET}`,
    `${border}└${'─'.repeat(innerWidth)}┘${ANSI.RESET}`
  ];

  return lines;
}

/**
 * 合并多列为并排输出
 */
function _mergeColumns(r, columns, colWidth, spacing) {
  const maxRows = Math.max(...columns.map(col => col.length));
  const result = [];

  for (let row = 0; row < maxRows; row++) {
    const parts = [];
    for (let c = 0; c < columns.length; c++) {
      const line = row < columns[c].length ? columns[c][row] : '';
      parts.push(r.pad(line, colWidth));
    }
    result.push(parts.join(' '.repeat(spacing)));
  }

  return result.join('\n');
}

/**
 * 渲染底部操作提示
 */
function _renderFooter(r, hasSelection, w) {
  const hints = [];
  hints.push('j/k or ↑↓: select');
  if (hasSelection) hints.push('Enter: detail');
  hints.push('/: search');
  hints.push('Esc: back');

  return r.separator('─', w) + '\n' + r.dim('  ' + hints.join('  |  '));
}

// ============================================================
// 数据处理工具函数
// ============================================================

/**
 * 按阶段对功能点分组
 */
function _groupByStage(features) {
  const groups = {};
  for (const stage of STAGE_VALUES) {
    groups[stage] = [];
  }
  for (const f of features) {
    const stage = f.stage || StageEnum.PRD;
    if (!groups[stage]) groups[stage] = [];
    groups[stage].push(f);
  }
  return groups;
}

/**
 * 格式化阶段显示
 */
function _formatStage(stage) {
  const icons = {
    prd: '📋 PRD',
    extracted: '🔍 Extracted',
    spec: '📝 Spec',
    implementing: '🔨 Implementing',
    verifying: '✅ Verifying',
    done: '✨ Done'
  };
  return icons[stage] || stage;
}

/**
 * 格式化优先级
 */
function _formatPriority(priority) {
  const colors = {
    P0: ANSI.BRIGHT_RED,
    P1: ANSI.YELLOW,
    P2: ANSI.DIM,
    P3: ANSI.DIM
  };
  const color = colors[priority] || ANSI.DIM;
  return `${color}${priority}${ANSI.RESET}`;
}

/**
 * 计算进度百分比
 */
function _calcProgress(stage) {
  const order = STAGE_ORDER[stage];
  if (order === undefined) return 0;
  return Math.round((order / (Object.keys(STAGE_ORDER).length - 1)) * 100);
}

export default KanbanScreen;
