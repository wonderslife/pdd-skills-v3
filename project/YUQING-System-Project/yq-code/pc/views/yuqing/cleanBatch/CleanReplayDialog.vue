<template>
  <el-dialog title="净化重跑" v-model="visible" width="780px" append-to-body destroy-on-close @closed="handleClosed">
    <el-alert type="info" :closable="false" show-icon class="mb8">
      <template #title>
        先「预览影响条数」再执行 —— 预览不写任何数据，确认口径无误后才真正改写净化状态。
        去重粒度为【按天】：同一链接跨天不算重复，同一天内被多渠道采到只保留首条并把其余渠道记在首条上。
      </template>
    </el-alert>

    <el-form :model="form" label-width="110px">
      <el-form-item label="采集日范围" required>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="起始采集日"
          end-placeholder="截止采集日"
          style="width: 100%"
        />
      </el-form-item>

      <el-row :gutter="10">
        <el-col :span="12">
          <el-form-item label="任务">
            <el-select v-model="form.scopeTaskId" placeholder="不限任务" clearable filterable style="width: 100%">
              <el-option v-for="o in taskOptions" :key="String(o.value)" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="渠道">
            <el-select v-model="form.scopeChannelId" placeholder="不限渠道" clearable filterable style="width: 100%">
              <el-option v-for="o in channelOptions" :key="String(o.value)" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-alert v-if="!hasScope" type="warning" :closable="false" show-icon class="mb8">
        <template #title>任务与渠道至少要选一个，避免全表重扫</template>
      </el-alert>
    </el-form>

    <div class="mb8">
      <el-button type="primary" icon="View" :loading="previewing" :disabled="!canRun" @click="handlePreview">
        预览影响条数
      </el-button>
      <el-button type="success" icon="Check" :loading="executing" :disabled="!canRun || !stats" @click="handleExecute">
        确认执行
      </el-button>
      <el-button link type="primary" icon="Refresh" @click="handleRefreshRules">刷新降噪规则缓存</el-button>
    </div>

    <el-alert v-if="stats" :type="stats.failReason ? 'error' : 'success'" :closable="false" show-icon class="mb8">
      <template #title>{{ summaryText }}</template>
    </el-alert>

    <el-descriptions v-if="stats" :column="2" border size="small">
      <el-descriptions-item label="扫描条数">{{ stats.totalCount }}</el-descriptions-item>
      <el-descriptions-item label="净化保留">{{ stats.cleanedCount }}</el-descriptions-item>
      <el-descriptions-item label="链接去重">{{ stats.dupCount }}</el-descriptions-item>
      <el-descriptions-item label="跨渠道重复">{{ stats.dupChannelCount }}</el-descriptions-item>
      <el-descriptions-item v-for="row in categoryRows" :key="row.code" :label="row.label">
        {{ row.count }}
      </el-descriptions-item>
    </el-descriptions>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { previewCleanReplay, executeCleanReplay, refreshNoiseRules } from '@/api/yuqing/clean/replay';
import type { CleanBatchScope, CleanBatchStats } from '@/api/yuqing/clean/replay';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqChannel } from '@/api/yuqing/channel/index';

const emit = defineEmits(['success']);

interface Option {
  label: string;
  value: any;
}

const visible = ref(false);
const previewing = ref(false);
const executing = ref(false);
const dateRange = ref<string[]>([]);
const stats = ref<CleanBatchStats | null>(null);
const taskOptions = ref<Option[]>([]);
const channelOptions = ref<Option[]>([]);

const form = reactive<CleanBatchScope>({
  batchName: undefined,
  batchType: 'condition_replay',
  scopeTaskId: null,
  scopeChannelId: null,
  scopeStartDate: undefined,
  scopeEndDate: undefined,
  previewOnly: true
});

/** 范围必须闭合且至少限定任务或渠道之一（后端同样校验，这里只是提前拦住） */
const hasScope = computed(() => !!form.scopeTaskId || !!form.scopeChannelId);

const canRun = computed(() => dateRange.value.length === 2 && !!dateRange.value[0] && !!dateRange.value[1] && hasScope.value);

/** 七类降噪类别的展示行；顺序与字典 yq_noise_category 一致 */
const CATEGORIES: Array<{ code: string; label: string }> = [
  { code: 'spam', label: '垃圾内容' },
  { code: 'advertisement', label: '广告营销' },
  { code: 'flooding', label: '灌水评论' },
  { code: 'meaningless', label: '无意义短句' },
  { code: 'bot', label: '机器人内容' },
  { code: 'blank', label: '空白内容' },
  { code: 'violation', label: '违规屏蔽' }
];

const categoryRows = computed(() =>
  CATEGORIES.map((c) => ({ code: c.code, label: c.label, count: stats.value?.byCategory?.[c.code] ?? 0 }))
);

const summaryText = computed(() => {
  const s = stats.value;
  if (!s) {
    return '';
  }
  if (s.failReason) {
    return '执行失败：' + s.failReason;
  }
  const total = s.totalCount || 1;
  const dupRate = ((s.dupCount * 100) / total).toFixed(2);
  const rejectRate = ((s.rejectedCount * 100) / total).toFixed(2);
  return (s.previewOnly ? '[预览] ' : '[已执行] ') + '扫描 ' + s.totalCount + ' 条：保留 ' + s.cleanedCount
    + ' / 剔除 ' + s.rejectedCount + ' / 重复 ' + s.dupCount + '（跨渠道 ' + s.dupChannelCount + '）'
    + '，去重率 ' + dupRate + '%、降噪率 ' + rejectRate + '%';
});

function buildPayload(previewOnly: boolean): CleanBatchScope {
  return {
    batchName: form.batchName,
    batchType: form.batchType,
    scopeTaskId: form.scopeTaskId ?? null,
    scopeChannelId: form.scopeChannelId ?? null,
    scopeStartDate: dateRange.value[0],
    scopeEndDate: dateRange.value[1],
    previewOnly
  };
}

function handlePreview() {
  previewing.value = true;
  previewCleanReplay(buildPayload(true))
    .then((res) => {
      stats.value = res.data;
    })
    .finally(() => {
      previewing.value = false;
    });
}

function handleExecute() {
  executing.value = true;
  executeCleanReplay(buildPayload(false))
    .then((res) => {
      stats.value = res.data;
      if (!res.data.failReason) {
        ElMessage.success('重跑完成，共处理 ' + res.data.totalCount + ' 条');
        emit('success');
      }
    })
    .finally(() => {
      executing.value = false;
    });
}

function handleRefreshRules() {
  refreshNoiseRules().then(() => {
    ElMessage.success('降噪规则缓存已刷新');
  });
}

function handleClosed() {
  stats.value = null;
  executing.value = false;
  previewing.value = false;
}

function loadOptions() {
  optionselectYqTask().then((res) => {
    taskOptions.value = (res.data ?? []).map((i: any) => ({ label: i.taskName, value: i.taskId }));
  });
  optionselectYqChannel().then((res) => {
    channelOptions.value = (res.data ?? []).map((i: any) => ({ label: i.channelName, value: i.channelId }));
  });
}

function open(): void {
  visible.value = true;
  loadOptions();
}

defineExpose({ open });
</script>

<style scoped>
.file-name {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
}
</style>
