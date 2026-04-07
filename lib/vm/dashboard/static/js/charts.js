/**
 * Charts - Canvas 图表引擎
 * 提供雷达图、直方图、环形仪表盘、折线图、水平条形图等可视化组件
 * 纯原生 Canvas API，无外部依赖
 *
 * @module Charts
 * @version 1.0.0
 */

const Charts = {
  // ==================== 通用工具方法 ====================

  /**
   * 清空画布
   * @param {string} canvasId - Canvas 元素 ID
   */
  clearCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  },

  /**
   * 根据评分获取颜色
   * @param {number} score - 评分 (0-100)
   * @returns {string} 颜色值
   */
  getColor(score) {
    if (score >= 90) return '#27ae60';  // S - 绿色
    if (score >= 80) return '#2980b9';  // A - 蓝色
    if (score >= 70) return '#f39c12';  // B - 黄色
    if (score >= 60) return '#e67e22';  // C - 橙色
    if (score >= 40) return '#e74c3c';  // D - 红色
    return '#c0392b';                   // F - 深红
  },

  /**
   * 获取等级标签
   * @param {number} score - 评分
   * @returns {string} 等级 (S/A/B/C/D/F)
   */
  getGrade(score) {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  },

  /**
   * 动画插值
   * @param {number} start - 起始值
   * @param {number} end - 结束值
   * @param {number} progress - 进度 (0-1)
   * @param {string} easing - 缓动函数类型
   * @returns {number}
   */
  _ease(start, end, progress, easing = 'easeOutCubic') {
    const delta = end - start;
    switch (easing) {
      case 'linear':
        return start + delta * progress;
      case 'easeOutCubic':
        return start + delta * (1 - Math.pow(1 - progress, 3));
      case 'easeInOutCubic':
        return start + delta * (progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2);
      default:
        return start + delta * progress;
    }
  },

  // ==================== 雷达图 ====================

  /**
   * 绘制五维雷达图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据对象
   * @param {string[]} data.labels - 标签数组（如 ['可读性','可维护性','健壮性','性能','安全性']）
   * @param {number[]} data.values - 值数组 (0-100)
   * @param {Object} options - 配置选项
   * @param {number} [options.maxVal=100] - 最大值
   * @param {string[]} [options.colors] - 颜色数组
   * @param {number} [options.fillAlpha=0.25] - 填充透明度
   * @param {boolean} [options.animate=true] - 是否启用动画
   * @param {Function} [options.onHover] - 悬停回调
   */
  radar(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.labels || !data.values) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 50;

    const {
      maxVal = 100,
      colors = ['#3498db', '#2ecc71'],
      fillAlpha = 0.25,
      animate = true,
      onHover = null
    } = options;

    const numPoints = data.labels.length;
    const angleStep = (Math.PI * 2) / numPoints;

    let animationProgress = animate ? 0 : 1;
    let hoveredIndex = -1;

    // 绘制背景网格
    function drawGrid() {
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 1;

      // 同心多边形网格
      for (let level = 1; level <= 5; level++) {
        const r = (radius / 5) * level;
        ctx.beginPath();
        for (let i = 0; i < numPoints; i++) {
          const angle = angleStep * i - Math.PI / 2;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // 从中心到各顶点的轴线
      for (let i = 0; i < numPoints; i++) {
        const angle = angleStep * i - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius
        );
        ctx.stroke();
      }

      // 标签
      ctx.fillStyle = '#34495e';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < numPoints; i++) {
        const angle = angleStep * i - Math.PI / 2;
        const labelRadius = radius + 25;
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;
        ctx.fillText(data.labels[i], x, y);
      }
    }

    // 绘制数据区域
    function drawData(progress) {
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const value = this._ease(0, data.values[i], progress);
        const normalizedValue = Math.min(value, maxVal) / maxVal;
        const angle = angleStep * i - Math.PI / 2;
        const r = radius * normalizedValue;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // 填充
      ctx.fillStyle = colors[0] + Math.round(fillAlpha * 255).toString(16).padStart(2, '0');
      ctx.fill();

      // 边框
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 2;
      ctx.stroke();

      // 数据点
      for (let i = 0; i < numPoints; i++) {
        const value = this._ease(0, data.values[i], progress);
        const normalizedValue = Math.min(value, maxVal) / maxVal;
        const angle = angleStep * i - Math.PI / 2;
        const r = radius * normalizedValue;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        ctx.beginPath();
        ctx.arc(x, y, i === hoveredIndex ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = colors[0];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 显示数值
        if (progress >= 1 || i === hoveredIndex) {
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 11px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(Math.round(data.values[i]), x, y - 12);
        }
      }
    }.bind(this);

    // 主绘制函数
    function render() {
      ctx.clearRect(0, 0, width, height);
      drawGrid();
      drawData(animationProgress);
    }

    // 动画循环
    if (animate && animationProgress < 1) {
      const startTime = performance.now();
      const duration = 800;

      function animateFrame(currentTime) {
        animationProgress = Math.min((currentTime - startTime) / duration, 1);
        render();

        if (animationProgress < 1) {
          requestAnimationFrame(animateFrame);
        }
      }

      requestAnimationFrame(animateFrame);
    } else {
      render();
    }

    // 鼠标悬停事件
    if (onHover) {
      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let newHoveredIndex = -1;
        for (let i = 0; i < numPoints; i++) {
          const normalizedValue = Math.min(data.values[i], maxVal) / maxVal;
          const angle = angleStep * i - Math.PI / 2;
          const r = radius * normalizedValue;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
          if (distance < 10) {
            newHoveredIndex = i;
            break;
          }
        }

        if (newHoveredIndex !== hoveredIndex) {
          hoveredIndex = newHoveredIndex;
          render();
          onHover(hoveredIndex, hoveredIndex >= 0 ? {
            label: data.labels[hoveredIndex],
            value: data.values[hoveredIndex]
          } : null);
        }

        canvas.style.cursor = hoveredIndex >= 0 ? 'pointer' : 'default';
      });

      canvas.addEventListener('mouseleave', () => {
        hoveredIndex = -1;
        render();
      });
    }
  },

  // ==================== 直方图 ====================

  /**
   * 绘制直方图/柱状图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据对象
   * @param {string[]} data.labels - 标签数组
   * @param {number[]} data.values - 值数组
   * @param {Object} options - 配置选项
   * @param {string[]} [options.colors] - 柱子颜色数组
   * @param {boolean} [options.animate=true] - 是否动画
   * @param {Function} [options.onClick] - 点击回调
   * @param {string} [options.label=''] - Y轴标签
   */
  histogram(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.labels || !data.values) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 30, right: 20, bottom: 50, left: 50 };

    const {
      colors = ['#27ae60', '#2980b9', '#f39c12', '#e67e22', '#e74c3c', '#c0392b'],
      animate = true,
      onClick = null,
      label = ''
    } = options;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barCount = data.labels.length;
    const barWidth = chartWidth / barCount * 0.7;
    const barGap = chartWidth / barCount * 0.3;
    const maxValue = Math.max(...data.values, 1);

    let animationProgress = animate ? 0 : 1;

    function render() {
      ctx.clearRect(0, 0, width, height);

      // Y轴网格线和刻度
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';

      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const value = Math.round(maxValue - (maxValue / gridLines) * i);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillText(value.toString(), padding.left - 10, y + 4);
      }

      // Y轴标签
      if (label) {
        ctx.save();
        ctx.translate(15, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#34495e';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      // 绘制柱子
      data.values.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight * animationProgress;
        const x = padding.left + (chartWidth / barCount) * index + barGap / 2;
        const y = padding.top + chartHeight - barHeight;
        const color = colors[index % colors.length];

        // 柱子渐变
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, this._adjustBrightness(color, -20));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        this._roundRect(ctx, x, y, barWidth, barHeight, 4);
        ctx.fill();

        // 数值标签
        if (animationProgress >= 1) {
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 12px -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(value.toString(), x + barWidth / 2, y - 8);
        }

        // X轴标签
        ctx.fillStyle = '#34495e';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(data.labels[index], x + barWidth / 2, height - padding.bottom + 20);
      });
    }.bind(this);

    // 动画
    if (animate) {
      const startTime = performance.now();
      const duration = 600;

      function animateFrame(currentTime) {
        animationProgress = Math.min((currentTime - startTime) / duration, 1);
        render();

        if (animationProgress < 1) {
          requestAnimationFrame(animateFrame);
        }
      }

      requestAnimationFrame(animateFrame);
    } else {
      render();
    }

    // 点击事件
    if (onClick) {
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        if (mouseX >= padding.left && mouseX <= width - padding.right) {
          const index = Math.floor((mouseX - padding.left) / (chartWidth / barCount));
          if (index >= 0 && index < barCount) {
            onClick(index, data.labels[index], data.values[index]);
          }
        }
      });

      canvas.style.cursor = 'pointer';
    }
  },

  // ==================== 环形进度仪表盘 ====================

  /**
   * 绘制环形进度仪表盘
   * @param {string} canvasId - Canvas 元素 ID
   * @param {number} percent - 百分比 (0-100)
   * @param {Object} options - 配置选项
   * @param {string} [options.color='#3498db'] - 进度颜色
   * @param {string} [options.bgColor='#ecf0f1'] - 背景颜色
   * @param {number} [options.lineWidth=12] - 线宽
   * @param {string} [options.label=''] - 中心标签文字
   * @param {Object} [options.thresholdColors] - 阈值颜色配置
   * @param {boolean} [options.animate=true] - 是否动画
   */
  gauge(canvasId, percent, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    const {
      color = '#3498db',
      bgColor = '#ecf0f1',
      lineWidth = 12,
      label = '',
      thresholdColors = { warning: '#f39c12', danger: '#e74c3c', warningThreshold: 80, dangerThreshold: 95 },
      animate = true
    } = options;

    const clampedPercent = Math.min(100, Math.max(0, percent));
    let animationProgress = animate ? 0 : 1;

    // 根据阈值选择颜色
    function getGaugeColor(pct) {
      if (pct >= thresholdColors.dangerThreshold) return thresholdColors.danger;
      if (pct >= thresholdColors.warningThreshold) return thresholdColors.warning;
      return color;
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      const currentPercent = clampedPercent * animationProgress;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * currentPercent / 100);

      // 背景圆环
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 进度圆环
      if (currentPercent > 0) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = getGaugeColor(clampedPercent);
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 渐变端点圆
        const endX = centerX + Math.cos(endAngle) * radius;
        const endY = centerY + Math.sin(endAngle) * radius;
        ctx.beginPath();
        ctx.arc(endX, endY, lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = getGaugeColor(clampedPercent);
        ctx.fill();
      }

      // 中心文字
      const displayPercent = Math.round(clampedPercent * animationProgress);
      ctx.fillStyle = '#2c3e50';
      ctx.font = `bold ${radius * 0.35}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${displayPercent}%`, centerX, centerY - (label ? 10 : 0));

      // 标签
      if (label) {
        ctx.fillStyle = '#7f8c8d';
        ctx.font = `${radius * 0.14}px -apple-system, sans-serif`;
        ctx.fillText(label, centerX, centerY + radius * 0.2);
      }
    }

    // 动画
    if (animate) {
      const startTime = performance.now();
      const duration = 1000;

      function animateFrame(currentTime) {
        animationProgress = Math.min((currentTime - startTime) / duration, 1);
        // 使用 easeOutElastic 效果
        animationProgress = animationProgress === 1 ? 1 :
          Math.pow(2, -10 * animationProgress) * Math.sin((animationTime - 0.075) * (2 * Math.PI) / 0.3) + 1;
        render();

        if (animationProgress < 1) {
          requestAnimationFrame(animateFrame);
        }
      }

      let animationTime = 0;
      function wrapper(currentTime) {
        if (!startTime) startTime = currentTime;
        animationTime = (currentTime - startTime) / duration;
        animateFrame(currentTime);
      }

      requestAnimationFrame(wrapper);
    } else {
      render();
    }
  },

  // ==================== 折线图 ====================

  /**
   * 绘制折线图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据对象
   * @param {string[]} data.labels - X轴标签
   * @param {Array} data.datasets - 数据集数组，每项包含 {label, values[], color}
   * @param {Object} options - 配置选项
   * @param {number} [options.threshold] - 收敛阈值线
   * @param {string} [options.thresholdLabel=''] - 阈值标签
   * @param {boolean} [options.animate=true] - 是否动画
   * @param {boolean} [options.showPoints=true] - 是否显示数据点
   * @param {boolean} [options.fillArea=false] - 是否填充区域
   */
  lineChart(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.labels || !data.datasets) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 30, right: 20, bottom: 50, left: 50 };

    const {
      threshold = null,
      thresholdLabel = '',
      animate = true,
      showPoints = true,
      fillArea = false
    } = options;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const pointCount = data.labels.length;

    // 计算所有数据集的最大最小值
    let allValues = [];
    data.datasets.forEach(ds => allValues.push(...ds.values));
    if (threshold) allValues.push(threshold);
    const maxValue = Math.max(...allValues, 1);
    const minValue = Math.min(...allValues, 0);
    const valueRange = maxValue - minValue || 1;

    let animationProgress = animate ? 0 : 1;

    function getX(index) {
      return padding.left + (index / (pointCount - 1 || 1)) * chartWidth;
    }

    function getY(value) {
      return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      // 网格和Y轴
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#7f8c8d';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'right';

      const gridLines = 5;
      for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const value = maxValue - ((maxValue - minValue) / gridLines) * i;

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillText(Math.round(value).toString(), padding.left - 10, y + 4);
      }

      // X轴标签
      ctx.textAlign = 'center';
      ctx.fillStyle = '#34495e';
      data.labels.forEach((label, i) => {
        ctx.fillText(label, getX(i), height - padding.bottom + 20);
      });

      // 阈值线
      if (threshold !== null) {
        const thresholdY = getY(threshold);
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(padding.left, thresholdY);
        ctx.lineTo(width - padding.right, thresholdY);
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // 阈值标签
        ctx.fillStyle = '#e74c3c';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(thresholdLabel || `Threshold: ${threshold}`, width - padding.right - 80, thresholdY - 8);
      }

      // 绘制每个数据集
      data.datasets.forEach((dataset, dsIndex) => {
        const color = dataset.color || `hsl(${dsIndex * 60}, 70%, 50%)`;
        const animatedLength = Math.floor(pointCount * animationProgress);

        // 填充区域
        if (fillArea && animatedLength > 0) {
          ctx.beginPath();
          ctx.moveTo(getX(0), getY(0));

          for (let i = 0; i < animatedLength; i++) {
            ctx.lineTo(getX(i), getY(dataset.values[i]));
          }

          ctx.lineTo(getX(animatedLength - 1), getY(minValue));
          ctx.lineTo(getX(0), getY(minValue));
          ctx.closePath();

          ctx.fillStyle = color + '20';
          ctx.fill();
        }

        // 折线
        ctx.beginPath();
        for (let i = 0; i < animatedLength; i++) {
          const x = getX(i);
          const y = getY(dataset.values[i]);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 数据点
        if (showPoints) {
          for (let i = 0; i < animatedLength; i++) {
            const x =getX(i);
            const y = getY(dataset.values[i]);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 数值标签
            if (animationProgress >= 1) {
              ctx.fillStyle = '#2c3e50';
              ctx.font = '10px -apple-system, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(dataset.values[i].toString(), x, y - 10);
            }
          }
        }
      });
    }

    // 动画
    if (animate) {
      const startTime = performance.now();
      const duration = 800;

      function animateFrame(currentTime) {
        animationProgress = Math.min((currentTime - startTime) / duration, 1);
        render();

        if (animationProgress < 1) {
          requestAnimationFrame(animateFrame);
        }
      }

      requestAnimationFrame(animateFrame);
    } else {
      render();
    }
  },

  // ==================== 水平条形图 ====================

  /**
   * 绘制水平条形图
   * @param {string} canvasId - Canvas 元素 ID
   * @param {Object} data - 数据对象
   * @param {string[]} data.labels - 标签数组
   * @param {number[]} data.values - 值数组
   * @param {Object} options - 配置选项
   * @param {string[]} [options.colors] - 条形颜色
   * @param {boolean} [options.animate=true] - 是否动画
   * @param {Function} [options.onClick] - 点击回调
   * @param {boolean} [options.showPercent=true] - 显示百分比
   */
  horizontalBar(canvasId, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data.labels || !data.values) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 20, right: 60, bottom: 20, left: 100 };

    const {
      colors = ['#e74c3c', '#f39c12', '#3498db', '#9b59b6', '#1abc9c'],
      animate = true,
      onClick = null,
      showPercent = true
    } = options;

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barCount = data.labels.length;
    const barHeight = chartHeight / barCount * 0.65;
    const barGap = chartHeight / barCount * 0.35;
    const maxValue = Math.max(...data.values, 1);
    const total = data.values.reduce((a, b) => a + b, 0);

    let animationProgress = animate ? 0 : 1;

    function render() {
      ctx.clearRect(0, 0, width, height);

      // 网格线
      ctx.strokeStyle = '#ecf0f1';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 4; i++) {
        const x = padding.left + (chartWidth / 4) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }

      // 条形
      data.values.forEach((value, index) => {
        const y = padding.top + (chartHeight / barCount) * index + barGap / 2;
        const barWidthAnimated = (value / maxValue) * chartWidth * animationProgress;
        const color = colors[index % colors.length];

        // 背景
        ctx.fillStyle = '#f8f9fa';
        ctx.beginPath();
        this._roundRect(ctx, padding.left, y, chartWidth, barHeight, 3);
        ctx.fill();

        // 前景
        if (barWidthAnimated > 0) {
          const gradient = ctx.createLinearGradient(padding.left, y, padding.left + barWidthAnimated, y);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, this._adjustBrightness(color, -15));

          ctx.fillStyle = gradient;
          ctx.beginPath();
          this._roundRect(ctx, padding.left, y, barWidthAnimated, barHeight, 3);
          ctx.fill();
        }

        // 标签
        ctx.fillStyle = '#34495e';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(data.labels[index], padding.left - 10, y + barHeight / 2);

        // 数值和百分比
        if (animationProgress >= 1) {
          ctx.fillStyle = '#2c3e50';
          ctx.font = 'bold 11px -apple-system, sans-serif';
          ctx.textAlign = 'left';

          const textX = padding.left + barWidthAnimated + 8;
          let labelText = value.toString();
          if (showPercent && total > 0) {
            labelText += ` (${Math.round(value / total * 100)}%)`;
          }
          ctx.fillText(labelText, textX, y + barHeight / 2);
        }
      });
    }.bind(this);

    // 动画
    if (animate) {
      const startTime = performance.now();
      const duration = 600;

      function animateFrame(currentTime) {
        animationProgress = Math.min((currentTime - startTime) / duration, 1);
        render();

        if (animationProgress < 1) {
          requestAnimationFrame(animateFrame);
        }
      }

      requestAnimationFrame(animateFrame);
    } else {
      render();
    }

    // 点击事件
    if (onClick) {
      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        if (mouseY >= padding.top && mouseY <= height - padding.bottom) {
          const index = Math.floor((mouseY - padding.top) / (chartHeight / barCount));
          if (index >= 0 && index < barCount) {
            onClick(index, data.labels[index], data.values[index]);
          }
        }
      });

      canvas.style.cursor = 'pointer';
    }
  },

  // ==================== 内部工具方法 ====================

  /**
   * 绘制圆角矩形路径
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} r - 圆角半径
   */
  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y + r, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  /**
   * 调整颜色亮度
   * @param {string} color - 十六进制颜色
   * @param {number} amount - 调整量 (-255 到 255)
   * @returns {string}
   */
  _adjustBrightness(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
};

// 导出全局使用
window.Charts = Charts;
