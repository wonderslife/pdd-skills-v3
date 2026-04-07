/**
 * PDD Visual Manager - SPA Main Controller (VM-B012)
 *
 * 单页应用的全局状态管理与控制器
 * 负责：
 * - 全局状态管理（主题、连接、数据）
 * - Tab 视图切换
 * - SSE 实时连接管理
 * - 数据获取与缓存
 * - Modal 弹窗管理
 * - Toast 通知系统
 * - 键盘快捷键
 * - 自动刷新机制
 *
 * @version 1.0.0
 */

// ============================================================
// App - 全局单例控制器
// ============================================================

const App = {
  // ----------------------------------------------------------
  // 状态定义
  // ----------------------------------------------------------
  state: {
    /** 当前激活的视图标签 */
    currentTab: 'pipeline',

    /** 当前主题：'light' | 'dark' */
    theme: localStorage.getItem('vm-theme') || 'light',

    /** SSE 连接状态 */
    connected: false,

    /** 最后更新时间戳 */
    lastUpdate: null,

    /** 完整项目数据（从 /api/project 获取） */
    projectData: null,

    /** 功能点列表（从 /api/features 获取） */
    features: [],

    /** 项目摘要信息（从 /api/summary 获取） */
    summary: null,

    /** 质量矩阵数据（从 /api/quality 获取） */
    qualityMatrix: null,

    /** Token 统计数据 */
    tokenStats: null,

    /** 缓存统计数据 */
    cacheStats: null,

    /** 系统健康状态 */
    systemHealth: null,

    /** 自动刷新间隔（毫秒） */
    refreshInterval: 30000,

    /** EventSource 实例引用 */
    es: null,

    /** 自动刷新定时器 ID */
    refreshTimerId: null,

    /** 各视图模块实例引用 { [viewName]: instance } */
    viewInstances: {},

    /** 是否正在加载初始数据 */
    isLoading: true,

    /** 重连尝试次数 */
    reconnectAttempts: 0,

    /** 最大重连次数 */
    maxReconnectAttempts: 5
  },

  // ----------------------------------------------------------
  // 初始化入口
  // ----------------------------------------------------------

  /**
   * 初始化应用
   * 在 DOMContentLoaded 时自动调用
   */
  init() {
    console.log('[App] 初始化 PDD Visual Manager...');

    // 应用保存的主题设置
    this.applyTheme();

    // 绑定事件监听器
    this.bindEvents();

    // 从 URL hash 恢复视图状态
    this.restoreTabFromHash();

    // 建立 SSE 连接
    this.connectSSE();

    // 获取初始数据
    this.fetchInitialData();

    // 启动自动刷新定时器
    this.startAutoRefresh();

    console.log('[App] 初始化完成');
  },

  // ----------------------------------------------------------
  // 主题管理
  // ----------------------------------------------------------

  /**
   * 应用当前主题到 DOM
   */
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.state.theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = this.state.theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
    }
  },

  /**
   * 切换亮色/暗色主题
   */
  toggleTheme() {
    this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('vm-theme', this.state.theme);
    this.applyTheme();
    this.showToast('info', `已切换到${this.state.theme === 'dark' ? '暗色' : '亮色'}主题`);
  },

  // ----------------------------------------------------------
  // 事件绑定
  // ----------------------------------------------------------

  /**
   * 绑定所有全局事件监听器
   */
  bindEvents() {
    // Tab 切换按钮
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // 主题切换按钮
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Modal 关闭（点击遮罩层）
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.closeModal();
        }
      });
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    // 监听浏览器前进/后退按钮（hash 变化）
    window.addEventListener('hashchange', () => {
      this.restoreTabFromHash();
    });

    // 页面可见性变化时暂停/恢复刷新
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseAutoRefresh();
      } else {
        this.resumeAutoRefresh();
        // 页面重新可见时立即刷新一次
        this.fetchSummaryOnly();
      }
    });
  },

  /**
   * 处理键盘快捷键
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    // Escape 关闭 Modal
    if (e.key === 'Escape') {
      this.closeModal();
      return;
    }

    // 数字键 1-4 切换视图（仅在非输入框内生效）
    if (!this.isInputFocused() && e.key >= '1' && e.key <= '4') {
      const tabs = ['pipeline', 'kanban', 'quality', 'system'];
      const tabIndex = parseInt(e.key) - 1;
      if (tabs[tabIndex]) {
        this.switchTab(tabs[tabIndex]);
      }
    }
  },

  /**
   * 检查当前是否聚焦在输入框中
   * @returns {boolean}
   */
  isInputFocused() {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
  },

  // ----------------------------------------------------------
  // Tab 视图管理
  // ----------------------------------------------------------

  /**
   * 切换到指定视图
   * @param {string} tab - 视图名称 ('pipeline'|'kanban'|'quality'|'system')
   */
  switchTab(tab) {
    if (!tab || tab === this.state.currentTab) return;

    const validTabs = ['pipeline', 'kanban', 'quality', 'system'];
    if (!validTabs.includes(tab)) {
      console.warn(`[App] 无效的视图名称: ${tab}`);
      return;
    }

    // 更新状态
    this.state.currentTab = tab;

    // 更新 UI - Tab 按钮
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 更新 UI - 视图容器
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tab}`);
    });

    // 更新 URL hash（不触发页面跳转）
    window.location.hash = tab;

    // 通知视图模块显示
    if (this.state.viewInstances[tab]?.onShow) {
      this.state.viewInstances[tab].onShow(this.getSharedData());
    }

    console.log(`[App] 切换到视图: ${tab}`);
  },

  /**
   * 从 URL hash 恢复视图状态
   */
  restoreTabFromHash() {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['pipeline', 'kanban', 'quality', 'system'];

    if (hash && validTabs.includes(hash)) {
      this.state.currentTab = hash;

      // 同步更新 UI
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === hash);
      });
      document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${hash}`);
      });
    }
  },

  // ----------------------------------------------------------
  // SSE 连接管理
  // ----------------------------------------------------------

  /**
   * 建立 SSE 连接
   */
  connectSSE() {
    // 如果已有连接，先关闭
    if (this.state.es) {
      this.disconnectSSE();
    }

    console.log('[App] 正在建立 SSE 连接...');

    try {
      const es = new EventSource('/sse');
      this.state.es = es;

      // 连接成功
      es.onopen = () => {
        console.log('[App] SSE 连接已建立');
        this.state.connected = true;
        this.state.reconnectAttempts = 0;
        this.updateConnectionStatus(true);
        this.showToast('success', '实时连接已建立');
      };

      // 连接错误或断开
      es.onerror = (err) => {
        console.warn('[App] SSE 连接错误或断开');
        this.state.connected = false;
        this.updateConnectionStatus(false);

        // 尝试重连
        this.attemptReconnect();
      };

      // 监听各类事件
      es.addEventListener('stage_change', (e) => {
        this.handleSSEEvent('stage_change', e);
      });

      es.addEventListener('quality_update', (e) => {
        this.handleSSEEvent('quality_update', e);
      });

      es.addEventListener('engine_metrics', (e) => {
        this.handleSSEEvent('engine_metrics', e);
      });

      es.addEventListener('system_event', (e) => {
        this.handleSSEEvent('system_event', e);
      });

      es.addEventListener('data_refreshed', (e) => {
        this.handleDataRefreshed(e);
      });

      es.addEventListener('connected', (e) => {
        console.log('[App] 收到服务器确认:', e.data);
      });

    } catch (err) {
      console.error('[App] SSE 创建失败:', err);
      this.state.connected = false;
      this.updateConnectionStatus(false);
    }
  },

  /**
   * 断开 SSE 连接
   */
  disconnectSSE() {
    if (this.state.es) {
      this.state.es.close();
      this.state.es = null;
      this.state.connected = false;
      this.updateConnectionStatus(false);
      console.log('[App] SSE 连接已断开');
    }
  },

  /**
   * 尝试重连 SSE
   */
  attemptReconnect() {
    if (this.state.reconnectAttempts >= this.state.maxReconnectAttempts) {
      console.error('[App] 达到最大重连次数，停止重连');
      this.showToast('error', '实时连接失败，请刷新页面重试');
      return;
    }

    this.state.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.state.reconnectAttempts), 30000);

    console.log(`[App] 将在 ${delay}ms 后尝试第 ${this.state.reconnectAttempts} 次重连...`);

    setTimeout(() => {
      if (!this.state.connected) {
        this.connectSSE();
      }
    }, delay);
  },

  /**
   * 处理 SSE 接收到的事件
   * @param {string} type - 事件类型
   * @param {Event} event - 原始事件对象
   */
  handleSSEEvent(type, event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.error('[App] 解析 SSE 数据失败:', e);
      return;
    }

    console.log(`[App] 收到 SSE 事件: ${type}`, data);

    // 根据事件类型处理本地数据
    switch (type) {
      case 'stage_change':
        this.handleStageChange(data);
        break;
      case 'quality_update':
        this.handleQualityUpdate(data);
        break;
      default:
        break;
    }

    // 通知所有注册的视图模块
    this.notifyViews(type, data);

    // 更新最后更新时间
    this.updateLastUpdate();
  },

  /**
   * 处理阶段变更事件
   * @param {Object} data
   */
  handleStageChange(data) {
    if (!data.featureId || !data.newStage) return;

    const feature = this.state.features.find(f => f.id === data.featureId);
    if (feature) {
      feature.stage = data.newStage;
      console.log(`[App] 功能点 ${data.featureId} 阶段变更为: ${data.newStage}`);
    }
  },

  /**
   * 处理质量更新事件
   * @param {Object} data
   */
  handleQualityUpdate(data) {
    if (!data.featureId) return;

    const feature = this.state.features.find(f => f.id === data.featureId);
    if (feature && data.grade !== undefined) {
      feature.grade = data.grade;
    }
  },

  /**
   * 处理数据刷新完成事件
   * @param {Event} event
   */
  handleDataRefreshed(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      return;
    }

    console.log('[App] 收到数据刷新通知');

    if (data.summary) {
      this.state.summary = data.summary;
    }

    // 通知视图
    this.notifyViews('data_refreshed', data);

    // 更新 UI
    this.updateLastUpdate();
    this.updateStatusBar();

    this.showToast('success', '数据已同步更新');
  },

  /**
   * 更新连接状态指示器
   * @param {boolean} online
   */
  updateConnectionStatus(online) {
    const el = document.getElementById('connection-status');
    if (el) {
      el.className = `status-dot ${online ? 'online' : 'offline'}`;
      el.title = online ? '实时连接正常' : '实时连接断开';
    }
  },

  // ----------------------------------------------------------
  // 数据获取与管理
  // ----------------------------------------------------------

  /**
   * 获取初始数据（并行请求多个接口）
   */
  async fetchInitialData() {
    this.state.isLoading = true;
    this.showLoadingState();

    try {
      const [featuresRes, summaryRes, qualityRes, systemRes] = await Promise.all([
        fetch('/api/features'),
        fetch('/api/summary'),
        fetch('/api/quality'),
        fetch('/api/system')
      ]);

      const [featuresData, summaryData, qualityData, systemData] = await Promise.all([
        featuresRes.json(),
        summaryRes.json(),
        qualityRes.json(),
        systemRes.json()
      ]);

      // 更新状态
      this.state.features = featuresData?.data?.features || [];
      this.state.summary = summaryData?.data?.summary || {};
      this.state.qualityMatrix = qualityData?.data?.matrix || {};
      this.state.systemHealth = systemData?.data?.health || {};

      this.state.isLoading = false;
      this.hideLoadingState();

      // 渲染当前视图
      this.renderCurrentView();

      // 更新状态栏
      this.updateStatusBar();
      this.updateLastUpdate();

      console.log(`[App] 初始数据加载完成，共 ${this.state.features.length} 个功能点`);

    } catch (err) {
      console.error('[App] 初始数据加载失败:', err);
      this.state.isLoading = false;
      this.hideLoadingState();
      this.showToast('error', '数据加载失败，请检查网络连接');
    }
  },

  /**
   * 仅获取摘要数据（用于轻量级刷新）
   */
  async fetchSummaryOnly() {
    try {
      const res = await fetch('/api/summary');
      const data = await res.json();

      if (data?.data?.summary) {
        this.state.summary = data.data.summary;
        this.updateLastUpdate();
        this.notifyViews('auto_refresh', this.state.summary);
      }
    } catch (err) {
      console.warn('[App] 摘要刷新失败:', err);
    }
  },

  /**
   * 渲染当前激活的视图
   */
  renderCurrentView() {
    const tab = this.state.currentTab;
    const viewInstance = this.state.viewInstances[tab];

    if (viewInstance?.render) {
      viewInstance.render(this.getSharedData());
    }
  },

  /**
   * 获取共享数据（供视图模块使用）
   * @returns {Object}
   */
  getSharedData() {
    return {
      features: this.state.features,
      summary: this.state.summary,
      qualityMatrix: this.state.qualityMatrix,
      tokenStats: this.state.tokenStats,
      cacheStats: this.state.cacheStats,
      systemHealth: this.state.systemHealth,
      lastUpdate: this.state.lastUpdate,
      connected: this.state.connected
    };
  },

  // ----------------------------------------------------------
  // 自动刷新机制
  // ----------------------------------------------------------

  /**
   * 启动自动刷新定时器
   */
  startAutoRefresh() {
    if (this.state.refreshTimerId) {
      clearInterval(this.state.refreshTimerId);
    }

    this.state.refreshTimerId = setInterval(() => {
      this.fetchSummaryOnly();
    }, this.state.refreshInterval);

    // 更新状态栏显示的间隔时间
    const timerEl = document.getElementById('refresh-timer');
    if (timerEl) {
      timerEl.textContent = `刷新间隔: ${(this.state.refreshInterval / 1000)}s`;
    }

    console.log(`[App] 自动刷新已启动，间隔: ${this.state.refreshInterval / 1000}s`);
  },

  /**
   * 暂停自动刷新（页面不可见时调用）
   */
  pauseAutoRefresh() {
    if (this.state.refreshTimerId) {
      clearInterval(this.state.refreshTimerId);
      this.state.refreshTimerId = null;
      console.log('[App] 自动刷新已暂停');
    }
  },

  /**
   * 恢复自动刷新（页面可见时调用）
   */
  resumeAutoRefresh() {
    if (!this.state.refreshTimerId) {
      this.startAutoRefresh();
    }
  },

  /**
   * 手动触发数据刷新
   */
  async manualRefresh() {
    this.showToast('info', '正在刷新数据...');

    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      const data = await res.json());

      if (data.success) {
        // 刷新本地数据
        await this.fetchInitialData();
        this.showToast('success', '数据刷新完成');
      } else {
        throw new Error(data.error || '刷新失败');
      }
    } catch (err) {
      console.error('[App] 手动刷新失败:', err);
      this.showToast('error', '刷新失败: ' + err.message);
    }
  },

  // ----------------------------------------------------------
  // UI 更新方法
  // ----------------------------------------------------------

  /**
   * 更新底部状态栏信息
   */
  updateStatusBar() {
    // 功能点数量
    const fcEl = document.getElementById('feature-count');
    if (fcEl) {
      fcEl.textContent = `功能点: ${this.state.features.length}`;
    }

    // 系统状态
    const sysEl = document.getElementById('system-status');
    if (sysEl && this.state.systemHealth) {
      const status = this.state.systemHealth.status || 'unknown';
      sysEl.textContent = `系统: ${status === 'healthy' ? '正常' : status}`;
      sysEl.className = status === 'healthy' ? 'text-success' : 'text-warning';
    }
  },

  /**
   * 更新最后更新时间显示
   */
  updateLastUpdate() {
    this.state.lastUpdate = new Date();
    const el = document.getElementById('last-update');
    if (el) {
      el.textContent = `最后更新: ${this.state.lastUpdate.toLocaleTimeString('zh-CN')}`;
    }
  },

  // ----------------------------------------------------------
  // 视图实例注册与通信
  // ----------------------------------------------------------

  /**
   * 注册视图模块实例
   * 各视图 JS 文件通过此方法将自己注册到 App 中
   *
   * @param {string} name - 视图名称 ('pipeline'|'kanban'|'quality'|'system')
   * @param {Object} instance - 视图实例，需实现 render/onShow/onEvent 方法
   *
   * @example
   * // 在 pipeline-view.js 中
   * App.registerView('pipeline', {
   *   render(data) { ... },
   *   onShow(data) { ... },
   *   onEvent(type, data) { ... }
   * });
   */
  registerView(name, instance) {
    if (!name || !instance) {
      console.warn('[App] registerView: 参数无效');
      return;
    }

    this.state.viewInstances[name] = instance;
    console.log(`[App] 视图已注册: ${name}`);

    // 如果该视图是当前激活的视图，立即渲染
    if (name === this.state.currentTab && !this.state.isLoading) {
      instance.render(this.getSharedData());
    }
  },

  /**
   * 向所有注册的视图广播事件
   * @param {string} eventType - 事件类型
   * @param {*} data - 事件数据
   */
  notifyViews(eventType, data) {
    Object.entries(this.state.viewInstances).forEach(([name, view]) => {
      if (typeof view.onEvent === 'function') {
        try {
          view.onEvent(eventType, data);
        } catch (err) {
          console.error(`[App] 视图 ${name} 的 onEvent 出错:`, err);
        }
      }
    });
  },

  // ----------------------------------------------------------
  // Modal 弹窗管理
  // ----------------------------------------------------------

  /**
   * 显示 Modal 弹窗
   * @param {string} contentHTML - 弹窗内容 HTML
   * @param {Object} [options={}] - 配置选项
   * @param {string} [options.title] - 弹窗标题
   * @param {number} [options.width] - 弹窗宽度（px）
   */
  showModal(contentHTML, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');

    if (!overlay || !content) return;

    // 构建内容
    let html = '<span class="modal-close" onclick="App.closeModal()">&times;</span>';

    if (options.title) {
      html += `<div class="modal-title">${this.escapeHTML(options.title)}</div>`;
    }

    html += `<div class="modal-body">${contentHTML}</div>`;

    content.innerHTML = html;

    // 应用自定义宽度
    if (options.width) {
      content.style.maxWidth = `${options.width}px`;
    }

    // 显示弹窗
    overlay.classList.remove('modal-hidden');

    // 禁止背景滚动
    document.body.style.overflow = 'hidden';

    console.log('[App] Modal 已打开');
  },

  /**
   * 关闭 Modal 弹窗
   */
  closeModal() {
    const overlay = document.getElementById('modal-overlay');

    if (overlay) {
      overlay.classList.add('modal-hidden');
      document.body.style.overflow = '';
      console.log('[App] Modal 已关闭');
    }
  },

  // ----------------------------------------------------------
  // Toast 通知系统
  // ----------------------------------------------------------

  /**
   * 显示 Toast 通知
   * @param {'success'|'warning'|'error'|'info'} type - 通知类型
   * @param {string} message - 通知消息
   * @param {number} [duration=4000] - 显示时长（毫秒），0 表示不自动关闭
   */
  showToast(type, message, duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // 图标映射
    const icons = {
      success: '\u2705',
      warning: '\u26A0\uFE0F',
      error: '\u274C',
      info: '\u2139\uFE0F'
    };

    // 创建 toast 元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${this.escapeHTML(message)}</span>
      <button class="toast-close" onclick="this.parentElement.classList.add('removing');setTimeout(()=>this.parentElement.remove(),250)">&times;</button>
    `;

    container.appendChild(toast);

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
          if (toast.parentElement) {
            toast.remove();
          }
        }, 250);
      }, duration);
    }
  },

  // ----------------------------------------------------------
  // 加载状态管理
  // ----------------------------------------------------------

  /**
   * 显示加载状态占位符
   */
  showLoadingState() {
    const views = document.querySelectorAll('.view.active');
    views.forEach(view => {
      if (!view.querySelector('.loading-state')) {
        const loader = document.createElement('div');
        loader.className = 'loading-state';
        loader.innerHTML = `
          <div class="loading-spinner"></div>
          <div>正在加载数据...</div>
        `;
        view.appendChild(loader);
      }
    });
  },

  /**
   * 隐藏加载状态占位符
   */
  hideLoadingState() {
    const loaders = document.querySelectorAll('.loading-state');
    loaders.forEach(loader => loader.remove());
  },

  // ----------------------------------------------------------
  // 工具函数
  // ----------------------------------------------------------

  /**
   * HTML 转义（防止 XSS）
   * @param {string} str
   * @returns {string}
   */
  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 格式化文件大小
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * 格式化持续时间
   * @param {number} seconds
   * @returns {string}
   */
  formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  /**
   * 调用 API 的通用方法
   * @param {string} endpoint - API 路径
   * @param {Object} [options={}] - fetch 选项
   * @returns {Promise<Object>}
   */
  async apiCall(endpoint, options = {}) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' },
        ...options
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      console.error(`[App] API 调用失败 [${endpoint}]:`, err);
      throw err;
    }
  }
};

// ============================================================
// 自动初始化
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => App.init());
} else {
  // DOMContentLoaded 已经触发（脚本在 body 底部加载）
  App.init();
}

// 导出全局引用（方便其他脚本使用和调试）
window.App = App;
