<template>
  <div v-loading="loading">
    <el-descriptions :column="2" border size="small">
      <el-descriptions-item label="点位名称">{{ detail?.pointName }}</el-descriptions-item>
      <el-descriptions-item label="所属机房">{{ detail?.roomName }}</el-descriptions-item>
      <el-descriptions-item label="巡检员">{{ detail?.inspectorName }}</el-descriptions-item>
      <el-descriptions-item label="巡检时间">{{ detail?.inspectTime }}</el-descriptions-item>
      <el-descriptions-item label="巡检结果">
        <dict-tag :options="sys_inspect_result" :value="detail?.result" />
      </el-descriptions-item>
      <el-descriptions-item label="数据来源">
        <dict-tag :options="sys_inspect_source" :value="detail?.source" />
      </el-descriptions-item>
      <el-descriptions-item label="耗时">{{ detail?.duration != null ? detail.duration + ' 秒' : '-' }}</el-descriptions-item>
      <el-descriptions-item label="异常项数">{{ detail?.abnormalCount ?? 0 }}</el-descriptions-item>
      <el-descriptions-item label="巡检备注" :span="2">{{ detail?.remark || '-' }}</el-descriptions-item>
      <el-descriptions-item label="管理员备注" :span="2">{{ detail?.adminRemark || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-divider content-position="left">巡检项明细</el-divider>
    <el-table :data="detail?.itemResults || []" size="small" border>
      <el-table-column label="序号" type="index" width="60" align="center" />
      <el-table-column label="巡检项" prop="itemName" min-width="130" />
      <el-table-column label="判定结果" width="110" align="center">
        <template #default="{ row }">
          <dict-tag :options="sys_item_result" :value="row.result" />
        </template>
      </el-table-column>
      <el-table-column label="数值" prop="value" width="110" align="center" />
      <el-table-column label="异常说明" prop="description" min-width="160" show-overflow-tooltip />
      <el-table-column label="现场照片" min-width="180">
        <template #default="{ row }">
          <div v-if="row.photoUrls?.length" class="photo-list">
            <el-image
              v-for="(url, pi) in row.photoUrls"
              :key="pi"
              :src="url"
              :preview-src-list="row.photoUrls"
              :initial-index="pi"
              fit="cover"
              class="photo-thumb"
            />
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>

    <template v-if="photos.length">
      <el-divider content-position="left">全部照片（{{ photos.length }} 张）</el-divider>
      <div class="photo-list">
        <el-image
          v-for="(url, pi) in photos"
          :key="pi"
          :src="url"
          :preview-src-list="photos"
          :initial-index="pi"
          fit="cover"
          class="photo-thumb-lg"
        />
      </div>
    </template>
  </div>
</template>

<script setup name="InspectRecordDetail" lang="ts">
import { ref, computed, watch } from 'vue';
import { to } from 'await-to-js';
import { useDict } from '@/utils/dict';
import type { InspectRecordVO } from '@/api/inspect/record/types';
import { getInspectRecord } from '@/api/inspect/record';

const props = defineProps<{ recordId?: string | number | null }>();

const { sys_inspect_result, sys_inspect_source, sys_item_result } = useDict(
  'sys_inspect_result',
  'sys_inspect_source',
  'sys_item_result'
);

const detail = ref<InspectRecordVO | null>(null);
const loading = ref(false);

/** 汇总所有照片，去重 */
const photos = computed(() => {
  const set = new Set<string>();
  (detail.value?.photos ?? []).forEach((p) => {
    const url = p.originalUrl || p.compressedUrl;
    if (url) set.add(url);
  });
  (detail.value?.itemResults ?? []).forEach((it) => (it.photoUrls ?? []).forEach((u) => set.add(u)));
  return Array.from(set);
});

async function load() {
  if (props.recordId == null) return;
  loading.value = true;
  const [err, res] = await to(getInspectRecord(props.recordId));
  loading.value = false;
  if (err) return;
  detail.value = res?.data ?? null;
}

watch(() => props.recordId, (val) => { if (val != null) load(); }, { immediate: true });

defineExpose({ load });
</script>

<style scoped>
.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.photo-thumb {
  width: 48px;
  height: 48px;
  border-radius: 4px;
}
.photo-thumb-lg {
  width: 110px;
  height: 110px;
  border-radius: 6px;
}
</style>
