/**
 * PDD Visual Manager - 表格组件 (VM-C011)
 *
 * 提供灵活的终端表格渲染能力：
 * - 自动列宽计算
 * - 多种对齐方式
 * - 行高亮选择
 * - 固定表头/表尾
 * - 文本自动换行
 * - 多种边框风格
 *
 * 纯 Unicode 绘制，零依赖。
 */

import { ANSI, BORDER_CHARS } from '../renderer.js';

/** 默认对齐方式映射 */
const DEFAULT_ALIGN = {
  number: 'right',
  default: 'left'
};

/**
 * Table - 终端表格组件
 *
 * 功能丰富的表格渲染器，适用于数据展示场景。
 */
class Table {
  /**
   * 创建表格实例
   * @param {string[]} headers - 表头数组
   * @param {Array<Array<string|number>>} rows - 数据行二维数组
   * @param {Object} options - 配置选项
   */
  constructor(headers = [], rows = [], options = {}) {
    /** @type {string[]} 表头 */
    this.headers = headers.map(h => String(h || ''));

    /** @type {Array<Array<string>>} 数据行（已转为字符串） */
    this.rows = (rows || []).map(row =>
      (row || []).map(cell => String(cell ?? ''))
    );

    /** @type {Object} 配置选项 */
    this.options = {
      widths: null,            // 指定列宽数组
      aligns: [],              // 对齐方式数组 ('left'|'right'|'center')
      highlightRow: -1,        // 高亮行索引 (-1=无)
      fixedHeader: true,       // 固定表头
      fixedFooter: false,      // 固定表尾
      maxWidth: 0,             // 最大表格宽度 (0=不限制)
      wrapText: false,         // 是否换行文本
      borderStyle: 'single',   // 边框风格 ('single'|'double'|'rounded')
      title: '',               // 表格标题
      footer: null,            // 表尾数据行
      showRowNumbers: false,   // 显示行号
      compact: false,          // 紧凑模式（减少内边距）
      ...options
    };

    // 计算或使用指定的列宽
    this._calculateColumnWidths();
  }

  /**
   * 计算各列最佳宽度
   * @private
   */
  _calculateColumnWidths() {
    if (this.options.widths && Array.isArray(this.options.widths)) {
      this.columnWidths = [...this.options.widths];
      return;
    }

    // 初始化为表头宽度
    this.columnWidths = this.headers.map(h => this._strWidth(h));

    // 考虑每行的内容
    for (const row of this.rows) {
      for (let i = 0; i < row.length; i++) {
        const cellWidth = this._strWidth(row[i]);
        if (i < this.columnWidths.length) {
          if (cellWidth > this.columnWidths[i]) {
            this.columnWidths[i] = cellWidth;
          }
        } else {
          this.columnWidths.push(cellWidth);
        }
      }
    }

    // 最小宽度 3
    this.columnWidths = this.columnWidths.map(w => Math.max(w, 3));
  }

  /**
   * 设置高亮行
   * @param {number} index - 行索引 (-1 取消高亮)
   */
  setHighlight(index) {
    this.options.highlightRow = index;
  }

  /**
   * 渲染完整表格
   * @returns {string} 格式化的表格字符串
   */
  render() {
    const opts = this.options;
    const c = BORDER_CHARS[opts.borderStyle] || BORDER_CHARS.single;
    const widths = this.columnWidths;
    const aligns = opts.aligns;

    const lines = [];

    // 标题
    if (opts.title) {
      lines.push(this._renderTitle(opts.title, widths, c));
    }

    // 顶边框
    lines.push(this._makeBorder(c.tl, c.bt, c.tr, widths));

    // 表头
    lines.push(this._renderHeader(c, widths, aligns));

    // 表头下分隔线
    lines.push(this._makeBorder(c.lt, c.cross, c.rt, widths));

    // 数据行
    for (let r = 0; r < this.rows.length; r++) {
      const isHighlighted = r === opts.highlightRow;
      lines.push(this._renderDataRow(r, c, widths, aligns, isHighlighted));
    }

    // 表尾（如果有）
    if (opts.footer) {
      lines.push(this._makeBorder(c.lt, c.cross, c.rt, widths));
      const footerRow = opts.footer.map(f => String(f ?? ''));
      lines.push(this._renderCells(footerRow, c, widths, aligns, false));
    }

    // 底边框
    lines.push(this._makeBorder(c.bl, c.bb, c.br, widths));

    return lines.join('\n');
  }

  /**
   * 渲染紧凑版表格（无左右边框线）
   * @returns {string}
   */
  renderCompact() {
    const widths = this.columnWidths;
    const aligns = this.options.aligns;
    const lines = [];

    // 表头
    const headerCells = this.headers.map((h, i) =>
      this._pad(String(h), widths[i], aligns[i] || 'left')
    );
    lines.push(headerCells.join('  '));

    // 分隔线
    lines.push(widths.map(w => '─'.repeat(w)).join('  '));

    // 数据行
    for (let r = 0; r < this.rows.length; r++) {
      const cells = this.rows[r].map((cell, i) =>
        this._pad(String(cell), widths[i], aligns[i] || 'left')
      );
      lines.push(cells.join('  '));
    }

    return lines.join('\n');
  }

  /**
   * 渲染标题行
   * @param {string} title - 标题文本
   * @param {number[]} widths - 列宽数组
   * @param {Object} c - 边框字符
   * @returns {string}
   * @private
   */
  _renderTitle(title, widths, c) {
    const totalWidth = widths.reduce((sum, w) => sum + w + 1, 0) + 1;
    const titleStr = ` ${title} `;
    const padding = Math.max(0, totalWidth - this._strWidth(titleStr) - 2);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;

    return `${c.tl}─${' '.repeat(leftPad)}${titleStr}${' '.repeat(rightPad)}─${c.tr}`;
  }

  /**
   * 渲染表头行
   * @param {Object} c - 边框字符
   * @param {number[]} widths - 列宽
   * @param {string[]} aligns - 对齐方式
   * @returns {string}
   * @private
   */
  _renderHeader(c, widths, aligns) {
    const cells = this.headers.map((h, i) => {
      const padded = this._pad(String(h), widths[i], aligns[i] || 'center');
      return ANSI.BOLD + padded + ANSI.RESET;
    });

    return this._joinRow(cells, c.v);
  }

  /**
   * 渲染数据行
   * @param {number} rowIndex - 行索引
   * @param {Object} c - 边框字符
   * @param {number[]} widths - 列宽
   * @param {string[]} aligns - 对齐方式
   * @param {boolean} highlighted - 是否高亮
   * @returns {string}
   * @private
   */
  _renderDataRow(rowIndex, c, widths, aligns, highlighted) {
    const row = this.rows[rowIndex] || [];
    const line = this._renderCells(row, c, widths, aligns, highlighted);

    // 可选的行号前缀
    if (this.options.showRowNumbers) {
      const numStr = String(rowIndex + 1).padStart(3);
      const prefix = highlighted
        ? `${ANSI.REVERSE} ${numStr} ${ANSI.RESET}`
        : ` ${ANSI.DIM}${numStr}${ANSI.RESET} `;
      return prefix + line;
    }

    return line;
  }

  /**
   * 渲染单元格
   * @param {string[]} cells - 单元格数据
   * @param {Object} c - 边框字符
   * @param {number[]} widths - 列宽
   * @param {string[]} aligns - 对齐方式
   * @param {boolean} highlighted - 是否高亮
   * @returns {string}
   * @private
   */
  _renderCells(cells, c, widths, aligns, highlighted) {
    const padded = cells.map((cell, i) => {
      const w = i < widths.length ? widths[i] : 10;
      const align = (aligns && aligns[i]) || 'left';
      return this._pad(String(cell), w, align);
    });

    const rowStr = this._joinRow(padded, c.v);
    return highlighted ? ANSI.REVERSE + rowStr + ANSI.RESET : rowStr;
  }

  /**
   * 生成边框线
   * @param {string} left - 左角字符
   * @param {string} mid - 中间分隔字符
   * @param {string} right - 右角字符
   * @param {number[]} widths - 列宽数组
   * @returns {string}
   * @private
   */
  _makeBorder(left, mid, right, widths) {
    return left + widths.map(w => (mid === '─' || mid === '═' ? mid : '─').repeat(w)).join(mid) + right;
  }

  /**
   * 连接一行单元格
   * @param {string[]} cells - 已填充的单元格
   * @param {string} sep - 分隔符
   * @returns {string}
   * @private
   */
  _joinRow(cells, sep) {
    return sep + ' ' + cells.join(' ' + sep + ' ') + ' ' + sep;
  }

  /**
   * 文本填充到指定宽度
   * @param {string} text - 文本
   * @param {number} width - 目标宽度
   * @param {string} align - 对齐方式
   * @returns {string}
   * @private
   */
  _pad(text, width, align = 'left') {
    const displayLen = this._strWidth(text);
    if (displayLen >= width) {
      return this._truncate(text, width);
    }
    const pad = width - displayLen;
    switch (align) {
      case 'right':
        return ' '.repeat(pad) + text;
      case 'center':
        return ' '.repeat(Math.floor(pad / 2)) + text + ' '.repeat(Math.ceil(pad / 2));
      default:
        return text + ' '.repeat(pad);
    }
  }

  /**
   * 截断文本
   * @param {string} text - 文本
   * @param {number} maxLen - 最大宽度
   * @returns {string}
   * @private
   */
  _truncate(text, maxLen) {
    if (this._strWidth(text) <= maxLen) return text;
    let result = '';
    let currentW = 0;
    for (const ch of text) {
      const cw = this._strWidth(ch);
      if (currentW + cw > maxLen - 1) break;
      result += ch;
      currentW += cw;
    }
    return result + '…';
  }

  /**
   * 计算字符串显示宽度
   * @param {string} text
   * @returns {number}
   * @private
   */
  _strWidth(text) {
    let w = 0;
    for (const ch of String(text)) {
      w += ch.charCodeAt(0) > 0xff ? 2 : 1;
    }
    return w;
  }

  /**
   * 快速创建简单表格的静态工厂方法
   * @param {string[]} headers - 表头
   * @param {Array<Array>} rows - 数据行
   * @param {Object} options - 选项
   * @returns {string} 渲染结果
   */
  static quick(headers, rows, options = {}) {
    const table = new Table(headers, rows, options);
    return table.render();
  }

  /**
   * 创建键值对信息表（两列布局）
   * @param {Array<[string, string]>} data - 键值对数组
   * @param {Object} options - 选项
   * @returns {string}
   */
  static keyValue(data, options = {}) {
    const headers = options.headers || ['属性', '值'];
    const rows = data.map(([label, value]) => [label, String(value ?? '')]);
    return new Table(headers, rows, {
      ...options,
      aligns: ['left', 'left']
    }).render();
  }
}

export default Table;
