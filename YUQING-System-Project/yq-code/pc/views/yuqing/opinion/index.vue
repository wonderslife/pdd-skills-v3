<template>
  <div class="app-container">
    <!-- 组合筛选（验收标准 1：11 个维度） -->
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true" size="default">
      <el-form-item label="采集时间" prop="collectBeginTime">
        <el-date-picker
          v-model="collectRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 340px"
        />
      </el-form-item>
      <el-form-item label="发布时间" prop="publishBeginTime">
        <el-date-picker
          v-model="publishRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="监测任务" prop="taskId">
        <el-select v-model="queryParams.taskId" placeholder="全部任务" clearable filterable style="width: 180px">
          <el-option v-for="t in taskOptions" :key="t.taskId" :label="t.taskName" :value="t.taskId" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源渠道" prop="channelId">
        <el-select v-model="queryParams.channelId" placeholder="全部渠道" clearable filterable style="width: 180px">
          <el-option v-for="c in channelOptions" :key="c.channelId" :label="c.channelName" :value="c.channelId" />
        </el-select>
      </el-form-item>
      <el-form-item label="舆情属性" prop="sentiAttr">
        <el-select v-model="queryParams.sentiAttr" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_senti_attr" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="风险等级" prop="riskLevel">
        <el-select v-model="queryParams.riskLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="舆情分级" prop="opinionLevel">
        <el-select v-model="queryParams.opinionLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_opinion_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="传播量级" prop="spreadLevel">
        <el-select v-model="queryParams.spreadLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_spread_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="标签" prop="tagIds">
        <el-select v-model="queryParams.tagIds" multiple collapse-tags clearable placeholder="全部标签" style="width: 200px">
          <el-option v-for="t in tagOptions" :key="t.tagId" :label="t.tagName" :value="t.tagId" />
        </el-select>
      </el-form-item>
      <el-form-item label="采集来源" prop="collectSource">
        <el-select v-model="queryParams.collectSource" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_collect_source" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="清洗状态" prop="cleanStatus">
        <el-select v-model="queryParams.cleanStatus" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_clean_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="研判状态" prop="analyzeStatus">
        <el-select v-model="queryParams.analyzeStatus" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_analyze_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词" prop="keyword">
        <el-input v-model="queryParams.keyword" placeholder="标题/正文关键词" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="openExport" v-hasPermi="['yuqing:opinion:export']">导出Excel</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Tickets" @click="openExportLog" v-hasPermi="['yuqing:opinion:export']">导出记录</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Search" @click="openFullText">全文检索</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 数据范围说明（验收标准 8：让用户知道自己看到的是授权范围内的数据） -->
    <el-alert
      v-if="scopeDesc"
      :title="'当前数据范围：' + scopeDesc + '（已启用 ' + activeConditions + ' 个筛选条件）'"
      type="info"
      :closable="false"
      class="mb8"
    />

    <el-table v-loading="loading" :data="opinionList" @selection-change="handleSelectionChange" border>
      <el-table-column type="selection" width="45" align="center" />
      <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="260">
        <template #default="scope">
          <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">
            {{ scope.row.title }}
          </el-link>
          <span v-else>{{ scope.row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column label="来源渠道" prop="channelName" :show-overflow-tooltip="true" width="130" />
      <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
      <el-table-column label="发布作者" prop="author" :show-overflow-tooltip="true" width="120" />
      <el-table-column label="舆情属性" prop="sentiAttr" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_senti_attr" :value="scope.row.sentiAttr" />
        </template>
      </el-table-column>
      <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_risk_level" :value="scope.row.riskLevel" />
        </template>
      </el-table-column>
      <el-table-column label="分级" prop="opinionLevel" width="90" align="center">
        <template #default="scope">
          <dict-tag :options="yq_opinion_level" :value="scope.row.opinionLevel" />
        </template>
      </el-table-column>
      <el-table-column label="热度" prop="heatScore" width="80" align="center" sortable="custom" />
      <el-table-column label="采集时间" prop="collectTime" width="160" align="center" />
      <el-table-column label="研判状态" prop="analyzeStatus" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_analyze_status" :value="scope.row.analyzeStatus" />
        </template>
      </el-table-column>
      <el-table-column label="标记" width="110" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.alertFlag === '1'" size="small" type="danger">已预警</el-tag>
          <el-tag v-if="scope.row.pushFlag === '1'" size="small" type="warning" style="margin-left: 4px">已推送</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="openDetail(scope.row)" v-hasPermi="['yuqing:opinion:query']">详情</el-button>
          <el-button
            v-if="scope.row.clusterId"
            link
            type="primary"
            icon="Connection"
            @click="openCluster(scope.row)"
            v-hasPermi="['yuqing:opinion:query']"
          >
            事件
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态（验收标准 9）：给出可放宽的筛选建议，而不是一句「暂无数据」 -->
    <el-empty v-if="!loading && total === 0" :image-size="90" :description="emptyTitle">
      <div class="empty-hints">
        <div v-for="(h, i) in hints" :key="i" class="empty-hint-item">{{ i + 1 }}. {{ h }}</div>
      </div>
      <el-button v-if="!scopeEmpty" type="primary" plain @click="resetQuery">清空筛选条件</el-button>
    </el-empty>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 详情抽屉 -->
    <OpinionDetailDrawer v-model="detailOpen" :opinion-id="activeOpinionId" />

    <!-- 事件聚合抽屉 -->
    <ClusterTimelineDrawer v-model="clusterOpen" :cluster-id="activeClusterId" />

    <!-- 导出记录 -->
    <ExportLogDialog v-model="exportLogOpen" />

    <!-- 导出对话框（验收标准 5：条数与字段范围可配置） -->
    <el-dialog v-model="exportOpen" title="导出台账" width="640px" append-to-body>
      <el-alert
        :title="'当前筛选条件将导出约 ' + total + ' 条；超过 ' + syncLimit + ' 条将自动转为后台导出任务。'"
        type="info"
        :closable="false"
        class="mb8"
      />
      <el-form label-width="110px">
        <el-form-item label="导出字段">
          <div class="col-box">
            <el-checkbox-group v-model="exportForm.columns">
              <el-checkbox v-for="c in columnOptions" :key="c.field" :value="c.field">{{ c.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="tip">不勾选则导出全部 {{ columnOptions.length }} 列。</div>
        </el-form-item>
        <el-form-item label="导出条数">
          <el-radio-group v-model="rowLimitMode">
            <el-radio value="all">全部（最多 {{ maxExportRows }} 条）</el-radio>
            <el-radio value="limit">只导前</el-radio>
          </el-radio-group>
          <el-input-number v-if="rowLimitMode === 'limit'" v-model="exportForm.rowLimit" :min="1" :max="maxExportRows" style="width: 150px; margin-left: 8px" />
        </el-form-item>
        <el-form-item label="强制异步">
          <el-switch v-model="exportForm.async" />
          <span class="tip">开启后立即返回，完成后在「导出记录」中下载。</span>
        </el-form-item>
        <el-form-item label="文件名前缀">
          <el-input v-model="exportForm.fileNamePrefix" placeholder="默认「舆情台账」" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportOpen = false">取消</el-button>
        <el-button type="primary" :loading="exporting" @click="submitExport">开始导出</el-button>
      </template>
    </el-dialog>

    <!-- 全文检索（验收标准 7） -->
    <el-dialog v-model="searchOpen" title="全文检索" width="860px" append-to-body>
      <el-form :inline="true">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="标题或正文关键词" clearable style="width: 240px" @keyup.enter="doSearch" />
        </el-form-item>
        <el-form-item label="范围">
          <el-select v-model="searchForm.scope" style="width: 130px">
            <el-option label="标题+正文" value="both" />
            <el-option label="仅标题" value="title" />
            <el-option label="仅正文" value="content" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" :loading="searching" @click="doSearch">检索</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="searchResult.matchMode" :title="matchModeText" type="info" :closable="false" class="mb8" />
      <el-table :data="searchResult.hits || []" max-height="380" border>
        <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="200" />
        <el-table-column label="命中" prop="hitField" width="90" align="center">
          <template #default="scope">
            <el-tag size="small" type="info">{{ hitFieldText(scope.row.hitField) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="命中片段" min-width="320">
          <template #default="scope">
            <!-- fragments 由服务端先转义后标记，直接渲染是安全的 -->
            <div v-for="(f, i) in scope.row.fragments || []" :key="i" class="frag" v-html="f"></div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)" v-hasPermi="['yuqing:opinion:query']">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="searched && (searchResult.hits || []).length === 0" :description="searchEmptyText" :image-size="80" />
      <template #footer>
        <el-button @click="searchOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="YuqingOpinion">
import { ref, reactive, toRefs, computed, onMounted, getCurrentInstance } from 'vue';
import { ElMessage } from 'element-plus';
import { pageLedger, searchLedger, exportLedger, getLedgerExportStatus } from '@/api/yuqing/ledger';
import type { LedgerQueryParams, LedgerRowVO, LedgerSearchResultVO } from '@/api/yuqing/ledger/types';
import { optionselectYqTask } from '@/api/yuqing/task';
import { optionselectYqChannel } from '@/api/yuqing/channel';
import { listYqTag } from '@/api/yuqing/tag';
import OpinionDetailDrawer from './OpinionDetailDrawer.vue';
import ClusterTimelineDrawer from './ClusterTimelineDrawer.vue';
import ExportLogDialog from './ExportLogDialog.vue';

const { proxy } = getCurrentInstance() as any;
const {
  yq_senti_attr,
  yq_risk_level,
  yq_opinion_level,
  yq_spread_level,
  yq_collect_source,
  yq_clean_status,
  yq_analyze_status
} = proxy.useDict(
  'yq_senti_attr',
  'yq_risk_level',
  'yq_opinion_level',
  'yq_spread_level',
  'yq_collect_source',
  'yq_clean_status',
  'yq_analyze_status'
);

/** 导出上限的服务端口径（前端只做提示，真正的钳制在服务端） */
const syncLimit = ref(5000);
const maxExportRows = ref(200000);

/** 与后端 LedgerColumnCatalog 的字段名保持一致；标签文案与 @ExcelProperty 一致 */
const columnOptions = ref<Array<{ field: string; label: string }>>([
  { field: 'opinionId', label: '编号' },
  { field: 'title', label: '舆情标题' },
  { field: 'channelName', label: '来源渠道' },
  { field: 'taskName', label: '所属任务' },
  { field: 'publishTime', label: '发布时间' },
  { field: 'author', label: '发布作者' },
  { field: 'sentiAttr', label: '舆情属性' },
  { field: 'riskLevel', label: '风险等级' },
  { field: 'opinionLevel', label: '舆情分级' },
  { field: 'heatScore', label: '热度' },
  { field: 'collectSource', label: '采集来源' },
  { field: 'collectTime', label: '采集时间' },
  { field: 'analyzeStatus', label: '研判状态' },
  { field: 'cleanStatus', label: '清洗状态' },
  { field: 'region', label: '发布地域' },
  { field: 'clusterTitle', label: '关联事件' },
  { field: 'opinionUrl', label: '原文链接' }
]);

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const hints = ref<string[]>([]);
const scopeDesc = ref('');
const activeConditions = ref(0);
const scopeEmpty = ref(false);
const opinionList = ref<LedgerRowVO[]>([]);
const taskOptions = ref<any[]>([]);
const channelOptions = ref<any[]>([]);
const tagOptions = ref<any[]>([]);

const collectRange = ref<string[]>([]);
const publishRange = ref<string[]>([]);

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    collectBeginTime: undefined,
    collectEndTime: undefined,
    publishBeginTime: undefined,
    publishEndTime: undefined,
    taskId: undefined,
    channelId: undefined,
    sentiAttr: undefined,
    riskLevel: undefined,
    opinionLevel: undefined,
    spreadLevel: undefined,
    collectSource: undefined,
    cleanStatus: undefined,
    analyzeStatus: undefined,
    tagIds: [],
    keyword: undefined,
    orderBy: undefined,
    orderDesc: true
  } as LedgerQueryParams
});
const { queryParams } = toRefs(data);

const detailOpen = ref(false);
const clusterOpen = ref(false);
const exportLogOpen = ref(false);
const exportOpen = ref(false);
const exporting = ref(false);
const searchOpen = ref(false);
const searching = ref(false);
const searched = ref(false);
const activeOpinionId = ref<string | number>('');
const activeClusterId = ref<string | number>('');

const exportForm = reactive({
  columns: [] as string[],
  async: false,
  rowLimit: 1000,
  fileNamePrefix: ''
});
const rowLimitMode = ref<'all' | 'limit'>('all');

const searchForm = reactive({ keyword: '', scope: 'both' });
const searchResult = ref<LedgerSearchResultVO>({});

const emptyTitle = computed(() => {
  if (scopeEmpty.value) {
    return '没有授权给当前账号的舆情数据';
  }
  return '没有查询到符合条件的舆情';
});

const matchModeText = computed(() => {
  if (searchResult.value.matchMode === 'inverted-index') {
    return '检索口径：Doris 倒排索引';
  }
  return '检索口径：镜像库模糊扫描（未启用倒排索引，结果可能与正式检索存在差异）';
});

const searchEmptyText = computed(() => {
  const hs = searchResult.value.hints || [];
  return hs.length > 0 ? hs[0] : '没有命中结果，可尝试更短的词根或切换检索范围';
});

/** 查询列表（验收标准 1、2、8、9） */
async function getList() {
  loading.value = true;
  try {
    /* 时间区间控件与后端的两个字段之间做一次搬运，避免把区间数组直接发给后端 */
    queryParams.value.collectBeginTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[0] : undefined;
    queryParams.value.collectEndTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[1] : undefined;
    queryParams.value.publishBeginTime = publishRange.value && publishRange.value.length === 2 ? publishRange.value[0] : undefined;
    queryParams.value.publishEndTime = publishRange.value && publishRange.value.length === 2 ? publishRange.value[1] : undefined;

    const res = await pageLedger(queryParams.value);
    const page = res.data;
    opinionList.value = page?.rows ?? [];
    total.value = page?.total ?? 0;
    hints.value = page?.hints ?? [];
    scopeDesc.value = page?.scopeDesc ?? '';
    activeConditions.value = page?.activeConditions ?? 0;
    scopeEmpty.value = page?.scopeEmpty ?? false;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  collectRange.value = [];
  publishRange.value = [];
  queryParams.value = {
    pageNum: 1,
    pageSize: queryParams.value.pageSize,
    tagIds: [],
    orderDesc: true
  } as LedgerQueryParams;
  getList();
}

function handleSelectionChange() {
  /* 台账当前没有批量操作（写操作归研判/预警链路），保留钩子以便后续扩展 */
}

async function loadOptions() {
  try {
    const [t, c, g] = await Promise.all([
      optionselectYqTask({}),
      optionselectYqChannel({}),
      listYqTag({ pageNum: 1, pageSize: 200 })
    ]);
    taskOptions.value = t.data ?? [];
    channelOptions.value = c.data ?? [];
    tagOptions.value = g.data?.rows ?? [];
  } catch (e) {
    /* 下拉选项加载失败不应阻断台账本身，列表依旧可查 */
  }
}

function openDetail(row: any) {
  if (!row || row.opinionId === undefined || row.opinionId === null) {
    return;
  }
  activeOpinionId.value = row.opinionId;
  detailOpen.value = true;
}

function openCluster(row: any) {
  if (!row || row.clusterId === undefined || row.clusterId === null) {
    return;
  }
  activeClusterId.value = row.clusterId;
  clusterOpen.value = true;
}

function openExport() {
  exportForm.columns = [];
  exportForm.async = false;
  exportForm.rowLimit = Math.min(total.value > 0 ? total.value : 1000, maxExportRows.value);
  exportForm.fileNamePrefix = '';
  rowLimitMode.value = 'all';
  exportOpen.value = true;
}

/** 导出（验收标准 5、6） */
async function submitExport() {
  exporting.value = true;
  try {
    const res = await exportLedger({
      query: { ...queryParams.value, pageNum: undefined, pageSize: undefined },
      columns: exportForm.columns.length > 0 ? exportForm.columns : undefined,
      async: exportForm.async || undefined,
      rowLimit: rowLimitMode.value === 'limit' ? exportForm.rowLimit : undefined,
      fileNamePrefix: exportForm.fileNamePrefix || undefined,
      exportScope: 'ledger'
    });
    const r = res.data;
    if (!r) {
      ElMessage.error('导出未返回结果');
      return;
    }
    if (r.mode === 'sync' && r.fileUrl) {
      /* 同步导出：直接下载，不阻塞页面 */
      downloadByUrl(r.fileUrl, r.fileName);
      ElMessage.success(r.message || '导出完成');
      exportOpen.value = false;
      return;
    }
    exportOpen.value = false;
    ElMessage.info(r.message || '已转为后台导出任务');
    pollExport(r.exportId);
  } finally {
    exporting.value = false;
  }
}

/** 异步导出轮询（验收标准 6：完成后推送下载链接，这里给出页面内的兜底获取方式） */
let pollTimer: any = null;
function pollExport(exportId: string | number | undefined) {
  if (exportId === undefined || exportId === null) {
    return;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  let tries = 0;
  pollTimer = setInterval(async () => {
    tries += 1;
    try {
      const res = await getLedgerExportStatus(exportId);
      const r = res.data;
      if (!r) {
        return;
      }
      if (r.status === 'success' && r.fileUrl) {
        clearInterval(pollTimer);
        pollTimer = null;
        ElMessage.success('后台导出已完成，正在下载');
        downloadByUrl(r.fileUrl, r.fileName);
      } else if (r.status === 'failed') {
        clearInterval(pollTimer);
        pollTimer = null;
        ElMessage.error('后台导出失败：' + (r.failReason || '未知原因'));
      }
    } catch (e) {
      /* 轮询期间的网络抖动不终止任务，下一轮继续 */
    }
    if (tries >= 60 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      ElMessage.warning('导出任务仍在进行，请稍后在「导出记录」中查看');
    }
  }, 3000);
}

function downloadByUrl(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) {
    a.download = fileName;
  }
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openExportLog() {
  exportLogOpen.value = true;
}

function openFullText() {
  searchForm.keyword = queryParams.value.keyword || '';
  searchForm.scope = 'both';
  searchResult.value = {};
  searched.value = false;
  searchOpen.value = true;
}

async function doSearch() {
  if (!searchForm.keyword || !searchForm.keyword.trim()) {
    ElMessage.warning('请输入检索关键词');
    return;
  }
  searching.value = true;
  try {
    const res = await searchLedger(searchForm.keyword.trim(), searchForm.scope);
    searchResult.value = res.data ?? {};
    searched.value = true;
  } finally {
    searching.value = false;
  }
}

function hitFieldText(v?: string) {
  if (v === 'title') {
    return '标题';
  }
  if (v === 'content') {
    return '正文';
  }
  if (v === 'both') {
    return '标题+正文';
  }
  return '—';
}

onMounted(() => {
  loadOptions();
  getList();
});
</script>

<style scoped>
.mb8 {
  margin-bottom: 8px;
}
.tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.col-box {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 6px 10px;
  width: 100%;
}
.empty-hints {
  text-align: left;
  max-width: 640px;
  margin: 12px auto 16px;
}
.empty-hint-item {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 22px;
}
.frag {
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-regular);
}
:deep(.yq-hit) {
  color: var(--el-color-danger);
  font-style: normal;
  font-weight: 600;
  background: var(--el-color-danger-light-9);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
