/**
 * PDD Visual Manager - 键盘输入处理器 (VM-C003)
 *
 * 处理终端原始键盘输入，支持：
 * - Raw mode 模式捕获所有按键
 * - 特殊键解析（方向键、Ctrl组合键、功能键等）
 * - 终端 resize 事件监听
 * - 可插拔的按键回调机制
 *
 * 纯 Node.js 内置模块实现，零外部依赖。
 */

import readline from 'readline';

/**
 * 特殊按键映射表
 * 将原始字节序列映射为标准按键名称
 */
const KEY_MAP = {
  // 控制键
  '\x03': 'ctrl_c',       // Ctrl+C
  '\x04': 'ctrl_d',       // Ctrl+D
  '\x08': 'ctrl_h',       // Ctrl+H (Backspace)
  '\x09': 'tab',          // Tab
  '\x0a': 'enter',        // Enter (LF)
  '\x0d': 'return',       // Return (CR)
  '\x7f': 'backspace',    // Backspace
  '\x1b': 'escape',       // Esc (单个)

  // ESC 序列 - 光标键
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[C': 'right',
  '\x1b[D': 'left',

  // ESC 序列 - 功能/编辑键
  '\x1b[F': 'end',
  '\x1b[H': 'home',
  '\x1b[2~': 'insert',
  '\x1b[3~': 'delete',
  '\x1b[5~': 'pageup',
  '\x1b[6~': 'pagedown',

  // Shift + 方向键
  '\x1b[a': 'shift_up',
  '\x1b[b': 'shift_down',
  '\x1b[c': 'shift_right',
  '\x1b[d': 'shift_left',

  // Ctrl + 方向键
  '\x1b[1;5A': 'ctrl_up',
  '\x1b[1;5B': 'ctrl_down',
  '\x1b[1;5C': 'ctrl_right',
  '\x1b[1;5D': 'ctrl_left',

  // Shift+Tab
  '\x1b[Z': 'shift_tab',

  // F1-F12
  '\x1bOP': 'f1',
  '\x1bOQ': 'f2',
  '\x1bOR': 'f3',
  '\x1bOS': 'f4',
  '\x1b[15~': 'f5',
  '\x1b[17~': 'f6',
  '\x1b[18~': 'f7',
  '\x1b[19~': 'f8',
  '\x1b[20~': 'f9',
  '\x1b[21~': 'f10',
  '\x1b[23~': 'f11',
  '\x1b[24~': 'f12'
};

/**
 * InputHandler - 键盘输入处理器
 *
 * 管理 raw mode 终端输入，将原始字节流转换为结构化按键事件。
 *
 * 使用方式:
 * ```js
 * const handler = new InputHandler((key) => {
 *   console.log('Key pressed:', key.name);
 * });
 * handler.setup();
 * // ... 使用后 ...
 * handler.teardown();
 * ```
 */
class InputHandler {
  /**
   * 创建输入处理器
   * @param {Function} onKeyPress - 按键回调函数，接收 { name, char, raw } 对象
   */
  constructor(onKeyPress = null) {
    /** @type {Function|null} 按键回调 */
    this.onKeyPress = onKeyPress;

    /** @type {readline.Interface|null} readline 接口 */
    this.rl = null;

    /** @type {string} 输入缓冲区（用于多字节序列） */
    this.buffer = '';

    /** @type {boolean} 是否已激活 */
    this.active = false;

    /** @type {boolean} 是否已设置 raw mode */
    this.rawModeSet = false;
  }

  /**
   * 初始化输入处理器
   * 设置 raw mode 和事件监听
   */
  setup() {
    if (this.active) return;

    // 创建 readline 接口（保持 stdin 引用活跃）
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
      prompt: ''
    });

    // 启用 raw mode 以捕获所有按键
    try {
      process.stdin.setRawMode(true);
      this.rawModeSet = true;
    } catch (e) {
      console.error('[TUI] Warning: Cannot set raw mode:', e.message);
    }

    // 确保 stdin 处于 flowing mode
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // 监听数据输入
    process.stdin.on('data', (chunk) => {
      this._handleChunk(chunk);
    });

    // 监听终端尺寸变化
    process.stdout.on('resize', () => {
      if (this.onKeyPress) {
        this.onKeyPress({
          name: 'resize',
          char: '',
          raw: 'resize',
          columns: process.stdout.columns,
          rows: process.stdout.rows
        });
      }
    });

    this.active = true;
  }

  /**
   * 处理输入数据块
   * @param {Buffer|string} chunk - 输入数据
   * @private
   */
  _handleChunk(chunk) {
    const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    this.buffer += data;

    // 尝试从缓冲区提取完整的按键
    while (this.buffer.length > 0) {
      const key = this._parseNextKey();
      if (!key) break; // 需要更多数据

      if (this.onKeyPress) {
        try {
          this.onKeyPress(key);
        } catch (e) {
          console.error('[TUI] Key handler error:', e.message);
        }
      }
    }
  }

  /**
   * 从缓冲区解析下一个完整按键
   * @returns {Object|null} 按键对象或 null（需要更多数据）
   * @private
   */
  _parseNextKey() {
    const buf = this.buffer;

    // 直接查找已知按键序列（优先匹配长序列）
    for (const len = Math.min(buf.length, 10); len > 0; len--) {
      const seq = buf.substring(0, len);
      if (KEY_MAP.hasOwnProperty(seq)) {
        this.buffer = buf.substring(len);
        return {
          name: KEY_MAP[seq],
          char: seq,
          raw: seq
        };
      }
    }

    // 单个可打印字符
    if (buf.length >= 1) {
      const first = buf.charCodeAt(0);

      // Esc 键特殊处理：如果是单独的 \x1b 且后面没有跟其他字符
      // 这里我们采用简单策略：如果第一个是 \x1b 且不在已知序列中，
      // 先等待一下看是否有后续字符。但为了简化，直接返回 escape
      if (first === 0x1b) {
        // 如果是单独的 esc 或未知转义序列
        if (buf.length === 1 || buf[1] !== '[' && buf[1] !== 'O') {
          this.buffer = buf.substring(1);
          return { name: 'escape', char: '\x1b', raw: '\x1b' };
        }
        // CSI 序列，继续收集
        if (buf[1] === '[' || buf[1] === 'O') {
          // 等待完整序列 - 简单处理：最多等待 6 个字符
          if (buf.length < 3) return null; // 需要更多数据

          // 尝试匹配已知的 CSI 序列
          const csiEnd = this._findCSIEnd(buf);
          if (csiEnd > 0) {
            const seq = buf.substring(0, csiEnd);
            this.buffer = buf.substring(csiEnd);
            const knownName = KEY_MAP[seq];
            return {
              name: knownName || 'unknown_csi',
              char: seq,
              raw: seq
            };
          }
          // 如果还没结束且缓冲区不够长，等待更多数据
          if (buf.length < 7) return null;
          // 超过合理长度，当作未知序列消费掉
          this.buffer = buf.substring(1);
          return { name: 'unknown_sequence', char: buf[0], raw: buf[0] };
        }
      }

      // 可打印 ASCII 字符 (32-126)
      if (first >= 32 && first <= 126) {
        this.buffer = buf.substring(1);
        const char = buf[0];
        return {
          name: char,
          char: char,
          raw: char
        };
      }

      // 其他控制字符，跳过
      this.buffer = buf.substring(1);
      return {
        name: 'control',
        char: String.fromCharCode(first),
        raw: buf[0]
      };
    }

    return null;
  }

  /**
   * 查找 CSI 序列的结束位置
   * @param {string} buf - 缓冲区
   * @returns {number} CSI 序列结束位置（不包含），0 表示未找到
   * @private
   */
  _findCSIEnd(buf) {
    // CSI 序列格式: ESC [ 参数(可选) 中间符(可选) 最终字节
    // 最终字节通常是 0x40-0x7E 范围内的可打印字符
    let i = 2; // 跳过 ESC [
    while (i < buf.length) {
      const code = buf.charCodeAt(i);
      // 参数: 0x30-0x3F (0-9:;<=>?)
      // 中间符: 0x20-0x2F (空格!"#$%&'()*+,-./)
      // 最终字节: 0x40-0x7E (@A-Z[\]^_`a-z{|}~)
      if (code >= 0x40 && code <= 0x7e) {
        return i + 1;
      }
      i++;
    }
    return 0;
  }

  /**
   * 清理资源，恢复终端状态
   */
  teardown() {
    if (!this.active) return;

    // 恢复正常模式
    if (this.rawModeSet) {
      try {
        process.stdin.setRawMode(false);
      } catch (e) {
        // 忽略错误
      }
      this.rawModeSet = false;
    }

    // 暂停 stdin
    try {
      process.stdin.pause();
    } catch (e) {
      // 忽略
    }

    // 关闭 readline
    if (this.rl) {
      try {
        this.rl.close();
      } catch (e) {
        // 忽略
      }
      this.rl = null;
    }

    this.active = false;
    this.buffer = '';
  }

  /**
   * 检查是否处于活跃状态
   * @returns {boolean}
   */
  get isActive() {
    return this.active;
  }
}

export default InputHandler;
export { KEY_MAP };
