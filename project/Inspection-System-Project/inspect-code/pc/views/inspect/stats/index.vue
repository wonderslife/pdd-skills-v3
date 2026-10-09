<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="80px">
      <el-form-item label="统计粒度" prop="granularity">
        <el-select v-model="queryParams.granularity" style="width: 130px">
          <el-option label="按日" value="day" />
          <el-option label="按周" value="week" />
          <el-option label="按月" value="month" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属机房" prop="roomId">
        <el-select v-model="queryParams.roomId" placeholder="全部机房" clearable filterable style="width: 180px">
          <el-option v-for="o in roomOptions" :key="o.roomId" :label="o.roomName" :value="o.roomId!" />
        </el-select>
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="16" class="mb8">
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">未处理异常</div>
            <div class="stat-value danger">{{ abnormalCount }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">区间巡检次数</div>
            <div class="stat-value primary">{{ totalInspect }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-label">区间异常次数</div>
            <div class="stat-value warning">{{ totalAbnormal }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb8">
      <template #header>
        <span>巡检趋势</span>
      </template>
      <div ref="trendChartRef" style="width: 100%; height: 340px"></div>
      <el-empty v-if="!loadingTrend && !trendList.length" description="暂无数据" />
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span>点位巡检排名（Top {{ queryParams.limit }}）</span>
      </template>
      <el-table v-loading="loadingRank" :data="rankList" size="small" border>
        <el-table-column label="排名" type="index" width="70" align="center" />
        <el-table-column label="点位名称" prop="pointName" min-width="150" />
        <el-table-column label="所属机房" prop="roomName" width="150" />
        <el-table-column label="巡检次数" prop="inspectCount" width="110" align="center" />
        <el-table-column label="异常次数" prop="abnormalCount" width="110" align="center" />
        <el-table-column label="异常率" width="200" align="center">
          <template #default="{ row }">
            <el-progress :percentage="Number(row.abnormalRate ?? 0)" :stroke-width="12" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup name="InspectStats" lang="ts">
import { ref, reactive, toRefs, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { to } from 'await-to-js';
import * as echarts from 'echarts';
import type { StatsPointRankVO, StatsQuery, StatsTrendVO } from '@/api/inspect/stats/types';
import { getStatsTrend, getStatsPointRank, getAbnormalCount } from '@/api/inspect/stats';
import { optionselectInspectRoom } from '@/api/inspect/room';

const queryRef = ref();
const showSearch = ref(true);
const trendChartRef = ref<HTMLDivElement>();
const roomOptions = ref<any[]>([]);
const trendList = ref<StatsTrendVO[]>([]);
const rankList = ref<StatsPointRankVO[]>([]);
const loadingTrend = ref(false);
const loadingRank = ref(false);
const abnormalCount = ref(0);
const dateRange = ref<string[]>([]);
let chart: echarts.ECharts | null = null;

const data = reactive({
  queryParams: { granularity: 'day', limit: 10 } as StatsQuery
});
const { queryParams } = toRefs(data);

const totalInspect = computed(() => trendList.value.reduce((s, i) => s + (i.inspectCount ?? 0), 0));
const totalAbnormal = computed(() => trendList.value.reduce((s, i) => s + (i.abnormalCount ?? 0), 0));

function buildQuery(): StatsQuery {
  const q: StatsQuery = { ...queryParams.value };
  if (dateRange.value && dateRange.value.length === 2) {
    q.beginDate = dateRange.value[0];
    q.endDate = dateRange.value[1];
  }
  return q;
}

/** 无日期时给一个默认近 30 天，保证图表有数据 */
function ensureDefaultRange() {
  if (!dateRange.value || dateRange.value.length !== 2) {
    const end = new Date();
    const begin = new Date();
    begin.setDate(begin.getDate() - 29);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dateRange.value = [fmt(begin), fmt(end)];
  }
}

function renderChart() {
  if (!trendChartRef.value) return;
  if (!chart) chart = echarts.init(trendChartRef.value);
  const labels = trendList.value.map((i) => i.dateLabel ?? '');
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['巡检次数', '异常次数', '逾期数'] },
    grid: { left: 50, right: 24, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: labels, axisLabel: { rotate: labels.length > 12 ? 40 : 0 } },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '巡检次数', type: 'line', smooth: true, data: trendList.value.map((i) => i.inspectCount ?? 0), itemStyle: { color: '#409eff' } },
      { name: '异常次数', type: 'line', smooth: true, data: trendList.value.map((i) => i.abnormalCount ?? 0), itemStyle: { color: '#f56c6c' } },
      { name: '逾期数', type: 'bar', data: trendList.value.map((i) => i.overdueCount ?? 0), itemStyle: { color: '#e6a23c' } }
    ]
  });
  chart.resize();
}

async function loadTrend() {
  loadingTrend.value = true;
  const [err, res] = await to(getStatsTrend(buildQuery()));
  loadingTrend.value = false;
  if (err) return;
  trendList.value = res?.data ?? [];
  await nextTick();
  renderChart();
}

async function loadRank() {
  loadingRank.value = true;
  const [err, res] = await to(getStatsPointRank(buildQuery()));
  loadingRank.value = false;
  if (err) return;
  rankList.value = res?.data ?? [];
}

async function loadAbnormalCount() {
  const [err, res] = await to(getAbnormalCount(queryParams.value.roomId));
  if (err) return;
  abnormalCount.value = res?.data ?? 0;
}

async function loadRooms() {
  const { data } = await optionselectInspectRoom({});
  roomOptions.value = data ?? [];
}

function handleQuery() {
  ensureDefaultRange();
  loadTrend();
  loadRank();
  loadAbnormalCount();
}

function resetQuery() {
  queryParams.value = { granularity: 'day', limit: 10 } as StatsQuery;
  dateRange.value = [];
  queryRef.value?.resetFields();
  handleQuery();
}

function handleResize() {
  chart?.resize();
}

onMounted(() => {
  loadRooms();
  handleQuery();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  chart?.dispose();
  chart = null;
});
</script>

<style scoped>
.stat-card {
  text-align: center;
  padding: 6px 0;
}
.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
}
.stat-value.danger {
  color: var(--el-color-danger);
}
.stat-value.primary {
  color: var(--el-color-primary);
}
.stat-value.warning {
  color: var(--el-color-warning);
}
</style>
