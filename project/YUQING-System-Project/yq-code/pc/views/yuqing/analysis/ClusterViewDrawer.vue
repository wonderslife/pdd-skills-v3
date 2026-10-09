<template>
  <el-drawer v-model="visible" title="事件传播脉络" size="76%" append-to-body @open="load">
    <div v-loading="loading" class="cluster-body">
      <template v-if="cluster">
        <!-- ============================================ 事件概要（验收标准 4、10） -->
        <el-card shadow="never" class="sec">
          <template #header>
            <div class="sec-head">
              <span>{{ cluster.clusterTitle || '未命名事件' }}</span>
              <el-tag v-if="cluster.clusterId" size="small" type="info">聚合编号 {{ cluster.clusterId }}</el-tag>
            </div>
          </template>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="事件主题">{{ cluster.clusterTopic || '—' }}</el-descriptions-item>
            <el-descriptions-item label="起始时间">{{ cluster.firstTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="最近时间">{{ cluster.lastTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="舆情条数">{{ cluster.opinionCount || 0 }}</el-descriptions-item>
            <el-descriptions-item label="峰值热度">{{ cluster.peakHeat === null || cluster.peakHeat === undefined ? '—' : cluster.peakHeat }}</el-descriptions-item>
            <el-descriptions-item label="风险等级">
              <dict-tag v-if="cluster.riskLevel" :options="yq_risk_level" :value="cluster.riskLevel" />
              <span v-else>—</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 阶段分布：点击某一阶段可只看该阶段的节点 -->
          <div class="stage-bar">
            <span class="stage-label">传播阶段（点击筛选）：</span>
            <el-tag
              v-for="(cnt, key) in cluster.stageCount || {}"
              :key="key"
              size="small"
              effect="plain"
              :type="stageFilter === String(key).toUpperCase() ? 'primary' : 'info'"
              class="stage-item"
              @click="toggleStage(String(key))"
            >
              {{ stageText(key) }} {{ cnt }}
            </el-tag>
            <el-button v-if="stageFilter" link type="primary" @click="stageFilter = ''">清除筛选</el-button>
          </div>
          <el-alert
            v-if="cluster.timelineTruncated"
            title="时间轴节点过多已截断显示，未展示的部分请用「关联舆情」列表查看。"
            type="warning"
            :closable="false"
            class="mb8"
          />
        </el-card>

        <!-- ============================================ 传播时间轴（验收标准 4） -->
        <el-card shadow="never" class="sec">
          <template #header>
            <span>传播时间轴（{{ filteredTimeline.length }} 个节点）</span>
          </template>
          <el-timeline v-if="filteredTimeline.length > 0">
            <el-timeline-item
              v-for="node in filteredTimeline"
              :key="String(node.opinionId) + '-' + node.time"
              :timestamp="node.time"
              :type="stageTimelineType(node.stage)"
              placement="top"
            >
              <div class="tl-item">
                <div class="tl-head">
                  <el-tag size="small" effect="plain" class="tl-stage">{{ stageText(node.stage) }}</el-tag>
                  <el-link v-if="node.opinionUrl" type="primary" :href="node.opinionUrl" target="_blank" class="tl-title">{{ node.title }}</el-link>
                  <span v-else class="tl-title">{{ node.title }}</span>
                </div>
                <div class="tl-meta">
                  <span>{{ node.channelName || '未知渠道' }}</span>
                  <span v-if="node.author"> · {{ node.author }}</span>
                  <span v-if="node.heatScore !== null && node.heatScore !== undefined"> · 热度 {{ node.heatScore }}</span>
                  <span v-if="node.offsetMinutes !== null && node.offsetMinutes !== undefined"> · 距首发 {{ offsetText(node.offsetMinutes) }}</span>
                  <dict-tag v-if="node.sentiAttr" :options="yq_senti_attr" :value="node.sentiAttr" class="tl-dict" />
                  <dict-tag v-if="node.riskLevel" :options="yq_risk_level" :value="node.riskLevel" class="tl-dict" />
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else :image-size="80" :description="stageFilter ? '该阶段暂无节点' : '暂无传播节点'" />
        </el-card>

        <!-- ============================================ 关联舆情 -->
        <el-card v-if="(cluster.opinions || []).length > 0" shadow="never" class="sec">
          <template #header>
            <span>关联舆情（当前可见 {{ (cluster.opinions || []).length }} 条）</span>
          </template>
          <el-table :data="cluster.opinions || []" size="small" border max-height="320">
            <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="220">
              <template #default="scope">
                <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">{{ scope.row.title }}</el-link>
                <span v-else>{{ scope.row.title }}</span>
              </template>
            </el-table-column>
            <el-table-column label="渠道" prop="channelName" width="110" align="center" />
            <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
            <el-table-column label="热度" prop="heatScore" width="75" align="center" />
            <el-table-column label="舆情属性" prop="sentiAttr" width="95" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.sentiAttr" :options="yq_senti_attr" :value="scope.row.sentiAttr" />
              </template>
            </el-table-column>
            <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.riskLevel" :options="yq_risk_level" :value="scope.row.riskLevel" />
              </template>
            </el-table-column>
            <el-table-column label="研判状态" prop="analyzeStatus" width="95" align="center">
              <template #default="scope">
                <dict-tag :options="yq_analyze_status" :value="scope.row.analyzeStatus" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
      <el-empty v-else-if="!loading" :image-size="80" description="未获取到事件信息" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="ClusterViewDrawer">
import { ref, computed, getCurrentInstance } from 'vue';
import { getLedgerCluster } from '@/api/yuqing/ledger';
import type { ClusterViewVO, LedgerTimelineNode } from '@/api/yuqing/ledger/types';

const props = defineProps<{
  modelValue: boolean;
  clusterId?: string | number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_analyze_status } = proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_analyze_status');

/**
 * 阶段中文名。
 *
 * ⚠ 两处来源的大小写不同，这里统一按大写查表：
 *   - F-007 的 ClusterCard.stageCount 键是大写 FIRST/SPREAD/PEAK/FALL；
 *   - F-016 的传播时间轴节点 stage 是小写 first/spread/peak/fall。
 * 不归一化会出现「分布标签是中文、时间轴标签是英文」的割裂。
 */
const STAGE_LABELS: Record<string, string> = {
  FIRST: '首发',
  SPREAD: '扩散',
  PEAK: '峰值',
  FALL: '回落'
};

const loading = ref(false);
const cluster = ref<ClusterViewVO | null>(null);
const stageFilter = ref('');

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const timeline = computed<LedgerTimelineNode[]>(() => cluster.value?.timeline ?? []);

const filteredTimeline = computed<LedgerTimelineNode[]>(() => {
  const f = stageFilter.value;
  if (!f) {
    return timeline.value;
  }
  return timeline.value.filter((n) => String(n.stage || '').toUpperCase() === f);
});

function stageText(key: string | number | undefined): string {
  if (key === undefined || key === null) {
    return '—';
  }
  const k = String(key).toUpperCase();
  return STAGE_LABELS[k] || String(key);
}

function toggleStage(key: string) {
  const k = key.toUpperCase();
  stageFilter.value = stageFilter.value === k ? '' : k;
}

/** 时间轴节点圆点颜色：首发偏蓝、峰值标红，与「看传播节奏」的直觉一致 */
function stageTimelineType(stage?: string): string {
  const k = String(stage || '').toUpperCase();
  if (k === 'PEAK') {
    return 'danger';
  }
  if (k === 'FIRST') {
    return 'primary';
  }
  if (k === 'FALL') {
    return 'info';
  }
  return 'warning';
}

function offsetText(minutes?: number): string {
  const m = Number(minutes || 0);
  if (m < 60) {
    return m + ' 分钟';
  }
  if (m < 1440) {
    return (m / 60).toFixed(1) + ' 小时';
  }
  return (m / 1440).toFixed(1) + ' 天';
}

async function load() {
  if (props.clusterId === undefined || props.clusterId === null) {
    return;
  }
  loading.value = true;
  stageFilter.value = '';
  try {
    const res = await getLedgerCluster(props.clusterId, { nodeLimit: 200 });
    cluster.value = res.data ?? null;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.cluster-body {
  min-height: 200px;
}
.sec {
  margin-bottom: 12px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stage-bar {
  margin-top: 12px;
}
.stage-label {
  font-size: 13px;
  color: #606266;
  margin-right: 6px;
}
.stage-item {
  margin-right: 6px;
  cursor: pointer;
}
.tl-item {
  padding-bottom: 4px;
}
.tl-head {
  display: flex;
  align-items: center;
}
.tl-stage {
  margin-right: 8px;
}
.tl-title {
  font-weight: 600;
}
.tl-meta {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
}
.tl-dict {
  margin-left: 6px;
}
</style>
