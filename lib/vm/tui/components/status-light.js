/**
 * PDD Visual Manager - 状态指示灯组件 (VM-C013)
 *
 * 提供可视化的状态指示：
 * - 运行状态 (up/down/warn/unknown)
 * - 带颜色编码的状态灯
 * - 可选的闪烁动画效果
 * - 紧凑型和详细型两种显示模式
 *
 * 使用 Unicode 圆形字符实现视觉效果。
 */

import { ANSI } from '../renderer.js';

/**
 * 状态类型枚举
 */
export const StatusType = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  WARN: 'warn',
  UNKNOWN: 'unknown',
  PENDING: 'pending',
  ERROR: 'error'
});

/**
 * 状态对应的视觉配置
 */
const STATUS_CONFIG = {
  up: {
    char: '●',
    color: ANSI.BRIGHT_GREEN,
    altColor: ANSI.GREEN,
    label: '运行中',
    shortLabel: 'UP'
  },
  down: {
    char: '●',
    color: ANSI.BRIGHT_RED,
    altColor: ANSI.RED,
    label: '停止',
    shortLabel: 'DOWN'
  },
  warn: {
    char: '●',
    color: ANSI.BRIGHT_YELLOW,
    altColor: ANSI.YELLOW,
    label: '警告',
    shortLabel: 'WARN'
  },
  unknown: {
    char: '○',
    color: ANSI.DIM,
    altColor: ANSI.DIM,
    label: '未知',
    shortLabel: '?'
  },
  pending: {
    char: '◌',
    color: ANSI.YELLOW,
    altColor: ANSI.DIM,
    label: '等待中',
    shortLabel: '...'
  },
  error: {
    char: '✖',
    color: ANSI.BRIGHT_RED,
    altColor: ANSI.RED,
    label: '错误',
    shortLabel: 'ERR'
  }
};

/**
 * StatusLight - 状态指示灯组件
 *
 * 用于显示系统服务、任务等状态的直观指示器。
 */
class StatusLight {
  /**
   * 创建状态指示灯
   * @param {string} status - 状态类型 (StatusType)
   * @param {Object} options - 配置选项
   */
  constructor(status = 'unknown', options = {}) {
    /** @type {string} 当前状态 */
    this.status = status;

    /** @type {Object} 选项 */
    this.options = {
      showLabel: false,        // 显示状态文字
      detailed: false,         // 详细模式（显示完整标签）
      blink: false,            // 闪烁效果
      bold: true,              // 加粗显示
      suffix: '',              // 后缀文字（如延迟时间）
      prefix: '',              // 前缀文字
      ...options
    };

    // 闪烁动画状态
    this._blinkState = true;
    this._blinkTimer = null;

    if (this.options.blink) {
      this._startBlinking();
    }
  }

  /**
   * 获取当前状态的配置
   * @returns {Object}
   * @private
   */
  _getConfig() {
    return STATUS_CONFIG[this.status] || STATUS_CONFIG.unknown;
  }

  /**
   * 启动闪烁动画
   * @private
   */
  _startBlinking() {
    this._blinkTimer = setInterval(() => {
      this._blinkState = !this._blinkState;
    }, 500);

    if (this._blinkTimer.unref) {
      this._blinkTimer.unref();
    }
  }

  /**
   * 停止闪烁动画
   */
  stopBlinking() {
    if (this._blinkTimer) {
      clearInterval(this._blinkTimer);
      this._blinkTimer = null;
    }
  }

  /**
   * 更新状态
   * @param {string} newStatus - 新状态
   * @returns {StatusLight} this
   */
  setStatus(newStatus) {
    this.status = newStatus;
    return this;
  }

  /**
   * 渲染状态指示灯
   * @returns {string} 格式化的状态指示字符串
   */
  render() {
    const config = this._getConfig();
    const opts = this.options;

    let output = '';
    const color = this.options.blink && !this._blinkState
      ? config.altColor
      : config.color;

    // 前缀
    if (opts.prefix) {
      output += opts.prefix + ' ';
    }

    // 状态灯字符
    const style = opts.bold ? ANSI.BOLD : '';
    output += `${style}${color}${config.char}${ANSI.RESET}`;

    // 后缀（如响应时间）
    if (opts.suffix) {
      output += ` ${opts.suffix}`;
    }

    // 标签
    if (opts.showLabel || opts.detailed) {
      const label = opts.detailed ? config.label : config.shortLabel;
      output += ` ${color}${label}${ANSI.RESET}`;
    }

    return output;
  }

  /**
   * 仅渲染图标（无任何额外信息）
   * @returns {string}
   */
  renderIcon() {
    const config = this._getConfig();
    const color = this.options.blink && !this._blinkState
      ? config.altColor
      : config.color;
    const style = this.options.bold ? ANSI.BOLD : '';
    return `${style}${color}${config.char}${ANSI.RESET}`;
  }

  /**
   * 渲染带背景色的状态灯（更醒目）
   * @returns {string}
   */
  renderProminent() {
    const config = this._getConfig();
    const bgMap = {
      up: ANSI.BG_GREEN,
      down: ANSI.BG_RED,
      warn: ANSI.BG_YELLOW,
      unknown: '',
      pending: '',
      error: ANSI.BG_RED
    };
    const bg = bgMap[this.status] || '';
    return `${bg}${config.char} ${config.shortLabel}${ANSI.RESET}`;
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopBlinking();
  }

  // ============================================================
  // 静态工厂方法
  // ============================================================

  /**
   * 创建"运行中"状态灯
   * @param {Object} opts - 选项
   * @returns {StatusLight}
   */
  static up(opts = {}) {
    return new StatusLight('up', opts);
  }

  /**
   * 创建"停止"状态灯
   * @param {Object} opts - 选项
   * @returns {StatusLight}
   */
  static down(opts = {}) {
    return new StatusLight('down', opts);
  }

  /**
   * 创建"警告"状态灯
   * @param {Object} opts - 选项
   * @returns {StatusLight}
   */
  static warn(opts = {}) {
    return new StatusLight('warn', opts);
  }

  /**
   * 创建"未知"状态灯
   * @param {Object} opts - 选项
   * @returns {StatusLight}
   */
  static unknown(opts = {}) {
    return new StatusLight('unknown', opts);
  }

  /**
   * 从布尔值创建状态灯
   * @param {boolean} isHealthy - 是否健康
   * @param {Object} opts - 选项
   * @returns {StatusLight}
   */
  static fromBoolean(isHealthy, opts = {}) {
    return new StatusLight(isHealthy ? 'up' : 'down', opts);
  }

  /**
   * 批量渲染多个状态灯（水平排列）
   * @param {Array<{status: string, label?: string, suffix?: string}>} items - 状态项数组
   * @param {string} separator - 分隔符
   * @returns {string}
   */
  static row(items, separator = '  ') {
    return items.map(item => {
      const light = new StatusLight(item.status, {
        showLabel: !!item.label,
        suffix: item.suffix || ''
      });
      return light.render();
    }).join(separator);
  }
}

export default StatusLight;
