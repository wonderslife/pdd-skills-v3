<template>
  <el-card shadow="never" class="conclusion-panel">
    <template #header>
      <span>分析结论</span>
      <el-tag size="small" :type="modeType" class="mode-tag">{{ modeText }}</el-tag>
      <span class="card-hint">
        {{ dataUntil ? '数据截止 ' + dataUntil : '' }}
        {{ batchNo ? ' · 批次 ' + batchNo : '' }}
      </span>
    </template>

    <el-empty v-if="!conclusion" description="暂无结论" :image-size="60" />

    <template v-else>
      <el-row :gutter="12">
        <el-col :span="12">
          <div class="sec-title">核心舆情事件</div>
          <el-empty v-if="!has(coreEvents)" description="需按批次范围查看（本范围无事件聚类结果）" :image-size="40" />
          <div v-for="(ev, idx) in coreEvents" :key="idx" class="event-row" @click="emit('pick-event', { title: ev.title, key: ev.clusterId, opinionId: ev.opinionId })">
            <div class="event-title">{{ idx + 1 }}. {{ ev.title || '未命名事件' }}</div>
            <div class="event-meta">
              {{ n0(ev.opinionCount) }} 条 · 负面 {{ pct(ev.negativeRate) }} · 热度 {{ n0(ev.heatSum) }}
              <span v-if="ev.channels && ev.channels.length"> · 渠道 {{ ev.channels.join('、') }}</span>
            </div>
            <div class="event-meta">{{ ev.firstTime || '-' }} → {{ ev.lastTime || '-' }}</div>
          </div>
        </el-col>
        <el-col :span="12">
          <div class="sec-title">传播路径</div>
          <el-empty v-if="!has(propagation)" description="需按批次范围查看（本范围无明细级路径）" :image-size="40" />
          <div v-for="(st, idx) in propagation" :key="idx" class="stage-row">
            <el-tag size="small" type="info">{{ st.seq }}</el-tag>
            <span class="stage-name">{{ st.channelName }}</span>
            <span class="stage-meta">{{ n0(st.opinionCount) }} 条（{{ pct(st.countShare) }}）</span>
            <span class="stage-meta">首现 {{ st.firstTime || '-' }}</span>
            <span v-if="idx > 0" class="stage-meta">间隔 {{ n0(st.gapMinutes) }} 分钟</span>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <el-row :gutter="12">
        <el-col :span="12">
          <div class="sec-title">舆论焦点</div>
          <el-table :data="focusPoints" size="small" border max-height="240">
            <el-table-column label="类型" width="80" align="center">
              <template #default="scope">{{ scope.row.kind === 'topic' ? '话题' : '地域' }}</template>
            </el-table-column>
            <el-table-column label="焦点" prop="label" min-width="140" show-overflow-tooltip />
            <el-table-column label="条数" prop="opinionCount" width="80" align="right" />
            <el-table-column label="占比" width="80" align="right">
              <template #default="scope">{{ pct(scope.row.share) }}</template>
            </el-table-column>
            <el-table-column label="负面" width="80" align="right">
              <template #default="scope">{{ pct(scope.row.negativeRate) }}</template>
            </el-table-column>
          </el-table>
        </el-col>
        <el-col :span="12">
          <div class="sec-title">潜在风险点</div>
          <el-empty v-if="!has(riskPoints)" description="未触发风险阈值" :image-size="40" />
          <div v-for="(r, idx) in riskPoints" :key="idx" class="risk-row">
            <el-tag size="small" :type="riskTag(r.level)">{{ riskLevelText(r.level) }}</el-tag>
            <span class="risk-type">{{ r.type }}</span>
            <span class="risk-detail">{{ r.detail }}</span>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <div class="sec-title">结论摘要</div>
      <div v-for="(line, idx) in narrative" :key="idx" class="narrative-line">{{ line }}</div>
    </template>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AnalysisConclusion } from '@/api/yuqing/analytics/types';

const props = defineProps<{
  conclusion?: AnalysisConclusion;
  mode?: string;
  dataUntil?: string;
  batchNo?: string;
}>();

const emit = defineEmits<{ (e: 'pick-event', payload: { title?: string; key?: any; opinionId?: any }): void }>();

const coreEvents = computed(() => props.conclusion?.coreEvents || []);
const propagation = computed(() => props.conclusion?.propagation || []);
const focusPoints = computed(() => props.conclusion?.focusPoints || []);
const riskPoints = computed(() => props.conclusion?.riskPoints || []);
const narrative = computed(() => props.conclusion?.narrative || []);

const modeText = computed(() => {
  if (props.mode === 'batch') {
    return '批次结论';
  }
  if (props.mode === 'derived') {
    return '预聚合推导';
  }
  return '无';
});

const modeType = computed(() => {
  if (props.mode === 'batch') {
    return 'success';
  }
  if (props.mode === 'derived') {
    return 'warning';
  }
  return 'info';
});

function has(list: any[]) {
  return list && list.length > 0;
}

function riskTag(level?: string) {
  if (level === 'high') {
    return 'danger';
  }
  if (level === 'medium') {
    return 'warning';
  }
  return 'info';
}

function riskLevelText(level?: string) {
  if (level === 'high') {
    return '高';
  }
  if (level === 'medium') {
    return '中';
  }
  return '低';
}

function n0(v: any) {
  return v === null || v === undefined ? '0' : String(v);
}

function pct(v: any) {
  return v === null || v === undefined ? '0%' : v + '%';
}
</script>

<style scoped>
.conclusion-panel .mode-tag {
  margin-left: 8px;
}
.card-hint {
  float: right;
  font-size: 12px;
  color: #a8abb2;
  font-weight: normal;
}
.sec-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.event-row {
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  background: #fafafa;
  margin-bottom: 6px;
}
.event-row:hover {
  background: #f0f7ff;
}
.event-title {
  font-size: 13px;
  color: #303133;
}
.event-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.stage-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 5px 4px;
  border-bottom: 1px dashed #ebeef5;
}
.stage-name {
  font-weight: 600;
  color: #303133;
  min-width: 100px;
}
.stage-meta {
  font-size: 12px;
  color: #909399;
}
.risk-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 4px;
  border-bottom: 1px dashed #ebeef5;
}
.risk-type {
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}
.risk-detail {
  font-size: 12px;
  color: #606266;
}
.narrative-line {
  font-size: 13px;
  color: #606266;
  line-height: 1.9;
}
</style>
