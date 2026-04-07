/**
 * PipelineView - 流水线总览视图 (Panel 1)
 * 展示项目整体进度、六阶段流水线、功能点分布和最近活动
 *
 * @module PipelineView
 * @version 1.0.0
 * @requires App (全局应用对象)
 */

const PipelineView = {
  name: 'pipeline',

  // 阶段配置
  stages: [
    { id: 'prd', name: 'PRD', icon: '📋', color: '#9b59b6', description: '需求分析' },
    { id: 'extracted', name: 'EXTRACTED', icon: '🔍', color: '#3498db', description: '功能提取' },
    { id: 'spec', name: 'SPEC', icon: '📝', color: '#2ecc71', description: '规格生成' },
    { id: 'implementing', name: 'IMPLEMENTING', icon: '⚙️', color: '#f39c12', description: '代码实现' },
    { id: 'verifying', name: 'VERIFYING', icon: '✅', color: '#e74c3c', description: '质量验证' },
    { id: 'done', name: 'DONE', icon: '🎉', color: '#1abc9c', description: '已完成' }
  ],

  /**
   * 初始化视图
   */
  init() {
    App.registerView(this.name, this);
    console.log('[PipelineView] Initialized');
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
    }
  },

  /**
   * 主渲染方法
   * @param {Array} features - 功能点列表
   * @param {Object} summary - 项目汇总数据
   */
  render(features, summary) {
    const container = document.getElementById('view-pipeline');
    if (!container) return;

    container.innerHTML = `
      <div class="pipeline-view">
        ${this._renderSummaryCards(summary)}
        ${this._renderPipelineStages(features)}
        ${this._renderFeatureDistribution(features)}
        ${this._renderActivityTimeline(features)}
      </div>
    `;

    // 绑定阶段点击事件
    this._bindStageClickEvents();
  },

  /**
   * 渲染三张汇总卡片
   * @param {Object} summary - 汇总数据
   * @returns {string} HTML字符串
   */
  _renderSummaryCards(summary) {
    const totalFeatures = summary.totalFeatures || 0;
    const doneCount = summary.doneCount || 0;
    const progressPercent = totalFeatures > 0 ? Math.round((doneCount / totalFeatures) * 100) : 0;

    const avgScore = summary.avgScore || 0;
    const grade = Charts.getGrade(avgScore);

    const tokensUsed = summary.tokensUsed || 0;
    const tokensTotal = summary.tokensTotal || 100000;
    const tokenPercent = tokensTotal > 0 ? Math.round((tokensUsed / tokensTotal) * 100) : 0;

    return `
      <div class="grid-3 summary-cards">
        <!-- 卡1: 整体进度 -->
        <div class="card summary-card">
          <div class="card-header">
            <h3>整体进度</h3>
            <span class="badge badge-info">${doneCount}/${totalFeatures}</span>
          </div>
          <div class="card-body progress-ring-container">
            ${this._createProgressRing(progressPercent, 90)}
            <div class="progress-stats">
              <div class="stat-item">
                <span class="stat-label">已完成</span>
                <span class="stat-value">${doneCount}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">进行中</span>
                <span class="stat-value">${totalFeatures - doneCount}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 卡2: 质量概览 -->
        <div class="card summary-card">
          <div class="card-header">
            <h3>质量概览</h3>
            <span class="badge badge-${grade.toLowerCase()}">${grade}</span>
          </div>
          <div class="card-body quality-overview">
            <div class="quality-score">
              <span class="score-number">${avgScore.toFixed(1)}</span>
              <span class="score-max">/100</span>
            </div>
            <div class="grade-distribution">
              ${this._renderGradeBadges(summary.gradeDistribution || {})}
            </div>
          </div>
        </div>

        <!-- 卡3: Token消耗 -->
        <div class="card summary-card">
          <div class="card-header">
            <h3>Token 消耗</h3>
            <span class="badge badge-warning">${tokenPercent}%</span>
          </div>
          <div class="card-body token-overview">
            <div class="token-usage">
              <div class="token-number">
                <span class="token-used">${this._formatNumber(tokensUsed)}</span>
                <span class="token-divider">/</span>
                <span class="token-total">${this._formatNumber(tokensTotal)}</span>
              </div>
              <div class="token-bar">
                <div class="token-bar-fill" style="width: ${Math.min(tokenPercent, 100)}%; background-color: ${tokenPercent > 95 ? '#e74c3c' : tokenPercent > 80 ? '#f39c12' : '#27ae60'}"></div>
              </div>
            </div>
            <div class="token-trend">
              <i class="trend-icon ${summary.tokenTrend >= 0 ? 'trend-up' : 'trend-down'}">${summary.tokenTrend >= 0 ? '↑' : '↓'}</i>
              <span>较上次 +${Math.abs(summary.tokenTrend || 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 创建SVG环形进度条
   * @param {number} percent - 百分比
   * @param {number} size - 尺寸
   * @returns {string} SVG HTML
   */
  _createProgressRing(percent, size = 80) {
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    const color = percent >= 80 ? '#27ae60' : percent >= 50 ? '#f39c12' : '#e74c3c';

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="progress-ring-svg">
        <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="#ecf0f1" stroke-width="10"/>
        <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="${color}" stroke-width="10"
                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                stroke-linecap="round"
                transform="rotate(-90 ${size/2} ${size/2})"
                style="transition: stroke-dashoffset 0.8s ease-in-out"/>
        <text x="${size/2}" y="${size/2 + 5}" text-anchor="middle" font-size="18" font-weight="bold" fill="#2c3e50">
          ${percent}%
        </text>
      </svg>
    `;
  },

  /**
   * 渲染等级徽章
   * @param {Object} distribution - 等级分布
   * @returns {string} HTML
   */
  _renderGradeBadges(distribution) {
    const grades = ['S', 'A', 'B', 'C', 'D', 'F'];
    const colors = {
      S: '#27ae60', A: '#2980b9', B: '#f39c12',
      C: '#e67e22', D: '#e74c3c', F: '#c0392b'
    };

    return grades.map(grade => `
      <span class="grade-badge" style="background-color: ${colors[grade]}20; color: ${colors[grade]}; border: 1px solid ${colors[grade]}40;">
        ${grade}: ${distribution[grade] || 0}
      </span>
    `).join('');
  },

  /**
   * 渲染六阶段流水线图
   * @param {Array} features - 功能点列表
   * @returns {string} HTML
   */
  _renderPipelineStages(features) {
    // 计算每个阶段的统计
    const stageStats = {};
    const total = features.length || 0;

    this.stages.forEach(stage => {
      stageStats[stage.id] = features.filter(f => f.stage === stage.id);
    });

    return `
      <div class="card pipeline-card">
        <div class="card-header">
          <h3>开发流水线</h3>
          <span class="text-muted">共 ${total} 个功能点</span>
        </div>
        <div class="card-body">
          <div class="pipeline-container">
            ${this.stages.map((stage, index) => {
              const count = stageStats[stage.id] ? stageStats[stage.id].length : 0;
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;

              return `
                <div class="pipeline-stage" data-stage="${stage.id}">
                  <div class="stage-icon" style="background-color: ${stage.color}20; color: ${stage.color};">
                    ${stage.icon}
                  </div>
                  <div class="stage-name" style="color: ${stage.color};">${stage.name}</div>
                  <div class="stage-count">${count}</div>
                  <div class="stage-percent">${percent}%</div>
                  <div class="stage-progress-bar">
                    <div class="stage-progress-fill" style="width: ${percent}%; background-color: ${stage.color};"></div>
                  </div>
                  <div class="stage-description">${stage.description}</div>
                  ${index < this.stages.length - 1 ? `<div class="stage-arrow">→</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 渲染功能点阶段分布表
   * @param {Array} features - 功能点列表
   * @returns {string} HTML
   */
  _renderFeatureDistribution(features) {
    if (!features || features.length === 0) {
      return '';
    }

    // 只显示前15个，避免过长
    const displayFeatures = features.slice(0, 15);

    return `
      <div class="card distribution-card">
        <div class="card-header">
          <h3>功能点阶段分布</h3>
          <span class="text-muted">显示前 ${displayFeatures.length} / ${features.length} 个</span>
        </div>
        <div class="card-body">
          <table class="data-table feature-table">
            <thead>
              <tr>
                <th>功能点名称</th>
                <th>当前阶段</th>
                <th>评分</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${displayFeatures.map(feature => {
                const stageConfig = this.stages.find(s => s.id === feature.stage) || this.stages[0];
                const score = feature.quality?.score || 0;
                const grade = Charts.getGrade(score);

                return `
                  <tr>
                    <td class="feature-name-cell">
                      <span class="feature-name" title="${feature.name}">${this._truncate(feature.name, 30)}</span>
                    </td>
                    <td>
                      <span class="badge" style="background-color: ${stageConfig.color}20; color: ${stageConfig.color};">
                        ${stageConfig.icon} ${stageConfig.name}
                      </span>
                    </td>
                    <td>
                      <span class="score-text" style="color: ${Charts.getColor(score)};">${score.toFixed(1)} (${grade})</span>
                    </td>
                    <td>
                      <span class="status-dot status-${feature.status || 'active'}"></span>
                      ${feature.status || 'active'}
                    </td>
                    <td>
                      <button class="btn btn-sm btn-outline" onclick="KanbanView.showFeatureDetail('${feature.id}')">
                        详情
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  /**
   * 渲染最近活动时间线
   * @param {Array} features - 功能点列表
   * @returns {string} HTML
   */
  _renderActivityTimeline(features) {
    // 从所有功能的timeline中收集最近的10条活动
    let allActivities = [];

    (features || []).forEach(feature => {
      if (feature.timeline && Array.isArray(feature.timeline)) {
        feature.timeline.forEach(entry => {
          allActivities.push({
            ...entry,
            featureName: feature.name,
            featureId: feature.id
          });
        });
      }
    });

    // 按时间倒序排列，取前10条
    allActivities.sort((a, b) => new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time));
    const recentActivities = allActivities.slice(0, 10);

    if (recentActivities.length === 0) {
      return `
        <div class="card timeline-card">
          <div class="card-header">
            <h3>最近活动</h3>
          </div>
          <div class="card-body text-center text-muted py-4">
            暂无活动记录
          </div>
        </div>
      `;
    }

    return `
      <div class="card timeline-card">
        <div class="card-header">
          <h3>最近活动</h3>
          <span class="text-muted">最近 10 条</span>
        </div>
        <div class="card-body">
          <div class="timeline">
            ${recentActivities.map((activity, index) => {
              const timeStr = this._formatTime(activity.timestamp || activity.time);
              const stageConfig = this.stages.find(s =>
                activity.toStage === s.id || activity.stage === s.id
              );
              const dotColor = stageConfig ? stageConfig.color : '#95a5a6';

              return `
                <div class="timeline-item ${index === 0 ? 'latest' : ''}">
                  <div class="timeline-dot" style="background-color: ${dotColor};"></div>
                  <div class="timeline-content">
                    <div class="timeline-header">
                      <strong>${activity.featureName || '未知功能点'}</strong>
                      <span class="timeline-time">${timeStr}</span>
                    </div>
                    <div class="timeline-description">
                      ${activity.description || `${activity.type || '操作'}: ${activity.fromStage || ''} → ${activity.toStage || activity.stage || ''}`}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * 绑定阶段点击事件
   */
  _bindStageClickEvents() {
    document.querySelectorAll('.pipeline-stage[data-stage]').forEach(stageEl => {
      stageEl.addEventListener('click', () => {
        const stageId = stageEl.dataset.stage;
        // 切换到看板视图并筛选该阶段
        window.location.hash = '#kanban';
        // 延迟执行以确保视图已切换
        setTimeout(() => {
          if (typeof KanbanView !== 'undefined') {
            KanbanView.setFilter('stage', stageId);
          }
        }, 100);
      });

      stageEl.style.cursor = 'pointer';
      stageEl.title = '点击查看该阶段的功能点';
    });
  },

  // ==================== 工具方法 ====================

  /**
   * 格式化数字（添加千位分隔符）
   * @param {number} num
   * @returns {string}
   */
  _formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /**
   * 截断文本
   * @param {string} text - 文本
   * @param {number} maxLength - 最大长度
   * @returns {string}
   */
  _truncate(text, maxLength = 50) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * 格式化时间
   * @param {string|Date} time - 时间
   * @returns {string}
   */
  _formatTime(time) {
    if (!time) return '';

    try {
      const date = new Date(time);
      const now = new Date();
      const diff = now - date;

      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;

      return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return String(time);
    }
  }
};

// 初始化
PipelineView.init();

// 导出全局使用
window.PipelineView = PipelineView;
