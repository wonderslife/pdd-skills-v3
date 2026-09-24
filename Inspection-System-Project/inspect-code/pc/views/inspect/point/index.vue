<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="80px">
      <el-form-item label="点位名称" prop="pointName">
        <el-input v-model="queryParams.pointName" placeholder="请输入点位名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="点位编码" prop="pointCode">
        <el-input v-model="queryParams.pointCode" placeholder="请输入点位编码" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="所属机房" prop="roomId">
        <el-select v-model="queryParams.roomId" placeholder="请选择机房" clearable filterable style="width: 180px">
          <el-option v-for="o in roomOptions" :key="o.roomId" :label="o.roomName" :value="o.roomId!" />
        </el-select>
      </el-form-item>
      <el-form-item label="点位状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 150px">
          <el-option v-for="d in sys_point_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['inspect:point:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['inspect:point:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['inspect:point:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Upload" v-hasPermi="['inspect:point:import']" @click="handleImport">批量导入</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:point:qrcode']" :disabled="multiple" @click="handleBatchQrcode">批量二维码</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="pointList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="点位名称" align="center" prop="pointName" min-width="140" />
      <el-table-column label="点位编码" align="center" prop="pointCode" width="130" />
      <el-table-column label="所属机房" align="center" prop="roomName" width="130" />
      <el-table-column label="所属区域" align="center" prop="areaName" width="120" />
      <el-table-column label="位置描述" align="center" prop="location" min-width="140" show-overflow-tooltip />
      <el-table-column label="巡检周期" align="center" prop="cycleType" width="110">
        <template #default="scope">
          <dict-tag :options="sys_inspect_cycle" :value="scope.row.cycleType" />
        </template>
      </el-table-column>
      <el-table-column label="点位状态" align="center" prop="status" width="100">
        <template #default="scope">
          <dict-tag :options="sys_point_status" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="上次巡检时间" align="center" prop="lastInspectTime" width="170" />
      <el-table-column label="操作" align="center" width="230" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['inspect:point:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="primary" icon="Picture" v-hasPermi="['inspect:point:qrcode']" @click="handleShowQrcode(scope.row)">二维码</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['inspect:point:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 新增 / 修改 -->
    <el-dialog :title="title" v-model="open" width="980px" append-to-body>
      <InspectPointForm ref="pointFormRef" :edit-data="form" @submit="handleSubmit" />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="pointFormRef?.submit()">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 单点位二维码 -->
    <el-dialog title="点位二维码" v-model="qrcodeOpen" width="420px" append-to-body>
      <div style="text-align: center">
        <p style="margin-bottom: 12px">{{ qrcodePointName }}（{{ qrcodePointCode }}）</p>
        <img v-if="qrcodeUrl" :src="qrcodeUrl" style="width: 260px; height: 260px" alt="二维码" />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="downloadSingleQrcode">下载图片</el-button>
          <el-button @click="qrcodeOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 批量导入 -->
    <el-dialog title="点位批量导入" v-model="importOpen" width="900px" append-to-body>
      <el-alert
        title="先下载模板，按模板填写后上传。系统会逐行校验，只入库校验通过的行。"
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <el-row :gutter="10" class="mb8">
        <el-col :span="1.5">
          <el-button type="primary" plain icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
        </el-col>
      </el-row>
      <el-upload
        ref="uploadRef"
        :limit="1"
        accept=".xlsx,.xls"
        :auto-upload="false"
        :file-list="fileList"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
      >
        <template #trigger>
          <el-button type="primary" plain icon="Upload">选择 Excel 文件</el-button>
        </template>
        <template #tip>
          <div class="el-upload__tip">仅支持 .xlsx / .xls</div>
        </template>
      </el-upload>

      <el-row :gutter="10" class="mb8 mt10">
        <el-col :span="1.5">
          <el-button type="primary" :loading="validating" :disabled="!uploadFile" @click="handleValidate">开始校验</el-button>
        </el-col>
        <el-col :span="1.5" v-if="importRows.length">
          <el-button type="success" :disabled="!successRows.length" @click="handleConfirmImport">
            确认导入（{{ successRows.length }} 条）
          </el-button>
        </el-col>
      </el-row>

      <el-table v-if="importRows.length" :data="importRows" size="small" border max-height="320">
        <el-table-column label="行号" prop="rowNum" width="70" align="center" />
        <el-table-column label="校验结果" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'">{{ row.success ? '通过' : '失败' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="点位名称" align="center">
          <template #default="{ row }">{{ row.row?.pointName }}</template>
        </el-table-column>
        <el-table-column label="点位编码" align="center">
          <template #default="{ row }">{{ row.row?.pointCode }}</template>
        </el-table-column>
        <el-table-column label="失败原因" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.errorMsg }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="importOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="InspectPoint" lang="ts">
import { ref, reactive, toRefs, computed } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { useDict } from '@/utils/dict';
import type { InspectPointForm as InspectPointFormType, InspectPointQuery, InspectPointVO, PointImportRowVO } from '@/api/inspect/point/types';
import {
  listInspectPoint,
  getInspectPoint,
  addInspectPoint,
  updateInspectPoint,
  delInspectPoint,
  getPointQrcode,
  batchExportPointQrcode,
  importInspectPointData,
  importInspectPointConfirm
} from '@/api/inspect/point';
import { optionselectInspectRoom } from '@/api/inspect/room';
import InspectPointForm from './form.vue';

const { sys_point_status, sys_inspect_cycle } = useDict('sys_point_status', 'sys_inspect_cycle');

const pointList = ref<InspectPointVO[]>([]);
const roomOptions = ref<any[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const pointFormRef = ref();
const queryRef = ref();

/* 二维码 */
const qrcodeOpen = ref(false);
const qrcodeUrl = ref('');
const qrcodePointName = ref('');
const qrcodePointCode = ref('');
let qrcodeBlob: Blob | null = null;
let currentQrcodePointId: string | number | undefined;

/* 导入 */
const importOpen = ref(false);
const uploadRef = ref();
const fileList = ref<any[]>([]);
const uploadFile = ref<File | null>(null);
const importRows = ref<PointImportRowVO[]>([]);
const validating = ref(false);

const data = reactive({
  form: {} as InspectPointFormType,
  queryParams: { pageNum: 1, pageSize: 10 } as InspectPointQuery
});
const { queryParams, form } = toRefs(data);

/** 查询点位列表 */
async function getList() {
  loading.value = true;
  const [err, res] = await to(listInspectPoint(queryParams.value));
  loading.value = false;
  if (err) return;
  pointList.value = res!.data?.rows ?? [];
  total.value = res!.data?.total ?? 0;
}

async function loadRooms() {
  const { data } = await optionselectInspectRoom({});
  roomOptions.value = data ?? [];
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = { pointId: undefined } as InspectPointFormType;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectPointQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: InspectPointVO[]) {
  ids.value = selection.map((item) => item.pointId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增点位';
}

async function handleUpdate(row?: InspectPointVO) {
  reset();
  const _id = row?.pointId ?? ids.value[0];
  const { data } = await getInspectPoint(_id);
  const detail: any = data;
  form.value = {
    ...detail,
    itemList: (detail?.itemList ?? []).map((i: any) => ({ ...i }))
  };
  open.value = true;
  title.value = '修改点位';
}

/** 子组件校验通过后回调 */
async function handleSubmit(data: InspectPointFormType) {
  if (data.pointId != null) {
    const [err] = await to(updateInspectPoint(data));
    if (err) return;
    modal.msgSuccess('修改成功');
  } else {
    const [err, res] = await to(addInspectPoint(data));
    if (err) return;
    modal.msgSuccess('新增成功，已生成二维码');
    // 新增后可直接查看二维码
    if (res?.data != null) {
      currentQrcodePointId = res.data;
      qrcodePointName.value = data.pointName ?? '';
      qrcodePointCode.value = data.pointCode ?? '';
      await loadQrcode(res.data);
      qrcodeOpen.value = true;
    }
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: InspectPointVO) {
  const _ids = row?.pointId ?? ids.value;
  const [err] = await to(modal.confirm('是否确认删除点位编号为"' + _ids + '"的数据项？') as any);
  if (err) return;
  await delInspectPoint(_ids);
  modal.msgSuccess('删除成功');
  getList();
}

/* ---------------- 二维码 ---------------- */
/**
 * blob 响应里若装的是 JSON，说明后端抛了异常。
 * 注意：responseType=blob 时拦截器在判断 code 之前就直接 return，业务错误不会走 reject 分支，
 * 只能靠 MIME 类型识别，把真实 msg 解出来，否则用户只会看到一张裂图 / 莫名的失败。
 */
async function blobErrorText(blob: Blob): Promise<string> {
  if (!blob || !blob.type || blob.type.indexOf('json') === -1) return '';
  try {
    const body = JSON.parse(await blob.text());
    return body.msg || body.message || '操作失败';
  } catch {
    return '操作失败';
  }
}

async function loadQrcode(pointId: string | number) {
  if (qrcodeUrl.value) {
    URL.revokeObjectURL(qrcodeUrl.value);
    qrcodeUrl.value = '';
  }
  qrcodeBlob = null;
  const [err, res] = await to(getPointQrcode(pointId));
  if (err) {
    modal.msgError('二维码加载失败，请稍后重试');
    return;
  }
  // 响应拦截器对 blob 请求直接返回 Blob 本身（不是 { data: Blob }），写 res.data 会永远是 undefined
  const blob = res as unknown as Blob;
  const failMsg = blob ? await blobErrorText(blob) : '';
  if (failMsg) {
    modal.msgError(failMsg);
    return;
  }
  if (!blob) return;
  qrcodeBlob = blob;
  qrcodeUrl.value = URL.createObjectURL(blob);
}

async function handleShowQrcode(row: InspectPointVO) {
  currentQrcodePointId = row.pointId;
  qrcodePointName.value = row.pointName ?? '';
  qrcodePointCode.value = row.pointCode ?? '';
  await loadQrcode(row.pointId!);
  qrcodeOpen.value = true;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadSingleQrcode() {
  if (!qrcodeBlob) {
    modal.msgWarning('二维码尚未加载完成，请稍候重试');
    return;
  }
  saveBlob(qrcodeBlob, `${qrcodePointCode.value || '点位'}_二维码.png`);
}

async function handleBatchQrcode() {
  if (!ids.value.length) return;
  const [err, res] = await to(batchExportPointQrcode(ids.value));
  if (err) {
    modal.msgError('导出失败，请稍后重试');
    return;
  }
  // 同 loadQrcode：blob 请求拿到的是 Blob 本身
  const blob = res as unknown as Blob;
  if (!blob) {
    modal.msgError('导出失败');
    return;
  }
  // 后端会直接拒绝（超上限 / 所选点位均已停用等），这里把真实提示透传给用户
  const failMsg = await blobErrorText(blob);
  if (failMsg) {
    modal.msgError(failMsg);
    return;
  }
  saveBlob(blob, `点位二维码_${Date.now()}.zip`);
  modal.msgSuccess('导出成功');
}

/* ---------------- 批量导入 ---------------- */
function handleImport() {
  importOpen.value = true;
  fileList.value = [];
  uploadFile.value = null;
  importRows.value = [];
}

function handleDownloadTemplate() {
  download('/inspect/point/importTemplate', {}, '点位导入模板.xlsx');
}

function handleFileChange(file: any) {
  uploadFile.value = file.raw as File;
  fileList.value = [file];
  importRows.value = [];
}

function handleFileRemove() {
  uploadFile.value = null;
  importRows.value = [];
}

async function handleValidate() {
  if (!uploadFile.value) return;
  validating.value = true;
  const [err, res] = await to(importInspectPointData(uploadFile.value));
  validating.value = false;
  if (err) return;
  importRows.value = res?.data ?? [];
  const ok = successRows.value.length;
  const bad = importRows.value.length - ok;
  if (bad === 0) {
    modal.msgSuccess(`全部 ${ok} 行校验通过，可确认导入`);
  } else {
    modal.msgWarning(`校验完成：通过 ${ok} 行，失败 ${bad} 行`);
  }
}

const successRows = computed(() => importRows.value.filter((r) => r.success));

async function handleConfirmImport() {
  const rows = importRows.value.filter((r) => r.success);
  if (!rows.length) return;
  const [err, res] = await to(importInspectPointConfirm(rows));
  if (err) return;
  modal.msgSuccess(`成功导入 ${res?.data ?? 0} 条点位`);
  importOpen.value = false;
  getList();
}

loadRooms();
getList();
</script>

<style scoped>
.mt10 {
  margin-top: 10px;
}
</style>
