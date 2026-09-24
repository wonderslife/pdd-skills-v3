<template>
  <div class="app-container dashboard-page">
    <el-alert
      v-if="view?.batch?.degraded"
      type="warning"
      :closable="false"
      show-icon
      class="mb8"
      title="预聚合任务最近一次执行失败，当前展示的是上一次成功聚合的结果"
      :description="'失败原因：' + (view?.batch?.failReason || '未记录')"
    />
    <el-alert v-for="(msg, idx) in view?.notices || []" :key="idx" type="info" :closable="false" show-icon class="mb8" :title="msg" />

    <el-form ref="queryRef" :model="query" :inline="true" class="query-form">
      <el-form-item label="统计日期">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          unlink-panels
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 240px"
          @change="handleQuery"
        />
      </el-form-item>
      <el-form-item label="任务">
        <el-select v-model="query.taskId" placeholder="全部任务" clearable filterable style="width: 160px" @change="handleQuery">
          <el-option v-for="t in taskOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="渠道">
        <el-select v-model="query.channelId" placeholder="全部渠道" clearable filterable style="width: 160px" @change="handleQuery">
          <el-option v-for="c in channelOptions" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="舆情属性">
        <el-select v-model="query.sentiAttr" placeholder="全部" clearable style="width: 120px" @change="handleQuery">
          <el-option v-for="d in yq_senti_attr" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="风险等级">
        <el-select v-model="query.riskLevel" placeholder="全部" clearable style="width: 120px" @change="handleQuery">
          <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="趋势粒度">
        <el-select v-model="query.grain" style="width: 100px" @change="handleQuery">
          <el-option label="小时" value="hour" />
          <el-option label="日" value="day" />
          <el-option label="周" value="week" />
        </el-select>
      </el-form-item>
      <el-form-item label="热度口径">
        <el-select v-model="query.rankBy" style="width: 120px" @change="handleQuery">
          <el-option label="综合热度" value="heat" />
          <el-option label="阅读量" value="read" />
          <el-option label="转发量" value="share" />
          <el-option label="评论量" value="comment" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" :loading="loading" @click="handleQuery">查询</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        <el-button v-hasPermi="['yuqing:dashboard:export']" type="warning" plain icon="Download" @click="handleExport">导出Excel</el-button>
        <el-button v-hasPermi="['yuqing:dashboard:aggregate']" type="success" plain icon="Refresh" @click="openAggregate">重算</el-button>
        <el-button type="info" plain icon="List" @click="openBatches">聚合记录</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="12" class="mb8">
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">舆情总量</div>
          <div class="metric-value">{{ n0(view?.totals?.totalCount) }}</div>
          <div class="metric-sub">截止 {{ dataUntilText }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">负面占比</div>
          <div class="metric-value danger">{{ pct(view?.totals?.negativeRate) }}</div>
          <div class="metric-sub">负面 {{ n0(view?.totals?.negativeCount) }} 条</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">严重级</div>
          <div class="metric-value danger">{{ n0(view?.totals?.highRiskCount) }}</div>
          <div class="metric-sub">风险等级=严重</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">互动合计</div>
          <div class="metric-value">{{ n0(view?.totals?.interactionSum) }}</div>
          <div class="metric-sub">阅读 {{ n0(view?.totals?.readSum) }} / 转发 {{ n0(view?.totals?.shareSum) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">去重剔除</div>
          <div class="metric-value">{{ n0(view?.totals?.dupCount) }}</div>
          <div class="metric-sub">降噪剔除 {{ n0(view?.totals?.rejectedCount) }}</div>
        </el-card>
      </el-col>
      <el-col :span="4">
        <el-card shadow="hover" class="metric-card">
          <div class="metric-label">预警 / 推送</div>
          <div class="metric-value">{{ n0(view?.totals?.alertCount) }} / {{ n0(view?.totals?.pushCount) }}</div>
          <div class="metric-sub">{{ conclusionModeText }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="mb8">
      <el-col :span="8">
        <el-card shadow="never" class="dist-card">
          <template #header>
            <span>平台分布</span>
            <span class="card-hint">点击条目下钻明细</span>
          </template>
          <DimBars :items="view?.platform" @pick="pickDim('channel', $event)" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="dist-card">
          <template #header>
            <span>地域分布</span>
            <span class="card-hint">点击条目下钻明细</span>
          </template>
          <DimBars :items="view?.region" @pick="pickDim('region', $event)" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="dist-card">
          <template #header>
            <span>话题分布</span>
            <span class="card-hint">点击条目下钻明细</span>
          </template>
          <DimBars :items="view?.topic" @pick="pickDim('topic', $event)" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12" class="mb8">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>属性 / 风险 / 分级分布</span>
          </template>
          <el-row :gutter="8">
            <el-col :span="8">
              <div class="sub-title">舆情属性</div>
              <DimBars :items="view?.senti" @pick="pickDim('senti', $event)" />
            </el-col>
            <el-col :span="8">
              <div class="sub-title">风险等级</div>
              <DimBars :items="view?.risk" @pick="pickDim('risk', $event)" />
            </el-col>
            <el-col :span="8">
              <div class="sub-title">舆情分级</div>
              <DimBars :items="view?.level" @pick="pickDim('level', $event)" />
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>
            <span>传播趋势</span>
            <span class="card-hint">按 {{ view?.trendBase || '-' }} 归属，点击点位下钻</span>
          </template>
          <div ref="trendRef" class="trend-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="mb8">
      <template #header>
        <span>传播量级分布</span>
      </template>
      <DimBars :items="view?.spread" @pick="pickDim('spread', $event)" />
    </el-card>

    <el-card shadow="never" class="mb8">
      <template #header>
        <span>热点舆情 TOP 排行</span>
        <span class="card-hint">口径：{{ rankByText }}，点击标题查看原文，点击「下钻」查看同榜条目</span>
      </template>
      <el-table :data="view?.hot || []" border size="small">
        <el-table-column label="名次" prop="rankNo" width="70" align="center" />
        <el-table-column label="标题" prop="title" min-width="280" show-overflow-tooltip />
        <el-table-column label="平台" prop="channelName" width="130" show-overflow-tooltip />
        <el-table-column label="属性" prop="sentiAttr" width="80" align="center" />
        <el-table-column label="风险" prop="riskLevel" width="80" align="center" />
        <el-table-column label="阅读" prop="readCount" width="90" align="right" />
        <el-table-column label="转发" prop="shareCount" width="90" align="right" />
        <el-table-column label="评论" prop="commentCount" width="90" align="right" />
        <el-table-column label="热度" prop="heatScore" width="90" align="right" />
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="scope">
            <el-button link type="primary" icon="View" @click="openOrigin(scope.row)">原文</el-button>
            <el-button link type="primary" icon="Search" @click="drillHot(scope.row)">下钻</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <ConclusionPanel
      :conclusion="view?.conclusion"
      :mode="view?.conclusionMode"
      :data-until="view?.batch?.dataUntil"
      :batch-no="view?.batch?.batchNo"
      @pick-event="drillEvent"
    />

    <!-- 重算 -->
    <el-dialog v-model="aggregateOpen" title="重算 / 补算历史" width="520px" append-to-body>
      <el-form label-width="110px">
        <el-form-item label="统计日期">
          <el-date-picker
            v-model="aggregateForm.dateRange"
            type="daterange"
            unlink-panels
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="先清理旧行">
          <el-switch v-model="aggregateForm.purge" />
          <span class="form-hint">仅当「明细被删后重算、残留旧聚合行」时才需要；开启期间看板会短暂空窗</span>
        </el-form-item>
      </el-form>
      <div class="aggregate-tip">
        说明：重算按「采集日」读取明细并覆盖写入三张预聚合表。范围越大耗时越长，
        单次上限 366 天、明细 20 万条（命中上限会在结果里提示）。
      </div>
      <template #footer>
        <el-button type="primary" :loading="aggregating" @click="submitAggregate">开始重算</el-button>
        <el-button @click="aggregateOpen = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- 聚合记录 -->
    <el-dialog v-model="batchOpen" title="聚合批次台账" width="900px" append-to-body>
      <el-table :data="batches" border size="small" max-height="420">
        <el-table-column label="批次号" prop="batchNo" min-width="200" show-overflow-tooltip />
        <el-table-column label="统计范围" width="200" align="center">
          <template #default="scope">{{ scopeText(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="触发" prop="triggerType" width="80" align="center" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.status === 'success' ? 'success' : (scope.row.status === 'failed' ? 'danger' : 'warning')" size="small">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="明细/写入" width="140" align="center">
          <template #default="scope">{{ n0(scope.row.sourceCount) }} / {{ n0(scope.row.dailyRows) }}+{{ n0(scope.row.dimRows) }}+{{ n0(scope.row.hotRows) }}</template>
        </el-table-column>
        <el-table-column label="耗时" width="90" align="right">
          <template #default="scope">{{ n0(scope.row.costMs) }}ms</template>
        </el-table-column>
        <el-table-column label="数据截止" prop="dataUntil" width="160" align="center" />
        <el-table-column label="提示/失败原因" min-width="200" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.failReason || scope.row.notice || '-' }}</template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <DrilldownDrawer v-model="drillOpen" :params="drillParams" />
  </div>
</template>

<script setup name="YqDashboard" lang="ts">
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRefs } from 'vue';
import * as echarts from 'echarts';
import { getDashboard, getDrilldown, aggregateStats, listBatches } from '@/api/yuqing/analytics/index';
import type { DrilldownParams, DimItem, HotItem, StatsBatchVO } from '@/api/yuqing/analytics/types';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqChannel } from '@/api/yuqing/channel/index';
import { useDict } from '@/utils/dict';
import { download as requestDownload } from '@/utils/request';
import DimBars from './DimBars.vue';
import ConclusionPanel from './ConclusionPanel.vue';
import DrilldownDrawer from './DrilldownDrawer.vue';

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level } = toRefs<any>(useDict('yq_senti_attr', 'yq_risk_level'));

const loading = ref(false);
const aggregating = ref(false);
const aggregateOpen = ref(false);
const batchOpen = ref(false);
const drillOpen = ref(false);
const trendRef = ref<HTMLElement | null>(null);
const batches = ref<StatsBatchVO[]>([]);
const dateRange = ref<string[]>([]);
const taskOptions = ref<Array<{ value: string | number; label: string }>>([]);
const channelOptions = ref<Array<{ value: string | number; label: string }>>([]);

const view = ref<any>(null);

const data = reactive({
  query: {
    dateFrom: '',
    dateTo: '',
    taskId: undefined as any,
    channelId: undefined as any,
    sentiAttr: '',
    riskLevel: '',
    grain: 'day',
    rankBy: 'heat'
  },
  aggregateForm: {
    dateRange: [] as string[],
    purge: false
  },
  drillParams: {} as DrilldownParams
});
const { query, aggregateForm, drillParams } = toRefs(data);

let chart: any = null;

const rankByText = ref('综合热度');
const conclusionModeText = ref('');

const dataUntilText = ref('-');

onMounted(() => {
  const today = new Date();
  const end = fmtDay(today);
  const start = fmtDay(new Date(today.getTime() - 6 * 24 * 3600 * 1000));
  dateRange.value = [start, end];
  query.value.dateFrom = start;
  query.value.dateTo = end;
  loadOptions();
  loadDashboard();
});

onBeforeUnmount(() => {
  if (chart) {
    chart.dispose();
    chart = null;
  }
});

function fmtDay(d: Date) {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return y + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day);
}

/** 任务 / 渠道下拉：拿不到权限时留空即可，不影响看板主功能 */
async function loadOptions() {
  try {
    const [t, c] = await Promise.all([optionselectYqTask(), optionselectYqChannel()]);
    taskOptions.value = (t.data || []).map((x: any) => ({ value: x.taskId, label: x.taskName }));
    channelOptions.value = (c.data || []).map((x: any) => ({ value: x.channelId, label: x.channelName }));
  } catch (e) {
    taskOptions.value = [];
    channelOptions.value = [];
  }
}

async function loadDashboard() {
  loading.value = true;
  try {
    const res = await getDashboard(query.value);
    view.value = res.data;
    rankByText.value = rankLabel(query.value.rankBy);
    conclusionModeText.value =
      view.value?.conclusionMode === 'batch'
        ? '结论来自聚合批次'
        : view.value?.conclusionMode === 'derived'
          ? '结论为预聚合推导'
          : '暂无结论';
    dataUntilText.value = view.value?.batch?.dataUntil || '-';
    await nextTick();
    renderTrend();
  } finally {
    loading.value = false;
  }
}

function rankLabel(v?: string) {
  if (v === 'read') {
    return '阅读量';
  }
  if (v === 'share') {
    return '转发量';
  }
  if (v === 'comment') {
    return '评论量';
  }
  return '综合热度';
}

function renderTrend() {
  const items: DimItem[] = view.value?.trend || [];
  if (!trendRef.value) {
    return;
  }
  if (!chart) {
    chart = echarts.init(trendRef.value);
    chart.on('click', (p: any) => {
      const hit = items[p.dataIndex];
      if (hit) {
        pickDim('trend', hit);
      }
    });
  }
  const x = items.map((i) => i.dimLabel || i.dimKey);
  const y = items.map((i) => i.opinionCount || 0);
  const option: any = {
    grid: { left: 40, right: 16, top: 24, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, axisLabel: { rotate: x.length > 12 ? 40 : 0 } },
    yAxis: { type: 'value', name: '条数' },
    series: [
      {
        name: '舆情条数',
        type: 'line',
        smooth: true,
        showSymbol: y.length <= 60,
        areaStyle: { opacity: 0.15 },
        data: y
      }
    ]
  };
  chart.setOption(option, true);
  chart.resize();
}

function handleQuery() {
  query.value.dateFrom = dateRange.value && dateRange.value.length === 2 ? dateRange.value[0] : '';
  query.value.dateTo = dateRange.value && dateRange.value.length === 2 ? dateRange.value[1] : '';
  loadDashboard();
}

function resetQuery() {
  const today = new Date();
  const end = fmtDay(today);
  const start = fmtDay(new Date(today.getTime() - 6 * 24 * 3600 * 1000));
  dateRange.value = [start, end];
  query.value = {
    dateFrom: start,
    dateTo: end,
    taskId: undefined as any,
    channelId: undefined as any,
    sentiAttr: '',
    riskLevel: '',
    grain: 'day',
    rankBy: 'heat'
  };
  loadDashboard();
}

/** 分布条目 / 趋势点位 / 热点行 → 下钻 */
function pickDim(dimType: string, item: DimItem) {
  drillParams.value = {
    ...query.value,
    dimType: dimType,
    dimKey: item.dimKey,
    dimLabel: item.dimLabel,
    pageNum: 1,
    pageSize: 20
  } as DrilldownParams;
  drillOpen.value = true;
}

function drillHot(row: HotItem) {
  drillParams.value = {
    ...query.value,
    dimType: 'hot',
    dimKey: String(row.opinionId),
    dimLabel: row.title,
    opinionId: row.opinionId,
    pageNum: 1,
    pageSize: 20
  } as DrilldownParams;
  drillOpen.value = true;
}

function drillEvent(ev: { title?: string; key?: string; opinionId?: any }) {
  drillParams.value = {
    ...query.value,
    dimType: 'topic',
    dimKey: ev.key,
    dimLabel: ev.title,
    opinionId: ev.opinionId,
    pageNum: 1,
    pageSize: 20
  } as DrilldownParams;
  drillOpen.value = true;
}

function openOrigin(row: HotItem) {
  if (row.opinionUrl) {
    window.open(row.opinionUrl, '_blank');
  } else {
    proxy?.$modal.msgWarning('该条没有原文链接');
  }
}

function handleExport() {
  requestDownload(
    '/yuqing/analytics/export',
    { ...query.value },
    '多维分析_' + (query.value.dateFrom || '') + '_' + (query.value.dateTo || '') + '.xlsx'
  );
}

function openAggregate() {
  aggregateForm.value.dateRange = [query.value.dateFrom, query.value.dateTo];
  aggregateForm.value.purge = false;
  aggregateOpen.value = true;
}

async function submitAggregate() {
  const range = aggregateForm.value.dateRange || [];
  if (range.length !== 2) {
    proxy?.$modal.msgWarning('请选择统计日期范围');
    return;
  }
  aggregating.value = true;
  try {
    const res = await aggregateStats({
      dateFrom: range[0],
      dateTo: range[1],
      taskId: query.value.taskId,
      channelId: query.value.channelId,
      triggerType: 'manual',
      purge: aggregateForm.value.purge
    });
    const s: any = res.data || {};
    if (s.status === 'success') {
      proxy?.$modal.msgSuccess(
        '重算完成：明细 ' + s.sourceCount + ' 条，写入 ' + (s.dailyRows + s.dimRows + s.hotRows) + ' 行，耗时 ' + s.costMs + 'ms'
      );
      aggregateOpen.value = false;
      loadDashboard();
    } else {
      proxy?.$modal.msgError('重算失败：' + (s.failReason || '未知原因'));
    }
    (s.notices || []).forEach((m: string) => proxy?.$modal.msgWarning(m));
  } finally {
    aggregating.value = false;
  }
}

async function openBatches() {
  const res = await listBatches(30);
  batches.value = res.data || [];
  batchOpen.value = true;
}

function scopeText(row: StatsBatchVO) {
  return (row.beginDate || '-') + ' ~ ' + (row.endDate || '-');
}

function n0(v: any) {
  if (v === null || v === undefined) {
    return '0';
  }
  return String(v);
}

function pct(v: any) {
  if (v === null || v === undefined) {
    return '0%';
  }
  return v + '%';
}
</script>

<style scoped>
.dashboard-page .query-form {
  margin-bottom: 8px;
}
.metric-card {
  text-align: center;
}
.metric-label {
  font-size: 13px;
  color: #909399;
}
.metric-value {
  font-size: 24px;
  font-weight: 600;
  margin: 6px 0;
  color: #303133;
}
.metric-value.danger {
  color: #f56c6c;
}
.metric-sub {
  font-size: 12px;
  color: #a8abb2;
}
.card-hint {
  float: right;
  font-size: 12px;
  color: #a8abb2;
  font-weight: normal;
}
.sub-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 6px;
}
.trend-chart {
  width: 100%;
  height: 260px;
}
.form-hint {
  margin-left: 10px;
  font-size: 12px;
  color: #a8abb2;
}
.aggregate-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  padding: 8px 4px;
}
</style>
