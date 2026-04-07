/**
 * PDD Visual Manager - ANSI 渲染引擎 (VM-C002)
 *
 * 提供终端 UI 的底层渲染能力：
 * - ANSI 转义码常量定义
 * - 彩色文字输出
 * - 边框盒子绘制
 * - 进度条渲染
 * - 表格格式化
 * - 文本填充/截断（支持中文等宽）
 * - 终端尺寸自适应
 */

// ============================================================
// ANSI 转义码常量
// ============================================================
export const ANSI = Object.freeze({
  // 屏幕控制
  CLEAR: '\x1b[2J',
  HOME: '\x1b[H',
  SHOW_CURSOR: '\x1b[?25h',
  HIDE_CURSOR: '\x1b[?25l',
  ALT_BUFFER: '\x1b[?1049h',
  MAIN_BUFFER: '\x1b[?1049l',
  SAVE_POS: '\x1b[s',
  RESTORE_POS: '\x1b[u',

  // 前景色 (标准)
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',

  // 前景色 (亮色)
  BRIGHT_RED: '\x1b[91m',
  BRIGHT_GREEN: '\x1b[92m',
  BRIGHT_YELLOW: '\x1b[93m',
  BRIGHT_BLUE: '\x1b[94m',
  BRIGHT_MAGENTA: '\x1b[95m',
  BRIGHT_CYAN: '\x1b[96m',
  BRIGHT_WHITE: '\x1b[97m',

  // 背景色
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // 重置与样式
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  REVERSE: '\x1b[7m',
  STRIKETHROUGH: '\x1b[9m',

  // 光标移动
  POS(row, col) {
    return `\x1b[${row};${col}H`;
  },
  UP(n = 1) {
    return `\x1b[${n}A`;
  },
  DOWN(n = 1) {
    return `\x1b[${n}B`;
  },
  LEFT(n = 1) {
    return `\x1b[${n}D`;
  },
  RIGHT(n = 1) {
    return `\x1b[${n}C`;
  },

  // 清除操作
  CLEAR_LINE: '\x1b[K',
  CLEAR_TO_START: '\x1b[1K',
  CLEAR_TO_END: '\x1b[0J',
  CLEAR_SCREEN_BELOW: '\x1b[0J',
  CLEAR_SCREEN_ABOVE: '\x1b[1J'
});

/**
 * 边框字符集
 */
const BORDER_CHARS = {
  single: {
    tl: '┌', tr: '┐', bl: '└', br: '┘',
    h: '─', v: '│',
    lt: '├', rt: '┤', bt: '┬', bb: '┴', cross: '┼'
  },
  double: {
    tl: '╔', tr: '╗', bl: '╚', br: '╝',
    h: '═', v: '║',
    lt: '╠', rt: '╣', bt: '╦', bb: '╩', cross: '╬'
  },
  rounded: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯',
    h: '─', v: '│',
    lt: '├', rt: '┤', bt: '┬', bb: '┴', cross: '┼'
  }
};

/**
 * Renderer - ANSI 渲染引擎
 *
 * 封装所有终端输出操作，提供高层绘图 API。
 * 支持终端尺寸自适应、Unicode 字符宽度计算等。
 */
class Renderer {
  constructor() {
    this._updateSize();
  }

  /**
   * 更新终端尺寸信息
   */
  _updateSize() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
  }

  /**
   * 获取当前终端尺寸
   */
  get size() {
    this._updateSize();
    return { width: this.width, height: this.height };
  }

  // ============================================================
  // 屏幕控制
  // ============================================================

  /** 清屏并将光标移到左上角 */
  clear() {
    process.stdout.write(ANSI.CLEAR + ANSI.HOME);
  }

  /** 隐藏光标并归位 */
  home() {
    process.stdout.write(ANSI.HIDE_CURSOR + ANSI.HOME);
  }

  /** 恢复光标显示，切回主屏幕缓冲区 */
  restore() {
    process.stdout.write(ANSI.SHOW_CURSOR + ANSI.MAIN_BUFFER + ANSI.CLEAR);
  }

  /** 进入备用屏幕缓冲区并隐藏光标 */
  enterAltBuffer() {
    process.stdout.write(ANSI.ALT_BUFFER + ANSI.HIDE_CURSOR);
  }

  // ============================================================
  // 基础输出
  // ============================================================

  /** 写入文本 */
  write(text) {
    if (text) process.stdout.write(text);
  }

  /** 写入一行 */
  writeln(text = '') {
    process.stdout.write(text + '\n');
  }

  /** 移动光标到指定位置 */
  moveTo(row, col) {
    process.stdout.write(ANSI.POS(row, col));
  }

  // ============================================================
  // 彩色文字
  // ============================================================

  /** 包裹颜色代码 */
  colored(text, color) {
    return `${color}${text}${ANSI.RESET}`;
  }

  red(t) { return this.colored(t, ANSI.RED); }
  green(t) { return this.colored(t, ANSI.GREEN); }
  yellow(t) { return this.colored(t, ANSI.YELLOW); }
  blue(t) { return this.colored(t, ANSI.BLUE); }
  magenta(t) { return this.colored(t, ANSI.MAGENTA); }
  cyan(t) { return this.colored(t, ANSI.CYAN); }
  brightRed(t) { return this.colored(t, ANSI.BRIGHT_RED); }
  brightGreen(t) { return this.colored(t, ANSI.BRIGHT_GREEN); }
  brightYellow(t) { return this.colored(t, ANSI.BRIGHT_YELLOW); }
  brightBlue(t) { return this.colored(t, ANSI.BRIGHT_BLUE); }
  brightCyan(t) { return this.colored(t, ANSI.BRIGHT_CYAN); }
  brightWhite(t) { return this.colored(t, ANSI.BRIGHT_WHITE); }

  bold(t) { return `${ANSI.BOLD}${t}${ANSI.RESET}`; }
  dim(t) { return `${ANSI.DIM}${t}${ANSI.RESET}`; }
  italic(t) { return `${ANSI.ITALIC}${t}${ANSI.RESET}`; }
  underline(t) { return `${ANSI.UNDERLINE}${t}${ANSI.RESET}`; }
  reverse(t) { return `${ANSI.REVERSE}${t}${ANSI.RESET}`; }

  // ============================================================
  // 进度条
  // ============================================================

  /**
   * 渲染进度条
   * @param {number} current - 当前值
   * @param {number} total - 总量
   * @param {number} width - 进度条字符宽度
   * @param {Object} opts - 选项
   * @returns {string} 格式化的进度条字符串
   */
  progressBar(current, total, width = 20, opts = {}) {
    const {
      filledChar = '█',
      emptyChar = '░',
      showPercent = true,
      color = null
    } = opts;

    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const clampedPct = Math.max(0, Math.min(100, pct));
    const filled = Math.round(width * clampedPct / 100);

    let bar = filledChar.repeat(filled) + emptyChar.repeat(width - filled);

    if (color) {
      bar = this.colored(bar, color);
    }

    return showPercent !== false ? `${bar} ${clampedPct}%` : bar;
  }

  /**
   * 渲染带颜色的进度条（根据百分比自动变色）
   * @param {number} current - 当前值
   * @param {number} total - 总量
   * @param {number} width - 宽度
   * @param {Object} opts - 选项
   * @returns {string}
   */
  coloredProgressBar(current, total, width = 20, opts = {}) {
    const pct = total > 0 ? (current / total) * 100 : 0;
    let color;
    if (pct >= 90) color = ANSI.GREEN;
    else if (pct >= 60) color = ANSI.BRIGHT_GREEN;
    else if (pct >= 30) color = ANSI.YELLOW;
    else color = ANSI.RED;

    return this.progressBar(current, total, width, { ...opts, color });
  }

  // ============================================================
  // 边框盒子
  // ============================================================

  /**
   * 绘制边框盒子
   * @param {number} x - 左上角列（从1开始）
   * @param {number} y - 左上角行（从1开始）
   * @param {number} w - 宽度（字符数）
   * @param {number} h - 高度（行数）
   * @param {string} title - 标题（可选，居中显示在顶部边框）
   * @param {string} style - 边框风格 ('single'|'double'|'rounded')
   * @returns {string[]} 行数组
   */
  box(x, y, w, h, title = '', style = 'single') {
    const c = BORDER_CHARS[style] || BORDER_CHARS.single;
    const lines = [];

    // 顶行（可能包含标题）
    let topLine = c.tl + c.h.repeat(w - 2) + c.tr;
    if (title) {
      const titleStr = ` ${title} `;
      const titleStart = Math.floor((w - this.strWidth(titleStr)) / 2);
      if (titleStart > 0 && titleStart + this.strWidth(titleStr) < w - 1) {
        const before = c.h.repeat(titleStart);
        const after = c.h.repeat(w - 2 - titleStart - this.strWidth(titleStr));
        topLine = c.tl + before + titleStr + after + c.tr;
      }
    }
    lines.push(topLine);

    // 中间行
    for (let i = 1; i < h - 1; i++) {
      lines.push(c.v + ' '.repeat(w - 2) + c.v);
    }

    // 底行（如果高度>=2）
    if (h >= 2) {
      lines.push(c.bl + c.h.repeat(w - 2) + c.br);
    }

    return lines;
  }

  /**
   * 将内容放入盒子中
   * @param {string[]} contentLines - 内容行数组
   * @param {number} width - 盒子内部宽度
   * @param {string} title - 标题
   * @param {string} style - 边框风格
   * @returns {string[]} 完整的盒子行数组
   */
  boxWithContent(contentLines, width, title = '', style = 'single') {
    const innerWidth = width - 2; // 减去两边边框
    const paddedLines = contentLines.map(line => {
      const displayWidth = this.strWidth(line);
      if (displayWidth > innerWidth) {
        return this.truncate(line, innerWidth);
      }
      return line + ' '.repeat(innerWidth - displayWidth);
    });

    const height = paddedLines.length + 2; // 内容行 + 顶底边框
    const boxLines = this.box(1, 1, width, height, title, style);

    // 将内容填入盒子中间行
    for (let i = 0; i < paddedLines.length; i++) {
      const borderChar = (BORDER_CHARS[style] || BORDER_CHARS.single).v;
      boxLines[i + 1] = borderChar + paddedLines[i] + borderChar;
    }

    return boxLines;
  }

  // ============================================================
  // 表格
  // ============================================================

  /**
   * 渲染表格
   * @param {string[]} headers - 表头数组
   * @param {string[][]} rows - 数据行二维数组
   * @param {Object} opts - 选项
   * @returns {string} 格式化的表格字符串
   */
  table(headers, rows, opts = {}) {
    const {
      columnWidths = null,
      aligns = [],
      highlightRow = -1,
      padStr = ' ',
      borderStyle = 'single'
    } = opts;

    const c = BORDER_CHARS[borderStyle] || BORDER_CHARS.single;
    const allRows = [headers, ...rows];

    // 计算列宽
    let widths = columnWidths;
    if (!widths) {
      widths = headers.map(() => 0);
      for (const row of allRows) {
        for (let i = 0; i < row.length; i++) {
          const w = this.strWidth(String(row[i] || ''));
          if (w > widths[i]) widths[i] = w;
        }
      }
      // 最小宽度3
      widths = widths.map(w => Math.max(w, 3));
    }

    const totalWidth = widths.reduce((sum, w) => sum + w + 1, 0) + 1; // | between + edges
    const lines = [];

    // 分隔线生成器
    const sep = (left, mid, right) => {
      return left + widths.map(w => c.h.repeat(w)).join(mid) + right;
    };

    // 顶部分隔线
    lines.push(sep(c.tl, c.bt, c.tr));

    // 表头
    const headerCells = headers.map((h, i) => {
      const align = aligns[i] || 'left';
      return this.pad(String(h || ''), widths[i], align, padStr);
    });
    lines.push(c.v + ' ' + headerCells.join(' ' + c.v + ' ') + ' ' + c.v);

    // 表头下分隔线
    lines.push(sep(c.lt, c.cross, c.rt));

    // 数据行
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].map((cell, i) => {
        const align = aligns[i] || 'left';
        return this.pad(String(cell || ''), widths[i], align, padStr);
      });
      let line = c.v + ' ' + cells.join(' ' + c.v + ' ') + ' ' + c.v;

      if (r === highlightRow) {
        line = ANSI.REVERSE + line + ANSI.RESET;
      }

      lines.push(line);
    }

    // 底部分隔线
    lines.push(sep(c.bl, c.bb, c.br));

    return lines.join('\n');
  }

  // ============================================================
  // 文本工具
  // ============================================================

  /**
   * 计算字符串显示宽度（中文=2单位）
   * @param {string} text - 输入字符串
   * @returns {number} 显示宽度
   */
  strWidth(text) {
    let w = 0;
    for (const ch of String(text)) {
      const code = ch.charCodeAt(0);
      // CJK范围或其他全宽字符
      if (code > 0xff ||
          (code >= 0x3000 && code <= 0x303f) ||  // CJK符号和标点
          (code >= 0x3400 && code <= 0x4dbf) ||  // CJK扩展A
          (code >= 0x4e00 && code <= 0x9fff) ||  // CJK统一表意文字
          (code >= 0xf900 && code <= 0xfaff) ||  // CJK兼容表意文字
          (code >= 0xfe30 && code <= 0xfe4f)) {   // CJK兼容形式
        w += 2;
      } else {
        w += 1;
      }
    }
    return w;
  }

  /**
   * 文本填充到指定宽度
   * @param {string} text - 输入文本
   * @param {number} width - 目标宽度
   * @param {string} align - 对齐方式 ('left'|'right'|'center')
   * @param {string} fillChar - 填充字符
   * @returns {string}
   */
  pad(text, width, align = 'left', fillChar = ' ') {
    const len = this.strWidth(String(text));
    if (len >= width) return this.truncate(text, width);
    const pad = width - len;
    switch (align) {
      case 'right':
        return fillChar.repeat(pad) + text;
      case 'center':
        return fillChar.repeat(Math.floor(pad / 2)) + text + fillChar.repeat(Math.ceil(pad / 2));
      default:
        return text + fillChar.repeat(pad);
    }
  }

  /**
   * 截断文本到指定显示宽度
   * @param {string} text - 输入文本
   * @param {number} maxLen - 最大显示宽度
   * @param {string} suffix - 截断后缀（默认省略号）
   * @returns {string}
   */
  truncate(text, maxLen, suffix = '') {
    const str = String(text);
    if (this.strWidth(str) <= maxLen) return str;

    let result = '';
    let currentWidth = 0;
    const targetWidth = maxLen - this.strWidth(suffix);

    for (const ch of str) {
      const chWidth = this.strWidth(ch);
      if (currentWidth + chWidth > targetWidth) break;
      result += ch;
      currentWidth += chWidth;
    }

    return result + suffix;
  }

  /**
   * 生成分割线
   * @param {string} char - 分割字符
   * @param {number} width - 宽度（默认终端宽度）
   * @returns {string}
   */
  separator(char = '─', width = null) {
    const w = width || this.width;
    return (char || '─').repeat(Math.max(1, w));
  }

  // ============================================================
  // 高级布局辅助
  // ============================================================

  /**
   * 创建多列布局
   * @param {string[]} columns - 每列的内容字符串
   * @param {number[]} colWidths - 每列宽度
   * @param {number} spacing - 列间距
   * @returns {string[]}
   */
  layoutColumns(columns, colWidths, spacing = 2) {
    const result = [];
    const colLines = columns.map(col => col.split('\n'));
    const maxLines = Math.max(...colLines.map(lines => lines.length), 1);

    for (let i = 0; i < maxLines; i++) {
      let line = '';
      for (let c = 0; c < columns.length; c++) {
        const cellLine = colLines[c][i] || '';
        line += this.pad(cellLine, colWidths[c]);
        if (c < columns.length - 1) {
          line += ' '.repeat(spacing);
        }
      }
      result.push(line);
    }

    return result;
  }

  /**
   * 在指定区域居中文本
   * @param {string} text - 文本
   * @param {number} width - 区域宽度
   * @returns {string}
   */
  center(text, width = null) {
    const w = width || this.width;
    return this.pad(text, w, 'center');
  }
}

/** 全局单例实例 */
const rendererInstance = new Renderer();

export default Renderer;
export { rendererInstance, BORDER_CHARS };
