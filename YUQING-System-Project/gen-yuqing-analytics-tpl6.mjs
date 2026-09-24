/**
 * F-009 多维分析 · 第 6 片：PC 端接口与看板页面
 *
 * 硬约束（三层转义约定）：产物里不出现反引号与 ${ ，字符串拼接一律用 + 。
 */
export const ANALYTICS_TPL6 = [

  /* ================================================================ API */
  {
    rel: 'pc/api/yuqing/analytics/types.ts',
    content: `/**
 * 多维分析看板 · 类型定义（F-009）
 *
 * 注意：不要从这里导出 PageQuery —— 它是 src/types/global.d.ts 里的全局环境接口，
 * 一旦被 import 就会变成模块作用域，全项目的 PageQuery 使用者会集体报 TS2305。
 */

/** 看板查询条件（与后端 AggregateScope 字段一一对应） */
export interface AnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
  taskId?: string | number;
  channelId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  /** 趋势粒度 hour / day / week */
  grain?: string;
  /** 热点排序口径 read / share / comment / heat */
  rankBy?: string;
}

/** 维度条目：分布卡片的一行，也是趋势曲线的一个点 */
export interface DimItem {
  dimType?: string;
  dimKey?: string;
  dimLabel?: string;
  opinionCount?: number;
  positiveCount?: number;
  neutralCount?: number;
  negativeCount?: number;
  highRiskCount?: number;
  readSum?: number;
  commentSum?: number;
  shareSum?: number;
  likeSum?: number;
  heatSum?: number;
  negativeRate?: number;
  share?: number;
}

/** 总量卡 */
export interface TotalsView {
  totalCount?: number;
  positiveCount?: number;
  neutralCount?: number;
  negativeCount?: number;
  highRiskCount?: number;
  positiveRate?: number;
  neutralRate?: number;
  negativeRate?: number;
  readSum?: number;
  commentSum?: number;
  shareSum?: number;
  likeSum?: number;
  interactionSum?: number;
  avgHeatScore?: number;
  dupCount?: number;
  rejectedCount?: number;
  alertCount?: number;
  pushCount?: number;
  reportCount?: number;
}

/** 热点排行条目 */
export interface HotItem {
  rankNo?: number;
  opinionId?: string | number;
  taskId?: string | number;
  channelId?: string | number;
  title?: string;
  channelName?: string;
  opinionUrl?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  readCount?: number;
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;
  heatScore?: number;
}

/** 核心舆情事件 */
export interface CoreEvent {
  clusterId?: string | number;
  title?: string;
  opinionUrl?: string;
  opinionId?: string | number;
  opinionCount?: number;
  negativeCount?: number;
  negativeRate?: number;
  heatSum?: number;
  firstTime?: string;
  lastTime?: string;
  channels?: string[];
}

/** 传播路径的一站 */
export interface PropagationStage {
  seq?: number;
  channelName?: string;
  firstTime?: string;
  lastTime?: string;
  opinionCount?: number;
  countShare?: number;
  gapMinutes?: number;
}

/** 舆论焦点 */
export interface FocusPoint {
  kind?: string;
  key?: string;
  label?: string;
  opinionCount?: number;
  share?: number;
  negativeRate?: number;
  heatSum?: number;
}

/** 潜在风险点 */
export interface RiskPoint {
  level?: string;
  type?: string;
  detail?: string;
  value?: number;
  threshold?: number;
  target?: string;
}

/** 结构化分析结论 */
export interface AnalysisConclusion {
  clusterBased?: boolean;
  coreEvents?: CoreEvent[];
  propagation?: PropagationStage[];
  focusPoints?: FocusPoint[];
  riskPoints?: RiskPoint[];
  narrative?: string[];
  firstTime?: string;
  lastTime?: string;
  durationHours?: number;
  speedPerHour?: number;
  peakBucket?: string;
  peakCount?: number;
  generatedAt?: string;
}

/** 批次元信息 */
export interface BatchMeta {
  batchNo?: string;
  beginDate?: string;
  endDate?: string;
  dataUntil?: string;
  aggregatedAt?: string;
  degraded?: boolean;
  failReason?: string;
  conclusionJson?: string;
  available?: boolean;
}

/** 看板视图 */
export interface DashboardView {
  scope?: AnalyticsQuery;
  grain?: string;
  rankBy?: string;
  trendBase?: string;
  totals?: TotalsView;
  platform?: DimItem[];
  region?: DimItem[];
  topic?: DimItem[];
  senti?: DimItem[];
  risk?: DimItem[];
  level?: DimItem[];
  spread?: DimItem[];
  trend?: DimItem[];
  hot?: HotItem[];
  conclusion?: AnalysisConclusion;
  /** 结论来源 batch / derived / none */
  conclusionMode?: string;
  batch?: BatchMeta;
  notices?: string[];
  dateFrom?: string;
  dateTo?: string;
}

/** 下钻明细行 */
export interface DrilldownRow {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  region?: string;
  topicTags?: string;
  readCount?: number;
  commentCount?: number;
  shareCount?: number;
  likeCount?: number;
  opinionUrl?: string;
}

/** 下钻结果 */
export interface DrilldownResult {
  dimType?: string;
  dimKey?: string;
  dimLabel?: string;
  conditionText?: string;
  total?: number;
  pageNum?: number;
  pageSize?: number;
  rows?: DrilldownRow[];
}

/** 下钻请求参数 */
export interface DrilldownParams extends AnalyticsQuery {
  dimType: string;
  dimKey?: string;
  dimLabel?: string;
  opinionId?: string | number;
  pageNum?: number;
  pageSize?: number;
}

/** 重算请求 */
export interface AggregateRequest {
  dateFrom?: string;
  dateTo?: string;
  taskId?: string | number;
  channelId?: string | number;
  triggerType?: string;
  purge?: boolean;
}

/** 重算执行摘要 */
export interface AggregateSummary {
  batchNo?: string;
  status?: string;
  scopeText?: string;
  sourceCount?: number;
  dailyRows?: number;
  dimRows?: number;
  hotRows?: number;
  costMs?: number;
  dataUntil?: string;
  conclusionMode?: string;
  notices?: string[];
  failReason?: string;
}

/** 聚合批次台账行 */
export interface StatsBatchVO {
  batchId?: string | number;
  batchNo?: string;
  beginDate?: string;
  endDate?: string;
  triggerType?: string;
  status?: string;
  sourceCount?: number;
  dailyRows?: number;
  dimRows?: number;
  hotRows?: number;
  costMs?: number;
  dataUntil?: string;
  notice?: string;
  failReason?: string;
  createTime?: string;
}

/** 报告章节交接包（用于「带入报告」预览） */
export interface ReportSection {
  sectionCode?: string;
  title?: string;
  markdown?: string;
  metrics?: Record<string, any>;
  scopeText?: string;
  dataUntil?: string;
  sourceBatch?: string;
  generatedAt?: string;
}
`,
  },
  {
    rel: 'pc/api/yuqing/analytics/index.ts',
    content: `import type {
  AggregateRequest,
  AggregateSummary,
  AnalyticsQuery,
  DashboardView,
  DrilldownParams,
  DrilldownResult,
  ReportSection,
  StatsBatchVO
} from './types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 看板数据（F-009 验收标准 1 / 2 / 3 / 4）
 */
export const getDashboard = (query?: AnalyticsQuery): AxiosPromise<DashboardView> => {
  return request({
    url: '/yuqing/analytics/dashboard',
    method: 'get',
    params: query
  });
};

/**
 * 下钻明细（F-009 验收标准 6）
 */
export const getDrilldown = (params: DrilldownParams): AxiosPromise<DrilldownResult> => {
  return request({
    url: '/yuqing/analytics/drilldown',
    method: 'get',
    params
  });
};

/**
 * 报告章节交接包（F-009 验收标准 7）
 */
export const getReportSection = (query?: AnalyticsQuery): AxiosPromise<ReportSection> => {
  return request({
    url: '/yuqing/analytics/handoff',
    method: 'get',
    params: query
  });
};

/**
 * 手动重算 / 补算历史（F-009 验收标准 8 / 9）
 */
export const aggregateStats = (data: AggregateRequest): AxiosPromise<AggregateSummary> => {
  return request({
    url: '/yuqing/analytics/aggregate',
    method: 'post',
    data
  });
};

/**
 * 聚合批次台账
 */
export const listBatches = (limit?: number): AxiosPromise<StatsBatchVO[]> => {
  return request({
    url: '/yuqing/analytics/batches',
    method: 'get',
    params: { limit: limit }
  });
};
`,
  },

  /* ============================================================== 看板页 */
  {
    rel: 'pc/views/yuqing/dashboard/index.vue',
    content: `<template>
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
`,
  },
  {
    rel: 'pc/views/yuqing/dashboard/DimBars.vue',
    content: `<template>
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
`,
  },
  {
    rel: 'pc/views/yuqing/dashboard/ConclusionPanel.vue',
    content: `<template>
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
`,
  },
  {
    rel: 'pc/views/yuqing/dashboard/DrilldownDrawer.vue',
    content: `<template>
  <el-drawer v-model="visible" size="72%" :title="title" append-to-body destroy-on-close>
    <div class="drill-body">
      <el-alert type="info" :closable="false" show-icon class="mb8" :title="'下钻条件：' + (result?.conditionText || '-')" />
      <el-table v-loading="loading" :data="result?.rows || []" border size="small">
        <el-table-column label="标题" prop="title" min-width="260" show-overflow-tooltip />
        <el-table-column label="平台" prop="channelName" width="120" show-overflow-tooltip />
        <el-table-column label="属性" prop="sentiAttr" width="80" align="center" />
        <el-table-column label="风险" prop="riskLevel" width="80" align="center" />
        <el-table-column label="地域" prop="region" width="100" show-overflow-tooltip />
        <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
        <el-table-column label="阅读" prop="readCount" width="80" align="right" />
        <el-table-column label="转发" prop="shareCount" width="80" align="right" />
        <el-table-column label="评论" prop="commentCount" width="80" align="right" />
        <el-table-column label="原文" width="80" align="center">
          <template #default="scope">
            <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">打开</el-link>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="mt8"
        background
        layout="total, sizes, prev, pager, next"
        :total="result?.total || 0"
        v-model:current-page="pageNum"
        v-model:page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="load"
        @size-change="load"
      />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getDrilldown } from '@/api/yuqing/analytics/index';
import type { DrilldownParams, DrilldownResult } from '@/api/yuqing/analytics/types';

const props = defineProps<{ modelValue: boolean; params: DrilldownParams }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const loading = ref(false);
const result = ref<DrilldownResult | null>(null);
const pageNum = ref(1);
const pageSize = ref(20);

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const title = computed(() => '下钻明细 · ' + (props.params?.dimLabel || props.params?.dimKey || ''));

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      pageNum.value = 1;
      pageSize.value = props.params?.pageSize || 20;
      load();
    }
  }
);

async function load() {
  if (!props.params?.dimType) {
    return;
  }
  loading.value = true;
  try {
    const res = await getDrilldown({
      ...props.params,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    } as DrilldownParams);
    result.value = res.data || null;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.drill-body {
  padding: 0 4px;
}
.mt8 {
  margin-top: 8px;
}
</style>
`,
  },
];
