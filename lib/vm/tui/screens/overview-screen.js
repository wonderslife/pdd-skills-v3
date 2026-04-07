/**
 * PDD Visual Manager - 总览屏幕 (VM-C020)
 *
 * OverviewScreen 展示项目整体状态：
 * - 项目基本信息和进度
 * - 核心指标卡片（功能点数、通过率、平均分、Token消耗、迭代次数、缓存命中率）
 * - Pipeline 流水线可视化（各阶段分布）
 * - 最近活动时间线
 *
 * 布局结构:
 * ┌──────────────────────────────────────────────┐
 * │  顶栏: 项目名 | 进度条 | 时间                │
 * ├──────────┬──────────┬────────────────────────┤
 * │ 3张汇总卡│  3张汇总卡    │                    │
 * ├──────────┴──────────┴────────────────────────┤
 * │ Pipeline: PRD→Ext→Spec→Imp→Ver→Done         │
 * ├──────────────────────────────────────────────┤
 * │ 最近活动时间线                                │
 * └──────────────────────────────────────────────┘
 */

import { ANSI } from '../renderer.js';
import Card from '../components/card.js';
import ProgressBar from '../components/progress-bar.js';
import Table from '../components/table.js';

/**
 * OverviewScreen - 总览屏
 *
 * 静态方法类，接收 provider 和 renderer 参数进行渲染。
 */
class OverviewScreen {
  /**
   * 渲染总览屏幕
   * @param {PDDDataProvider} provider - 数据提供者
   * @param {Renderer} renderer - 渲染器实例
   * @returns {string} 完整的屏幕内容字符串
   */
  static render(provider, renderer) {
    const r = renderer;
    const w = r.width;
    const h = r.height;

    // 获取数据
    const summary = provider.getSummary() || {};
    const features = provider.getFeatures() || [];
    const qualityMatrix = provider.getQualityMatrix() || {};
    const tokenStats = provider.getTokenStats() || {};
    const cacheStats = provider.getCacheStats() || {};

    // 计算派生值
    const totalFeatures = summary.totalFeatures || features.length || 0;
    const progress = summary.overallProgress || 0;
    const avgScore = summary.avgQualityScore || 0;
    const avgIterations = summary.avgIterations || 0;
    const stageDist = summary.stageDistribution || {};
    const totalTokens = tokenStats.used || summary.totalTokens || 0;
    const tokenLimit = tokenStats.total || 60000;

    // 通过率计算
    let passRate = 0;
    if (totalFeatures > 0) {
      const doneCount = (stageDist['done'] || 0) + (stageDist['verifying'] || 0);
      passRate = Math.round((doneCount / totalFeatures) * 100);
    }

    // 缓存命中率
    const cacheHitRate = cacheStats.hitRate || 0;

    let output = '';

    // ========== 1. 顶栏 ==========
    output += _renderTopBar(r, summary, progress, w);

    output += '\n';

    // ========== 2. 指标卡片区域 (3列布局) ==========
    output += _renderMetricCards(r, {
      totalFeatures,
      passRate,
      avgScore,
      totalTokens,
      tokenLimit,
      avgIterations,
      cacheHitRate
    }, w);

    output += '\n';

    // ========== 3. Pipeline 流水线 ==========
    output += _renderPipeline(r, stageDist, totalFeatures, w);

    output += '\n';

    // ========== 4. 最近活动 ==========
    output += _renderActivityTimeline(r, features, h);

    return output;
  }
}

// ============================================================
// 私有渲染函数
// ============================================================

/**
 * 渲染顶栏
 */
function _renderTopBar(r, summary, progress, w) {
  const projectName = summary.name || 'PDD Project';
  const version = summary.version || '';
  const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  // 项目名称 + 版本
  const title = r.bold(r.cyan(`📊 ${projectName}`)) +
    (version ? r.dim(` v${version}`) : '');

  // 进度条
  const pb = new ProgressBar(progress, 100, 20, {
    showLabel: false,
    showPercent: true
  });
  const progressBarStr = pb.render();

  // 组合顶栏
  const leftPart = `${title}   进度: ${progressBarStr}`;
  const rightPart = r.dim(now);

  const leftWidth = r.strWidth(leftPart);
  const rightWidth = r.strWidth(rightPart);
  const middlePad = Math.max(2, w - leftWidth - rightWidth);

  return leftPart + ' '.repeat(middlePad) + rightPart;
}

/**
 * 渲染指标卡片区域
 */
function _renderMetricCards(r, metrics, w) {
  const { totalFeatures, passRate, avgScore, totalTokens, tokenLimit,
          avgIterations, cacheHitRate } = metrics;

  // 定义6个指标卡片
  const cardData = [
    {
      label: '功能点',
      value: String(totalFeatures),
      sub: `通过率: ${passRate}%`,
      color: ANSI.CYAN
    },
    {
      label: '平均分',
      value: String(avgScore),
      sub: `迭代: ${avgIterations}`,
      color: ANSI.YELLOW
    },
    {
      label: 'Token',
      value: _formatTokens(totalTokens),
      sub: `/${_formatTokens(tokenLimit)}`,
      color: ANSI.MAGENTA
    },
    {
      label: '缓存',
      value: `${cacheHitRate.toFixed(1)}%`,
      sub: '命中率',
      color: ANSI.GREEN
    },
    {
      label: '质量',
      value: _gradeFromScore(avgScore),
      sub: `${avgScore}/100`,
      color: _gradeColor(avgScore)
    },
    {
      label: '活跃',
      value: String(Math.round(avgIterations * 10) / 10),
      sub: '平均迭代',
      color: ANSI.BLUE
    }
  ];

  // 将卡片分为两行，每行3个
  const cardWidth = Math.floor((w - 8) / 3); // 减去间距

  let output = '';

  for (let row = 0; row < 2; row++) {
    const rowCards = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const data = cardData[idx];
      const cardContent = [
        '',
        `  ${data.color}${r.bold(data.value)}${ANSI.RESET}`,
        `  ${r.dim(data.sub)}`,
        ''
      ];
      const card = new Card(data.label, cardContent, {
        width: cardWidth,
        borderStyle: 'rounded',
        padding: { x: 1, y: 0 }
      });
      rowCards.push(card.render());
    }
    output += rowCards.join('  ') + '\n';
  }

  return output.trimEnd();
}

/**
 * 渲染 Pipeline 流水线
 */
function _renderPipeline(r, stageDist, totalFeatures, w) {
  const stages = [
    { key: 'prd', label: 'PRD', short: 'PRD' },
    { key: 'extracted', label: 'Extract', short: 'Ext' },
    { key: 'spec', label: 'Spec', short: 'Spec' },
    { key: 'implementing', label: 'Implement', short: 'Imp' },
    { key: 'verifying', label: 'Verify', short: 'Ver' },
    { key: 'done', label: 'Done', short: 'Done' }
  ];

  // 构建流水线文本
  let pipelineText = 'Pipeline: ';
  for (const stage of stages) {
    const count = stageDist[stage.key] || 0;
    pipelineText += `${stage.short}(${count})`;
    if (stage.key !== 'done') pipelineText += ' → ';
  }

  output = r.bold(pipelineText) + '\n\n';

  // 绘制进度条形式的流水线
  const barChars = ['░', '▒', '▓', '█'];
  let barLine = '';
  const totalStages = stages.length;

  for (let i = 0; i < totalStages; i++) {
    const stage = stages[i];
    const count = stageDist[stage.key] || 0;
    const maxInStage = Math.max(1, ...stages.map(s => stageDist[s.key] || 0));
    const ratio = count / maxInStage;

    // 每个阶段占用一定宽度
    const segWidth = Math.max(2, Math.floor((w - 10) / totalStages));
    const filled = Math.ceil(segWidth * ratio);

    // 根据阶段选择颜色
    const stageColors = [ANSI.RED, ANSI.YELLOW, ANSI.BRIGHT_YELLOW, ANSI.BRIGHT_CYAN, ANSI.GREEN, ANSI.BRIGHT_GREEN];
    const color = stageColors[i] || ANSI.DIM;

    barLine += color + barChars[3].repeat(filled) + barChars[0].repeat(segWidth - filled) + ANSI.RESET;
    if (i < totalStages - 1) barLine += ' ';
  }

  output += barLine;

  return output;
}

/**
 * 渲染最近活动时间线
 */
function _renderActivityTimeline(r, features, screenHeight) {
  const maxItems = Math.min(8, Math.floor(screenHeight / 2) - 5);

  // 模拟最近活动（从功能点的时间线中提取）
  const activities = [];

  // 收集各功能点的最新活动
  const sortedFeatures = [...features]
    .filter(f => f.updatedAt || f.createdAt)
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, maxItems);

  for (const f of sortedFeatures) {
    const ts = f.updatedAt || f.createdAt || 0;
    const timeStr = new Date(ts).toLocaleTimeString('zh-CN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 根据阶段决定图标
    const stageIcons = {
      prd: '📋',
      extracted: '🔍',
      spec: '📝',
      implementing: '🔨',
      verifying: '✅',
      done: '✨'
    };
    const icon = stageIcons[f.stage] || '📌';

    activities.push({
      icon,
      name: f.name || f.id || '(unnamed)',
      stage: f.stage,
      time: timeStr
    });
  }

  let output = '';

  // 分隔线
  output += r.separator('─', r.width);
  output += '\n';

  // 标题
  output += r.bold(' 最近活动') + '\n';
  output += r.separator('─', r.width);
  output += '\n';

  if (activities.length === 0) {
    output += r.dim('  暂无活动记录\n');
  } else {
    for (const act of activities) {
      const nameTruncated = r.truncate(act.name, r.width - 20);
      output += ` ${act.icon} ${nameTruncated}`;
      output += r.dim(`  ${act.time}\n`);
    }
  }

  return output;
}

// ============================================================
// 工具函数
// ============================================================

function _formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return String(n);
}

function _gradeFromScore(score) {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function _gradeColor(score) {
  if (score >= 85) return ANSI.GREEN;
  if (score >= 70) return ANSI.BRIGHT_GREEN;
  if (score >= 55) return ANSI.YELLOW;
  if (score >= 40) return ANSI.BRIGHT_RED;
  return ANSI.RED;
}

export default OverviewScreen;
