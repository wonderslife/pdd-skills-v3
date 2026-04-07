/**
 * PDD Visual Manager - Sparkline 迷你折线图组件 (VM-C012)
 *
 * 在终端中渲染轻量级的折线图/趋势图：
 * - Unicode 块字符绘制
 * - 支持单数据集和多数据集叠加
 * - 自动缩放和归一化
 * - 最小值/最大值/当前值标注
 * - 多种填充样式
 *
 * 适合在有限空间内展示趋势数据。
 */

import { ANSI } from '../renderer.js';

/**
 * Sparkline 绘图字符集
 */
const SPARK_CHARS = {
  // 块字符（从空到满，8级）
  blocks: [' ', '▁', '�', '▃', '▄', '▅', '▆', '▇', '█'],

  // 线条字符
  lineHorizontal: '━',
  lineVertical: '┃',

  // 点字符
  dot: '•',
  solidDot: '●',
  hollowDot: '○',

  // 填充字符
  fillFull: '█',
  fillPartial: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
  fillEmpty: '░'
};

/**
 * Sparkline - 迷你折线图组件
 *
 * 用于在终端中展示趋势数据的轻量图表。
 */
class Sparkline {
  /**
   * 创建 Sparkline 实例
   * @param {number[]} values - 数据值数组
   * @param {number} width - 图表宽度（字符数）
   * @param {number} height - 图表高度（行数）
   * @param {Object} options - 配置选项
   */
  constructor(values = [], width = 20, height = 4, options = {}) {
    /** @type {number[]} 数据值 */
    this.values = values.slice();

    /** @type {number} 图表宽度 */
    this.width = Math.max(3, width);

    /** @type {number} 图表高度 */
    this.height = Math.max(1, height);

    /** @type {Object} 选项 */
    this.options = {
      min: null,              // 手动指定最小值
      max: null,              // 手动指定最大值
      label: '',              // 标签文字
      color: ANSI.CYAN,       // 主色
      secondaryColor: ANSI.MAGENTA, // 第二数据集颜色
      fillChar: null,         // 填充字符（null=使用块字符）
      showDots: true,         // 显示数据点
      showMinMax: true,       // 显示最值标注
      fillArea: false,        // 填充区域
      ...options
    };

    // 计算数据范围
    this._calcRange();
  }

  /**
   * 计算数据范围
   * @private
   */
  _calcRange() {
    if (this.values.length === 0) {
      this.dataMin = 0;
      this.dataMax = 100;
      this.dataRange = 100;
      return;
    }

    this.dataMin = this.options.min !== null
      ? this.options.min
      : Math.min(...this.values);

    this.dataMax = this.options.max !== null
      ? this.options.max
      : Math.max(...this.values);

    // 防止除零
    this.dataRange = this.dataMax - this.dataMin || 1;
  }

  /**
   * 将数据值映射到高度级别
   * @param {number} value - 数据值
   * @returns {number} 高度级别 (0 到 height)
   * @private
   */
  _mapToHeight(value) {
    const normalized = (value - this.dataMin) / this.dataRange;
    return Math.round(normalized * (this.height - 1));
  }

  /**
   * 将数据值映射到块字符索引
   * @param {number} value - 数据值
   * @returns {number} 块字符索引 (0-8)
   * @private
   */
  _mapToBlock(value) {
    const normalized = (value - this.dataMin) / this.dataRange;
    return Math.min(8, Math.max(0, Math.round(normalized * 8)));
  }

  /**
   * 渲染 sparkline
   * @returns {string} 格式化的 sparkline 字符串
   */
  render() {
    if (this.values.length === 0) {
      return this.options.fillEmpty || SPARK_CHARS.fillEmpty.repeat(this.width);
    }

    switch (this.height) {
      case 1:
        return this._renderInline();
      default:
        return this._renderMultiLine();
    }
  }

  /**
   * 渲染单行内联 sparkline
   * 使用 ▁▂▃▄▅▆▇█ 字符在一行内显示趋势
   * @returns {string}
   * @private
   */
  _renderInline() {
    const chars = this.options.fillChar || SPARK_CHARS.blocks;
    const color = this.options.color;

    let result = '';
    for (const v of this.values) {
      const idx = this._mapToBlock(v);
      result += chars[idx];
    }

    // 应用颜色
    result = `${color}${result}${ANSI.RESET}`;

    // 添加标签
    if (this.options.label) {
      result = `${this.options.label} ${result}`;
    }

    // 添加最值标注
    if (this.options.showMinMax && this.values.length > 0) {
      const lastVal = this.values[this.values.length - 1];
      result += ` ${lastVal}`;
    }

    return result;
  }

  /**
   * 渲染多行 sparkline（真正的折线图效果）
   * @returns {string}
   * @private
   */
  _renderMultiLine() {
    const h = this.height;
    const w = this.width;
    const color = this.options.color;

    // 创建画布（从上到下）
    const canvas = [];
    for (let row = 0; row < h; row++) {
      canvas.push(new Array(w).fill(' '));
    }

    // 绘制数据点和连线
    const points = this.values.slice(0, w).map(v => this._mapToHeight(v));

    for (let x = 0; x < points.length; x++) {
      const y = points[x];
      const canvasY = h - 1 - y; // 翻转 Y 轴

      if (canvasY >= 0 && canvasY < h) {
        // 绘制点
        canvas[canvasY][x] = this.options.showDots ? SPARK_CHARS.solidDot : '█';

        // 向下填充（如果启用区域填充）
        if (this.options.fillArea) {
          for (let fy = canvasY + 1; fy < h; fy++) {
            canvas[fy][x] = this.options.fillChar || SPARK_CHARS.fillEmpty;
          }
        }

        // 绘制到下一个点的连线
        if (x < points.length - 1) {
          const nextY = points[x + 1];
          const nextCanvasY = h - 1 - nextY;

          // 垂直线连接
          const minY = Math.min(canvasY, nextCanvasY);
          const maxY = Math.max(canvasY, nextCanvasY);
          for (let ly = minY; ly <= maxY; ly++) {
            if (ly >= 0 && ly < h) {
              if (canvas[ly][x + 1] === ' ') {
                canvas[ly][x + 1] = SPARK_CHARS.lineVertical;
              }
            }
          }
        }
      }
    }

    // 组装输出
    let output = '';

    // Y轴最大值标签
    if (this.options.showMinMax) {
      output += `${String(this.dataMax).padStart(6)} ┃`;
    }

    for (let row = 0; row < h; row++) {
      const line = canvas[row].join('');
      output += `\n${color}${line}${ANSI.RESET}`;
    }

    // X轴最小值标签
    if (this.options.showMinMax) {
      output += `\n${String(this.dataMin).padStart(6)} ┃`;
    }

    // 标签
    if (this.options.label) {
      output += `\n  ${this.options.label}`;
    }

    return output.startsWith('\n') ? output.substring(1) : output;
  }

  /**
   * 渲染多数据集叠加的 sparkline
   * @param {{values: number[], color?: string, label?: string}[] datasets - 数据集数组
   * @returns {string}
   */
  renderMulti(datasets = []) {
    if (!datasets || datasets.length === 0) {
      return this.render();
    }

    // 简化处理：将多个数据集在同一行用不同颜色显示
    let result = '';
    for (const ds of datasets) {
      const dsColor = ds.color || this.options.secondaryColor;
      const subSpark = new Sparkline(
        ds.values || [],
        this.width,
        1,
        { ...this.options, color: dsColor, showMinMax: false }
      );
      result += subSpark.render() + '  ';
    }

    return result.trimEnd();
  }

  /**
   * 更新数据并重新渲染
   * @param {number[]} newValues - 新数据
   * @returns {string}
   */
  update(newValues) {
    this.values = newValues.slice();
    this._calcRange();
    return this.render();
  }

  /**
   * 创建简单的趋势箭头指示器
   * @param {number} currentValue - 当前值
   * @param {number} previousValue - 前一个值
   * @returns {string} 带颜色的趋势指示
   */
  static trend(currentValue, previousValue) {
    if (previousValue === 0 || previousValue === undefined || previousValue === null) {
      return `${ANSI.DIM}—${ANSI.RESET}`;
    }

    const diff = currentValue - previousValue;
    const pctChange = (diff / Math.abs(previousValue)) * 100;

    if (diff > 0) {
      return `${ANSI.GREEN}↑${Math.abs(pctChange).toFixed(1)}%${ANSI.RESET}`;
    } else if (diff < 0) {
      return `${ANSI.RED}↓${Math.abs(pctChange).toFixed(1)}%${ANSI.RESET}`;
    }
    return `${ANSI.DIM}→0%${ANSI.RESET}`;
  }

  /**
   * 快速创建 sparkline 的静态方法
   * @param {number[]} values - 数据
   * @param {number} width - 宽度
   * @param {Object} opts - 选项
   * @returns {string}
   */
  static quick(values, width = 10, opts = {}) {
    const sp = new Sparkline(values, width, 1, opts);
    return sp.render();
  }
}

export default Sparkline;
export { SPARK_CHARS };
