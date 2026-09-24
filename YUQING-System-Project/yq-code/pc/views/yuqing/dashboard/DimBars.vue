<template>
  <div class="dim-bars">
    <div v-if="!items || items.length === 0" class="empty">暂无数据</div>
    <div v-for="it in items" :key="it.dimKey" class="dim-row" @click="emit('pick', it)">
      <div class="dim-head">
        <span class="dim-label" :title="it.dimLabel">{{ it.dimLabel || it.dimKey }}</span>
        <span class="dim-value">{{ n0(it.opinionCount) }} 条 · {{ pct(it.share) }}</span>
      </div>
      <div class="dim-track">
        <div class="dim-fill" :style="barStyle(it)"></div>
        <div v-if="it.negativeRate" class="dim-neg" :style="negStyle(it)"></div>
      </div>
      <div class="dim-foot">
        <span>负面 {{ pct(it.negativeRate) }}</span>
        <span class="dim-link">下钻</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DimItem } from '@/api/yuqing/analytics/types';

const props = defineProps<{ items?: DimItem[] }>();
const emit = defineEmits<{ (e: 'pick', item: DimItem): void }>();

function barStyle(it: DimItem) {
  const w = Math.max(2, Math.min(100, it.share || 0));
  return { width: w + '%' };
}

/** 负面占比用一段红色叠加条表示，占比越高越显眼 */
function negStyle(it: DimItem) {
  const total = it.share || 0;
  if (total <= 0) {
    return { width: '0%' };
  }
  const negShare = (it.share || 0) * ((it.negativeRate || 0) / 100);
  return { width: Math.max(0, Math.min(100, negShare)) + '%' };
}

function n0(v: any) {
  return v === null || v === undefined ? '0' : String(v);
}

function pct(v: any) {
  return v === null || v === undefined ? '0%' : v + '%';
}
</script>

<style scoped>
.dim-bars {
  max-height: 300px;
  overflow-y: auto;
}
.dim-row {
  cursor: pointer;
  padding: 5px 2px;
  border-bottom: 1px dashed #ebeef5;
}
.dim-row:hover {
  background: #f5f7fa;
}
.dim-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #303133;
}
.dim-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
}
.dim-value {
  color: #606266;
}
.dim-track {
  position: relative;
  height: 8px;
  background: #f0f2f5;
  border-radius: 4px;
  margin: 4px 0;
  overflow: hidden;
}
.dim-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #409eff;
  border-radius: 4px;
}
.dim-neg {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #f56c6c;
  border-radius: 4px;
}
.dim-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #a8abb2;
}
.dim-link {
  color: #409eff;
}
.empty {
  color: #a8abb2;
  font-size: 13px;
  padding: 8px 0;
}
</style>
