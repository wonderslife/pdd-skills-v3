/**
 * PDD Visual Manager - 进度条组件 (VM-C010)
 *
 * 提供多种风格的进度条渲染：
 * - 水平进度条（默认）
 * - 分段进度条
 * - 环形进度条（ASCII艺术）
 * - 带颜色渐变的智能进度条
 * - 支持动画效果标记
 *
 * 纯 Unicode 字符绘制，零依赖。
 */

import { ANSI } from '../renderer.js';

/**
 * 进度条填充字符集
 */
const BAR_CHARS = {
  filled: '█',
  empty: '░',
  partial: ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'],
  thinFilled: '▓',
  thinEmpty: '░'
};

/**
 * 根据百分比获取颜色
 * @param {number} pct - 百分比 (0-100)
 * @returns {string} ANSI 颜色码
 */
function getColorForPercent(pct) {
  if (pct >= 90) return ANSI.BRIGHT_GREEN;
  if (pct >= 70) return ANSI.GREEN;
  if (pct >= 50) return ANSI.BRIGHT_YELLOW;
  if (pct >= 30) return ANSI.YELLOW;
  if (pct >= 15) return ANSI.BRIGHT_RED;
  return ANSI.RED;
}

/**
 * 获取等级颜色
 * @param {string} grade - 等级 (S/A/B/C/D/F)
 * @returns {string}
 */
function getGradeColor(grade) {
  const colors = {
    'S': ANSI.BRIGHT_GREEN,
    'A': ANSI.GREEN,
    'B': ANSI.BRIGHT_YELLOW,
    'C': ANSI.YELLOW,
    'D': ANSI.BRIGHT_RED,
    'F': ANSI.RED
  };
  return colors[grade] || ANSI.DIM;
}

/**
 * ProgressBar - 进度条组件
 *
 * 支持多种显示风格和配置选项的通用进度条。
 */
class ProgressBar {
  /**
   * 创建进度条实例
   * @param {number} value - 当前值
   * @param {number} max - 最大值
   * @param {number} width - 进度条字符宽度
   * @param {Object} options - 配置选项
   */
  constructor(value = 0, max = 100, width = 20, options = {}) {
    /** @type {number} 当前值 */
    this.value = value;

    /** @type {number} 最大值 */
    this.max = max;

    /** @type {number} 显示宽度 */
    this.width = Math.max(1, width);

    /** @type {Object} 选项 */
    this.options = {
      style: 'horizontal',     // horizontal | segmented | ring
      filledChar: '█',
      emptyChar: '░',
      showLabel: true,
      showPercent: true,
      label: '',
      color: null,             // 自定义颜色，null 表示自动
      animate: false,
      ...options
    };
  }

  /**
   * 计算当前百分比
   * @returns {number}
   */
  get percent() {
    if (this.max <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((this.value / this.max) * 100)));
  }

  /**
   * 更新进度值
   * @param {number} newValue - 新值
   * @returns {ProgressBar} this（链式调用）
   */
  update(newValue) {
    this.value = newValue;
    return this;
  }

  /**
   * 渲染水平进度条
   * @returns {string}
   */
  render() {
    switch (this.options.style) {
      case 'segmented':
        return this._renderSegmented();
      case 'ring':
        return this._renderRing();
      case 'vertical':
        return this._renderVertical();
      default:
        return this._renderHorizontal();
    }
  }

  /**
   * 渲染标准水平进度条
   * @returns {string}
   * @private
   */
  _renderHorizontal() {
    const pct = this.percent;
    const w = this.width;
    const opts = this.options;

    // 选择颜色
    const color = opts.color || getColorForPercent(pct);

    // 计算填充长度
    const exactFilled = (pct / 100) * w;
    const filled = Math.floor(exactFilled);
    const partial = exactFilled - filled;

    // 构建进度条
    let bar = opts.filledChar.repeat(filled);

    // 部分填充字符
    if (filled < w && partial > 0) {
      const partialIndex = Math.floor(partial * 8);
      bar += BAR_CHARS.partial[Math.min(partialIndex, 7)];
    } else if (filled < w) {
      // 无部分填充，直接接空字符
    }

    // 填充剩余空位
    const remaining = w - this._displayWidth(bar);
    if (remaining > 0) {
      bar += opts.emptyChar.repeat(remaining);
    }

    // 截断到目标宽度
    bar = bar.substring(0, w);

    // 应用颜色
    const coloredBar = `${color}${bar}${ANSI.RESET}`;

    // 组装最终输出
    let result = '';
    if (opts.label && opts.showLabel) {
      result += `${opts.label} `;
    }
    result += coloredBar;

    if (opts.showPercent !== false) {
      result += ` ${pct}%`;
    }

    return result;
  }

  /**
   * 渲染分段进度条
   * 用于多段式进度显示，如 S/A/B/C/D/F 分布
   * @param {Array<{value:number,label:string,color?:string}>} segments - 段定义
   * @returns {string}
   */
  renderSegmented(segments) {
    if (!segments || segments.length === 0) {
      return this.render(); // 回退到默认渲染
    }

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const w = this.width;

    let result = '';
    let remainingWidth = w;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segPct = total > 0 ? (seg.value / total) : 0;
      const segWidth = Math.max(1, Math.round(segPct * w));
      const clampedWidth = Math.min(segWidth, remainingWidth);

      if (clampedWidth <= 0) continue;

      const color = seg.color || getColorForPercent(segPct * 100);
      const char = this.options.filledChar.repeat(clampedWidth);
      result += `${color}${char}${ANSI.RESET}`;

      // 段标签（如果空间足够）
      if (seg.label && clampedWidth >= 3) {
        const label = seg.label.substring(0, clampedWidth);
        result = result.substring(0, result.length - clampedWidth);
        result += `${color}${this._centerText(label, clampedWidth)}${ANSI.RESET}`;
      }

      remainingWidth -= clampedWidth;
    }

    // 填充剩余空间
    if (remainingWidth > 0) {
      result += this.options.emptyChar.repeat(remainingWidth);
    }

    return result;
  }

  /**
   * 内部分段渲染方法
   * @returns {string}
   * @private
   */
  _renderSegmented() {
    // 默认使用百分比分段
    const pct = this.percent;
    const segments = [];

    if (pct >= 80) segments.push({ value: pct - 80, color: ANSI.BRIGHT_GREEN });
    if (pct >= 60) segments.push({ value: Math.min(pct, 80) - 60, color: ANSI.GREEN });
    if (pct >= 40) segments.push({ value: Math.min(pct, 60) - 40, color: ANSI.YELLOW });
    if (pct >= 20) segments.push({ value: Math.min(pct, 40) - 20, color: ANSI.BRIGHT_RED });
    if (pct > 0) segments.push({ value: Math.min(pct, 20), color: ANSI.RED });

    if (segments.length === 0) {
      segments.push({ value: 100 - pct, color: ANSI.DIM });
    }

    return this.renderSegmented(segments);
  }

  /**
   * 渲染环形/圆形进度指示器（ASCII 艺术）
   * 使用 Unicode 字符模拟环形效果
   * @returns {string}
   * @private
   */
  _renderRing() {
    const pct = this.percent;
    const color = this.options.color || getColorForPercent(pct);

    // 简化的环形表示：使用括号和填充
    // 格式: [██████░░] 75%
    const ringChars = '╭─╮││╰─╯';
    const innerBar = this._renderHorizontal();

    // 多行环形显示
    const lines = [
      `  ${ringChars[0]}${'─'.repeat(this.width + 2)}${ringChars[1]}`,
      `${ringChars[3]} ${innerBar} ${ringChars[4]}`,
      `  ${ringChars[5]}${'─'.repeat(this.width + 2)}${ringChars[6]}`
    ];

    return lines.join('\n');
  }

  /**
   * 渲染垂直进度条
   * @returns {string}
   * @private
   */
  _renderVertical() {
    const pct = this.percent;
    const h = this.width; // 用 width 作为高度
    const color = this.options.color || getColorForPercent(pct);
    const filled = Math.round((pct / 100) * h);

    let bar = '';
    for (let i = 0; i < h; i++) {
      if (i < h - filled) {
        bar += `${this.options.emptyChar}\n`;
      } else {
        bar += `${color}${this.options.filledChar}${ANSI.RESET}\n`;
      }
    }

    if (this.options.showPercent) {
      bar += `${pct}%\n`;
    }

    return bar.trimEnd();
  }

  /**
   * 创建等级进度条（用于质量评分）
   * @param {string} grade - 等级 (S/A/B/C/D/F)
   * @param {number} score - 分数
   * @param {number} width - 宽度
   * @returns {string}
   */
  static gradeBar(grade, score, width = 10) {
    const color = getGradeColor(grade);
    const pct = Math.min(100, Math.max(0, score));
    const filled = Math.round((pct / 100) * width);

    const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
    return `${color}${bar}${ANSI.RESET} ${grade}`;
  }

  /**
   * 创建迷你进度条（紧凑型）
   * @param {number} pct - 百分比
   * @param {number} width - 宽度
   * @returns {string}
   */
  static mini(pct, width = 8) {
    const pb = new ProgressBar(pct, 100, width, {
      showPercent: false,
      showLabel: false
    });
    return pb.render();
  }

  /**
   * 计算字符串显示宽度（简化版）
   * @param {string} str
   * @returns {number}
   * @private
   */
  _displayWidth(str) {
    let w = 0;
    for (const ch of str) {
      w += ch.charCodeAt(0) > 0xff ? 2 : 1;
    }
    return w;
  }

  /**
   * 文本居中
   * @param {string} text
   * @param {number} width
   * @returns {string}
   * @private
   */
  _centerText(text, width) {
    const len = text.length; // 简化：假设 ASCII
    if (len >= width) return text.substring(0, width);
    const pad = width - len;
    return ' '.repeat(Math.floor(pad / 2)) + text + ' '.repeat(Math.ceil(pad / 2));
  }
}

export default ProgressBar;
export { BAR_CHARS, getColorForPercent, getGradeColor };
