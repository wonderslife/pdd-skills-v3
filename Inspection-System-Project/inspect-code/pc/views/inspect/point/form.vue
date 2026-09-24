<template>
  <el-form ref="pointRef" :model="form" :rules="rules" label-width="110px">
    <el-row :gutter="16">
      <el-col :span="12">
        <el-form-item label="所属机房" prop="roomId">
          <el-select v-model="form.roomId" placeholder="请选择机房" clearable filterable style="width: 100%" @change="handleRoomChange">
            <el-option v-for="o in roomOptions" :key="o.roomId" :label="o.roomName" :value="o.roomId!" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="所属区域" prop="areaId">
          <el-select v-model="form.areaId" placeholder="请选择区域" clearable filterable style="width: 100%">
            <el-option v-for="o in areaOptions" :key="o.areaId" :label="o.areaName" :value="o.areaId!" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="点位名称" prop="pointName">
          <el-input v-model="form.pointName" placeholder="请输入点位名称" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="点位编码" prop="pointCode">
          <el-input v-model="form.pointCode" placeholder="全局唯一，如 RM-A-001" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="位置描述" prop="location">
          <el-input v-model="form.location" placeholder="如 A 排第 3 机柜" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="巡检周期" prop="cycleType">
          <el-select v-model="form.cycleType" placeholder="请选择巡检周期" style="width: 100%">
            <el-option v-for="d in sys_inspect_cycle" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="12" v-if="form.cycleType === 'custom'">
        <el-form-item label="间隔天数" prop="cycleValue">
          <el-input-number v-model="form.cycleValue" :min="1" :max="365" style="width: 100%" />
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="GPS 校验" prop="gpsEnabled">
          <el-radio-group v-model="form.gpsEnabled">
            <el-radio value="0">关闭</el-radio>
            <el-radio value="1">开启</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-col>
      <el-col :span="12">
        <el-form-item label="点位状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
            <el-option v-for="d in sys_point_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="24">
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-col>
    </el-row>

    <el-divider content-position="left">
      巡检项清单
      <el-button link type="primary" icon="Plus" class="ml10" @click="handleAddItem">添加巡检项</el-button>
      <el-select
        v-model="templateId"
        placeholder="从模板导入"
        clearable
        size="small"
        style="width: 180px; margin-left: 12px"
        @change="handleApplyTemplate"
      >
        <el-option v-for="t in templateOptions" :key="t.templateId" :label="t.templateName" :value="t.templateId!" />
      </el-select>
    </el-divider>

    <el-table :data="form.itemList || []" size="small" border>
      <el-table-column label="序号" type="index" width="60" align="center" />
      <el-table-column label="巡检项名称" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.itemName" placeholder="如 温度" />
        </template>
      </el-table-column>
      <el-table-column label="类型" width="130">
        <template #default="{ row }">
          <el-select v-model="row.itemType" placeholder="类型">
            <el-option v-for="d in sys_item_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="判定标准" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.standard" placeholder="如 18~27℃" />
        </template>
      </el-table-column>
      <el-table-column label="必填" width="100" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.required" active-value="1" inactive-value="0" />
        </template>
      </el-table-column>
      <el-table-column label="排序" width="100" align="center">
        <template #default="{ row }">
          <el-input-number v-model="row.orderNum" :min="0" controls-position="right" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" icon="Delete" @click="handleRemoveItem($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-form>
</template>

<script setup name="InspectPointForm" lang="ts">
import { ref, watch } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import type { InspectPointForm } from '@/api/inspect/point/types';
import { optionselectInspectRoom } from '@/api/inspect/room';
import { optionselectInspectArea } from '@/api/inspect/area';
import { getInspectItemTemplate, optionselectInspectItemTemplate } from '@/api/inspect/itemTemplate';

const props = defineProps<{
  /** 父组件传入的编辑数据 */
  editData?: InspectPointForm | null;
}>();

const emit = defineEmits<{ submit: [data: InspectPointForm] }>();

const { sys_inspect_cycle, sys_point_status, sys_item_type } = useDict('sys_inspect_cycle', 'sys_point_status', 'sys_item_type');

const pointRef = ref();
const form = ref<InspectPointForm>({ pointId: undefined, gpsEnabled: '0', status: 'active', cycleType: 'daily', itemList: [] });
const roomOptions = ref<any[]>([]);
const areaOptions = ref<any[]>([]);
const templateOptions = ref<any[]>([]);
const templateId = ref<string | number | undefined>(undefined);

const rules = {
  roomId: [{ required: true, message: '所属机房不能为空', trigger: 'change' }],
  pointName: [{ required: true, message: '点位名称不能为空', trigger: 'blur' }],
  pointCode: [{ required: true, message: '点位编码不能为空', trigger: 'blur' }],
  cycleType: [{ required: true, message: '巡检周期不能为空', trigger: 'change' }],
  status: [{ required: true, message: '点位状态不能为空', trigger: 'change' }]
};

/** 机房下拉 */
async function loadRooms() {
  const { data } = await optionselectInspectRoom({});
  roomOptions.value = data ?? [];
}

/** 区域下拉（按机房联动） */
async function loadAreas(roomId?: string | number) {
  if (roomId == null) {
    areaOptions.value = [];
    return;
  }
  const { data } = await optionselectInspectArea({ roomId });
  areaOptions.value = data ?? [];
}

/** 模板下拉 */
async function loadTemplates() {
  const { data } = await optionselectInspectItemTemplate({});
  templateOptions.value = data ?? [];
}

function handleRoomChange(roomId: string | number) {
  form.value.areaId = undefined;
  loadAreas(roomId);
}

function handleAddItem() {
  if (!form.value.itemList) form.value.itemList = [];
  form.value.itemList.push({
    itemName: '',
    itemType: 'radio',
    standard: '',
    required: '1',
    orderNum: form.value.itemList.length
  } as any);
}

function handleRemoveItem(index: number) {
  form.value.itemList?.splice(index, 1);
}

/** 从模板导入巡检项（覆盖现有清单） */
async function handleApplyTemplate(id: string | number) {
  if (id == null) return;
  const [err, res] = await to(getInspectItemTemplate(id));
  if (err) return;
  const detailList = (res as any)?.data?.detailList ?? [];
  if (!detailList.length) {
    modal.msgWarning('该模板下没有巡检项明细，请先到「巡检项模板」为该模板维护明细');
    return;
  }
  form.value.itemList = detailList.map((d: any, i: number) => ({
    itemName: d.itemName,
    itemType: d.itemType || 'radio',
    standard: d.standard,
    required: d.required ?? '1',
    orderNum: d.orderNum ?? i,
    templateId: id
  }));
  modal.msgSuccess(`已导入 ${detailList.length} 个巡检项`);
}

watch(
  () => props.editData,
  (val) => {
    if (val) {
      form.value = { ...val, itemList: val.itemList ? val.itemList.map((i) => ({ ...i })) : [] };
      if (form.value.gpsEnabled == null) form.value.gpsEnabled = '0';
      loadAreas(form.value.roomId);
    }
  },
  { immediate: true }
);

/** 校验通过后把数据抛给父组件 */
function submit() {
  pointRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    const items = form.value.itemList ?? [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemName) {
        modal.msgError(`第 ${i + 1} 行巡检项名称不能为空`);
        return;
      }
    }
    emit('submit', form.value);
  });
}

loadRooms();
loadTemplates();

defineExpose({ submit, form });
</script>

<style scoped>
.ml10 {
  margin-left: 10px;
}
</style>
