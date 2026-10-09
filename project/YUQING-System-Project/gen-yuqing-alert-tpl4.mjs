/**
 * F-010 / F-011 前端模板（PC api + PC views + H5 页面）
 *
 * ⚠ 归属说明（避免与 gen-yuqing.mjs 抢同一产物）：
 *   - alert/alertRule/pushRule/pushTemplate/pushRecord 这几张表在 gen-yuqing.mjs 里是
 *     `pcPage: false`，生成器只产出 api/index.ts + types.ts，**不产出 views**。
 *   - 因此 views 归本生成器所有；本文件只新增 `dispatch.ts`，
 *     绝不覆盖 gen-yuqing.mjs 的 `index.ts` / `types.ts`。
 *   - 若日后把某表改成 `pcPage: true`，必须先删除本文件里对应的 view 模板，否则两个生成器会互相覆盖。
 *
 * 约定：Vue/TS 产物里不使用反引号与模板字符串插值（规避三层转义坑）。
 */
export const WEB_PC_TPL = [

  /* -------------------------------------------------------------- PC api */
  {
    rel: 'pc/api/yuqing/alert/dispatch.ts',
    content: `import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 预警扫描请求
 */
export interface AlertScanRequest {
  taskId?: string | number;
  windowMinutes?: number;
  dryRun?: boolean;
  pushAfterCreate?: boolean;
}

/**
 * 预警扫描结果
 */
export interface AlertScanStats {
  windowMinutes?: number;
  dryRun?: boolean;
  ruleCount?: number;
  scanned?: number;
  suppressed?: number;
  decisionCount?: number;
  created?: number;
  alertIds?: Array<string | number>;
  message?: string;
  details?: string[];
}

/**
 * 预警处置提交
 */
export interface AlertProcessForm {
  alertId: string | number;
  status: string;
  processRemark?: string;
}

/**
 * 手动触发预警扫描（落库）
 */
export const scanAlert = (data?: AlertScanRequest): AxiosPromise<AlertScanStats> => {
  return request({
    url: '/yuqing/alert/scan',
    method: 'post',
    data: data || {}
  });
};

/**
 * 预览预警命中（不落库）
 */
export const previewAlert = (data?: AlertScanRequest): AxiosPromise<AlertScanStats> => {
  return request({
    url: '/yuqing/alert/preview',
    method: 'post',
    data: data || {}
  });
};

/**
 * 处置预警（已处置/已忽略必须填说明，服务端会强校验）
 */
export const processAlert = (data: AlertProcessForm): AxiosPromise => {
  return request({
    url: '/yuqing/alert/process',
    method: 'post',
    data
  });
};

/**
 * 未处置计数（列表红标与台账提示用）
 */
export const alertPendingCount = (): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/pendingCount',
    method: 'get'
  });
};

/**
 * 按时间与级别统计
 */
export const alertStatistics = (params?: { beginDate?: string; endDate?: string }): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/statistics',
    method: 'get',
    params
  });
};

/**
 * 手动把指定预警推送到企业微信
 */
export const pushAlerts = (alertIds: Array<string | number>): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/alert/push',
    method: 'post',
    data: alertIds
  });
};
`,
  },

  {
    rel: 'pc/api/yuqing/push/dispatch.ts',
    content: `import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/**
 * 推送执行统计
 */
export interface PushStats {
  attempted?: number;
  sent?: number;
  failed?: number;
  deferred?: number;
  skipped?: number;
  recordIds?: Array<string | number>;
  details?: string[];
}

/**
 * 重发一条失败记录
 */
export const retryPush = (recordId: string | number): AxiosPromise<PushStats> => {
  return request({
    url: '/yuqing/push/retry/' + recordId,
    method: 'post'
  });
};

/**
 * 刷出免打扰顺延的定时批量
 */
export const flushPush = (): AxiosPromise<number> => {
  return request({
    url: '/yuqing/push/flush',
    method: 'post'
  });
};

/**
 * 推送量与成功率统计
 */
export const pushStatistics = (params?: { beginDate?: string; endDate?: string }): AxiosPromise<Record<string, any>> => {
  return request({
    url: '/yuqing/push/statistics',
    method: 'get',
    params
  });
};
`,
  },

  /* ------------------------------------------------- 预警处置台（F-010） */
  {
    rel: 'pc/views/yuqing/alert/index.vue',
    content: `<template>
  <div class="app-container">
    <el-row :gutter="12" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">未处置</div>
          <div class="stat-value red">{{ pending.pending }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">处置中</div>
          <div class="stat-value">{{ pending.processing }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">需醒目提示（预警/紧急且未处置）</div>
          <div class="stat-value red">{{ pending.highlightPending }}</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">当前筛选结果</div>
          <div class="stat-value">{{ total }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="预警标题" prop="alertTitle">
        <el-input v-model="queryParams.alertTitle" placeholder="请输入预警标题" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="预警级别" prop="alertLevel">
        <el-select v-model="queryParams.alertLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_alert_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="触发场景" prop="triggerScene">
        <el-select v-model="queryParams.triggerScene" placeholder="全部" clearable style="width: 150px">
          <el-option v-for="d in yq_alert_scene" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="处置状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_alert_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="推送结果" prop="pushResult">
        <el-select v-model="queryParams.pushResult" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button v-hasPermi="['yuqing:alert:list']" type="primary" plain icon="Radar" :loading="scanning" @click="handleScan()">手动扫描</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button v-hasPermi="['yuqing:alert:list']" type="info" plain icon="View" :loading="scanning" @click="handlePreview()">预览命中</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button v-hasPermi="['yuqing:push:edit']" type="warning" plain icon="Promotion" :disabled="multiple" @click="handlePush()">推送所选</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button v-hasPermi="['yuqing:alert:list']" type="success" plain icon="DataLine" @click="handleStatistics()">统计</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="alertList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="预警标题" prop="alertTitle" :show-overflow-tooltip="true" min-width="220">
        <template #default="scope">
          <el-badge v-if="isHighlight(scope.row)" is-dot type="danger">
            <span class="red">{{ scope.row.alertTitle }}</span>
          </el-badge>
          <span v-else>{{ scope.row.alertTitle }}</span>
        </template>
      </el-table-column>
      <el-table-column label="触发场景" prop="triggerScene" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_alert_scene" :value="scope.row.triggerScene" />
        </template>
      </el-table-column>
      <el-table-column label="预警级别" prop="alertLevel" width="100" align="center">
        <template #default="scope">
          <el-tag :type="levelTag(scope.row.alertLevel)">{{ levelText(scope.row.alertLevel) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="触发值" prop="triggerValue" :show-overflow-tooltip="true" min-width="200" />
      <el-table-column label="触发时间" prop="triggerTime" width="160" align="center" />
      <el-table-column label="处置状态" prop="status" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_alert_status" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="推送结果" prop="pushResult" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_status" :value="scope.row.pushResult" />
        </template>
      </el-table-column>
      <el-table-column label="处置人" prop="processByName" width="100" align="center" />
      <el-table-column label="处置时间" prop="processTime" width="160" align="center" />
      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="scope">
          <el-button v-hasPermi="['yuqing:alert:process']" link type="primary" icon="Edit" :disabled="!canProcess(scope.row)" @click="openProcess(scope.row)">处置</el-button>
          <el-button v-hasPermi="['yuqing:push:edit']" link type="warning" icon="Promotion" @click="handlePush(scope.row)">推送</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" :title="title" width="620px" append-to-body>
      <el-form ref="alertRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="预警标题">
          <el-input v-model="form.alertTitle" disabled />
        </el-form-item>
        <el-form-item label="触发值">
          <el-input v-model="form.triggerValue" type="textarea" :rows="2" disabled />
        </el-form-item>
        <el-form-item label="处置状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择处置状态" style="width: 100%">
            <el-option label="处置中" value="processing" />
            <el-option label="已处置" value="handled" />
            <el-option label="已忽略" value="ignored" />
          </el-select>
        </el-form-item>
        <el-form-item label="处置说明" prop="processRemark">
          <el-input v-model="form.processRemark" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="已处置 / 已忽略 必填，请写明具体处置动作或忽略理由" />
        </el-form-item>
        <el-alert v-if="requireRemark" type="warning" :closable="false" show-icon title="标记为「已处置」或「已忽略」时必须填写处置说明，服务端也会强校验。" />
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitProcess">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqAlert" lang="ts">
import { ref, reactive, toRefs, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqAlertQuery, YqAlertVO } from '@/api/yuqing/alert/types';
import { listYqAlert } from '@/api/yuqing/alert/index';
import { scanAlert, previewAlert, processAlert, alertPendingCount, alertStatistics, pushAlerts } from '@/api/yuqing/alert/dispatch';
import { useDict } from '@/utils/dict';

const { yq_alert_level, yq_alert_scene, yq_alert_status, yq_push_status } = toRefs<any>(
  useDict('yq_alert_level', 'yq_alert_scene', 'yq_alert_status', 'yq_push_status')
);

const loading = ref(true);
const showSearch = ref(true);
const scanning = ref(false);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const multiple = ref(true);
const alertList = ref<YqAlertVO[]>([]);
const queryRef = ref();
const alertRef = ref();
const pending = ref<Record<string, any>>({ pending: 0, processing: 0, highlightPending: 0 });

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    alertTitle: undefined,
    alertLevel: undefined,
    triggerScene: undefined,
    status: undefined,
    pushResult: undefined
  } as YqAlertQuery,
  form: {} as Record<string, any>
});
const { queryParams, form } = toRefs(data);

const requireRemark = computed(() => form.value.status === 'handled' || form.value.status === 'ignored');

const rules = {
  status: [{ required: true, message: '请选择处置状态', trigger: 'change' }],
  processRemark: [
    {
      validator: (_rule: any, value: any, callback: any) => {
        const need = form.value.status === 'handled' || form.value.status === 'ignored';
        if (need && (!value || String(value).trim().length < 5)) {
          callback(new Error('处置说明不少于 5 个字符'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ]
};

const HIGHLIGHT = ['warning', 'urgent'];

function isHighlight(row: YqAlertVO) {
  return row.status === 'pending' && HIGHLIGHT.indexOf(String(row.alertLevel)) >= 0;
}

function canProcess(row: YqAlertVO) {
  return row.status !== 'handled' && row.status !== 'ignored';
}

function levelText(level: any) {
  return String(level) === 'urgent' ? '紧急' : String(level) === 'warning' ? '预警' : String(level) === 'attention' ? '关注' : '提示';
}

function levelTag(level: any): 'primary' | 'success' | 'info' | 'warning' | 'danger' {
  const v = String(level);
  if (v === 'urgent') {
    return 'danger';
  }
  if (v === 'warning') {
    return 'warning';
  }
  if (v === 'attention') {
    return 'primary';
  }
  return 'info';
}

async function getList() {
  loading.value = true;
  try {
    const res = await listYqAlert(queryParams.value);
    alertList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

async function loadPending() {
  const res = await alertPendingCount();
  pending.value = res.data || { pending: 0, processing: 0, highlightPending: 0 };
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqAlertQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqAlertVO[]) {
  ids.value = selection.map((item) => item.alertId!) as Array<string | number>;
  multiple.value = !selection.length;
}

async function handleScan() {
  scanning.value = true;
  try {
    const res = await scanAlert({});
    const s = res.data || {};
    await showScanResult(s, '扫描完成');
    await getList();
    await loadPending();
  } finally {
    scanning.value = false;
  }
}

async function handlePreview() {
  scanning.value = true;
  try {
    const res = await previewAlert({});
    await showScanResult(res.data || {}, '预览完成（未落库）');
  } finally {
    scanning.value = false;
  }
}

async function showScanResult(s: Record<string, any>, title2: string) {
  let html = '<p>候选舆情：' + (s.scanned || 0) + ' 条 ｜ 命中：' + (s.decisionCount || 0)
    + ' 条 ｜ 抑制（已预警/冷却期）：' + (s.suppressed || 0) + ' 条 ｜ 落库：' + (s.created || 0) + ' 条</p>';
  const details: string[] = s.details || [];
  if (details.length) {
    html += '<p>命中明细：</p><ul style="margin:0;padding-left:18px;max-height:240px;overflow:auto">';
    for (let i = 0; i < details.length; i++) {
      html += '<li>' + details[i] + '</li>';
    }
    html += '</ul>';
  }
  await ElMessageBox.alert(html, title2, { dangerouslyUseHTMLString: true });
}

async function handlePush(row?: YqAlertVO) {
  const target = row?.alertId ? [row.alertId] : ids.value;
  if (!target.length) {
    ElMessage.warning('请先选择要推送的预警');
    return;
  }
  await ElMessageBox.confirm('确认把 ' + target.length + ' 条预警推送到企业微信？', '提示', { type: 'warning' });
  const res = await pushAlerts(target);
  const s = res.data || {};
  ElMessage.success('推送完成：成功 ' + (s.sent || 0) + '，失败 ' + (s.failed || 0) + '，顺延 ' + (s.deferred || 0));
  await getList();
}

function openProcess(row: YqAlertVO) {
  form.value = {
    alertId: row.alertId,
    alertTitle: row.alertTitle,
    triggerValue: row.triggerValue,
    status: 'processing',
    processRemark: ''
  };
  title.value = '预警处置';
  open.value = true;
}

function cancel() {
  open.value = false;
}

async function submitProcess() {
  await alertRef.value?.validate();
  await processAlert({
    alertId: form.value.alertId,
    status: form.value.status,
    processRemark: form.value.processRemark
  });
  ElMessage.success('处置成功');
  open.value = false;
  await getList();
  await loadPending();
}

async function handleStatistics() {
  const res = await alertStatistics({});
  const s = res.data || {};
  const byLevel = s.byLevel || {};
  let rows = '';
  const keys = Object.keys(byLevel);
  for (let i = 0; i < keys.length; i++) {
    rows += '<tr><td>' + keys[i] + '</td><td>' + byLevel[keys[i]] + '</td></tr>';
  }
  const html = '<p>统计区间：' + (s.from || '') + ' ~ ' + (s.to || '') + '，共 ' + (s.total || 0)
    + ' 条，已处置率 ' + ((s.handledRate || 0) * 100).toFixed(1) + '%</p>'
    + '<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">'
    + '<tr><th>预警级别</th><th>条数</th></tr>' + rows + '</table>';
  await ElMessageBox.alert(html, '预警统计（近 7 天）', { dangerouslyUseHTMLString: true });
}

onMounted(() => {
  getList();
  loadPending();
});
</script>

<style scoped>
.stat-row {
  margin-bottom: 12px;
}
.stat-card {
  text-align: center;
}
.stat-label {
  color: #909399;
  font-size: 13px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  margin-top: 6px;
}
.red {
  color: #f56c6c;
}
</style>
`,
  },

  /* --------------------------------------------------------- 预警规则 CRUD */
  {
    rel: 'pc/views/yuqing/alertRule/index.vue',
    content: `<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="queryParams.ruleName" placeholder="请输入规则名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="预警级别" prop="alertLevel">
        <el-select v-model="queryParams.alertLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_alert_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="ruleList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="规则名称" prop="ruleName" :show-overflow-tooltip="true" min-width="150" />
      <el-table-column label="触发场景" prop="triggerScenes" :show-overflow-tooltip="true" min-width="180" />
      <el-table-column label="统计窗口(分)" prop="windowMinutes" width="110" align="center" />
      <el-table-column label="条数阈值" prop="countThreshold" width="90" align="center" />
      <el-table-column label="热度阈值" prop="heatThreshold" width="90" align="center" />
      <el-table-column label="风险阈值" prop="riskLevelThreshold" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_risk_level" :value="scope.row.riskLevelThreshold" />
        </template>
      </el-table-column>
      <el-table-column label="传播阈值" prop="spreadThreshold" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_spread_level" :value="scope.row.spreadThreshold" />
        </template>
      </el-table-column>
      <el-table-column label="突发倍数" prop="burstRatio" width="90" align="center" />
      <el-table-column label="最小条数" prop="minBurstCount" width="90" align="center" />
      <el-table-column label="冷却(分)" prop="cooldownMinutes" width="90" align="center" />
      <el-table-column label="预警级别" prop="alertLevel" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_alert_level" :value="scope.row.alertLevel" />
        </template>
      </el-table-column>
      <el-table-column label="推送级别" prop="pushLevel" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_level" :value="scope.row.pushLevel" />
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="80" align="center">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" :title="title" width="760px" append-to-body>
      <el-form ref="ruleRef" :model="form" :rules="rules" label-width="130px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="form.ruleName" placeholder="请输入规则名称" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="触发场景" prop="triggerScenes">
              <el-select v-model="sceneList" multiple placeholder="请选择触发场景" style="width: 100%">
                <el-option v-for="d in yq_alert_scene" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="统计时间窗口" prop="windowMinutes">
              <el-input-number v-model="form.windowMinutes" :min="1" :max="1440" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="条数阈值" prop="countThreshold">
              <el-input-number v-model="form.countThreshold" :min="0" :max="100000" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="热度阈值" prop="heatThreshold">
              <el-input-number v-model="form.heatThreshold" :min="0" :max="100" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="最低触发风险等级" prop="riskLevelThreshold">
              <el-select v-model="form.riskLevelThreshold" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最低触发传播量级" prop="spreadThreshold">
              <el-select v-model="form.spreadThreshold" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_spread_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="突发增量倍数" prop="burstRatio">
              <el-input-number v-model="form.burstRatio" :min="0.1" :max="999" :step="0.1" :precision="2" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="突发最小条数" prop="minBurstCount">
              <el-input-number v-model="form.minBurstCount" :min="1" :max="10000" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="事件冷却(分钟)" prop="cooldownMinutes">
              <el-input-number v-model="form.cooldownMinutes" :min="1" :max="10080" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="重点专项标签" prop="topicTags">
          <el-input v-model="form.topicTags" placeholder="逗号分隔；命中舆情话题标签即触发 special_topic 场景" maxlength="500" />
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="预警级别" prop="alertLevel">
              <el-select v-model="form.alertLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_alert_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联动推送级别" prop="pushLevel">
              <el-select v-model="form.pushLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="额外通知人" prop="notifyUserIds">
          <el-input v-model="form.notifyUserIds" placeholder="用户ID，逗号分隔（可为空）" maxlength="1000" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in sys_normal_disable" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqAlertRule" lang="ts">
import { ref, reactive, toRefs, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqAlertRuleForm, YqAlertRuleQuery, YqAlertRuleVO } from '@/api/yuqing/alertRule/types';
import { listYqAlertRule, getYqAlertRule, delYqAlertRule, addYqAlertRule, updateYqAlertRule } from '@/api/yuqing/alertRule/index';
import { useDict } from '@/utils/dict';

const { yq_alert_level, yq_alert_scene, yq_risk_level, yq_spread_level, yq_push_level, sys_normal_disable } = toRefs<any>(
  useDict('yq_alert_level', 'yq_alert_scene', 'yq_risk_level', 'yq_spread_level', 'yq_push_level', 'sys_normal_disable')
);

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const ruleList = ref<YqAlertRuleVO[]>([]);
const queryRef = ref();
const ruleRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, ruleName: undefined, alertLevel: undefined } as YqAlertRuleQuery,
  form: {} as YqAlertRuleForm
});
const { queryParams, form } = toRefs(data);

/** 场景多选与 form.triggerScenes 的双向桥接 */
const sceneList = computed({
  get() {
    const v = form.value.triggerScenes;
    return v ? String(v).split(',').filter((s) => s) : [];
  },
  set(val: string[]) {
    form.value.triggerScenes = val.join(',');
  }
});

const rules = {
  ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
  triggerScenes: [{ required: true, message: '至少选择一个触发场景', trigger: 'change' }],
  windowMinutes: [{ required: true, message: '统计时间窗口不能为空', trigger: 'blur' }],
  alertLevel: [{ required: true, message: '预警级别不能为空', trigger: 'change' }],
  pushLevel: [{ required: true, message: '联动推送级别不能为空', trigger: 'change' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqAlertRule(queryParams.value);
    ruleList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = {
    ruleId: undefined,
    ruleName: undefined,
    triggerScenes: 'new_negative,high_risk',
    windowMinutes: 10,
    countThreshold: 0,
    heatThreshold: 0,
    riskLevelThreshold: 'moderate',
    spreadThreshold: 'medium',
    burstRatio: 3,
    minBurstCount: 5,
    cooldownMinutes: 360,
    topicTags: undefined,
    alertLevel: 'warning',
    pushLevel: 'immediate',
    notifyUserIds: undefined,
    status: '0'
  } as YqAlertRuleForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqAlertRuleQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqAlertRuleVO[]) {
  ids.value = selection.map((item) => item.ruleId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增预警规则';
}

async function handleUpdate(row?: YqAlertRuleVO) {
  reset();
  const _id = row?.ruleId ?? ids.value[0];
  const res = await getYqAlertRule(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改预警规则';
}

async function submitForm() {
  await ruleRef.value?.validate();
  if (form.value.ruleId != null) {
    await updateYqAlertRule(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqAlertRule(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqAlertRuleVO) {
  const target = row?.ruleId ? [row.ruleId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条预警规则？', '提示', { type: 'warning' });
  await delYqAlertRule(target);
  ElMessage.success('删除成功');
  await getList();
}

onMounted(() => {
  getList();
});
</script>
`,
  },

  /* --------------------------------------------------------- 推送规则 CRUD */
  {
    rel: 'pc/views/yuqing/pushRule/index.vue',
    content: `<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="queryParams.ruleName" placeholder="请输入规则名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="推送级别" prop="pushLevel">
        <el-select v-model="queryParams.pushLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标类型" prop="targetType">
        <el-select v-model="queryParams.targetType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_target" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Refresh" :loading="flushing" @click="handleFlush()">刷出顺延批量</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="ruleList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="规则名称" prop="ruleName" :show-overflow-tooltip="true" min-width="160" />
      <el-table-column label="推送场景" prop="pushScenes" :show-overflow-tooltip="true" min-width="180" />
      <el-table-column label="推送级别" prop="pushLevel" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_level" :value="scope.row.pushLevel" />
        </template>
      </el-table-column>
      <el-table-column label="目标类型" prop="targetType" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_target" :value="scope.row.targetType" />
        </template>
      </el-table-column>
      <el-table-column label="目标ID" prop="targetIds" :show-overflow-tooltip="true" min-width="140" />
      <el-table-column label="推送模板" prop="templateName" width="140" align="center" />
      <el-table-column label="免打扰" width="130" align="center">
        <template #default="scope">
          <span>{{ scope.row.quietStart }} ~ {{ scope.row.quietEnd }}</span>
        </template>
      </el-table-column>
      <el-table-column label="重试上限" prop="maxRetry" width="90" align="center" />
      <el-table-column label="状态" prop="status" width="80" align="center">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" :title="title" width="720px" append-to-body>
      <el-form ref="ruleRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="推送场景" prop="pushScenes">
          <el-select v-model="sceneList" multiple placeholder="请选择推送场景" style="width: 100%">
            <el-option v-for="d in yq_push_scene" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="推送级别" prop="pushLevel">
              <el-select v-model="form.pushLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="推送模板" prop="pushTemplateId">
              <el-select v-model="form.pushTemplateId" placeholder="不选则用内置模板" clearable style="width: 100%">
                <el-option v-for="t in templateOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="form.pushLevel === 'scheduled'" label="定时批量 cron" prop="scheduleCron">
          <el-input v-model="form.scheduleCron" placeholder="如 0 0 9 * * ?（留空则由定时任务按节拍刷出）" maxlength="50" />
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="目标类型" prop="targetType">
              <el-select v-model="form.targetType" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_target" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标ID" prop="targetIds">
              <el-input v-model="form.targetIds" placeholder="角色ID / 部门ID / 用户ID，逗号分隔" maxlength="1000" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="免打扰开始" prop="quietStart">
              <el-input v-model="form.quietStart" placeholder="HH:mm，如 22:00" maxlength="5" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="免打扰结束" prop="quietEnd">
              <el-input v-model="form.quietEnd" placeholder="HH:mm，如 08:00" maxlength="5" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" show-icon title="免打扰时段内，定时批量会顺延到时段结束再发；高风险即时推送会穿透（可在配置中关闭）。开始与结束相同视为未配置。" />
        <el-form-item label="重试上限" prop="maxRetry">
          <el-input-number v-model="form.maxRetry" :min="0" :max="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in sys_normal_disable" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqPushRule" lang="ts">
import { ref, reactive, toRefs, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqPushRuleForm, YqPushRuleQuery, YqPushRuleVO } from '@/api/yuqing/pushRule/types';
import { listYqPushRule, getYqPushRule, delYqPushRule, addYqPushRule, updateYqPushRule } from '@/api/yuqing/pushRule/index';
import { optionselectYqPushTemplate } from '@/api/yuqing/pushTemplate/index';
import { flushPush } from '@/api/yuqing/push/dispatch';
import { useDict } from '@/utils/dict';

const { yq_push_level, yq_push_scene, yq_push_target, sys_normal_disable } = toRefs<any>(
  useDict('yq_push_level', 'yq_push_scene', 'yq_push_target', 'sys_normal_disable')
);

const loading = ref(true);
const showSearch = ref(true);
const flushing = ref(false);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const ruleList = ref<YqPushRuleVO[]>([]);
const templateOptions = ref<Array<{ label: string; value: any }>>([]);
const queryRef = ref();
const ruleRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, ruleName: undefined, pushLevel: undefined, targetType: undefined } as YqPushRuleQuery,
  form: {} as YqPushRuleForm
});
const { queryParams, form } = toRefs(data);

const sceneList = computed({
  get() {
    const v = form.value.pushScenes;
    return v ? String(v).split(',').filter((s) => s) : [];
  },
  set(val: string[]) {
    form.value.pushScenes = val.join(',');
  }
});

const rules = {
  ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
  pushScenes: [{ required: true, message: '至少选择一个推送场景', trigger: 'change' }],
  pushLevel: [{ required: true, message: '推送级别不能为空', trigger: 'change' }],
  targetType: [{ required: true, message: '目标类型不能为空', trigger: 'change' }],
  targetIds: [{ required: true, message: '目标ID不能为空', trigger: 'blur' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqPushRule(queryParams.value);
    ruleList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

async function loadTemplates() {
  const res = await optionselectYqPushTemplate({});
  templateOptions.value = (res.data || []).map((t: any) => ({ label: t.templateName, value: t.templateId }));
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = {
    ruleId: undefined,
    ruleName: undefined,
    pushScenes: 'high_risk',
    pushLevel: 'immediate',
    scheduleCron: undefined,
    pushTemplateId: undefined,
    targetType: 'user',
    targetIds: undefined,
    quietStart: '22:00',
    quietEnd: '08:00',
    maxRetry: 3,
    status: '0'
  } as YqPushRuleForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqPushRuleQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqPushRuleVO[]) {
  ids.value = selection.map((item) => item.ruleId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增推送规则';
}

async function handleUpdate(row?: YqPushRuleVO) {
  reset();
  const _id = row?.ruleId ?? ids.value[0];
  const res = await getYqPushRule(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改推送规则';
}

async function submitForm() {
  await ruleRef.value?.validate();
  if (form.value.ruleId != null) {
    await updateYqPushRule(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqPushRule(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqPushRuleVO) {
  const target = row?.ruleId ? [row.ruleId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条推送规则？', '提示', { type: 'warning' });
  await delYqPushRule(target);
  ElMessage.success('删除成功');
  await getList();
}

async function handleFlush() {
  flushing.value = true;
  try {
    const res = await flushPush();
    ElMessage.success('已刷出 ' + (res.data || 0) + ' 条顺延的定时批量推送');
  } finally {
    flushing.value = false;
  }
}

onMounted(() => {
  getList();
  loadTemplates();
});
</script>
`,
  },

  /* --------------------------------------------------------- 推送模板 CRUD */
  {
    rel: 'pc/views/yuqing/pushTemplate/index.vue',
    content: `<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="模板名称" prop="templateName">
        <el-input v-model="queryParams.templateName" placeholder="请输入模板名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="内容形式" prop="contentType">
        <el-select v-model="queryParams.contentType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_content_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="tplList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="模板名称" prop="templateName" :show-overflow-tooltip="true" min-width="160" />
      <el-table-column label="内容形式" prop="contentType" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_content_type" :value="scope.row.contentType" />
        </template>
      </el-table-column>
      <el-table-column label="包含字段" prop="fieldList" :show-overflow-tooltip="true" min-width="240" />
      <el-table-column label="状态" prop="status" width="80" align="center">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" :title="title" width="760px" append-to-body>
      <el-form ref="tplRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="form.templateName" placeholder="请输入模板名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="内容形式" prop="contentType">
          <el-radio-group v-model="form.contentType">
            <el-radio v-for="d in yq_push_content_type" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="模板正文" prop="bodyTemplate">
          <el-input v-model="form.bodyTemplate" type="textarea" :rows="8" placeholder="支持占位符：{title} {level} {channel} {content} {url} {pushTime}" />
        </el-form-item>
        <el-form-item label="包含字段" prop="fieldList">
          <el-input v-model="form.fieldList" placeholder="逗号分隔，如：标题,等级,平台,时间,内容,风险,态势,链接,建议,推送时间" maxlength="1000" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon title="统一模板固定包含 10 要素：舆情标题、舆情等级、发布平台、发布时间、舆情核心内容、风险分析、传播态势、舆情原文链接、处置建议、推送时间。长正文会自动截断并保留原文链接。" />
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in sys_normal_disable" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqPushTemplate" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqPushTemplateForm, YqPushTemplateQuery, YqPushTemplateVO } from '@/api/yuqing/pushTemplate/types';
import { listYqPushTemplate, getYqPushTemplate, delYqPushTemplate, addYqPushTemplate, updateYqPushTemplate } from '@/api/yuqing/pushTemplate/index';
import { useDict } from '@/utils/dict';

const { yq_push_content_type, sys_normal_disable } = toRefs<any>(useDict('yq_push_content_type', 'sys_normal_disable'));

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const tplList = ref<YqPushTemplateVO[]>([]);
const queryRef = ref();
const tplRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, templateName: undefined, contentType: undefined } as YqPushTemplateQuery,
  form: {} as YqPushTemplateForm
});
const { queryParams, form } = toRefs(data);

const rules = {
  templateName: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  contentType: [{ required: true, message: '内容形式不能为空', trigger: 'change' }],
  bodyTemplate: [{ required: true, message: '模板正文不能为空', trigger: 'blur' }],
  fieldList: [{ required: true, message: '包含字段不能为空', trigger: 'blur' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqPushTemplate(queryParams.value);
    tplList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = {
    templateId: undefined,
    templateName: undefined,
    contentType: 'detail',
    bodyTemplate: undefined,
    fieldList: '标题,等级,平台,时间,内容,风险,态势,链接,建议,推送时间',
    status: '0'
  } as YqPushTemplateForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqPushTemplateQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqPushTemplateVO[]) {
  ids.value = selection.map((item) => item.templateId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增推送模板';
}

async function handleUpdate(row?: YqPushTemplateVO) {
  reset();
  const _id = row?.templateId ?? ids.value[0];
  const res = await getYqPushTemplate(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改推送模板';
}

async function submitForm() {
  await tplRef.value?.validate();
  if (form.value.templateId != null) {
    await updateYqPushTemplate(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqPushTemplate(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqPushTemplateVO) {
  const target = row?.templateId ? [row.templateId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条推送模板？', '提示', { type: 'warning' });
  await delYqPushTemplate(target);
  ElMessage.success('删除成功');
  await getList();
}

onMounted(() => {
  getList();
});
</script>
`,
  },

  /* --------------------------------------------------------- 推送记录列表 */
  {
    rel: 'pc/views/yuqing/pushRecord/index.vue',
    content: `<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="推送场景" prop="pushScene">
        <el-select v-model="queryParams.pushScene" placeholder="全部" clearable style="width: 150px">
          <el-option v-for="d in yq_push_scene" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="发送状态" prop="sendStatus">
        <el-select v-model="queryParams.sendStatus" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="推送级别" prop="pushLevel">
        <el-select v-model="queryParams.pushLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="DataLine" @click="handleStatistics()">成功率统计</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="info" plain icon="Refresh" :loading="flushing" @click="handleFlush()">刷出顺延批量</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="recordList">
      <el-table-column label="推送规则" prop="ruleName" :show-overflow-tooltip="true" min-width="150" />
      <el-table-column label="推送场景" prop="pushScene" width="130" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_scene" :value="scope.row.pushScene" />
        </template>
      </el-table-column>
      <el-table-column label="推送级别" prop="pushLevel" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_level" :value="scope.row.pushLevel" />
        </template>
      </el-table-column>
      <el-table-column label="发送状态" prop="sendStatus" width="110" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.sendStatus === 'failed'" type="danger">失败</el-tag>
          <el-tag v-else-if="scope.row.sendStatus === 'pending'" type="warning">待发送</el-tag>
          <el-tag v-else type="success">成功</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="接收人ID" prop="targetIds" :show-overflow-tooltip="true" min-width="130" />
      <el-table-column label="重试" prop="retryCount" width="70" align="center" />
      <el-table-column label="失败原因" prop="failReason" :show-overflow-tooltip="true" min-width="220" />
      <el-table-column label="发送时间" prop="sendTime" width="160" align="center" />
      <el-table-column label="操作" width="190" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="openDetail(scope.row)">内容快照</el-button>
          <el-button link type="warning" icon="Refresh" :disabled="scope.row.sendStatus === 'success'" @click="handleRetry(scope.row)">重发</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" title="推送内容快照" width="680px" append-to-body>
      <el-input v-model="snapshot" type="textarea" :rows="18" readonly />
    </el-dialog>
  </div>
</template>

<script setup name="YqPushRecord" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqPushRecordQuery, YqPushRecordVO } from '@/api/yuqing/pushRecord/types';
import { listYqPushRecord } from '@/api/yuqing/pushRecord/index';
import { retryPush, flushPush, pushStatistics } from '@/api/yuqing/push/dispatch';
import { useDict } from '@/utils/dict';

const { yq_push_scene, yq_push_level, yq_push_status } = toRefs<any>(
  useDict('yq_push_scene', 'yq_push_level', 'yq_push_status')
);

const loading = ref(true);
const showSearch = ref(true);
const flushing = ref(false);
const total = ref(0);
const open = ref(false);
const snapshot = ref('');
const recordList = ref<YqPushRecordVO[]>([]);
const queryRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, pushScene: undefined, sendStatus: undefined, pushLevel: undefined } as YqPushRecordQuery
});
const { queryParams } = toRefs(data);

async function getList() {
  loading.value = true;
  try {
    const res = await listYqPushRecord(queryParams.value);
    recordList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqPushRecordQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function openDetail(row: YqPushRecordVO) {
  snapshot.value = String(row.contentSnapshot || '');
  open.value = true;
}

async function handleRetry(row: YqPushRecordVO) {
  await ElMessageBox.confirm('确认重发该条推送记录？', '提示', { type: 'warning' });
  const res = await retryPush(row.recordId!);
  const s = res.data || {};
  if ((s.sent || 0) > 0) {
    ElMessage.success('重发成功');
  } else {
    ElMessage.error('重发失败：' + ((s.details && s.details[0]) || '请查看失败原因'));
  }
  await getList();
}

async function handleFlush() {
  flushing.value = true;
  try {
    const res = await flushPush();
    ElMessage.success('已刷出 ' + (res.data || 0) + ' 条顺延的定时批量推送');
  } finally {
    flushing.value = false;
  }
}

async function handleStatistics() {
  const res = await pushStatistics({});
  const s = res.data || {};
  const byStatus = s.byStatus || {};
  const byScene = s.byScene || {};
  function rowsOf(obj: Record<string, any>) {
    let out = '';
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      out += '<tr><td>' + keys[i] + '</td><td>' + obj[keys[i]] + '</td></tr>';
    }
    return out;
  }
  const html = '<p>统计区间：' + (s.from || '') + ' ~ ' + (s.to || '') + '，共 ' + (s.total || 0)
    + ' 条，成功 ' + (s.success || 0) + ' 条，成功率 ' + ((s.successRate || 0) * 100).toFixed(1) + '%</p>'
    + '<p><b>按状态</b></p><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">'
    + '<tr><th>状态</th><th>条数</th></tr>' + rowsOf(byStatus) + '</table>'
    + '<p style="margin-top:10px"><b>按场景</b></p><table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%">'
    + '<tr><th>场景</th><th>条数</th></tr>' + rowsOf(byScene) + '</table>';
  await ElMessageBox.alert(html, '推送成功率统计（近 7 天）', { dangerouslyUseHTMLString: true });
}

onMounted(() => {
  getList();
});
</script>
`,
  },

  /* ---------------------------------------------------------------- H5 api */
  {
    rel: 'h5/api/yuqing/alert/dispatch.js',
    content: `import request from '@/utils/request'

/**
 * 手动触发预警扫描（落库）
 */
export function scanAlert(data) {
  return request({
    url: '/yuqing/alert/scan',
    method: 'post',
    data: data || {}
  })
}

/**
 * 预览预警命中（不落库）
 */
export function previewAlert(data) {
  return request({
    url: '/yuqing/alert/preview',
    method: 'post',
    data: data || {}
  })
}

/**
 * 处置预警（已处置/已忽略必须填说明，服务端强校验）
 */
export function processAlert(data) {
  return request({
    url: '/yuqing/alert/process',
    method: 'post',
    data
  })
}

/**
 * 未处置计数
 */
export function alertPendingCount() {
  return request({
    url: '/yuqing/alert/pendingCount',
    method: 'get'
  })
}
`,
  },

  /* --------------------------------------------------------------- H5 页面 */
  {
    rel: 'h5/pages/yuqing/alert/index.vue',
    content: `<template>
  <view class="page">
    <view class="stat">
      <view class="stat-item">
        <text class="num err">{{ pending.pending }}</text>
        <text class="lbl">未处置</text>
      </view>
      <view class="stat-item">
        <text class="num">{{ pending.processing }}</text>
        <text class="lbl">处置中</text>
      </view>
      <view class="stat-item">
        <text class="num err">{{ pending.highlightPending }}</text>
        <text class="lbl">紧急未处置</text>
      </view>
    </view>

    <view class="filter">
      <picker :range="statusLabels" @change="onStatusChange">
        <view class="picker">{{ statusLabel }}</view>
      </picker>
    </view>

    <view v-if="list.length === 0" class="empty">暂无预警</view>

    <view v-for="item in list" :key="item.alertId" class="card" @click="openProcess(item)">
      <view class="row">
        <text class="title" :class="{ err: item.alertLevel === 'urgent' || item.alertLevel === 'warning' }">{{ item.alertTitle }}</text>
      </view>
      <view class="row meta">
        <text class="tag">{{ levelText(item.alertLevel) }}</text>
        <text class="tag">{{ sceneText(item.triggerScene) }}</text>
        <text class="tag">{{ statusText(item.status) }}</text>
      </view>
      <view class="row">
        <text class="trigger">{{ item.triggerValue }}</text>
      </view>
      <view class="row meta">
        <text>{{ item.triggerTime }}</text>
      </view>
    </view>

    <view v-if="hasMore" class="more" @click="loadMore">加载更多</view>

    <view v-if="showDlg" class="mask" @click="closeDlg">
      <view class="dlg" @click.stop>
        <view class="dlg-title">预警处置</view>
        <view class="dlg-line">{{ current.alertTitle }}</view>
        <view class="dlg-line sub">{{ current.triggerValue }}</view>
        <view class="dlg-label">处置状态</view>
        <view class="status-group">
          <view v-for="s in statusChoices" :key="s.value" class="status-item" :class="{ active: form.status === s.value }" @click="form.status = s.value">
            {{ s.label }}
          </view>
        </view>
        <view class="dlg-label">处置说明（已处置/已忽略必填）</view>
        <textarea v-model="form.processRemark" class="ta" placeholder="请写明具体处置动作或忽略理由" :maxlength="500" />
        <view class="btns">
          <view class="btn" @click="closeDlg">取消</view>
          <view class="btn primary" @click="submit">提交</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { listYqAlert } from '@/api/yuqing/alert';
import { processAlert, alertPendingCount } from '@/api/yuqing/alert/dispatch';

definePage({
  style: {
    navigationBarTitleText: '风险预警'
  }
});

const pending = ref<Record<string, any>>({ pending: 0, processing: 0, highlightPending: 0 });
const list = ref<any[]>([]);
const pageNum = ref(1);
const pageSize = 10;
const hasMore = ref(true);
const showDlg = ref(false);
const current = ref<Record<string, any>>({});
const form = reactive({ alertId: '', status: 'processing', processRemark: '' });

const statusChoices = [
  { label: '处置中', value: 'processing' },
  { label: '已处置', value: 'handled' },
  { label: '已忽略', value: 'ignored' }
];

const statusLabels = ['全部', '未处置', '处置中', '已处置', '已忽略'];
const statusValues = ['', 'pending', 'processing', 'handled', 'ignored'];
const statusIndex = ref(1);
const statusLabel = ref('未处置');

function onStatusChange(e: any) {
  statusIndex.value = Number(e.detail.value);
  statusLabel.value = statusLabels[statusIndex.value];
  pageNum.value = 1;
  list.value = [];
  hasMore.value = true;
  load();
}

function levelText(v: any) {
  const s = String(v);
  return s === 'urgent' ? '紧急' : s === 'warning' ? '预警' : s === 'attention' ? '关注' : '提示';
}

function sceneText(v: any) {
  const s = String(v);
  return s === 'new_negative' ? '新增负面' : s === 'high_risk' ? '高风险' : s === 'burst_increment' ? '突发增量' : s === 'special_topic' ? '重点专项' : s;
}

function statusText(v: any) {
  const s = String(v);
  return s === 'pending' ? '未处置' : s === 'processing' ? '处置中' : s === 'handled' ? '已处置' : s === 'ignored' ? '已忽略' : s;
}

async function load() {
  const res = await listYqAlert({
    pageNum: pageNum.value,
    pageSize,
    status: statusValues[statusIndex.value] || undefined
  });
  const rows = res.data?.rows || [];
  list.value = list.value.concat(rows);
  hasMore.value = rows.length >= pageSize;
}

function loadMore() {
  pageNum.value += 1;
  load();
}

async function loadPending() {
  const res = await alertPendingCount();
  pending.value = res.data || { pending: 0, processing: 0, highlightPending: 0 };
}

function openProcess(item: Record<string, any>) {
  if (item.status === 'handled' || item.status === 'ignored') {
    return;
  }
  current.value = item;
  form.alertId = item.alertId;
  form.status = 'processing';
  form.processRemark = '';
  showDlg.value = true;
}

function closeDlg() {
  showDlg.value = false;
}

async function submit() {
  const need = form.status === 'handled' || form.status === 'ignored';
  if (need && (!form.processRemark || form.processRemark.trim().length < 5)) {
    uni.showToast({ title: '处置说明不少于 5 个字', icon: 'none' });
    return;
  }
  await processAlert({
    alertId: form.alertId,
    status: form.status,
    processRemark: form.processRemark
  });
  uni.showToast({ title: '提交成功', icon: 'success' });
  showDlg.value = false;
  pageNum.value = 1;
  list.value = [];
  hasMore.value = true;
  await load();
  await loadPending();
}

onMounted(() => {
  load();
  loadPending();
});
</script>

<style scoped>
.page {
  padding: 20rpx;
  background: #f5f6fa;
  min-height: 100vh;
}
.stat {
  display: flex;
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx 0;
}
.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.num {
  font-size: 40rpx;
  font-weight: 600;
}
.err {
  color: #f56c6c;
}
.lbl {
  font-size: 24rpx;
  color: #909399;
  margin-top: 8rpx;
}
.filter {
  margin: 20rpx 0;
}
.picker {
  background: #fff;
  border-radius: 10rpx;
  padding: 18rpx 24rpx;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
}
.title {
  font-size: 30rpx;
  font-weight: 600;
}
.meta {
  font-size: 24rpx;
  color: #909399;
}
.tag {
  border: 1rpx solid #dcdfe6;
  border-radius: 6rpx;
  padding: 2rpx 10rpx;
  margin-right: 12rpx;
  font-size: 22rpx;
}
.trigger {
  font-size: 26rpx;
  color: #606266;
}
.empty {
  text-align: center;
  color: #909399;
  padding: 80rpx 0;
}
.more {
  text-align: center;
  color: #409eff;
  padding: 24rpx 0;
  font-size: 28rpx;
}
.mask {
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dlg {
  width: 620rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
}
.dlg-title {
  font-size: 32rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20rpx;
}
.dlg-line {
  font-size: 28rpx;
  margin-bottom: 10rpx;
}
.dlg-line.sub {
  font-size: 24rpx;
  color: #909399;
}
.dlg-label {
  font-size: 26rpx;
  color: #606266;
  margin: 20rpx 0 10rpx;
}
.status-group {
  display: flex;
}
.status-item {
  flex: 1;
  text-align: center;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  padding: 14rpx 0;
  margin-right: 12rpx;
  font-size: 26rpx;
}
.status-item.active {
  border-color: #409eff;
  color: #409eff;
}
.ta {
  width: 100%;
  height: 160rpx;
  border: 1rpx solid #dcdfe6;
  border-radius: 8rpx;
  padding: 14rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.btns {
  display: flex;
  margin-top: 26rpx;
}
.btn {
  flex: 1;
  text-align: center;
  border: 1rpx solid #dcdfe6;
  border-radius: 10rpx;
  padding: 18rpx 0;
  margin-right: 16rpx;
  font-size: 28rpx;
}
.btn.primary {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
</style>
`,
  },

];
