<template>
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
