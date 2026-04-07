/**
 * PDD Visual Manager - Terminal TUI 主控制器 (VM-C001 + VM-C004)
 *
 * TUIApp 是整个终端 UI 的主入口和协调器：
 * - 管理屏幕生命周期（启动/停止）
 * - 协调数据提供者 (PDDDataProvider)
 * - 处理用户键盘输入并分发到各 Screen
 * - 管理多屏切换、搜索模式、详情覆盖层
 * - 自动刷新机制
 *
 * 使用方式:
 * ```js
 * import { TUIApp } from './tui/tui.js';
 * const app = new TUIApp('/path/to/project', { refresh: 5 });
 * await app.start();
 * ```
 */

import readline from 'readline';
import Renderer, { ANSI } from './renderer.js';
import InputHandler from './input.js';

// 延迟导入 screen 模块（避免循环依赖，按需加载）
let OverviewScreen = null;
let KanbanScreen = null;
let QualityScreen = null;
let SystemScreen = null;

/** 屏幕定义 */
const SCREENS = [
  { id: 'overview', name: '总览', icon: '▣' },
  { id: 'kanban',   name: '看板', icon: '▦' },
  { id: 'quality',  name: '质量', icon: '◈' },
  { id: 'system',   name: '系统', icon: '⚙' }
];

/**
 * TUIApp - 终端 UI 应用主类
 */
class TUIApp {
  /**
   * 创建 TUI 应用实例
   * @param {string} projectRoot - 项目根目录路径
   * @param {Object} options - 配置选项
   * @param {number} [options.refresh=5] - 自动刷新间隔（秒）
   * @param {boolean} [options.debug=false] - 调试模式
   */
  constructor(projectRoot, options = {}) {
    /** @type {string} 项目根目录 */
    this.projectRoot = projectRoot;

    /** @type {Object} 配置选项 */
    this.options = {
      refresh: 5,
      debug: false,
      ...options
    };

    /** @type {PDDDataProvider|null} 数据提供者 */
    this.provider = null;

    /** @type {Renderer} 渲染器实例 */
    this.renderer = new Renderer();

    /** @type {InputHandler|null} 输入处理器 */
    this.inputHandler = null;

    /** @type {number} 当前屏幕索引 */
    this.currentScreen = 0;

    /** @type {boolean} 是否运行中 */
    this.running = false;

    /** @type {number|null} 刷新定时器 ID */
    this.refreshTimer = null;

    /** @type {number} 刷新间隔（毫秒） */
    this.refreshInterval = (this.options.refresh || 5) * 1000;

    /** @type {boolean} 是否暂停自动刷新 */
    this.paused = false;

    /** @type {boolean} 是否处于搜索模式 */
    this.searchMode = false;

    /** @type {string} 当前搜索查询 */
    this.searchQuery = '';

    /** @type {number} 看板选中功能点索引 */
    this.selectedFeatureIndex = -1;

    /** @type {boolean} 是否显示详情覆盖层 */
    this.detailOverlay = false;

    /** @type {boolean} 是否显示帮助覆盖层 */
    this.helpOverlay = false;

    /** @type {number} 上次渲染时间戳 */
    this.lastRenderTime = 0;

    /** @type {number} 渲染计数 */
    this.renderCount = 0;

    // 绑定方法
    this._onKeyPress = this._onKeyPress.bind(this);
  }

  // ============================================================
  // 生命周期管理
  // ============================================================

  /**
   * 启动 TUI 应用
   * 异步方法：初始化数据源、设置输入处理、开始渲染循环
   */
  async start() {
    if (this.running) return;

    try {
      // 1. 进入备用屏幕缓冲区并隐藏光标
      this.renderer.enterAltBuffer();
      this.renderer.clear();

      // 2. 动态加载 PDDDataProvider
      const { PDDDataProvider } = await import('../data-provider.js');
      this.provider = new PDDDataProvider(this.projectRoot);

      // 3. 初始化数据源
      await this.provider.init();

      // 4. 动态加载 Screen 模块
      await this._loadScreens();

      // 5. 设置输入处理器
      this._setupInput();

      // 6. 启动自动刷新
      this._startAutoRefresh();

      // 7. 标记为运行中
      this.running = true;

      // 8. 首次渲染
      this.render();

      if (this.options.debug) {
        this._log('TUI started successfully');
      }
    } catch (error) {
      this._log(`Failed to start TUI: ${error.message}`);
      this.stop();
      throw error;
    }
  }

  /**
   * 停止 TUI 应用
   * 清理资源、恢复终端状态
   */
  stop() {
    if (!this.running) return;

    // 停止自动刷新
    this._stopAutoRefresh();

    // 清理输入处理器
    if (this.inputHandler) {
      this.inputHandler.teardown();
      this.inputHandler = null;
    }

    // 恢复终端状态
    this.renderer.restore();

    // 标记为已停止
    this.running = false;

    if (this.options.debug) {
      this._log(`TUI stopped. Total renders: ${this.renderCount}`);
    }
  }

  // ============================================================
  // 屏幕模块加载
  // ============================================================

  /**
   * 动态加载所有 Screen 模块
   * @private
   */
  async _loadScreens() {
    const [overviewMod, kanbanMod, qualityMod, systemMod] = await Promise.all([
      import('./screens/overview-screen.js'),
      import('./screens/kanban-screen.js'),
      import('./screens/quality-screen.js'),
      import('./screens/system-screen.js')
    ]);

    OverviewScreen = overviewMod.OverviewScreen;
    KanbanScreen = kanbanMod.KanbanScreen;
    QualityScreen = qualityMod.QualityScreen;
    SystemScreen = systemMod.SystemScreen;
  }

  // ============================================================
  // 输入处理
  // ============================================================

  /**
   * 设置键盘输入监听
   * @private
   */
  _setupInput() {
    this.inputHandler = new InputHandler(this._onKeyPress);
    this.inputHandler.setup();
  }

  /**
   * 按键事件回调
   * @param {Object} key - 按键对象 { name, char, raw }
   * @private
   */
  _onKeyPress(key) {
    try {
      // 帮助覆盖层优先处理
      if (this.helpOverlay) {
        this._handleHelpInput(key);
        return;
      }

      // 详情覆盖层处理
      if (this.detailOverlay) {
        this._handleDetailInput(key);
        return;
      }

      // 搜索模式处理
      if (this.searchMode) {
        this._handleSearchInput(key);
        return;
      }

      // 正常模式按键处理
      this._handleNormalInput(key);
    } catch (e) {
      this._log(`Key handler error: ${e.message}`);
    }
  }

  /**
   * 正常模式下的按键处理
   * @param {Object} key - 按键对象
   * @private
   */
  _handleNormalInput(key) {
    switch (key.name) {
      // 退出
      case 'q':
      case 'ctrl_c':
        this.stop();
        process.exit(0);
        break;

      // 屏幕切换
      case 'tab':
        this.switchScreen(1);
        break;
      case 'shift_tab':
        this.switchScreen(-1);
        break;
      case 'right':
        this.switchScreen(1);
        break;
      case 'left':
        this.switchScreen(-1);
        break;
      case '1': case '2': case '3': case '4': {
        const idx = parseInt(key.name) - 1;
        if (idx >= 0 && idx < SCREENS.length) {
          this.currentScreen = idx;
          this.selectedFeatureIndex = -1;
          this.render();
        }
        break;
      }

      // 手动刷新
      case 'r':
        this._manualRefresh();
        break;

      // 暂停/恢复
      case 'p':
        this.paused = !this.paused;
        this.render();
        break;

      // 搜索
      case '/':
        this.searchMode = true;
        this.searchQuery = '';
        this.render();
        break;

      // 帮助
      case '?':
        this.helpOverlay = true;
        this.render();
        break;

      // 看板导航
      case 'j':
      case 'down':
        if (this.currentScreen === 1) { // kanban screen
          this._navigateFeatures(1);
        }
        break;
      case 'k':
      case 'up':
        if (this.currentScreen === 1) { // kanban screen
          this._navigateFeatures(-1);
        }
        break;

      // Enter 打开详情
      case 'enter':
      case 'return':
        if (this.currentScreen === 1 && this.selectedFeatureIndex >= 0) {
          this.detailOverlay = true;
          this.render();
        }
        break;

      // Resize 事件
      case 'resize':
        this.render();
        break;

      default:
        // 忽略未知按键
        break;
    }
  }

  /**
   * 搜索模式下的按键处理
   * @param {Object} key - 按键对象
   * @private
   */
  _handleSearchInput(key) {
    switch (key.name) {
      case 'escape':
        this.searchMode = false;
        this.searchQuery = '';
        this.selectedFeatureIndex = -1;
        this.render();
        break;

      case 'enter':
      case 'return':
        // 执行搜索并切换到看板屏
        this.searchMode = false;
        this.currentScreen = 1; // 切换到 kanban
        this.selectedFeatureIndex = 0;
        this.render();
        break;

      case 'backspace':
        this.searchQuery = this.searchQuery.slice(0, -1);
        this.render();
        break;

      default:
        // 追加可打印字符
        if (key.char && key.char.length === 1 && key.char.charCodeAt(0) >= 32) {
          this.searchQuery += key.char;
          this.render();
        }
        break;
    }
  }

  /**
   * 详情覆盖层的按键处理
   * @param {Object} key - 按键对象
   * @private
   */
  _handleDetailInput(key) {
    switch (key.name) {
      case 'escape':
      case 'q':
      case 'e':
        this.detailOverlay = false;
        this.render();
        break;

      case 'j':
      case 'down':
        this._navigateFeatures(1);
        this.render(); // 更新详情显示
        break;

      case 'k':
      case 'up':
        this._navigateFeatures(-1);
        this.render();
        break;

      default:
        break;
    }
  }

  /**
   * 帮助覆盖层的按键处理
   * @param {Object} key - 按键对象
   * @private
   */
  _handleHelpInput(key) {
    switch (key.name) {
      case 'escape':
      case 'q':
      case '?':
        this.helpOverlay = false;
        this.render();
        break;
      default:
        break;
    }
  }

  // ============================================================
  // 导航与切换
  // ============================================================

  /**
   * 切换到相邻屏幕
   * @param {number} delta - 方向 (+1 或 -1)
   */
  switchScreen(delta) {
    const total = SCREENS.length;
    this.currentScreen = (this.currentScreen + delta + total) % total;
    this.selectedFeatureIndex = -1;
    this.detailOverlay = false;
    this.searchMode = false;
    this.render();
  }

  /**
   * 在功能点列表中导航
   * @param {number} delta - 方向 (+1 下, -1 上)
   * @private
   */
  _navigateFeatures(delta) {
    if (!this.provider) return;

    const features = this._getFilteredFeatures();
    const count = features.length;

    if (count === 0) {
      this.selectedFeatureIndex = -1;
      return;
    }

    if (this.selectedFeatureIndex < 0) {
      this.selectedFeatureIndex = delta > 0 ? 0 : count - 1;
    } else {
      this.selectedFeatureIndex = (this.selectedFeatureIndex + delta + count) % count;
    }

    this.render();
  }

  /**
   * 获取当前过滤后的功能点列表
   * @returns {Array}
   * @private
   */
  _getFilteredFeatures() {
    if (!this.provider) return [];

    let features = this.provider.getFeatures() || [];
    if (!Array.isArray(features)) features = [];

    // 应用搜索过滤
    if (this.searchQuery && this.searchQuery.length > 0) {
      const query = this.searchQuery.toLowerCase();
      features = features.filter(f =>
        (f.name && f.name.toLowerCase().includes(query)) ||
        (f.id && f.id.toLowerCase().includes(query)) ||
        (f.description && f.description.toLowerCase().includes(query))
      );
    }

    return features;
  }

  // ============================================================
  // 刷新机制
  // ============================================================

  /**
   * 启动自动刷新定时器
   * @private
   */
  _startAutoRefresh() {
    this._stopAutoRefresh();

    this.refreshTimer = setInterval(async () => {
      if (!this.running || this.paused || this.searchMode || this.detailOverlay || this.helpOverlay) {
        return;
      }

      try {
        await this.provider.refresh();
        this.render();
      } catch (e) {
        this._log(`Auto-refresh error: ${e.message}`);
      }
    }, this.refreshInterval);

    // 防止定时器阻止进程退出
    if (this.refreshTimer.unref) {
      this.refreshTimer.unref();
    }
  }

  /**
   * 停止自动刷新定时器
   * @private
   */
  _stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * 手动触发刷新
   * @private
   */
  async _manualRefresh() {
    try {
      await this.provider.refresh();
      this.render();
    } catch (e) {
      this._log(`Manual refresh error: ${e.message}`);
    }
  }

  // ============================================================
  // 渲染系统
  // ============================================================

  /**
   * 主渲染方法 - 根据当前状态绘制完整屏幕
   */
  render() {
    if (!this.running || !this.provider) return;

    const startTime = Date.now();
    this.renderer._updateSize();

    // 清屏并归位
    this.renderer.home();

    let output = '';

    // 根据当前状态决定渲染内容
    if (this.helpOverlay) {
      output = this._renderHelpScreen();
    } else if (this.detailOverlay) {
      output = this._renderDetailOverlay();
    } else if (this.searchMode) {
      output = this._renderSearchMode();
    } else {
      output = this._renderCurrentScreen();
    }

    // 渲染底部状态栏
    output += '\n' + this._renderStatusBar();

    // 输出到终端
    this.renderer.write(output);

    // 更新统计
    this.lastRenderTime = Date.now();
    this.renderCount++;

    if (this.options.debug) {
      const elapsed = Date.now() - startTime;
      if (elapsed > 50) {
        this._log(`Slow render: ${elapsed}ms`);
      }
    }
  }

  /**
   * 渲染当前激活的屏幕
   * @returns {string}
   * @private
   */
  _renderCurrentScreen() {
    switch (this.currentScreen) {
      case 0:
        return OverviewScreen.render(this.provider, this.renderer);
      case 1:
        return KanbanScreen.render(
          this.provider,
          this.renderer,
          this.selectedFeatureIndex,
          this._getFilteredFeatures()
        );
      case 2:
        return QualityScreen.render(this.provider, this.renderer);
      case 3:
        return SystemScreen.render(this.provider, this.renderer);
      default:
        return OverviewScreen.render(this.provider, this.renderer);
    }
  }

  /**
   * 渲染搜索模式界面
   * @returns {string}
   * @private
   */
  _renderSearchMode() {
    const r = this.renderer;
    const w = r.width;
    const h = r.height;

    let output = '';

    // 搜索提示栏
    output += r.bold(r.cyan('/')) + r.dim(' 搜索功能点...') + ' ';
    output += r.bold(this.searchQuery) + '█'; // 光标

    // 显示搜索结果预览
    const results = this._getFilteredFeatures();
    output += '\n\n';
    output += r.dim(`找到 ${results.length} 个匹配结果:\n`);

    const maxShow = Math.min(results.length, h - 6);
    for (let i = 0; i < maxShow; i++) {
      const f = results[i];
      const marker = i === 0 ? r.bold('»') : ' ';
      const name = r.truncate(f.name || f.id || '(unnamed)', w - 10);
      output += `${marker} ${name}\n`;
      if (f.description) {
        output += `  ${r.dim(r.truncate(f.description, w - 12))}\n`;
      }
    }

    if (results.length > maxShow) {
      output += r.dim(`\n... 还有 ${results.length - maxShow} 个结果\n`);
    }

    output += '\n' + r.dim('Enter: 确认搜索 | Esc: 取消');

    return output;
  }

  /**
   * 渲染详情覆盖层
   * @returns {string}
   * @private
   */
  _renderDetailOverlay() {
    const r = this.renderer;
    const features = this._getFilteredFeatures();

    if (this.selectedFeatureIndex < 0 || !features[this.selectedFeatureIndex]) {
      this.detailOverlay = false;
      return this._renderCurrentScreen();
    }

    const feature = features[this.selectedFeatureIndex];
    return KanbanScreen.renderDetail(feature, r, this.selectedFeatureIndex, features.length);
  }

  /**
   * 渲染帮助屏幕
   * @returns {string}
   * @private
   */
  _renderHelpScreen() {
    const r = this.renderer;
    const w = Math.min(r.width, 60);

    const helpContent = [
      '',
      r.bold(r.center(' 键盘快捷键 ', w)),
      '',
      r.separator('─', w),
      '',
      '  Tab / ← →     切换屏幕',
      '  1-4           直接跳转到指定屏幕',
      '  r             手动刷新数据',
      '  p             暂停/恢复自动刷新',
      '  /             搜索功能点',
      '  j/k 或 ↑↓     选择功能点 (看板)',
      '  Enter         查看详情',
      '  Esc           关闭弹窗/退出搜索',
      '  ?             显示/关闭帮助',
      '  q / Ctrl+C    退出程序',
      '',
      r.separator('─', w),
      '',
      r.dim(' 按 Esc 或 q 关闭帮助'),
      ''
    ];

    // 居中显示帮助面板
    const lines = helpContent.map(line => r.center(line, w));
    return lines.join('\n');
  }

  /**
   * 渲染底部状态栏
   * @returns {string}
   * @private
   */
  _renderStatusBar() {
    const r = this.renderer;
    const w = r.width;

    // 构建 tab 区域
    let tabs = '';
    for (let i = 0; i < SCREENS.length; i++) {
      const scr = SCREENS[i];
      const isActive = i === this.currentScreen;
      const prefix = isActive ? '[' : ' ';
      const suffix = isActive ? ']' : ' ';

      if (isActive) {
        tabs += r.bold(r.reverse(`${prefix}${scr.icon} ${scr.name}${suffix}`));
      } else {
        tabs += `${prefix}${scr.icon} ${scr.name}${suffix}`;
      }
      tabs += '  ';
    }

    // 右侧信息
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const statusParts = [];

    // 连接状态指示
    statusParts.push(this.provider ? r.brightGreen('●') : r.brightRed('○'));

    // 暂停指示
    if (this.paused) {
      statusParts.push(r.brightYellow('⏸'));
    }

    // 时间
    statusParts.push(r.dim(now));

    // 刷新计数（调试模式）
    if (this.options.debug) {
      statusParts.push(r.dim(`#${this.renderCount}`));
    }

    const rightInfo = statusParts.join(' ');

    // 组合状态栏
    const tabsWidth = r.strWidth(tabs);
    const rightWidth = r.strWidth(rightInfo);
    const middlePad = Math.max(2, w - tabsWidth - rightWidth);

    return ANSI.REVERSE +
      tabs +
      ' '.repeat(middlePad) +
      rightInfo +
      ANSI.RESET;
  }

  // ============================================================
  // 工具方法
  // ============================================================

  /**
   * 获取当前屏幕信息
   * @returns {Object}
   */
  get currentScreenInfo() {
    return SCREENS[this.currentScreen] || SCREENS[0];
  }

  /**
   * 调试日志输出
   * @param {string} message - 日志消息
   * @private
   */
  _log(message) {
    if (this.options.debug) {
      // 写入 stderr 以免干扰 TUI 渲染
      process.stderr.write(`[TUI:DEBUG] ${message}\n`);
    }
  }
}

export { TUIApp, SCREENS };
export default TUIApp;
