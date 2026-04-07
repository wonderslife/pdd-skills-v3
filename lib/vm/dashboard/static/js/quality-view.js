/**
 * QualityView - 质量监控视图 (Panel 3)
 * 展示五维雷达图、评分分布、Token仪表盘、缓存效率、问题排行、迭代收敛曲线
 *
 * @module QualityView
 * @version 1.0.0
 * @requires App, Charts (Canvas 图表引擎)
 */

const QualityView = {
  name: 'quality',

  /**
   * 初始化视图
   */
  init() {
    App.registerView(this.name, this);
    console.log('[QualityView] Initialized');
  },

  /**
   * 视图显示时调用
   */
  onShow() {
    this.render();
  },

  /**
   * SSE事件处理
   * @param {string} type - 事件类型
   * @param {*} data - 事件数据
   */
  onEvent(type, data) {
    if (type === 'quality_update' || type === 'data_refreshed' || type === 'token_threshold') {
      this.render();
    }
  },

  /**
   * 主渲染方法（异步，因为需要fetch多个API）
   */
  async render() {
    const container = document.getElementById('view-quality');
    if (!container) return;

    // 显示加载状态
    container.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>正在加载质量数据...</p>
      </div>
    `;

    try {
      // 并行获取所有需要的数据
      const [qualityRes, tokenRes, cacheRes, iterationRes] = await Promise.all([
        fetch('/api/quality').catch(() => null),
        fetch('/api/tokens').catch(() => null),
        fetch('/api/cache').catch(() => null),
        fetch('/api/iterations').catch(() => null)
      ]);

      // 解析响应
      let qualityMatrix = null;
      let tokenStats = null;
      let cacheStats = null;
      let iterations = [];

      if (qualityRes && qualityRes.ok) {
        const qData = await qualityRes.json();
        qualityMatrix = qData.matrix || qData;
      }

      if (tokenRes && tokenRes.ok) {
        const tData = await tokenRes.json();
        tokenStats = tData.stats || tData;
      }

      if (cacheRes && cacheRes.ok) {
        const cData = await cacheRes.json();
        cacheStats = cData.stats || cData;
      }

      if (iterationRes && iterationRes.ok) {
        const iData = await iterationRes.json();
        iterations = iData.iterations || [];
      }

      // 渲染完整视图
      container.innerHTML = `
        <div class="quality-view">
          <div class="grid-2">
            <!-- 左上: 雷达图 -->
            ${this._renderRadarChart(qualityMatrix)}

            <!-- 右上: 评分分布 -->
            ${this._renderGradeDistribution(qualityMatrix)}

            <!-- 左中: Token仪表盘 -->
            ${this._renderTokenGauge(tokenStats)}

            <!-- 右中: 缓存面板 -->
            ${this._renderCachePanel(cacheStats)}

            <!-- 左下: 问题排行 -->
            ${this._renderTopIssues(qualityMatrix)}

            <!-- 右下: 迭代收敛曲线 -->
            ${this._renderConvergenceCurve(iterations)}
          </div>
        </div>
      `;

      // 延迟绘制Canvas图表（确保DOM已渲染）
      setTimeout(() => {
        this._drawCharts(qualityMatrix, tokenStats, iterations);
      }, 100);

    } catch (error) {
      console.error('[QualityView] Render error:', error);
      container.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>加载质量数据失败</h3>
          <p>${error.message}</p>
          <button class="btn btn-primary" onclick="QualityView.render()">重试</button>
        </div>
      `;
    }
  },

  // ==================== 子面板渲染方法 ====================

  /**
   * 渲染雷达图容器
   * @param {Object} matrix - 质量矩阵数据
   * @returns {string} HTML
   */
  _renderRadarChart(matrix) {
    const dimensions = matrix?.dimensions || {};
    const hasData = Object.keys(dimensions).length > 0;

    return `
      <div class="card radar-card">
        <div class="card-header">
          <h3>🎯 五维质量雷达</h3>
          <span class="text-muted">各维度得分</span>
        </div>
        <div class="card-body canvas-container">
          ${hasData ? '<canvas id="radar-chart" width="400" height="350"></canvas>' : '<div class="empty-panel">暂无数据</div>'}
        </div>
      </div>
    `;
  },

  /**
   * 渲染评分分布直方图容器
   * @param {Object} matrix - 质量矩阵数据
   * @returns {string} HTML
   */
  _renderGradeDistribution(matrix) {
    const distribution = matrix?.gradeDistribution || matrix?.distribution || {};
    const avgScore = matrix?.avgScore || matrix?.averageScore || 0;

    return `
      <div class="card grade-dist-card">
        <div class="card-header">
          <h3>📊 评分分布</h3>
          <span class="badge badge-${Charts.getGrade(avgScore).toLowerCase()}">平均: ${avgScore.toFixed(1)}</span>
        </div>
        <div class="card-body canvas-container">
          <canvas id="grade-histogram" width="400" height="300"></canvas>
        </div>
      </div>
    `;
  },

  /**
   * 渲染Token预算仪表盘容器
   * @param {Object} tokenStats - Token统计
   * @returns {string} HTML
   */
  _renderTokenGauge(tokenStats) {
    const used = tokenStats?.used || tokenStats?.consumed || 0;
    const total = tokenStats?.total || tokenStats?.budget || 100000;
    const percent = total > 0 ? ((used / total) * 100).toFixed(1) : 0;

    return `
      <div class="card token-gauge-card">
        <div class="card-header">
          <h3>💰 Token 预算</h3>
          <span class="text-muted">${percent}% 已使用</span>
        </div>
        <div class="card-body">
          <div class="gauge-container">
            <canvas id="token-gauge" width="200" height="200"></canvas>
          </div>
          <div class="token-stats-row">
            <div class="ts-item">
              <span class="ts-label">已用</span>
              <span class="ts-value">${this._formatNumber(used)}</span>
            </div>
            <div class="ts-divider">/</div>
            <div class="ts-item">
              <span class="ts-label">预算</span>
              <span class="ts-value">${this._formatNumber(total)}</span>
            </div>
            <div class="ts-divider">/</div>
            <div class="ts-item">
              <span class="ts-label">剩余</span>
              <span class="ts-value" style="color: ${percent > 95 ? '#e74c3c' : percent > 80 ? '#f39c12' : '#27ae60'}">${this._formatNumber(total - used)}</span>
            </div>
          </div>

          <!-- 各阶段Token消耗柱状图 -->
          ${tokenStats?.byStage ? `
            <div class="stage-token-bars mt-3">
              <canvas id="stage-token-chart" width="380" height="180"></canvas>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * 渲染缓存效率面板
   * @param {Object|null} cacheStats - 缓存统计
   * @returns {string} HTML
   */
  _renderCachePanel(cacheStats) {
    if (!cacheStats) {
      return `
        <div class="card cache-card">
          <div class="card-header">
            <h3>⚡ 缓存效率</h3>
            <span class="badge badge-secondary">N/A</span>
          </div>
          <div class="card-body text-center py-4">
            <div class="empty-icon">🚫</div>
            <p class="text-muted">缓存未启用或无数据</p>
          </div>
        </div>
      `;
    }

    const l1 = cacheStats.l1?.hitRate || cacheStats.l1HitRate || 0;
    const l2 = cacheStats.l2?.hitRate || cacheStats.l2HitRate || 0;
    const l3 = cacheStats.l3?.hitRate || cacheStats.l3HitRate || 0;
    const overall = cacheStats.overall?.hitRate || cacheStats.overallHitRate ||
                    ((l1 + l2 + l3) / 3) || 0;

    return `
      <div class="card cache-card">
        <div class="card-header">
          <h3>⚡ 缓存效率</h3>
          <span class="text-muted">三层命中率</span>
        </div>
        <div class="card-body">
          <div class="cache-overall">
            <div class="cache-big-number" style="color: ${overall >= 90 ? '#27ae60' : overall >= 70 ? '#f39c12' : '#e74c3c'}">
              ${overall.toFixed(1)}%
            </div>
            <div class="cache-label">总命中率</div>
          </div>

          <div class="cache-layers">
            <div class="cache-layer">
              <div class="layer-name">L1 缓存</div>
              <div class="layer-bar-container">
                <div class="layer-bar-fill" style="width: ${l1}%; background-color: #27ae60;"></div>
              </div>
              <div class="layer-value">${l1.toFixed(1)}%</div>
            </div>
            <div class="cache-layer">
              <div class="layer-name">L2 缓存</div>
              <div class="layer-bar-container">
                <div class="layer-bar-fill" style="width: ${l2}%; background-color: #3498db;"></div>
              </div>
              <div class="layer-value">${l2.toFixed(1)}%</div>
            </div>
            <div class="cache-layer">
              <div class="layer-name">L3 缓存</div>
              <div class="layer-bar-container">
                <div class="layer-bar-fill" style="width: ${l3}%; background-color: #9b59b6;"></div>
              </div>
              <div class="layer-value">${l3.toFixed(1)}%</div>
            </div>
          </div>

          ${cacheStats.size ? `<div class="cache-meta text-muted mt-2">缓存大小: ${this._formatBytes(cacheStats.size)}</div>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * 渲染Top N问题排行容器
   * @param {Object} matrix - 质量矩阵数据
   * @returns {string} HTML
   */
  _renderTopIssues(matrix) {
    const issueTypes = matrix?.issueTypes || matrix?.topIssues || {};

    return `
      <div class="card issues-rank-card">
        <div class="card-header">
          <h3>🐛 Top 问题排行</h3>
          <span class="text-muted">按类型统计</span>
        </div>
        <div class="card-body canvas-container">
          ${Object.keys(issueTypes).length > 0 ?
            '<canvas id="issues-horizontal-bar" width="400" height="280"></canvas>' :
            '<div class="empty-panel success">✅ 未发现问题</div>'
          }
        </div>
      </div>
    `;
  },

  /**
   * 渲染迭代收敛曲线容器
   * @param {Array} iterations - 迭代列表
   * @returns {string} HTML
   */
  _renderConvergenceCurve(iterations) {
    const hasIterations = Array.isArray(iterations) && iterations.length > 0;

    return `
      <div class="card convergence-card">
        <div class="card-header">
          <h3>📈 迭代收敛曲线</h3>
          ${hasIterations ? `<span class="badge badge-success">共 ${iterations.length} 轮</span>` : ''}
        </div>
        <div class="card-body canvas-container">
          ${hasIterations ?
            '<canvas id="convergence-line-chart" width="400" height="300"></canvas>' :
            '<div class="empty-panel">暂无迭代数据</div>'
          }
        </div>
      </div>
    `;
  },

  // ==================== Canvas 绘制方法 ====================

  /**
   * 绘制所有Canvas图表
   * @param {Object} matrix - 质量矩阵
   * @param {Object} tokenStats - Token统计
   * @param {Array} iterations - 迭代列表
   */
  _drawCharts(matrix, tokenStats, iterations) {
    try {
      // 1. 绘制雷达图
      this._drawRadarChart(matrix);

      // 2. 绘制评分分布直方图
      this._drawGradeHistogram(matrix);

      // 3. 绘制Token仪表盘
      this._drawTokenGauge(tokenStats);

      // 4. 绘制阶段Token柱状图
      this._drawStageTokenChart(tokenStats);

      // 5. 绘制问题排行条形图
      this._drawIssuesBar(matrix);

      // 6. 绘制迭代收敛曲线
      this._drawConvergenceChart(iterations);

    } catch (error) {
      console.error('[QualityView] Chart drawing error:', error);
    }
  },

  /**
   * 绘制五维雷达图
   * @param {Object} matrix - 质量矩阵
   */
  _drawRadarChart(matrix) {
    const canvas = document.getElementById('radar-chart');
    if (!canvas || !matrix?.dimensions) return;

    const dims = matrix.dimensions;
    const labels = Object.keys(dims);
    const values = Object.values(dims);

    // 确保是五维数据（不足的补全，多余的截取）
    while (labels.length < 5) {
      labels.push(`维度${labels.length + 1}`);
      values.push(0);
    }

    Charts.radar('radar-chart', {
      labels: labels.slice(0, 5),
      values: values.slice(0, 5)
    }, {
      colors: ['#3498db'],
      fillAlpha: 0.25,
      animate: true,
      maxVal: 100,
      onHover: (index, info) => {
        // 可以在这里添加悬停提示逻辑
        console.log('Radar hover:', info);
      }
    });
  },

  /**
   * 绘制评分分布直方图
   * @param {Object} matrix - 质量矩阵
   */
  _drawGradeHistogram(matrix) {
    const canvas = document.getElementById('grade-histogram');
    if (!canvas) return;

    const dist = matrix?.gradeDistribution || matrix?.distribution || {
      S: 0, A: 0, B: 0, C: 0, D: 0, F: 0
    };

    const grades = ['S', 'A', 'B', 'C', 'D', 'F'];
    const colors = ['#27ae60', '#2980b9', '#f39c12', '#e67e22', '#e74c3c', '#c0392b'];

    Charts.histogram('grade-histogram', {
      labels: grades,
      values: grades.map(g => dist[g] || 0)
    }, {
      colors: colors,
      label: '数量',
      animate: true,
      onClick: (index, label, value) => {
        if (value > 0 && typeof KanbanView !== 'undefined') {
          // 点击筛选对应等级的功能点
          window.location.hash = '#kanban';
          setTimeout(() => {
            KanbanView.setFilter('search', `grade:${label}`);
          }, 100);
        }
      }
    });
  },

  /**
   * 绘制Token仪表盘
   * @param {Object} tokenStats - Token统计
   */
  _drawTokenGauge(tokenStats) {
    const canvas = document.getElementById('token-gauge');
    if (!canvas || !tokenStats) return;

    const used = tokenStats.used || tokenStats.consumed || 0;
    const total = tokenStats.total || tokenStats.budget || 100000;
    const percent = total > 0 ? ((used / total) * 100) : 0;

    Charts.gauge('token-gauge', percent, {
      color: '#3498db',
      bgColor: '#ecf0f1',
      lineWidth: 14,
      label: 'TOKENS',
      thresholdColors: {
        warning: '#f39c12',
        danger: '#e74c3c',
        warningThreshold: 80,
        dangerThreshold: 95
      },
      animate: true
    });
  },

  /**
   * 绘制各阶段Token柱状图
   * @param {Object} tokenStats - Token统计
   */
  _drawStageTokenChart(tokenStats) {
    const canvas = document.getElementById('stage-token-chart');
    if (!canvas || !tokenStats?.byStage) return;

    const byStage = tokenStats.byStage;
    const stages = ['prd', 'extracted', 'spec', 'implementing', 'verifying'];
    const stageLabels = ['PRD', '提取', '规格', '实现', '验证'];
    const stageColors = ['#9b59b6', '#3498db', '#2ecc71', '#f39c12', '#e74c3c'];

    const values = stages.map(s => byStage[s] || 0);

    Charts.histogram('stage-token-chart', {
      labels: stageLabels,
      values: values
    }, {
      colors: stageColors,
      label: 'Tokens',
      animate: true
    });
  },

  /**
   * 绘制问题排行水平条形图
   * @param {Object} matrix - 质量矩阵
   */
  _drawIssuesBar(matrix) {
    const canvas = document.getElementById('issues-horizontal-bar');
    if (!canvas) return;

    const issueTypes = matrix?.issueTypes || matrix?.topIssues || {};

    if (Object.keys(issueTypes).length === 0) return;

    const entries = Object.entries(issueTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8); // Top 8

    Charts.horizontalBar('issues-horizontal-bar', {
      labels: entries.map(e => e[0]),
      values: entries.map(e => e[1])
    }, {
      colors: ['#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#95a5a6'],
      animate: true,
      showPercent: true,
      onClick: (index, label, value) => {
        // 可以跳转到看板视图筛选相关问题
        if (typeof KanbanView !== 'undefined') {
          App.showModal(`
            <div class="issue-detail-modal">
              <h4>${label}</h4>
              <p>共有 <strong>${value}</strong> 个此类型的问题</p>
              <p class="text-muted">点击下方按钮查看涉及的功能点</p>
              <button class="btn btn-primary" onclick="App.closeModal(); window.location.hash='#kanban';">
                查看功能点
              </button>
            </div>
          `);
        }
      }
    });
  },

  /**
   * 绘制迭代收敛曲线
   * @param {Array} iterations - 迭代列表
   */
  _drawConvergenceChart(iterations) {
    const canvas = document.getElementById('convergence-line-chart');
    if (!canvas || !Array.isArray(iterations) || iterations.length === 0) return;

    const labels = iterations.map((_, i) => `R${i + 1}`);
    const scores = iterations.map(it => it.score || 0);

    Charts.lineChart('convergence-line-chart', {
      labels: labels,
      datasets: [{
        label: '评分',
        values: scores,
        color: '#3498db'
      }]
    }, {
      threshold: 90,
      thresholdLabel: '目标线 (90分)',
      animate: true,
      showPoints: true,
      fillArea: true
    });
  },

  // ==================== 工具方法 ====================

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
  }
};

// 初始化
QualityView.init();

// 导出全局使用
window.QualityView = QualityView;
