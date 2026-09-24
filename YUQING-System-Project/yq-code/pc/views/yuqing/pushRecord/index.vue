<template>
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
