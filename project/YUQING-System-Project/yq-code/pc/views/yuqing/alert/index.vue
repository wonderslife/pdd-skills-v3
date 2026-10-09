<template>
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
