<template>
  <el-form ref="supplementRef" :model="form" :rules="rules" label-width="110px">
    <el-row :gutter="16">
      <el-col :span="12">
        <el-form-item label="巡检点位" prop="pointId">
          <el-select v-model="form.pointId" placeholder="请选择点位" clearable filterable style="width: 100%" @change="handlePointChange">
            <el-option
              v-for="p in pointOptions"
              :key="p.pointId"
              :label="`${p.pointName}（${p.pointCode}）`"
              :value="p.pointId!"
            />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="巡检员" prop="inspectorId">
          <el-input v-model="inspectorName" placeholder="请选择巡检员" readonly>
            <template #append>
              <el-button icon="Search" @click="openUserSelect">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="巡检时间" prop="inspectTime">
          <el-date-picker
            v-model="form.inspectTime"
            type="datetime"
            placeholder="请选择实际巡检时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            :disabled-date="disabledDate"
            style="width: 100%"
          />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="补录原因" prop="supplementReason">
          <el-input v-model="form.supplementReason" placeholder="如：原巡检人漏扫，事后补录" />
        </el-form-item>
      </el-col>
      <el-col :span="24">
        <el-form-item label="整体备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-col>
    </el-row>

    <el-divider content-position="left">巡检项结果</el-divider>
    <el-table :data="form.itemResults || []" size="small" border>
      <el-table-column label="序号" type="index" width="60" align="center" />
      <el-table-column label="巡检项" prop="itemName" min-width="130" />
      <el-table-column label="判定" width="230">
        <template #default="{ row }">
          <el-radio-group v-model="row.result">
            <el-radio value="normal">正常</el-radio>
            <el-radio value="abnormal">异常</el-radio>
            <el-radio value="na">不适用</el-radio>
          </el-radio-group>
        </template>
      </el-table-column>
      <el-table-column label="填写数值" width="140">
        <template #default="{ row }">
          <el-input v-model="row.value" placeholder="选填" />
        </template>
      </el-table-column>
      <el-table-column label="异常说明" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.description" :disabled="row.result !== 'abnormal'" placeholder="异常时必填" />
        </template>
      </el-table-column>
      <el-table-column label="现场照片" width="260">
        <template #default="{ row }">
          <div>
            <el-upload
              :show-file-list="false"
              :http-request="(opt: any) => handleUploadPhoto(opt, row)"
              accept="image/*"
            >
              <el-button size="small" :disabled="row.result !== 'abnormal'">上传照片</el-button>
            </el-upload>
            <div v-if="row.photos?.length" class="photo-list">
              <el-image
                v-for="(p, pi) in row.photos"
                :key="pi"
                :src="p.originalUrl"
                :preview-src-list="row.photos.map((x: any) => x.originalUrl)"
                :initial-index="pi"
                fit="cover"
                class="photo-thumb"
              />
            </div>
            <span v-if="row.result === 'abnormal' && !row.photos?.length" class="tip-danger">异常需 ≥1 张照片</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <UserSelect ref="userSelectRef" :multiple="false" :data="selectUserIds" @confirm-call-back="userSelectCallBack" />
  </el-form>
</template>

<script setup name="InspectRecordSupplement" lang="ts">
import { ref, watch } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import type { InspectRecordSubmitForm } from '@/api/inspect/record/types';
import { uploadInspectPhoto } from '@/api/inspect/record';
import { getInspectPoint, optionselectInspectPoint } from '@/api/inspect/point';

const emit = defineEmits<{ submit: [data: InspectRecordSubmitForm] }>();

const supplementRef = ref();
const userSelectRef = ref();
const form = ref<InspectRecordSubmitForm>({ pointId: undefined as any, itemResults: [] });
const pointOptions = ref<any[]>([]);
const inspectorName = ref('');
const selectUserIds = ref<Array<string | number>>([]);

const rules = {
  pointId: [{ required: true, message: '巡检点位不能为空', trigger: 'change' }],
  inspectorId: [{ required: true, message: '请选择巡检员', trigger: 'change' }],
  inspectTime: [{ required: true, message: '请选择实际巡检时间', trigger: 'change' }],
  supplementReason: [{ required: true, message: '补录原因不能为空', trigger: 'blur' }]
};

/** 不允许选择未来的日期，也不允许早于 1 年前 */
function disabledDate(time: Date) {
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 3600 * 1000;
  return time.getTime() > now || time.getTime() < oneYearAgo;
}

async function loadPoints() {
  const { data } = await optionselectInspectPoint({});
  pointOptions.value = data ?? [];
}

/** 选点位后带出巡检项清单 */
async function handlePointChange(pointId: string | number) {
  if (pointId == null) {
    form.value.itemResults = [];
    return;
  }
  const [err, res] = await to(getInspectPoint(pointId));
  if (err) return;
  const items = (res as any)?.data?.itemList ?? [];
  if (!items.length) {
    modal.msgWarning('该点位未配置巡检项，请先在点位管理中补充');
  }
  form.value.itemResults = items.map((i: any, idx: number) => ({
    itemId: i.itemId,
    itemName: i.itemName,
    result: 'normal',
    value: '',
    description: '',
    orderNum: i.orderNum ?? idx,
    photos: []
  }));
}

function openUserSelect() {
  userSelectRef.value?.open();
}

function userSelectCallBack(users: any[]) {
  if (!users || !users.length) return;
  const u = users[0];
  form.value.inspectorId = u.userId ?? u.id;
  inspectorName.value = u.nickName ?? u.userName ?? '';
}

/** 单张照片上传：先落 OSS 拿 URL，再挂到该巡检项的 photos */
async function handleUploadPhoto(option: any, row: any) {
  const [err, res] = await to(uploadInspectPhoto(option.file as File));
  if (err) {
    option.onError?.(err);
    return;
  }
  const d = (res as any)?.data ?? {};
  if (!row.photos) row.photos = [];
  row.photos.push({
    originalUrl: d.originalUrl,
    originalSize: d.originalSize,
    compressedUrl: d.compressedUrl,
    compressedSize: d.compressedSize,
    fileName: d.fileName
  });
  option.onSuccess?.(res);
}

/** 校验通过后把数据抛给父组件 */
function submit() {
  supplementRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    const items = form.value.itemResults ?? [];
    if (!items.length) {
      modal.msgError('请先选择点位以带出巡检项');
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.result) {
        modal.msgError(`第 ${i + 1} 项「${it.itemName}」未选择判定结果`);
        return;
      }
      if (it.result === 'abnormal') {
        if (!it.description) {
          modal.msgError(`第 ${i + 1} 项「${it.itemName}」异常说明不能为空`);
          return;
        }
        if (!it.photos || !it.photos.length) {
          modal.msgError(`第 ${i + 1} 项「${it.itemName}」异常必须上传至少 1 张照片`);
          return;
        }
      }
    }
    emit('submit', form.value);
  });
}

watch(
  () => form.value.pointId,
  (val) => {
    if (val == null) form.value.itemResults = [];
  }
);

loadPoints();

function reset() {
  form.value = { pointId: undefined as any, itemResults: [] };
  inspectorName.value = '';
  selectUserIds.value = [];
}

defineExpose({ submit, form, reset });
</script>

<style scoped>
.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.photo-thumb {
  width: 42px;
  height: 42px;
  border-radius: 4px;
}
.tip-danger {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
