<template>
  <el-drawer v-model="visible" :title="view.clusterTitle || '事件聚合'" size="58%" append-to-body>
    <div v-loading="loading">
      <el-descriptions :column="3" size="small" border class="mb12">
        <el-descriptions-item label="关联舆情">{{ view.opinionCount ?? 0 }} 条</el-descriptions-item>
        <el-descriptions-item label="首次出现">{{ view.firstTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="最后出现">{{ view.lastTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="峰值热度">{{ view.peakHeat ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <dict-tag :options="yq_risk_level" :value="view.riskLevel" />
        </el-descriptions-item>
        <el-descriptions-item label="阶段分布">
          <el-tag v-for="s in stageRows" :key="s.stage" size="small" class="mr4">
            {{ s.label }} {{ s.count }}
          </el-tag>
          <span v-if="stageRows.length === 0">—</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="view.timelineTruncated"
        title="关联舆情较多，时间轴仅展示前若干节点；完整列表见下方表格。"
        type="warning"
        :closable="false"
        class="mb12"
      />

      <el-card shadow="never" class="mb12">
        <template #header><span class="blk-title">传播脉络</span></template>
        <el-timeline>
          <el-timeline-item
            v-for="n in view.timeline || []"
            :key="n.opinionId"
            :timestamp="n.time + '（' + basisText(n.timeBasis) + '）'"
            :type="stageType(n.stage)"
            placement="top"
          >
            <div class="node">
              <el-tag size="small" :type="stageType(n.stage)">{{ stageText(n.stage) }}</el-tag>
              <el-link v-if="n.opinionUrl" type="primary" :href="n.opinionUrl" target="_blank" class="node-title">
                {{ n.title }}
              </el-link>
              <span v-else class="node-title">{{ n.title }}</span>
              <span class="node-meta">
                {{ n.channelName || '—' }} / {{ n.author || '匿名' }} / 热度 {{ n.heatScore ?? '—' }}
              </span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="(view.timeline || []).length === 0" description="暂无时间轴数据" :image-size="60" />
      </el-card>

      <el-card shadow="never">
        <template #header><span class="blk-title">关联舆情</span></template>
        <el-table :data="view.opinions || []" size="small" max-height="320" border>
          <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="220" />
          <el-table-column label="渠道" prop="channelName" width="120" />
          <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
          <el-table-column label="属性" prop="sentiAttr" width="90" align="center">
            <template #default="scope">
              <dict-tag :options="yq_senti_attr" :value="scope.row.sentiAttr" />
            </template>
          </el-table-column>
          <el-table-column label="热度" prop="heatScore" width="75" align="center" />
        </el-table>
      </el-card>
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="ClusterTimelineDrawer">
import { ref, watch, computed, getCurrentInstance } from 'vue';
import { getLedgerCluster } from '@/api/yuqing/ledger';
import type { ClusterViewVO } from '@/api/yuqing/ledger/types';

const props = defineProps<{ modelValue: boolean; clusterId?: string | number }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const { proxy } = getCurrentInstance() as any;
const { yq_risk_level, yq_senti_attr } = proxy.useDict('yq_risk_level', 'yq_senti_attr');

const visible = ref(props.modelValue);
const loading = ref(false);
const view = ref<ClusterViewVO>({});

/** 把 stageCount 这个 Map 摊平成数组，避免在模板里做类型断言 */
const stageRows = computed(() => {
  const m = view.value.stageCount || {};
  const order = ['first', 'spread', 'peak', 'fall'];
  const rows: Array<{ stage: string; label: string; count: number }> = [];
  for (const k of order) {
    if (m[k] !== undefined) {
      rows.push({ stage: k, label: stageText(k), count: m[k] });
    }
  }
  for (const k of Object.keys(m)) {
    if (order.indexOf(k) < 0) {
      rows.push({ stage: k, label: stageText(k), count: m[k] });
    }
  }
  return rows;
});

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v;
    if (v) {
      load();
    }
  }
);
watch(visible, (v) => emit('update:modelValue', v));
watch(
  () => props.clusterId,
  () => {
    if (visible.value) {
      load();
    }
  }
);

async function load() {
  if (props.clusterId === undefined || props.clusterId === null || props.clusterId === '') {
    return;
  }
  loading.value = true;
  try {
    const res = await getLedgerCluster(props.clusterId, { pageNum: 1, pageSize: 50 });
    view.value = res.data ?? {};
  } finally {
    loading.value = false;
  }
}

function stageText(s?: string) {
  if (s === 'first') {
    return '首发';
  }
  if (s === 'spread') {
    return '扩散';
  }
  if (s === 'peak') {
    return '峰值';
  }
  if (s === 'fall') {
    return '回落';
  }
  return '—';
}

function stageType(s?: string) {
  if (s === 'first') {
    return 'primary';
  }
  if (s === 'peak') {
    return 'danger';
  }
  if (s === 'spread') {
    return 'warning';
  }
  return 'info';
}

function basisText(b?: string) {
  if (b === 'publish') {
    return '发布时间';
  }
  if (b === 'collect') {
    return '采集时间';
  }
  return b || '时间';
}
</script>

<style scoped>
.mb12 {
  margin-bottom: 12px;
}
.blk-title {
  font-weight: 600;
}
.node-title {
  margin: 0 6px;
  font-weight: 500;
}
.node-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.mr4 {
  margin-right: 4px;
}
</style>
