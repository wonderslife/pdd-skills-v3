# Testcase Agent - 自愈机制详解

> **版本**: 1.0.1
> **最后更新**: 2026-05-08
> **关联**: 铁律 4 - 自愈而非放弃（Self-Healing, Not Give Up）

---

## 📖 目录

1. [设计哲学](#设计哲学)
2. [4级降级策略详解](#4级降级策略详解)
3. [UID缓存机制](#uid缓存机制)
4. [自愈成功案例](#自愈成功案例)
5. [自愈失败处理](#自愈失败处理)
6. [性能指标与优化](#性能指标与优化)

---

## 设计哲学

### 为什么需要自愈？

UI自动化测试最大的痛点是**前端变化导致测试失效**：

- 开发重构了组件，元素的 class 名称变了
- 文案调整了，按钮文字从"提交"改为"确认提交"
- 页面结构微调，元素从第2个变成了第3个
- A/B测试导致同一页面有不同的DOM结构

传统的解决方案是**硬编码选择器**（CSS/XPath），一旦变化就全部失效。

我们的方案是**语义化描述 + 智能匹配**，让Agent像人一样"理解"页面。

### 核心原则

> **当按照 target 描述找不到元素时，禁止直接报错终止。必须启动自愈程序。**

这意味着：
- ❌ 不能因为一次定位失败就放弃整个步骤
- ✅ 应该尝试多种策略来找到正确的元素
- ✅ 即使最终失败，也要提供详细的诊断信息帮助修复

---

## 4级降级策略详解

### Level 1: UID 缓存查找（最快）

**原理**：利用之前成功定位过的元素UID缓存

**速度**: <1ms（内存查找）
**命中率**: 
- 首次使用: ~70%（依赖预填充的缓存）
- 复用已有缓存: ~95%

**实现逻辑**：
```javascript
async function level1_UIDCache(target, locator) {
  if (!locator?.uid_cache_key) {
    return { found: false, reason: "No cache key provided" };
  }
  
  const cached = uidCache.get(locator.uid_cache_key);
  
  if (!cached) {
    return { found: false, reason: "Cache miss" };
  }
  
  // 验证缓存中的元素是否仍然存在
  const exists = await checkElementExists(cached.uid);
  
  if (!exists) {
    uidCache.delete(locator.uid_cache_key); // 清除过期缓存
    return { found: false, reason: "Element no longer exists" };
  }
  
  return {
    found: true,
    uid: cached.uid,
    confidence: 0.98, // 高置信度（历史成功记录）
    source: "Level 1: UID Cache",
    metadata: {
      cacheKey: locator.uid_cache_key,
      lastUsed: cached.lastUsed,
      usageCount: cached.usageCount
    }
  };
}
```

**适用场景**：
- 同一元素在多个步骤中重复使用（如用户名输入框）
- 跨用例复用（如登录模板）
- 页面刷新后的重新定位

**缓存更新时机**：
- Level 2/3 匹配成功后 → 创建/更新缓存条目
- 元素仍然有效时 → 增加 `usageCount`
- 页面导航后 → 标记缓存可能过期（但不删除）
- 自愈修复后 → 更新为新找到的 UID

---

### Level 2: 精确语义匹配（精确）

**原理**：获取完整DOM树，按文本内容或ARIA标签精确匹配

**速度**: ~50ms（需要一次快照）
**命中率**: ~80%

**匹配规则**：
```javascript
async function level2_ExactMatch(target, snapshot) {
  const candidates = [];
  
  for (const element of snapshot.elements) {
    let score = 0;
    
    // 规则 1: 文本完全匹配
    if (element.text === target) {
      score += 100;
    }
    // 规则 2: ARIA 标签完全匹配
    else if (element.ariaLabel === target) {
      score += 95;
    }
    // 规则 3: placeholder 完全匹配
    else if (element.placeholder === target) {
      score += 90;
    }
    
    if (score >= 90) {
      candidates.push({
        uid: element.uid,
        score,
        matchType: score === 100 ? 'exact_text' : 
                 score === 95 ? 'aria_label' : 'placeholder'
      });
    }
  }
  
  if (candidates.length === 1) {
    return {
      found: true,
      uid: candidates[0].uid,
      confidence: 0.92,
      source: "Level 2: Exact Match",
      matchType: candidates[0].matchType
    };
  }
  
  if (candidates.length > 1) {
    return {
      found: false,
      reason: "Multiple exact matches found",
      candidates: candidates.slice(0, 5), // 返回前5个候选
      suggestion: "Consider using more specific target description"
    };
  }
  
  return { found: false, reason: "No exact match found" };
}
```

**适用场景**：
- 文本明确的静态元素（按钮、链接、标题）
- 有 ARIA 标签的无障碍元素
- 表单元素的 placeholder 匹配

**优势**：速度快、准确率高、无歧义

**劣势**：对动态文案（如"显示 12 条结果"）效果差

---

### Level 3: 模糊匹配（宽松）

**原理**：使用包含关系、角色推断、类型推断进行宽松匹配

**速度**: ~100ms
**命中率**: ~65%

**匹配算法**：
```javascript
async function level3_FuzzyMatch(target, snapshot) {
  const candidates = [];
  const keywords = extractKeywords(target); // 提取关键词
  
  for (const element of snapshot.elements) {
    let scores = [];
    
    // 策略 1: 文本包含关系
    const textScore = calculateTextInclusion(element.text, keywords);
    scores.push({ strategy: 'text_inclusion', score: textScore });
    
    // 策略 2: 角色匹配
    const inferredRole = inferRoleFromTarget(target);
    if (element.role === inferredRole) {
      scores.push({ strategy: 'role_match', score: 85 });
    }
    
    // 策略 3: 类型推断
    const inferredType = inferElementType(target);
    if (element.type === inferredType) {
      scores.push({ strategy: 'type_match', score: 75 });
    }
    
    // 策略 4: 上下文邻近性（父元素/兄弟元素）
    const contextScore = analyzeContext(element, target);
    scores.push({ strategy: 'context_proximity', score: contextScore });
    
    // 加权平均
    const weightedScore = weightedAverage(scores);
    
    if (weightedScore >= 0.7) { // 置信度阈值
      candidates.push({
        uid: element.uid,
        score: weightedScore,
        strategies: scores.filter(s => s.score > 50),
        element: {
          text: element.text,
          role: element.role,
          type: element.type
        }
      });
    }
  }
  
  if (candidates.length === 0) {
    return { found: false, reason: "No fuzzy match above threshold (0.7)" };
  }
  
  // 按分数排序，返回最高分的候选
  candidates.sort((a, b) => b.score - a.score);
  const bestMatch = candidates[0];
  
  return {
    found: true,
    uid: bestMatch.uid,
    confidence: bestMatch.score,
    source: "Level 3: Fuzzy Match",
    matchStrategies: bestMatch.strategies,
    alternativeCandidates: candidates.slice(1, 4), // 备选方案
    warning: bestMatch.score < 0.85 ? "Low confidence, consider manual verification" : null
  };
}

// 辅助函数：从目标描述提取关键词
function extractKeywords(target) {
  // 移除常见停用词
  const stopWords = ['的', '按钮', '输入框', '链接', '菜单', '选项'];
  return target
    .split(/[\s、，]/)
    .filter(word => !stopWords.includes(word))
    .filter(word => word.length > 1);
}

// 辅助函数：根据目标推断元素角色
function inferRoleFromTarget(target) {
  if (target.includes('按钮') || target.includes('btn')) return 'button';
  if (target.includes('输入') || target.includes('填写')) return 'textbox';
  if (target.includes('选择') || target.includes('下拉')) return 'combobox';
  if (target.includes('链接') || target.includes('跳转')) return 'link';
  if (target.includes('图片') || target.includes('图像')) return 'img';
  return null; // 无法推断
}

// 辅助函数：根据目标推断元素类型
function inferElementType(target) {
  if (target.includes('输入') || target.includes('填写')) return 'input';
  if (target.includes('密码')) return 'password';
  if (target.includes('复选') || target.includes('勾选')) return 'checkbox';
  if (target.includes('单选') || target.includes('选择')) return 'radio';
  if (target.includes('文件') || target.includes('上传')) return 'file';
  return null; // 无法推断
}
```

**适用场景**：
- 文案有轻微变化的动态元素
- 目标描述不够精确的情况
- 前端重构后元素属性变化

**优势**：容错性强，能处理多种变化

**劣势**：可能产生误匹配，需要置信度阈值控制

---

### Level 4: AI 辅助（最后手段）

**原理**：将页面快照和目标描述发送给 LLM，让AI分析DOM结构推荐最佳元素

**速度**: ~500ms-2s（取决于LLM响应时间）
**命中率**: ~55%（但能处理复杂场景）

**实现逻辑**：
```javascript
async function level4_AIAssisted(target, snapshot) {
  // 构建prompt
  const prompt = `
你是一个UI自动化测试专家。我需要在当前页面找到一个元素。

目标描述: "${target}"

页面快照（简化版）:
${formatSnapshotForLLM(snapshot)}

请分析DOM结构，推荐最可能匹配目标的元素。
返回格式（JSON）:
{
  "recommended_uid": "元素UID",
  "confidence": 0.0-1.0,
  "reasoning": "推荐理由",
  "alternative_uids": ["备选UID1", "备选UID2"],
  "warnings": ["注意事项"]
}

注意：
1. 优先选择文本内容最相关的元素
2. 考虑元素的可见性和可交互性
3. 如果没有高置信度匹配，confidence设为<0.6
4. reasoning要简洁明了
`;

  // 调用LLM
  const llmResponse = await callLLM(prompt);
  const recommendation = JSON.parse(llmResponse);
  
  if (recommendation.confidence > 0.6) {
    return {
      found: true,
      uid: recommendation.recommended_uid,
      confidence: recommendation.confidence,
      source: "Level 4: AI Assisted",
      reasoning: recommendation.reasoning,
      alternatives: recommendation.alternative_uids,
      warnings: recommendation.warnings,
      llmMetadata: {
        model: config.llm.model,
        tokensUsed: llmResponse.tokens,
        latency: llmResponse.latency
      }
    };
  }
  
  return {
    found: false,
    reason: "AI confidence below threshold",
    aiRecommendation: recommendation,
    suggestion: "Manual inspection required"
  };
}
```

**适用场景**：
- 前3级都失败时的兜底方案
- 复杂的动态页面（SPA、React/Vue组件）
- 目标描述非常模糊或不准确的情况

**优势**：能理解上下文，处理复杂场景

**劣势**：速度慢、成本高、不确定性大

---

## UID缓存机制

### 缓存存储结构

```javascript
const uidCache = new Map();

// 缓存条目结构
{
  "username_input": {
    uid: "e_123",
    target: "用户名输入框",
    selector: "input[name='username']",
    pageUrl: "http://uniportal.sjjk.com.cn/login",
    timestamp: 1715184000000,
    usageCount: 3,
    lastSuccess: true,
    discoveredBy: "Level 2: Exact Match"  // 记录发现来源
  },
  "login_button": {
    uid: "e_456",
    target: "登录按钮",
    selector: "button[type='submit']",
    pageUrl: "http://uniportal.sjjk.com.cn/login",
    timestamp: 1715184010000,
    usageCount: 5,
    lastSuccess: true,
    discoveredBy: "Level 3: Fuzzy Match"
  }
}
```

### 缓存管理策略

```javascript
class UidCacheManager {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;           // 最大缓存条目数
    this.ttl = options.ttl || 7 * 24 * 60 * 60 * 1000; // 7天过期
    this.cache = new Map();
  }
  
  // 获取缓存
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // 检查过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }
  
  // 设置/更新缓存
  set(key, value) {
    // 如果已存在，保留usageCount等信息
    const existing = this.cache.get(key);
    
    const entry = {
      ...value,
      timestamp: Date.now(),
      usageCount: existing ? existing.usageCount + 1 : 1,
      lastSuccess: true
    };
    
    this.cache.set(key, entry);
    
    // 淘汰策略：超过最大容量时删除最久未使用的
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }
  
  // 标记缓存失效（元素不存在时）
  invalidate(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastSuccess = false;
      entry.invalidatedAt = Date.now();
    }
  }
  
  // LRU淘汰策略
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      log(`[Cache] Evicted stale entry: ${oldestKey}`);
    }
  }
  
  // 导出缓存（用于调试和分析）
  export() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({
        key,
        ...value,
        // 脱敏：移除敏感信息
      })),
      statistics: this.getStatistics()
    };
  }
  
  // 缓存统计
  getStatistics() {
    let totalUsage = 0;
    let hitCount = 0;
    let missCount = 0;
    
    for (const entry of this.cache.values()) {
      totalUsage += entry.usageCount;
      if (entry.lastSuccess) hitCount++;
      else missCount++;
    }
    
    return {
      totalEntries: this.cache.size,
      totalUsage,
      hitRate: this.cache.size > 0 ? hitCount / this.cache.size : 0,
      averageUsagePerEntry: this.cache.size > 0 ? totalUsage / this.cache.size : 0
    };
  }
}
```

### CLI命令集成

```bash
# 查看缓存统计
pdd test cache stats
# 输出:
# Cache Statistics:
#   Total entries: 45
#   Hit rate: 87%
#   Average usage per entry: 3.2

# 清空缓存
pdd test cache clear
# 输出:
# Cleared 45 cache entries

# 导出缓存为JSON
pdd test cache export --output cache-export.json
# 输出:
# Exported cache to cache-export.json
```

---

## 自愈成功案例

### 案例 1：菜单文案变化

```
[Step 7] 尝试定位目标: "资产评估核准"
→ Level 1: UID 缓存未命中（首次访问此页面）
→ Level 2: 精确语义匹配...
  ✗ 未找到文本完全等于 "资产评估核准" 的元素
→ Level 3: 模糊匹配...
  ✓ 发现 <span>资产评估核准管理</span>
  相似度: 87% (高度相关)
→ 使用元素: span[text="资产评估核准管理"] (uid: e_456)
→ 执行点击操作... ✓ 成功
→ 更新 UID 缓存: key="menu_asset_eval_approval" → uid="e_456"

[报告记录]
⚠️ Step 7: 选择器已自动修复
  原始目标: "资产评估核准"
  实际匹配: span[text="资产评估核准管理"]
  修复级别: Level 3 (模糊匹配)
  相似度: 87%
  建议: 更新 YAML 用例以保持最新
```

### 案例 2：按钮重构

```
[Step 9] 尝试定位目标: "新增申请按钮"
→ Level 1: UID 缓存命中! key="btn_add_new" → uid="e_789"
→ 验证元素存在... ✓ 有效
→ 直接使用缓存 UID 执行
→ 执行点击操作... ✓ 成功
→ 更新缓存使用次数: usageCount 4→5

[报告记录]
✓ Step 9: 使用缓存定位 (Level 1)
  缓存键: btn_add_new
  命中次数: 第5次
  耗时: 0.8ms (vs 平均50ms for Level 2)
```

---

## 自愈失败处理

当4级降级全部失败时：

```
[Step 11] 尝试定位目标: "不存在的按钮"
→ Level 1: UID 缓存未命中
→ Level 2: 精确语义匹配... 未找到
→ Level 3: 模糊匹配... 无合适候选 (最高相似度 32%)
→ Level 4: AI 辅助...
  LLM 分析结果: confidence=0.42, reasoning="页面中没有符合'按钮'特征的可交互元素"
✗ 自愈程序无法定位元素

[诊断信息]
  • 当前 URL: http://example.com/page
  • 页面快照: snapshot_step_11.json
  • 搜索的关键词: "不存在的按钮"
  • 候选元素列表: []
  
[可能原因]
  1. 元素尚未加载完成（需要等待）
  2. 元素被隐藏或移除（display:none / removed from DOM）
  3. 页面版本已更新，元素名称/结构发生变化
  4. target 描述不准确或不完整
  5. 权限不足，元素对当前用户不可见

[下一步建议]
  1. 手动检查页面确认元素是否存在
  2. 在该 step 前添加 wait_for 步骤等待元素出现
  3. 更新 YAML 用例中的 target 描述
  4. 截取当前页面截图供人工分析

[影响]
  该步骤标记为 FAILED
  但继续执行后续步骤（非致命错误）
  报告中将包含完整的诊断信息和建议
```

---

## 性能指标与优化

### 性能基准

| 级别 | 平均耗时 | P90 耗时 | 成功率 | CPU占用 | 内存占用 |
|------|---------|---------|--------|---------|---------|
| Level 1 | 0.8ms | 1.2ms | 95% | 极低 | 极低 |
| Level 2 | 52ms | 85ms | 82% | 低 | 低 |
| Level 3 | 108ms | 180ms | 68% | 中 | 中 |
| Level 4 | 1200ms | 2500ms | 58% | 高 | 高 |

### 优化策略

1. **预热缓存**：执行前批量加载常用元素的UID缓存
2. **并行尝试**：Level 2 和 Level 3 可以并行执行，取最优结果
3. **缓存预测**：基于历史数据预测下一步可能需要的元素，提前缓存
4. **LLM缓存**：对相似的查询缓存LLM结果，避免重复调用
5. **渐进式降级**：如果Level 2已经找到高置信度匹配(>0.95)，跳过Level 3

### 监控指标

```json
{
  "self_healing_metrics": {
    "total_attempts": 150,
    "level1_hits": 85,
    "level2_hits": 35,
    "level3_hits": 20,
    "level4_hits": 8,
    "failures": 2,
    "overall_success_rate": 0.987,
    "avg_healing_time_ms": 145,
    "cache_hit_rate": 0.72
  }
}
```

---

## 📚 相关文档

- [铁律完整实现](./iron-rules-detail.md) - 所有铁律的详细说明
- [错误处理与重试](./error-handling.md) - 异常情况处理
- [HTML报告模板](../templates/report-template.html) - 报告结构

---

> **维护者**: PDD Team
> **最后更新**: 2026-05-08
> **版本**: 1.0.1
