/**
 * SystemView - 系统管理与资产视图 (Panel 4)
 * 展示服务状态、项目资产浏览器、操作按钮、活动日志
 *
 * @module SystemView
 * @version 1.0.0
 * @requires App
 */

const SystemView = {
  name: 'system',

  // 操作日志
  activityLog: [],

  // 是否暂停日志滚动
  paused: false,

  // 当前操作状态（防止重复点击）
  operationInProgress: false,

  /**
   * 初始化视图
   */
  init() {
    App.registerView(this.name, this);
    this.bindActions();
    console.log('[SystemView] Initialized');
  },

  /**
   * 视图显示时调用
   */
  onShow() {
    this.render();
  },

  /**
   * SSE事件处理 - 记录活动日志
   * @param {string} type - 事件类型
   * @param {*} data - 事件数据
   */
  onEvent(type, data) {
    this.addActivityLog(type, data);
  },

  /**
   * 绑定操作按钮事件（使用事件委托）
   */
  bindActions() {
    document.addEventListener('click', async (e) => {
      // 全量重新扫描
      if (e.target.matches('#btn-scan') || e.target.closest('#btn-scan')) {
        await this.actionScan(e.target);
      }

      // 导入报告
      if (e.target.matches('#btn-import') || e.target.closest('#btn-import')) {
        await this.actionImportReport();
      }

      // 导出JSON
      if (e.target.matches('#btn-export-json') || e.target.closest('#btn-export-json')) {
        await this.actionExport('json');
      }

      // 导出Markdown
      if (e.target.matches('#btn-export-md') || e.target.closest('#btn-export-md')) {
        await this.actionExport('md');
      }

      // 导出CSV
      if (e.target.matches('#btn-export-csv') || e.target.closest('#btn-export-csv')) {
        await this.actionExport('csv');
      }

      // 清理缓存
      if (e.target.matches('#btn-clear-cache') || e.target.closest('#btn-clear-cache')) {
        await this.actionClearCache();
      }

      // 暂停/恢复日志
      if (e.target.matches('#btn-toggle-log')) {
        this.paused = !this.paused;
        e.target.textContent = this.paused ? '▶️ 恢复' : '⏸️ 暂停';
        e.target.classList.toggle('btn-warning', this.paused);
        e.target.classList.toggle('btn-outline', !this.paused);
      }
    });
  },

  /**
   * 主渲染方法
   */
  async render() {
    const container = document.getElementById('view-system');
    if (!container) return;

    container.innerHTML = `
      <div class="system-view">
        <!-- 上半部分: grid-2 -->
        <div class="grid-2 system-top">
          ${this._renderServiceStatus()}
          ${this._renderAssetBrowser()}
        </div>

        <!-- 下半部分 -->
        ${this._renderActionButtons()}
        ${this._renderActivityLog()}
      </div>
    `;

    // 加载服务状态数据
    this._loadSystemHealth();

    // 滚动日志到底部
    this._scrollLogToBottom();
  },

  // ==================== 服务状态面板 ====================

  /**
   * 渲染服务状态面板容器
   * @returns {string} HTML
   */
  _renderServiceStatus() {
    return `
      <div class="card service-status-card">
        <div class="card-header">
          <h3>🖥️ 服务状态</h3>
          <span class="text-muted">系统健康检查</span>
        </div>
        <div class="card-body" id="service-status-content">
          <div class="loading-spinner-small"></div>
          <p class="text-muted">正在检测服务状态...</p>
        </div>
      </div>
    `;
  },

  /**
   * 加载并渲染服务健康状态
   */
  async _loadSystemHealth() {
    try {
      const response = await fetch('/api/system');
      if (!response.ok) throw new Error('获取系统状态失败');

      const data = await response.json();
      const health = data.health || data;

      this._renderServiceStatusContent(health);

      // 记录到日志
      this.addActivityLog('health_check', { status: health.overall?.status || 'unknown' });

    } catch (error) {
      console.error('[SystemView] Failed to load health:', error);
      document.getElementById('service-status-content').innerHTML = `
        <div class="text-danger">
          <p>⚠️ 无法连接到系统</p>
          <small>${error.message}</small>
        </div>
      `;
    }
  },

  /**
   * 渲染服务状态详情
   * @param {Object} health - 健康状态数据
   */
  _renderServiceStatusContent(health) {
    const container = document.getElementById('service-status-content');
    if (!container) return;

    const services = [
      { key: 'api', name: 'API Server', icon: '🌐' },
      { key: 'mcp', name: 'MCP Server', icon: '🔌' },
      { key: 'grpc', name: 'gRPC Server', icon: '📡' },
      { key: 'openclaw', name: 'OpenClaw', icon: '🦞' }
    ];

    container.innerHTML = `
      <div class="services-grid">
        ${services.map(svc => {
          const svcHealth = health.services?.[svc.key] || {};
          const status = svcHealth.status || 'unknown';
          const latency = svcHealth.latency || 0;
          const uptime = svcHealth.uptime || 0;

          return `
            <div class="service-item status-${status}">
              <div class="service-icon">${svc.icon}</div>
              <div class="service-info">
                <div class="service-name">${svc.name}</div>
                <div class="status-light status-${status}" title="${status}"></div>
              </div>
              <div class="service-metrics">
                <div class="metric">
                  <span class="metric-label">延迟</span>
                  <span class="metric-value">${latency > 0 ? `${latency}ms` : '-'}</span>
                </div>
                <div class="metric">
                  <span class="metric-label">运行时间</span>
                  <span class="metric-value">${this._formatUptime(uptime)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 插件列表 -->
      ${health.plugins && health.plugins.length > 0 ? `
        <div class="plugins-section mt-3">
          <h5>已加载插件 (${health.plugins.length})</h5>
          <div class="plugins-grid">
            ${health.plugins.map(plugin => `
              <div class="plugin-card">
                <div class="plugin-name">${plugin.name || plugin.id}</div>
                <div class="plugin-version">v${plugin.version || '0.0.0'}</div>
                <div class="plugin-status status-dot status-${plugin.status || 'active'}"></div>
                <button class="btn btn-xs btn-outline plugin-action-btn"
                        onclick="SystemView._handlePluginAction('${plugin.id}', '${plugin.status}')"
                        ${this.operationInProgress ? 'disabled' : ''}>
                  ${plugin.status === 'loaded' || plugin.status === 'active' ? '卸载' : '加载'}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  },

  // ==================== 项目资产浏览器 ====================

  /**
   * 渲染资产浏览器容器
   * @returns {string} HTML
   */
  _renderAssetBrowser() {
    return `
      <div class="card asset-browser-card">
        <div class="card-header">
          <h3>📁 项目资产浏览器</h3>
          <button class="btn btn-xs btn-outline" onclick="SystemView._refreshAssets()">🔄 刷新</button>
        </div>
        <div class="card-body asset-browser" id="asset-browser-content">
          ${this._renderAssetTreeSkeleton()}
        </div>
      </div>
    `;
  },

  /**
   * 渲染资产树骨架屏
   * @returns {string} HTML
   */
  _renderAssetTreeSkeleton() {
    return `
      <div class="asset-columns">
        <div class="asset-column">
          <div class="asset-folder" data-folder="dev-specs">
            <span class="folder-icon">📁</span>
            <span class="folder-name">dev-specs/</span>
            <span class="folder-count">-</span>
          </div>
          <div class="folder-content collapsed" id="folder-dev-specs"></div>
        </div>

        <div class="asset-column">
          <div class="asset-folder" data-folder="src">
            <span class="folder-icon">📁</span>
            <span class="folder-name">src/</span>
            <span class="folder-count">-</span>
          </div>
          <div class="folder-content collapsed" id="folder-src"></div>
        </div>

        <div class="asset-column">
          <div class="asset-folder" data-folder="reports">
            <span class="folder-icon">📁</span>
            <span class="folder-name">reports/</span>
            <span class="folder-count">-</span>
          </div>
          <div class="folder-content collapsed" id="folder-reports"></div>
        </div>
      </div>
    `;
  },

  /**
   * 刷新资产数据
   */
  async _refreshAssets() {
    // 这里可以从API获取实际的文件列表
    // 目前使用模拟数据或从App.state获取
    const features = App.state.features || [];

    // 构建模拟的资产数据
    const assets = {
      'dev-specs': (features || []).filter(f => f.artifacts?.spec).map(f => ({
        name: `${f.id}.md`,
        size: f.artifacts.spec.size || Math.round(Math.random() * 5000) + 1000,
        modifiedAt: f.artifacts.spec.generatedAt || f.updatedAt,
        type: 'markdown'
      })),
      'src': (features || []).filter(f => f.artifacts?.code).map(f => ({
        name: f.artifacts.code.path || `feature-${f.id}/`,
        files: f.artifacts.code.fileCount || Math.floor(Math.random() * 10) + 1,
        loc: f.artifacts.code.loc || Math.floor(Math.random() * 1000) + 100,
        languages: f.artifacts.code.languages || {},
        modifiedAt: f.updatedAt,
        type: 'directory'
      })),
      'reports': (features || []).filter(f => f.artifacts?.report).map(f => ({
        name: `${f.id}-report.md`,
        type: 'report',
        size: f.artifacts.report.size || Math.round(Math.random() * 3000) + 500,
        generatedAt: f.artifacts.report.generatedAt || f.updatedAt
      }))
    };

    this._renderAssetData(assets);
  },

  /**
   * 渲染资产数据
   * @param {Object} assets - 资产数据
   */
  _renderAssetData(assets) {
    // dev-specs 文件列表
    const specsContainer = document.getElementById('folder-dev-specs');
    if (specsContainer) {
      const specs = assets['dev-specs'] || [];
      specsContainer.previousElementSibling.querySelector('.folder-count').textContent = specs.length;
      specsContainer.innerHTML = specs.length > 0 ? specs.map(file => `
        <div class="file-item file-markdown" onclick="SystemView._previewFile('${file.name}', '${file.type}')">
          <span class="file-icon">📄</span>
          <span class="file-name" title="${file.name}">${this._truncate(file.name, 20)}</span>
          <span class="file-size">${this._formatBytes(file.size)}</span>
          <span class="file-time">${this._formatDate(file.modifiedAt)}</span>
        </div>
      `).join('') : '<div class="empty-folder">空目录</div>';
    }

    // src 目录统计
    const srcContainer = document.getElementById('folder-src');
    if (srcContainer) {
      const srcItems = assets['src'] || [];
      srcContainer.previousElementSibling.querySelector('.folder-count').textContent =
        `${srcItems.length} 个模块`;

      let totalFiles = 0;
      let totalLoc = 0;
      const allLanguages = {};

      srcItems.forEach(item => {
        totalFiles += item.files || 0;
        totalLoc += item.loc || 0;
        Object.entries(item.languages || {}).forEach(([lang, stats]) => {
          allLanguages[lang] = (allLanguages[lang] || 0) + (stats.loc || 0);
        });
      });

      srcContainer.innerHTML = srcItems.length > 0 ? `
        <div class="src-summary">
          <div class="summary-stat">
            <strong>${totalFiles}</strong> 个文件
          </div>
          <div class="summary-stat">
            <strong>${this._formatNumber(totalLoc)}</strong> 行代码
          </div>
        </div>
        ${Object.keys(allLanguages).length > 0 ? `
          <div class="language-summary">
            ${Object.entries(allLanguages).map(([lang, loc]) => `
              <span class="lang-tag" style="background-color: ${this._getLanguageColor(lang)}20; color: ${this._getLanguageColor(lang)}">
                ${lang}: ${this._formatNumber(loc)} LOC
              </span>
            `).join('')}
          </div>
        ` : ''}
        <div class="module-list">
          ${srcItems.map(item => `
            <div class="file-item file-directory" onclick="SystemView._previewFile('${item.name}', '${item.type}')">
              <span class="file-icon">📂</span>
              <span class="file-name">${item.name}</span>
              <span class="file-meta">${item.files}f / ${this._formatNumber(item.loc)}loc</span>
            </div>
          `).join('')}
        </div>
      ` : '<div class="empty-folder">无源代码</div>';
    }

    // reports 报告列表
    const reportsContainer = document.getElementById('folder-reports');
    if (reportsContainer) {
      const reports = assets['reports'] || [];
      reportsContainer.previousElementSibling.querySelector('.folder-count').textContent = reports.length;
      reportsContainer.innerHTML = reports.length > 0 ? reports.map(report => `
        <div class="file-item file-report" onclick="SystemView._previewFile('${report.name}', '${report.type}')">
          <span class="file-icon">📊</span>
          <span class="file-name" title="${report.name}">${this._truncate(report.name, 20)}</span>
          <span class="file-type badge badge-outline">${report.type}</span>
          <span class="file-size">${this._formatBytes(report.size)}</span>
          <span class="file-time">${this._formatDate(report.generatedAt)}</span>
        </div>
      `).join('') : '<div class="empty-folder">无报告</div>';
    }

    // 绑定文件夹展开/折叠事件
    document.querySelectorAll('.asset-folder').forEach(folder => {
      folder.addEventListener('click', () => {
        const folderName = folder.dataset.folder;
        const content = document.getElementById(`folder-${folderName}`);
        if (content) {
          content.classList.toggle('collapsed');
          folder.classList.toggle('expanded');
        }
      });
    });
  },

  /**
   * 预览文件内容（简单Modal）
   * @param {string} fileName - 文件名
   * @param {string} fileType - 文件类型
   */
  async _previewFile(fileName, fileType) {
    App.showModal(`
      <div class="file-preview-modal">
        <div class="preview-header">
          <h4>📄 ${fileName}</h4>
          <button class="btn btn-sm btn-outline" onclick="App.closeModal()">关闭</button>
        </div>
        <div class="preview-body">
          <div class="loading-spinner-small"></div>
          <p class="text-muted">正在加载文件内容...</p>
        </div>
      </div>
    `);

    // 尝试获取文件内容
    try {
      const response = await fetch(`/api/file?name=${encodeURIComponent(fileName)}&type=${fileType}`);
      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          const previewBody = document.querySelector('.preview-body');
          if (previewBody) {
            previewBody.innerHTML = `<pre class="code-preview"><code>${this._escapeHtml(data.content || '(空文件)')}</code></pre>`;
          }
        }, 200);
      } else {
        throw new Error('无法加载文件');
      }
    } catch (error) {
      setTimeout(() => {
        const previewBody = document.querySelector('.preview-body');
        if (previewBody) {
          previewBody.innerHTML = `<p class="text-warning">⚠️ ${error.message}</p>`;
        }
      }, 200);
    }
  },

  // ==================== 操作按钮区 ====================

  /**
   * 渲染操作按钮区
   * @returns {string} HTML
   */
  _renderActionButtons() {
    return `
      <div class="card action-buttons-card">
        <div class="card-header">
          <h3>⚡ 操作中心</h3>
        </div>
        <div class="card-body">
          <div class="action-buttons-row">
            <button id="btn-scan" class="btn btn-primary" title="全量重新扫描所有功能点" ${this.operationInProgress ? 'disabled' : ''}>
              🔄 全量重新扫描
            </button>
            <button id="btn-import" class="btn btn-secondary" title="导入外部验证报告" ${this.operationInProgress ? 'disabled' : ''}>
              📥 导入报告
            </button>
            <button id="btn-export-json" class="btn btn-outline" title="导出JSON格式数据" ${this.operationInProgress ? 'disabled' : ''}>
              💾 导出 JSON
            </button>
            <button id="btn-export-md" class="btn btn-outline" title="导出Markdown格式报告" ${this.operationInProgress ? 'disabled' : ''}>
              📝 导出 MD
            </button>
            <button id="btn-export-csv" class="btn btn-outline" title="导出CSV格式表格" ${this.operationInProgress ? 'disabled' : ''}>
              📊 导出 CSV
            </button>
            <button id="btn-clear-cache" class="btn btn-danger" title="清理系统缓存（谨慎操作）" ${this.operationInProgress ? 'disabled' : ''}>
              🗑️ 清理缓存
            </button>
          </div>
          <div class="action-hint text-muted mt-2">
            <small>提示: 部分操作需要确认，请仔细阅读提示信息</small>
          </div>
        </div>
      </div>
    `;
  },

  // ==================== 日志与活动流 ====================

  /**
   * 渲染活动日志容器
   * @returns {string} HTML
   */
  _renderActivityLog() {
    return `
      <div class="card activity-log-card">
        <div class="card-header">
          <h3>📋 操作日志与活动流</h3>
          <div class="log-controls">
            <button id="btn-toggle-log" class="btn btn-xs btn-outline">⏸️ 暂停</button>
            <button class="btn btn-xs btn-outline" onclick="SystemView.activityLog = []; SystemView._renderLogEntries();">
              🗑️ 清空
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="activity-log-container" id="activity-log-container">
            <table class="data-table log-table">
              <thead>
                <tr>
                  <th width="140">时间戳</th>
                  <th width="120">操作类型</th>
                  <th width="80">结果</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody id="log-entries-body">
                ${this.activityLog.length > 0 ?
                  this.activityLog.slice(0, 50).map(entry => this._renderLogRow(entry)).join('') :
                  '<tr><td colspan="4" class="text-center text-muted py-3">暂无日志记录，操作将自动记录在此处</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染单行日志
   * @param {Object} entry - 日志条目
   * @returns {string} HTML
   */
  _renderLogRow(entry) {
    const typeColors = {
      stage_change: '#3498db',
      quality_update: '#27ae60',
      token_threshold: '#f39c12',
      data_refreshed: '#9b59b6',
      health_check: '#1abc9c',
      scan: '#3498db',
      export: '#2ecc71',
      import: '#e67e22',
      clear_cache: '#e74c3c',
      error: '#e74c3c'
    };

    const color = typeColors[entry.type] || '#95a5a6';
    const isSuccess = !entry.result || entry.result === 'success';

    return `
      <tr class="log-entry ${isSuccess ? '' : 'log-error'}">
        <td><code class="log-time">${entry.time}</code></td>
        <td>
          <span class="badge badge-outline" style="border-color: ${color}; color: ${color}">
            ${this._formatEventType(entry.type)}
          </span>
        </td>
        <td>
          <span class="status-dot status-${isSuccess ? 'success' : 'error'}"></span>
        </td>
        <td class="log-detail" title="${entry.data}">${this._truncate(entry.data, 80)}</td>
      </tr>
    `;
  },

  /**
   * 格式化事件类型显示名称
   * @param {string} type - 事件类型
   * @returns {string}
   */
  _formatEventType(type) {
    const names = {
      stage_change: '阶段变更',
      quality_update: '质量更新',
      token_threshold: 'Token预警',
      data_refreshed: '数据刷新',
      health_check: '健康检查',
      scan: '全量扫描',
      export: '数据导出',
      import: '报告导入',
      clear_cache: '清理缓存',
      error: '错误'
    };
    return names[type] || type;
  },

  /**
   * 添加活动日志条目
   * @param {string} type - 事件类型
   * @param {*} data - 事件数据
   */
  addActivityLog(type, data) {
    if (this.paused) return;

    const entry = {
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      type: type,
      result: 'success',
      data: JSON.stringify(data).slice(0, 150)
    };

    this.activityLog.unshift(entry);

    // 保持最多200条
    if (this.activityLog.length > 200) {
      this.activityLog.pop();
    }

    // 实时插入DOM（如果容器存在）
    this._appendLogRow(entry);
  },

  /**
   * 追加一行日志到DOM
   * @param {Object} entry - 日志条目
   */
  _appendLogRow(entry) {
    const tbody = document.getElementById('log-entries-body');
    if (!tbody) return;

    // 如果是第一条且是占位符，先清空
    if (tbody.children.length === 1 && tbody.children[0].querySelector('.text-muted')) {
      tbody.innerHTML = '';
    }

    // 在顶部插入新行
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = this._renderLogRow(entry);
    const newRow = tempDiv.firstElementChild;

    tbody.insertBefore(newRow, tbody.firstChild);

    // 限制显示50行
    while (tbody.children.length > 50) {
      tbody.removeChild(tbody.lastChild);
    }

    // 自动滚动到底部
    this._scrollLogToBottom();
  },

  /**
   * 重新渲染所有日志条目
   */
  _renderLogEntries() {
    const tbody = document.getElementById('log-entries-body');
    if (!tbody) return;

    tbody.innerHTML = this.activityLog.length > 0 ?
      this.activityLog.slice(0, 50).map(entry => this._renderLogRow(entry)).join('') :
      '<tr><td colspan="4" class="text-center text-muted py-3">暂无日志记录</td></tr>';
  },

  /**
   * 滚动日志到底部
   */
  _scrollLogToBottom() {
    const container = document.getElementById('activity-log-container');
    if (container && !this.paused) {
      container.scrollTop = container.scrollHeight;
    }
  },

  // ==================== 操作方法 ====================

  /**
   * 执行全量重新扫描
   * @param {HTMLElement} button - 触发按钮
   */
  async actionScan(button) {
    if (this.operationInProgress) return;

    // 确认对话框
    const confirmed = confirm(
      '确定要执行全量重新扫描吗？\n\n' +
      '这将:\n' +
      '- 重新扫描所有规格文件\n' +
      '- 重新分析源代码\n' +
      '- 更新所有功能点状态\n\n' +
      '预计耗时: 30秒 ~ 2分钟'
    );

    if (!confirmed) return;

    this.operationInProgress = true;
    button.disabled = true;
    button.innerHTML = '⏳ 扫描中...';

    this.addActivityLog('scan', { action: 'start' });

    try {
      const response = await fetch('/api/refresh', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        this.addActivityLog('scan', { action: 'complete', featuresScanned: result.count || 0 });
        alert(`✅ 扫描完成！\n共扫描 ${result.count || 0} 个功能点`);

        // 刷新数据
        await App.fetchInitialData();
        this.render();
      } else {
        throw new Error(result.error || '扫描失败');
      }

    } catch (error) {
      console.error('[SystemView] Scan error:', error);
      this.addActivityLog('error', { message: error.message });
      alert(`❌ 扫描失败: ${error.message}`);
    } finally {
      this.operationInProgress = false;
      button.disabled = false;
      button.innerHTML = '🔄 全量重新扫描';
    }
  },

  /**
   * 执行导入报告
   */
  async actionImportReport() {
    if (this.operationInProgress) return;

    // 创建文件输入
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.json,.csv';
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const confirmed = confirm(
        `确定要导入 ${files.length} 个报告文件吗？\n\n` +
        files.map(f => `- ${f.name} (${this._formatBytes(f.size)})`).join('\n')
      );

      if (!confirmed) return;

      this.operationInProgress = true;
      this.addActivityLog('import', { files: files.map(f => f.name), count: files.length });

      try {
        const formData = new FormData();
        files.forEach(file => formData.append('reports', file));

        const response = await fetch('/api/import', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          this.addActivityLog('import', { ...result, status: 'success' });
          alert(`✅ 导入成功！\n共导入 ${result.imported || files.length} 个报告`);
          await App.fetchInitialData();
          this.render();
        } else {
          throw new Error(result.error || '导入失败');
        }

      } catch (error) {
        console.error('[SystemView] Import error:', error);
        this.addActivityLog('error', { message: error.message });
        alert(`❌ 导入失败: ${error.message}`);
      } finally {
        this.operationInProgress = false;
      }
    };

    input.click();
  },

  /**
   * 执行数据导出
   * @param {string} format - 导出格式 (json|md|csv)
   */
  async actionExport(format) {
    if (this.operationInProgress) return;

    this.operationInProgress = true;
    this.addActivityLog('export', { format, action: 'start' });

    try {
      const response = await fetch(`/api/export?format=${format}`);

      if (!response.ok) throw new Error('导出失败');

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `pdd-export.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.addActivityLog('export', { format, status: 'success', filename });
      console.log(`[SystemView] Exported: ${filename}`);

    } catch (error) {
      console.error('[SystemView] Export error:', error);
      this.addActivityLog('error', { message: error.message, context: `export:${format}` });
      alert(`❌ 导出失败: ${error.message}`);
    } finally {
      this.operationInProgress = false;
    }
  },

  /**
   * 执行清理缓存
   */
  async actionClearCache() {
    if (this.operationInProgress) return;

    // 二次确认（危险操作）
    const confirmed = confirm(
      '⚠️ 警告: 您确定要清理系统缓存吗？\n\n' +
      '这将清除:\n' +
      '- L1/L2/L3 所有层级缓存\n' +
      '- 已编译的中间结果\n' +
      '- 临时生成的文件\n\n' +
      '注意: 此操作不可撤销！'
    );

    if (!confirmed) return;

    // 第三次确认（最终确认）
    const finalConfirm = prompt('请输入 "CONFIRM" 以确认清理缓存:');
    if (finalConfirm !== 'CONFIRM') {
      alert('已取消操作');
      return;
    }

    this.operationInProgress = true;
    this.addActivityLog('clear_cache', { action: 'start' });

    try {
      const response = await fetch('/api/cache/clear', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        this.addActivityLog('clear_cache', { ...result, status: 'success' });
        alert(`✅ 缓存清理完成！\n释放空间: ${this._formatBytes(result.freed || 0)}`);
        this.render(); // 刷新视图以更新缓存统计
      } else {
        throw new Error(result.error || '清理失败');
      }

    } catch (error) {
      console.error('[SystemView] Clear cache error:', error);
      this.addActivityLog('error', { message: error.message });
      alert(`❌ 清理失败: ${error.message}`);
    } finally {
      this.operationInProgress = false;
    }
  },

  /**
   * 处理插件操作（加载/卸载）
   * @param {string} pluginId - 插件ID
   * @param {string} currentStatus - 当前状态
   */
  async _handlePluginAction(pluginId, currentStatus) {
    const action = currentStatus === 'loaded' || currentStatus === 'active' ? 'unload' : 'load';
    const confirmed = confirm(`确定要${action === 'unload' ? '卸载' : '加载'}插件 "${pluginId}" 吗？`);

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/plugins/${pluginId}/${action}`, { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        this.addActivityLog('plugin_action', { pluginId, action, status: 'success' });
        alert(`✅ 插件${action === 'unload' ? '卸载' : '加载'}成功`);
        this._loadSystemHealth(); // 刷新服务状态
      } else {
        throw new Error(result.error || '操作失败');
      }

    } catch (error) {
      this.addActivityLog('error', { message: error.message, context: `plugin:${action}` });
      alert(`❌ 操作失败: ${error.message}`);
    }
  },

  // ==================== 工具方法 ====================

  /**
   * 格式化运行时间
   * @param {number} seconds - 秒数
   * @returns {string}
   */
  _formatUptime(seconds) {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  /**
   * 格式化数字（千位分隔符）
   * @param {number} num
   * @returns {string}
   */
  _formatNumber(num) {
    if (!num && num !== 0) return '0';
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /**
   * 格式化字节数
   * @param {number} bytes
   * @returns {string}
   */
  _formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  },

  /**
   * 格式化日期
   * @param {string} dateStr
   * @returns {string}
   */
  _formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('zh-CN');
    } catch (e) {
      return dateStr;
    }
  },

  /**
   * 截断文本
   * @param {string} text
   * @param {number} maxLen
   * @returns {string}
   */
  _truncate(text, maxLen = 50) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  },

  /**
   * HTML转义
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 获取语言颜色
   * @param {string} lang
   * @returns {string}
   */
  _getLanguageColor(lang) {
    const colors = {
      javascript: '#f7df1e', typescript: '#3178c6', python: '#3776ab',
      java: '#007396', go: '#00add8', rust: '#dea584',
      cpp: '#00599c', c: '#a8b9cc', ruby: '#cc342d',
      php: '#777bb4', swift: '#f05138', kotlin: '#7f52ff'
    };
    return colors[lang.toLowerCase()] || '#95a5a6';
  }
};

// 初始化
SystemView.init();

// 导出全局使用
window.SystemView = SystemView;
