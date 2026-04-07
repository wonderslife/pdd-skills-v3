/**
 * PDD Visual Manager - Card 卡片组件 (VM-C014)
 *
 * 提供带边框的面板容器：
 * - InfoCard: 键值对信息卡片
 * - 双卡片并排布局
 * - 可自定义边框风格和颜色
 * - 支持标题、页脚
 * - 响应式宽度适配
 *
 * 使用 Unicode 圆角/直角边框字符绘制。
 */

import { ANSI, BORDER_CHARS } from '../renderer.js';

/**
 * Card - 通用卡片组件
 *
 * 带边框的内容容器，可用于组织 UI 布局中的各个区块。
 */
class Card {
  /**
   * 创建卡片实例
   * @param {string} title - 卡片标题
   * @param {string|string[]} content - 内容（字符串或行数组）
   * @param {Object} options - 配置选项
   */
  constructor(title = '', content = '', options = {}) {
    /** @type {string} 标题 */
    this.title = title;

    /** @type {string[]} 内容行数组 */
    this.contentLines = typeof content === 'string'
      ? content.split('\n')
      : (Array.isArray(content) ? content : ['']);

    /** @type {Object} 选项 */
    this.options = {
      width: 0,                 // 宽度 (0=自适应)
      borderColor: null,        // 边框颜色
      titleColor: ANSI.BOLD + ANSI.CYAN,  // 标题颜色
      footer: '',               // 页脚文字
      borderStyle: 'rounded',   // 边框风格 ('single'|'double'|'rounded')
      padding: { x: 2, y: 1 },  // 内边距
      ...options
    };
  }

  /**
   * 渲染卡片
   * @returns {string} 格式化的卡片字符串
   */
  render() {
    const opts = this.options;
    const c = BORDER_CHARS[opts.borderStyle] || BORDER_CHARS.rounded;

    // 确定实际宽度
    const contentWidth = this._calcContentWidth();
    const totalWidth = contentWidth + opts.padding.x * 2;
    const innerWidth = totalWidth - 2; // 减去两边边框

    const lines = [];

    // 顶边框（可能包含标题）
    lines.push(this._renderTopBorder(c, totalWidth));

    // 上内边距
    for (let i = 0; i < opts.padding.y; i++) {
      lines.push(`${c.v}${' '.repeat(innerWidth)}${c.v}`);
    }

    // 内容行
    for (const rawLine of this.contentLines) {
      const padded = this._padLine(rawLine, innerWidth);
      lines.push(`${c.v} ${padded} ${c.v}`);
    }

    // 下内边距
    for (let i = 0; i < opts.padding.y; i++) {
      lines.push(`${c.v}${' '.repeat(innerWidth)}${c.v}`);
    }

    // 页脚（如果存在）
    if (opts.footer) {
      const footerPadded = this._padLine(opts.footer, innerWidth);
      lines.push(`${c.v} ${ANSI.DIM}${footerPadded}${ANSI.RESET} ${c.v}`);
    }

    // 底边框
    lines.push(`${c.bl}${c.h.repeat(innerWidth)}${c.br}`);

    return lines.join('\n');
  }

  /**
   * 渲染顶边框（带标题）
   * @param {Object} c - 边框字符
   * @param {number} totalWidth - 总宽度
   * @returns {string}
   * @private
   */
  _renderTopBorder(c, totalWidth) {
    const innerWidth = totalWidth - 2;

    if (!this.title) {
      return `${c.tl}${c.h.repeat(innerWidth)}${c.tr}`;
    }

    // 标题格式: "── title ──"
    const titleStr = ` ${this.title} `;
    const titleWidth = this._strWidth(titleStr);

    if (titleWidth >= innerWidth) {
      // 标题太长，截断
      const truncated = this._truncate(this.title, innerWidth - 4);
      return `${c.tl}─ ${truncated} ─${c.tr}`;
    }

    const before = Math.floor((innerWidth - titleWidth) / 2);
    const after = innerWidth - titleWidth - before;

    const titleColored = `${this.options.titleColor}${titleStr}${ANSI.RESET}`;
    return `${c.tl}${c.h.repeat(before)}${titleColored}${c.h.repeat(after)}${c.tr}`;
  }

  /**
   * 计算内容所需宽度
   * @returns {number}
   * @private
   */
  _calcContentWidth() {
    if (this.options.width > 0) {
      return this.options.width;
    }

    let maxW = 0;
    for (const line of this.contentLines) {
      const w = this._strWidth(line);
      if (w > maxW) maxW = w;
    }
    if (this.title) {
      const titleW = this._strWidth(this.title) + 2; // 加上两边空格
      if (titleW > maxW) maxW = titleW;
    }
    if (this.options.footer) {
      const footerW = this._strWidth(this.options.footer);
      if (footerW > maxW) maxW = footerW;
    }

    return Math.max(maxW + 2, 10); // 最小宽度 10
  }

  /**
   * 填充行到指定宽度
   * @param {string} line - 原始行
   * @param {number} width - 目标宽度
   * @returns {string}
   * @private
   */
  _padLine(line, width) {
    const lineW = this._strWidth(line);
    if (lineW >= width) {
      return this._truncate(line, width);
    }
    return line + ' '.repeat(width - lineW);
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
    let w = 0;
    for (const ch of text) {
      const cw = this._strWidth(ch);
      if (w + cw > maxLen - 1) break;
      result += ch;
      w += cw;
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

  // ============================================================
  // 静态工厂方法
  // ============================================================

  /**
   * 创建信息卡片（键值对列表）
   * @param {string} title - 标题
   * @param {Array<{label: string, value: string, color?: string}>} items - 键值对数组
   * @param {Object} cardOpts - 卡片选项
   * @returns {string} 渲染后的卡片
   */
  static info(title, items = [], cardOpts = {}) {
    const lines = items.map(item => {
      const valueColor = item.color || '';
      const valueSuffix = item.value;
      const formatted = valueColor
        ? `${item.label}: ${valueColor}${valueSuffix}${ANSI.RESET}`
        : `${item.label}: ${valueSuffix}`;
      return formatted;
    });

    const card = new Card(title, lines, {
      borderStyle: 'rounded',
      ...cardOpts
    });
    return card.render();
  }

  /**
   * 创建双卡片并排布局
   * @param {Card} leftCard - 左侧卡片
   * @param {Card} rightCard - 右侧卡片
   * @param {number} spacing - 间距
   * @returns {string} 并排的两个卡片
   */
  static sideBySide(leftCard, rightCard, spacing = 4) {
    const leftLines = leftCard.render().split('\n');
    const rightLines = rightCard.render().split('\n');

    const maxRows = Math.max(leftLines.length, rightLines.length);
    const spacer = ' '.repeat(spacing);
    const result = [];

    for (let i = 0; i < maxRows; i++) {
      const left = i < leftLines.length ? leftLines[i] : ' '.repeat(leftLines[0]?.length || 0);
      const right = i < rightLines.length ? rightLines[i] : ' '.repeat(rightLines[0]?.length || 0);
      result.push(`${left}${spacer}${right}`);
    }

    return result.join('\n');
  }

  /**
   * 创建三卡片横向布局
   * @param {Card[]} cards - 卡片数组 (最多3个)
   * @param {number} spacing - 间距
   * @returns {string}
   */
  static triple(cards, spacing = 2) {
    if (!cards || cards.length === 0) return '';

    const renderedCards = cards.map(c => c.render().split('\n'));
    const maxRows = Math.max(...renderedCards.map(lines => lines.length));
    const result = [];

    for (let row = 0; row < maxRows; row++) {
      const parts = renderedCards.map((lines, idx) => {
        const line = row < lines.length ? lines[row] : '';
        // 补齐宽度
        const refWidth = lines[0] ? lines[0].length : 0;
        return line.padEnd(refWidth);
      });
      result.push(parts.join(' '.repeat(spacing)));
    }

    return result.join('\n');
  }

  /**
   * 创建指标卡片（大数字+标签）
   * @param {string} label - 标签
   * @param {string|number} value - 值
   * @param {string} unit - 单位
   * @param {Object} opts - 选项
   * @returns {string}
   */
  static metric(label, value, unit = '', opts = {}) {
    const valueColor = opts.valueColor || ANSI.BOLD + ANSI.CYAN;
    const valueStr = `${valueColor}${value}${ANSI.RESET}${unit ? ' ' + unit : ''}`;

    const content = [
      '',
      `  ${valueStr}`,
      `  ${ANSI.DIM}${label}${ANSI.RESET}`,
      ''
    ];

    const card = new Card(opts.title || '', content, {
      borderStyle: 'rounded',
      titleColor: opts.titleColor || ANSI.DIM,
      width: opts.width || 0,
      ...opts
    });
    return card.render();
  }

  /**
   * 创建警告/错误提示卡片
   * @param {string} message - 消息内容
   * @param {string} type - 类型 ('warn'|'error'|'info')
   * @param {Object} opts - 选项
   * @returns {string}
   */
  static alert(message, type = 'info', opts = {}) {
    const typeConfig = {
      warn: { icon: '⚠', color: ANSI.BRIGHT_YELLOW, title: '警告' },
      error: { icon: '✖', color: ANSI.BRIGHT_RED, title: '错误' },
      info: { icon: 'ℹ', color: ANSI.BLUE, title: '信息' }
    };

    const cfg = typeConfig[type] || typeConfig.info;
    const content = [
      '',
      `  ${cfg.color}${cfg.icon}  ${message}${ANSI.RESET}`,
      ''
    ];

    const card = new Card(cfg.title, content, {
      borderStyle: 'single',
      titleColor: cfg.color,
      borderColor: cfg.color,
      ...opts
    });
    return card.render();
  }
}

export default Card;
