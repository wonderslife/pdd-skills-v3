<template>
  <el-dialog v-model="visible" title="导出台账记录（审计）" width="900px" append-to-body>
    <el-form :inline="true">
      <el-form-item label="导出范围">
        <el-select v-model="query.exportScope" placeholder="全部" clearable style="width: 150px">
          <el-option label="台账" value="ledger" />
          <el-option label="事件聚合" value="cluster" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" border max-height="420">
      <el-table-column label="导出时间" prop="createTime" width="165" align="center" />
      <el-table-column label="范围" prop="exportScope" width="90" align="center">
        <template #default="scope">
          <el-tag size="small" type="info">{{ scopeText(scope.row.exportScope) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="筛选条件" prop="querySummary" :show-overflow-tooltip="true" min-width="240" />
      <el-table-column label="条数" prop="rowCount" width="80" align="center" />
      <el-table-column label="列数" prop="columnCount" width="70" align="center" />
      <el-table-column label="方式" prop="exportMode" width="80" align="center">
        <template #default="scope">
          <el-tag size="small" :type="scope.row.exportMode === 'async' ? 'warning' : 'success'">
            {{ scope.row.exportMode === 'async' ? '异步' : '同步' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="90" align="center">
        <template #default="scope">
          <el-tag size="small" :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="IP" prop="operIp" width="120" align="center" />
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="scope">
          <el-button v-if="scope.row.fileUrl" link type="primary" @click="download(scope.row)">下载</el-button>
          <el-tooltip v-else-if="scope.row.failReason" :content="scope.row.failReason" placement="top">
            <span class="fail">失败</span>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="getList"
    />
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="ExportLogDialog">
import { ref, reactive, toRefs, watch } from 'vue';
import { pageLedgerExportLog } from '@/api/yuqing/ledger';
import type { LedgerExportLogVO } from '@/api/yuqing/ledger/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const visible = ref(props.modelValue);
const loading = ref(false);
const total = ref(0);
const list = ref<LedgerExportLogVO[]>([]);

const data = reactive({
  query: { pageNum: 1, pageSize: 10, exportScope: undefined as string | undefined }
});
const { query } = toRefs(data);

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v;
    if (v) {
      query.value.pageNum = 1;
      getList();
    }
  }
);
watch(visible, (v) => emit('update:modelValue', v));

async function getList() {
  loading.value = true;
  try {
    const res = await pageLedgerExportLog(query.value);
    list.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.value.pageNum = 1;
  getList();
}

function resetQuery() {
  query.value = { pageNum: 1, pageSize: 10, exportScope: undefined };
  getList();
}

function scopeText(v?: string) {
  return v === 'cluster' ? '事件聚合' : '台账';
}

function statusText(v?: string) {
  if (v === 'success') {
    return '成功';
  }
  if (v === 'failed') {
    return '失败';
  }
  if (v === 'running') {
    return '导出中';
  }
  return '排队中';
}

function statusType(v?: string) {
  if (v === 'success') {
    return 'success';
  }
  if (v === 'failed') {
    return 'danger';
  }
  return 'warning';
}

function download(row: any) {
  const a = document.createElement('a');
  a.href = row.fileUrl;
  if (row.fileName) {
    a.download = row.fileName;
  }
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
</script>

<style scoped>
.fail {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
