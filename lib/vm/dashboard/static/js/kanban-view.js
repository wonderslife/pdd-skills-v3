/**
 * KanbanView - 看板与详情视图 (Panel 2)
 * 提供6列看板展示、筛选搜索、功能点详情弹窗
 *
 * @module KanbanView
 * @version 1.0.0
 * @requires App, PipelineView
 */

const KanbanView = {
  name: 'kanban',

  // 当前查看的feature索引
  currentIndex: 0,

  // 筛选后的功能点列表
  filteredFeatures: [],

  // 当前筛选条件
  filters: {
    stage: '',
    search: '',
    sortBy: 'name',
    viewMode: 'card' // card | list | table
  },

  // 阶段配置（与PipelineView保持一致）
  stages: [
    { id: 'prd', name: 'PRD', color: '#9b59b6', icon: '📋' },
    { id: 'extracted', name: 'EXTRACTED', color: '#3498db', icon: '🔍' },
    { id: 'spec', name: 'SPEC', color: '#2ecc71', icon: '📝' },
    { id: 'implementing', name: 'IMPLEMENTING', color: '#f39c12', icon: '⚙️' },
    { id: 'verifying', name: 'VERIFYING', color: '#e74c3c', icon: '✅' },
    { id: 'done', name: 'DONE', color: '#1abc9c', icon: '🎉' }
  ],

  /**
   * 初始化视图
   */
  init() {
    App.registerView(this.name, this);
    this.bindFilterEvents();
    console.log('[KanbanView] Initialized');
  },

  /**
   * 视图显示时调用
   */
  onShow() {
    this.render(App.state.features || [], App.state.summary || {});
  },

  /**
   * SSE事件处理
   * @param {string} type - 事件类型
   * @param {*} data - 事件数据
   */
  onEvent(type, data) {
    if (type === 'stage_change' || type === 'data_refreshed') {
      this.render(App.state.features || [], App.state.summary || {});
      // 如果当前有打开的详情弹窗，更新内容
      if (this.currentFeatureId) {
        this.showFeatureDetail(this.currentFeatureId);
      }
    }
  },

  /**
   * 绑定筛选栏事件
   */
  bindFilterEvents() {
    // 使用事件委托，在render后绑定
    document.addEventListener('click', (e) => {
      // 阶段筛选按钮
      if (e.target.matches('.filter-stage-btn')) {
        const stage = e.target.dataset.stage;
        this.setFilter('stage', stage === this.filters.stage ? '' : stage);
      }

      // 视图模式切换
      if (e.target.matches('.view-mode-btn')) {
        this.setFilter('viewMode', e.target.dataset.mode);
      }

      // 排序选择
      if (e.target.matches('#sort-select')) {
        return; // change事件处理
      }

      // 搜索框（实时搜索）
      if (e.target.matches('#search-input')) {
        return; // input事件处理
      }

      // 清除筛选
      if (e.target.matches('.clear-filters-btn')) {
        this.clearFilters();
      }
    });

    // 搜索输入事件
    document.addEventListener('input', (e) => {
      if (e.target.matches('#search-input')) {
        this.setFilter('search', e.target.value);
      }
    });

    // 排序改变事件
    document.addEventListener('change', (e) => {
      if (e.target.matches('#sort-select')) {
        this.setFilter('sortBy', e.target.value);
      }
    });

    // 键盘导航（ESC关闭Modal，左右切换Feature）
    document.addEventListener('keydown', (e) => {
      if (!this.currentFeatureId) return;

      switch(e.key) {
        case 'Escape':
          App.closeModal();
          this.currentFeatureId = null;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.navigateFeature(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.navigateFeature(1);
          break;
      }
    });
  },

  /**
   * 设置筛选条件并重新渲染
   * @param {string} key - 筛选键
   * @param {*} value - 筛选值
   */
  setFilter(key, value) {
    this.filters[key] = value;
    this.render(App.state.features || [], App.state.summary || {});
  },

  /**
   * 清除所有筛选
   */
  clearFilters() {
    this.filters = {
      stage: '',
      search: '',
      sortBy: 'name',
      viewMode: 'card'
    };
    this.render(App.state.features || [], App.state.summary || {});
  },

  /**
   * 主渲染方法
   * @param {Array} features - 功能点列表
   * @param {Object} summary - 项目汇总
   */
  render(features, summary) {
    const container = document.getElementById('view-kanban');
    if (!container) return;

    // 应用筛选
    this.filteredFeatures = this._applyFilters(features);

    container.innerHTML = `
      <div class="kanban-view">
        ${this._renderFilterBar()}
        ${this._renderKanbanBoard()}
      </div>
    `;

    // 绑定卡片点击事件
    this._bindCardEvents();
  },

  /**
   * 应用筛选条件
   * @param {Array} features - 原始功能点列表
   * @returns {Array} 筛选后的列表
   */
  _applyFilters(features) {
    let result = [...(features || [])];

    // 阶段筛选
    if (this.filters.stage) {
      result = result.filter(f => f.stage === this.filters.stage);
    }

    // 搜索筛选
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(searchTerm) ||
        (f.description && f.description.toLowerCase().includes(searchTerm))
      );
    }

    // 排序
    result.sort((a, b) => {
      switch (this.filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'score':
          return (b.quality?.score || 0) - (a.quality?.score || 0);
        case 'tokens':
          return (b.tokens?.total || 0) - (a.tokens?.total || 0);
        case 'date':
          return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
        default:
          return 0;
      }
    });

    return result;
  },

  /**
   * 渲染筛选栏
   * @returns {string} HTML
   */
  _renderFilterBar() {
    return `
      <div class="filter-bar">
        <div class="filter-group filter-stages">
          <span class="filter-label">阶段:</span>
          <button class="filter-stage-btn ${!this.filters.stage ? 'active' : ''}" data-stage="">
            全部 (${App.state.features?.length || 0})
          </button>
          ${this.stages.map(stage => {
            const count = (App.state.features || []).filter(f => f.stage === stage.id).length;
            return `
              <button class="filter-stage-btn ${this.filters.stage === stage.id ? 'active' : ''}"
                      data-stage="${stage.id}"
                      style="--stage-color: ${stage.color}">
                ${stage.icon} ${stage.name} (${count})
              </button>
            `;
          }).join('')}
        </div>

        <div class="filter-group filter-search">
          <input type="text" id="search-input"
                 placeholder="搜索功能点..."
                 value="${this.filters.search}"
                 class="search-input" />
        </div>

        <div class="filter-group filter-sort">
          <select id="sort-select" class="sort-select">
            <option value="name" ${this.filters.sortBy === 'name' ? 'selected' : ''}>按名称</option>
            <option value="score" ${this.filters.sortBy === 'score' ? 'selected' : ''}>按评分</option>
            <option value="tokens" ${this.filters.sortBy === 'tokens' ? 'selected' : ''}>按Token</option>
            <option value="date" ${this.filters.sortBy === 'date' ? 'selected' : ''}>按日期</option>
          </select>
        </div>

        <div class="filter-group view-modes">
          <button class="view-mode-btn ${this.filters.viewMode === 'card' ? 'active' : ''}" data-mode="card" title="卡片视图">
            🃏
          </button>
          <button class="view-mode-btn ${this.filters.viewMode === 'list' ? 'active' : ''}" data-mode="list" title="列表视图">
            📋
          </button>
          <button class="view-mode-btn ${this.filters.viewMode === 'table' ? 'active' : ''}" data-mode="table" title="表格视图">
            📊
          </button>
        </div>

        ${(this.filters.stage || this.filters.search) ? `
          <button class="btn btn-sm btn-outline clear-filters-btn">清除筛选</button>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染看板面板
   * @returns {string} HTML
   */
  _renderKanbanBoard() {
    if (this.filteredFeatures.length === 0) {
      return `
        <div class="card empty-state">
          <div class="empty-icon">🔍</div>
          <h3>没有找到匹配的功能点</h3>
          <p>尝试调整筛选条件或清除筛选</p>
          <button class="btn btn-primary" onclick="KanbanView.clearFilters()">清除所有筛选</button>
        </div>
      `;
    }

    if (this.filters.viewMode === 'table') {
      return this._renderTableView();
    }

    if (this.filters.viewMode === 'list') {
      return this._renderListView();
    }

    // 默认卡片视图（看板）
    return `
      <div class="kanban-board">
        ${this.stages.map(stage => {
          const stageFeatures = this.filteredFeatures.filter(f => f.stage === stage.id);
          return `
            <div class="kanban-column" data-stage="${stage.id}">
              <div class="column-header" style="background-color: ${stage.color}; border-color: ${stage.color}">
                <span class="column-name">${stage.icon} ${stage.name}</span>
                <span class="column-count">${stageFeatures.length}</span>
              </div>
              <div class="column-cards">
                ${stageFeatures.map(feature => this._renderCard(feature)).join('')}
                ${stageFeatures.length === 0 ? '<div class="empty-column">暂无功能点</div>' : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * 渲染单个看板卡片
   * @param {Object} feature - 功能点数据
   * @returns {string} HTML
   */
  _renderCard(feature) {
    const score = feature.quality?.score || 0;
    const grade = Charts.getGrade(score);
    const tokens = feature.tokens?.total || 0;

    return `
      <div class="kanban-card" data-id="${feature.id}" title="点击查看详情">
        <div class="card-title-row">
          <h4 class="card-name" title="${feature.name}">${this._truncate(feature.name, 25)}</h4>
        </div>
        <div class="card-meta">
          <span class="card-grade badge badge-${grade.toLowerCase()}">${grade}</span>
          <span class="card-tokens">🪙 ${this._formatNumber(tokens)}</span>
        </div>
        <div class="card-progress-hint">
          ${this._getProgressHint(feature.stage)}
        </div>
      </div>
    `;
  },

  /**
   * 获取进度提示文字
   * @param {string} stage - 当前阶段
   * @returns {string}
   */
  _getProgressHint(stage) {
    const hints = {
      prd: '需求分析中...',
      extracted: '已提取，待生成规格',
      spec: '规格生成完成，待实现',
      implementing: '开发实现中...',
      verifying: '质量验证中...',
      done: '✨ 已完成'
    };
    return hints[stage] || '进行中';
  },

  /**
   * 渲染列表视图
   * @returns {string} HTML
   */
  _renderListView() {
    return `
      <div class="list-view">
        ${this.filteredFeatures.map(feature => {
          const stageConfig = this.stages.find(s => s.id === feature.stage) || this.stages[0];
          const score = feature.quality?.score || 0;
          const grade = Charts.getGrade(score);

          return `
            <div class="list-item" data-id="${feature.id}">
              <div class="list-item-main" onclick="KanbanView.showFeatureDetail('${feature.id}')">
                <span class="item-stage-badge" style="background-color: ${stageConfig.color}20; color: ${stageConfig.color}">
                  ${stageConfig.icon}
                </span>
                <div class="item-info">
                  <h4 class="item-name">${feature.name}</h4>
                  <p class="item-desc">${feature.description || '暂无描述'}</p>
                </div>
                <div class="item-stats">
                  <span class="item-score" style="color: ${Charts.getColor(score)}">${score.toFixed(1)} (${grade})</span>
                  <span class="item-tokens">🪙 ${this._formatNumber(feature.tokens?.total || 0)}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * 渲染表格视图
   * @returns {string} HTML
   */
  _renderTableView() {
    return `
      <div class="table-view card">
        <table class="data-table kanban-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>阶段</th>
              <th>评分</th>
              <th>Token</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredFeatures.map(feature => {
              const stageConfig = this.stages.find(s => s.id === feature.stage) || this.stages[0];
              const score = feature.quality?.score || 0;
              const grade = Charts.getGrade(score);

              return `
                <tr onclick="KanbanView.showFeatureDetail('${feature.id}')" style="cursor:pointer;">
                  <td><strong>${this._truncate(feature.name, 30)}</strong></td>
                  <td>
                    <span class="badge" style="background-color: ${stageConfig.color}20; color: ${stageConfig.color}">
                      ${stageConfig.icon} ${stageConfig.name}
                    </span>
                  </td>
                  <td><span style="color: ${Charts.getColor(score)}; font-weight: bold;">${score.toFixed(1)} (${grade})</span></td>
                  <td>${this._formatNumber(feature.tokens?.total || 0)}</td>
                  <td>${this._formatDate(feature.updatedAt || feature.createdAt)}</td>
                  <td>
                    <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); KanbanView.showFeatureDetail('${feature.id}')">
                      详情
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * 绑定卡片点击事件
   */
  _bindCardEvents() {
    document.querySelectorAll('.kanban-card[data-id], .list-item[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        this.showFeatureDetail(el.dataset.id);
      });
    });
  },

  /**
   * 显示功能点详情
   * @param {string} featureId - 功能点ID
   */
  async showFeatureDetail(featureId) {
    this.currentFeatureId = featureId;

    try {
      // 先从本地状态查找
      let feature = (App.state.features || []).find(f => f.id === featureId);

      // 如果本地没有，从API获取
      if (!feature) {
        const response = await fetch(`/api/feature/${featureId}`);
        if (!response.ok) throw new Error('获取功能点详情失败');
        const data = await response.json();
        feature = data.feature;
      }

      if (!feature) throw new Error('功能点不存在');

      // 更新当前索引
      this.currentIndex = this.filteredFeatures.findIndex(f => f.id === featureId);

      // 渲染详情Modal
      const html = this._renderDetailView(feature);
      App.showModal(html);

      // 绑定导航按钮事件
      setTimeout(() => this._bindNavigationEvents(), 100);

    } catch (error) {
      console.error('[KanbanView] Error loading feature detail:', error);
      App.showModal(`
        <div class="error-state">
          <div class="error-icon">❌</div>
          <h3>加载失败</h3>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="App.closeModal()">关闭</button>
        </div>
      `);
    }
  },

  /**
   * 导航到相邻功能点
   * @param {number} direction - 方向 (-1=上一个, 1=下一个)
   */
  navigateFeature(direction) {
    if (this.filteredFeatures.length === 0) return;

    let newIndex = this.currentIndex + direction;

    // 循环导航
    if (newIndex < 0) newIndex = this.filteredFeatures.length - 1;
    if (newIndex >= this.filteredFeatures.length) newIndex = 0;

    const nextFeature = this.filteredFeatures[newIndex];
    if (nextFeature) {
      this.showFeatureDetail(nextFeature.id);
    }
  },

  /**
   * 渲染详情视图完整HTML
   * @param {Object} feature - 功能点数据
   * @returns {string} HTML
   */
  _renderDetailView(feature) {
    const stageConfig = this.stages.find(s => s.id === feature.stage) || this.stages[0];
    const score = feature.quality?.score || 0;
    const grade = Charts.getGrade(score);

    return `
      <div class="feature-detail-modal">
        <!-- 导航栏 -->
        <div class="detail-nav">
          <button class="nav-btn nav-prev" onclick="KanbanView.navigateFeature(-1)" title="上一个 (←)">
            ◀
          </button>
          <div class="nav-info">
            <span class="nav-counter">${this.currentIndex + 1} / ${this.filteredFeatures.length}</span>
            <span class="nav-feature-name">${feature.name}</span>
          </div>
          <button class="nav-btn nav-next" onclick="KanbanView.navigateFeature(1)" title="下一个 (→)">
            ▶
          </button>
          <button class="nav-btn nav-close" onclick="App.closeModal(); KanbanView.currentFeatureId = null;" title="关闭 (ESC)">
            ✕
          </button>
        </div>

        <!-- 内容区域 -->
        <div class="detail-content">
          <!-- Tab导航 -->
          <div class="detail-tabs">
            <button class="detail-tab active" data-tab="overview">概览</button>
            <button class="detail-tab" data-tab="timeline">时间线</button>
            <button class="detail-tab" data-tab="spec">规格信息</button>
            <button class="detail-tab" data-tab="code">代码统计</button>
            <button class="detail-tab" data-tab="quality">验证结果</button>
            <button class="detail-tab" data-tab="issues">问题列表</button>
            <button class="detail-tab" data-tab="tokens">Token消耗</button>
            <button class="detail-tab" data-tab="iterations">迭代历史</button>
          </div>

          <!-- Tab内容 -->
          <div class="detail-panels">
            ${this._renderOverviewPanel(feature, stageConfig, grade)}
            ${this._renderTimelinePanel(feature)}
            ${this._renderSpecPanel(feature)}
            ${this._renderCodePanel(feature)}
            ${this._renderQualityPanel(feature)}
            ${this._renderIssuesPanel(feature)}
            ${this._renderTokenPanel(feature)}
            ${this._renderIterationPanel(feature)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染概览面板
   */
  _renderOverviewPanel(feature, stageConfig, grade) {
    return `
      <div class="detail-panel active" data-panel="overview">
        <div class="panel-grid">
          <div class="info-section">
            <h4>基本信息</h4>
            <dl class="info-list">
              <dt>ID</dt><dd>${feature.id}</dd>
              <dt>名称</dt><dd><strong>${feature.name}</strong></dd>
              <dt>当前阶段</dt>
              <dd><span class="badge" style="background-color: ${stageConfig.color}20; color: ${stageConfig.color}">${stageConfig.icon} ${stageConfig.name}</span></dd>
              <dt>优先级</dt><dd>${feature.priority || '-'}</dd>
              <dt>评分/等级</dt>
              <dd><span style="color: ${Charts.getColor(feature.quality?.score || 0)}; font-weight: bold;">${(feature.quality?.score || 0).toFixed(1)} (${grade})</span></dd>
            </dl>
          </div>

          <div class="info-section">
            <h4>描述</h4>
            <p class="description-text">${feature.description || '暂无描述'}</p>

            <h4 style="margin-top: 16px;">标签</h4>
            <div class="tags-container">
              ${(feature.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('') || '<span class="text-muted">无标签</span>'}
            </div>
          </div>

          <div class="info-section">
            <h4>时间信息</h4>
            <dl class="info-list">
              <dt>创建时间</dt><dd>${this._formatDateTime(feature.createdAt)}</dd>
              <dt>更新时间</dt><dd>${this._formatDateTime(feature.updatedAt)}</dd>
            </dl>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染时间线面板
   */
  _renderTimelinePanel(feature) {
    const timeline = feature.timeline || [];

    if (timeline.length === 0) {
      return `
        <div class="detail-panel" data-panel="timeline">
          <div class="empty-panel">暂无时间线记录</div>
        </div>
      `;
    }

    return `
      <div class="detail-panel" data-panel="timeline">
        <div class="vertical-timeline">
          ${timeline.map((entry, index) => {
            const fromStage = this.stages.find(s => s.id === entry.fromStage);
            const toStage = this.stages.find(s => s.id === entry.toStage);
            const isLatest = index === 0;

            return `
              <div class="vt-item ${isLatest ? 'latest' : ''}">
                <div class="vt-dot" style="background-color: ${toStage?.color || '#95a5a6'}"></div>
                <div class="vt-content">
                  <div class="vt-header">
                    <strong>${entry.type || '阶段变更'}</strong>
                    <span class="vt-time">${this._formatDateTime(entry.timestamp || entry.time)}</span>
                  </div>
                  <div class="vt-body">
                    ${fromStage ? `<span class="badge" style="background-color: ${fromStage.color}20; color: ${fromStage.color}">${fromStage.name}</span>` : ''}
                    →
                    ${toStage ? `<span class="badge" style="background-color: ${toStage.color}20; color: ${toStage.color}">${toStage.name}</span>` : ''}
                    ${entry.description ? `<p class="mt-1 text-muted">${entry.description}</p>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /**
   * 渲染规格信息面板
   */
  _renderSpecPanel(feature) {
    const spec = feature.artifacts?.spec;

    if (!spec) {
      return `
        <div class="detail-panel" data-panel="spec">
          <div class="empty-panel">暂无规格信息</div>
        </div>
      `;
    }

    return `
      <div class="detail-panel" data-panel="spec">
        <dl class="info-list">
          <dt>规格文件</dt><dd>${spec.fileName || spec.path || '-'}</dd>
          <dt>模板类型</dt><dd>${spec.templateType || '-'}</dd>
          <dt>生成时间</dt><dd>${this._formatDateTime(spec.generatedAt)}</dd>
          <dt>状态</dt><dd><span class="badge badge-${spec.status || 'unknown'}">${spec.status || '未知'}</span></dd>
        </dl>

        ${spec.content ? `
          <div class="code-preview">
            <pre><code>${this._escapeHtml(spec.content.substring(0, 2000))}${spec.content.length > 2000 ? '\n...(截断)' : ''}</code></pre>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染代码统计面板
   */
  _renderCodePanel(feature) {
    const code = feature.artifacts?.code;

    if (!code) {
      return `
        <div class="detail-panel" data-panel="code">
          <div class="empty-panel">暂无代码统计</div>
        </div>
      `;
    }

    return `
      <div class="detail-panel" data-panel="code">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${code.fileCount || 0}</div>
            <div class="stat-label">文件数</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${this._formatNumber(code.loc || 0)}</div>
            <div class="stat-label">总行数 (LOC)</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${code.languageCount || Object.keys(code.languages || {}).length}</div>
            <div class="stat-label">语言数</div>
          </div>
        </div>

        ${code.languages && Object.keys(code.languages).length > 0 ? `
          <h5 class="mt-3">语言分布</h5>
          <div class="language-bars">
            ${Object.entries(code.languages).map(([lang, stats]) => `
              <div class="lang-item">
                <span class="lang-name">${lang}</span>
                <div class="lang-bar">
                  <div class="lang-bar-fill" style="width: ${(stats.loc / code.loc * 100)}%; background-color: ${this._getLanguageColor(lang)}"></div>
                </div>
                <span class="lang-stats">${stats.files} 文件 / ${this._formatNumber(stats.loc)} 行</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染验证结果面板
   */
  _renderQualityPanel(feature) {
    const quality = feature.quality;

    if (!quality) {
      return `
        <div class="detail-panel" data-panel="quality">
          <div class="empty-panel">暂无验证结果</div>
        </div>
      `;
    }

    const score = quality.score || 0;
    const grade = Charts.getGrade(score);

    return `
      <div class="detail-panel" data-panel="quality">
        <div class="quality-summary">
          <div class="quality-score-display">
            <div class="big-score" style="color: ${Charts.getColor(score)}">${score.toFixed(1)}</div>
            <div class="grade-label badge badge-${grade.toLowerCase()}" style="font-size: 16px;">${grade}</div>
          </div>
          <div class="quality-metrics">
            <div class="metric-item">
              <span class="metric-label">通过率</span>
              <span class="metric-value">${(quality.passRate || 0).toFixed(1)}%</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">问题数</span>
              <span class="metric-value">${(quality.issues || []).length}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">测试覆盖</span>
              <span class="metric-value">${(quality.coverage || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        ${quality.dimensions && Object.keys(quality.dimensions).length > 0 ? `
          <h5 class="mt-3">维度得分</h5>
          <div class="dimension-scores">
            ${Object.entries(quality.dimensions).map(([dim, val]) => `
              <div class="dim-item">
                <span class="dim-name">${dim}</span>
                <div class="dim-bar">
                  <div class="dim-bar-fill" style="width: ${val}%; background-color: ${Charts.getColor(val)}"></div>
                </div>
                <span class="dim-value">${val}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染问题列表面板
   */
  _renderIssuesPanel(feature) {
    const issues = feature.quality?.issues || [];

    if (issues.length === 0) {
      return `
        <div class="detail-panel" data-panel="issues">
          <div class="empty-panel success">✅ 未发现问题</div>
        </div>
      `;
    }

    return `
      <div class="detail-panel" data-panel="issues">
        <table class="data-table issues-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>描述</th>
              <th>严重程度</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            ${issues.map(issue => `
              <tr>
                <td><span class="badge badge-outline">${issue.type || issue.category || '-'}</span></td>
                <td>${issue.description || issue.message || '-'}</td>
                <td>
                  <span class="severity-${issue.severity || 'low'}">${this._capitalize(issue.severity || 'low')}</span>
                </td>
                <td><span class="status-dot status-${issue.status || 'open'}"></span> ${issue.status || 'open'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * 渲染Token消耗面板
   */
  _renderTokenPanel(feature) {
    const tokens = feature.tokens;

    if (!tokens) {
      return `
        <div class="detail-panel" data-panel="tokens">
          <div class="empty-panel">暂无Token数据</div>
        </div>
      `;
    }

    const total = tokens.total || 0;
    const stages = tokens.byStage || {};

    return `
      <div class="detail-panel" data-panel="tokens">
        <div class="token-summary">
          <div class="token-total">
            <span class="token-big-number">${this._formatNumber(total)}</span>
            <span class="token-unit">Tokens</span>
          </div>
        </div>

        ${Object.keys(stages).length > 0 ? `
          <h5 class="mt-3">各阶段消耗</h5>
          <div class="token-breakdown">
            ${Object.entries(stages).map(([stage, amount]) => {
              const stageConfig = this.stages.find(s => s.id === stage);
              const percent = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;

              return `
                <div class="token-stage-item">
                  <span class="ts-name" style="color: ${stageConfig?.color || '#95a5a6'}">
                    ${stageConfig?.icon || ''} ${stage.toUpperCase()}
                  </span>
                  <div class="ts-bar">
                    <div class="ts-bar-fill" style="width: ${percent}%; background-color: ${stageConfig?.color || '#95a5a6'}"></div>
                  </div>
                  <span class="ts-value">${this._formatNumber(amount)} (${percent}%)</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * 渲染迭代历史面板
   */
  _renderIterationPanel(feature) {
    const iterations = feature.iterations || [];

    if (iterations.length === 0) {
      return `
        <div class="detail-panel" data-panel="iterations">
          <div class="empty-panel">暂无迭代记录</div>
        </div>
      `;
    }

    return `
      <div class="detail-panel" data-panel="iterations">
        <table class="data-table iteration-table">
          <thead>
            <tr>
              <th>轮次</th>
              <th>评分</th>
              <th>修复问题</th>
              <th>Token消耗</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            ${iterations.map((iter, index) => `
              <tr class="${index === iterations.length - 1 ? 'latest-iteration' : ''}">
                <td><strong>R${index + 1}</strong></td>
                <td>
                  <span style="color: ${Charts.getColor(iter.score || 0)}; font-weight: bold;">
                    ${(iter.score || 0).toFixed(1)}
                  </span>
                  <span class="badge badge-${Charts.getGrade(iter.score || 0).toLowerCase()} ml-1">
                    ${Charts.getGrade(iter.score || 0)}
                  </span>
                </td>
                <td>${iter.fixedIssues || iter.issuesFixed || 0}</td>
                <td>${this._formatNumber(iter.tokens || 0)}</td>
                <td>${this._formatDateTime(iter.timestamp || iter.time)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * 绑定导航和Tab事件
   */
  _bindNavigationEvents() {
    // Tab切换
    document.querySelectorAll('.detail-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // 移除所有active
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));

        // 添加active
        tab.classList.add('active');
        const panelName = tab.dataset.tab;
        const panel = document.querySelector(`.detail-panel[data-panel="${panelName}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  },

  // ==================== 工具方法 ====================

  /**
   * 格式化数字
   */
  _formatNumber(num) {
    if (!num) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /**
   * 截断文本
   */
  _truncate(text, maxLen = 50) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  },

  /**
   * 格式化日期
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
   * 格式化日期时间
   */
  _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('zh-CN');
    } catch (e) {
      return dateStr;
    }
  },

  /**
   * 首字母大写
   */
  _capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * HTML转义
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /**
   * 获取语言颜色
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
KanbanView.init();

// 导出全局使用
window.KanbanView = KanbanView;
