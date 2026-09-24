<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="批次名称" prop="batchName">
        <el-input v-model="queryParams.batchName" placeholder="请输入批次名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="重跑类型" prop="batchType">
        <el-select v-model="queryParams.batchType" placeholder="请选择重跑类型" clearable style="width: 180px">
          <el-option v-for="d in yq_clean_batch_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="范围-任务" prop="scopeTaskId">
        <el-select v-model="queryParams.scopeTaskId" placeholder="请选择范围-任务" clearable filterable style="width: 200px">
          <el-option v-for="o in taskOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:clean:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:clean:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:clean:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:clean:export']" @click="handleExport">导出</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Refresh" v-hasPermi="['yuqing:clean:replay']" @click="openReplay">净化重跑</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="cleanBatchList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="批次名称" align="center" prop="batchName" width="120" show-overflow-tooltip />
      <el-table-column label="重跑类型" align="center" prop="batchType">
        <template #default="scope">
          <dict-tag :options="yq_clean_batch_type" :value="scope.row.batchType" />
        </template>
      </el-table-column>
      <el-table-column label="范围-任务" align="center" prop="taskName" show-overflow-tooltip />
      <el-table-column label="范围-渠道" align="center" prop="channelName" show-overflow-tooltip />
      <el-table-column label="范围-起始采集日" align="center" prop="scopeStartDate" width="120" show-overflow-tooltip />
      <el-table-column label="范围-截止采集日" align="center" prop="scopeEndDate" width="120" show-overflow-tooltip />
      <el-table-column label="扫描条数" align="center" prop="totalCount" width="120" show-overflow-tooltip />
      <el-table-column label="净化保留条数" align="center" prop="cleanedCount" width="120" show-overflow-tooltip />
      <el-table-column label="降噪剔除条数" align="center" prop="rejectedCount" width="120" show-overflow-tooltip />
      <el-table-column label="链接去重条数" align="center" prop="dupCount" width="120" show-overflow-tooltip />
      <el-table-column label="跨渠道重复条数" align="center" prop="dupChannelCount" width="120" show-overflow-tooltip />
      <el-table-column label="垃圾内容剔除量" align="center" prop="noiseSpam" width="120" show-overflow-tooltip />
      <el-table-column label="广告营销剔除量" align="center" prop="noiseAdvertisement" width="120" show-overflow-tooltip />
      <el-table-column label="灌水评论剔除量" align="center" prop="noiseFlooding" width="120" show-overflow-tooltip />
      <el-table-column label="无意义短句剔除量" align="center" prop="noiseMeaningless" width="120" show-overflow-tooltip />
      <el-table-column label="机器人内容剔除量" align="center" prop="noiseBot" width="120" show-overflow-tooltip />
      <el-table-column label="空白内容剔除量" align="center" prop="noiseBlank" width="120" show-overflow-tooltip />
      <el-table-column label="违规屏蔽剔除量" align="center" prop="noiseViolation" width="120" show-overflow-tooltip />
      <el-table-column label="仅预览未落库（0否 1是）" align="center" prop="previewOnly" width="120" show-overflow-tooltip />
      <el-table-column label="执行状态" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="yq_clean_batch_status" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="失败原因" align="center" prop="failReason" width="120" show-overflow-tooltip />
      <el-table-column label="耗时（毫秒）" align="center" prop="costMs" width="120" show-overflow-tooltip />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:clean:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:clean:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="cleanBatchRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="批次名称" prop="batchName" required>
          <el-input v-model="form.batchName" placeholder="请输入批次名称" />
        </el-form-item>
        <el-form-item label="重跑类型" prop="batchType">
          <el-select v-model="form.batchType" placeholder="请选择重跑类型" style="width: 100%">
            <el-option v-for="d in yq_clean_batch_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="范围-任务" prop="scopeTaskId">
          <el-select v-model="form.scopeTaskId" placeholder="请选择范围-任务" clearable filterable style="width: 100%">
            <el-option v-for="o in taskOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="范围-渠道" prop="scopeChannelId">
          <el-select v-model="form.scopeChannelId" placeholder="请选择范围-渠道" clearable filterable style="width: 100%">
            <el-option v-for="o in channelOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="范围-起始采集日" prop="scopeStartDate">
          <el-date-picker v-model="form.scopeStartDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择范围-起始采集日" style="width: 100%" />
        </el-form-item>
        <el-form-item label="范围-截止采集日" prop="scopeEndDate">
          <el-date-picker v-model="form.scopeEndDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择范围-截止采集日" style="width: 100%" />
        </el-form-item>
        <el-form-item label="扫描条数" prop="totalCount">
          <el-input-number v-model="form.totalCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="净化保留条数" prop="cleanedCount">
          <el-input-number v-model="form.cleanedCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="降噪剔除条数" prop="rejectedCount">
          <el-input-number v-model="form.rejectedCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="链接去重条数" prop="dupCount">
          <el-input-number v-model="form.dupCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="跨渠道重复条数" prop="dupChannelCount">
          <el-input-number v-model="form.dupChannelCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="垃圾内容剔除量" prop="noiseSpam">
          <el-input-number v-model="form.noiseSpam" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="广告营销剔除量" prop="noiseAdvertisement">
          <el-input-number v-model="form.noiseAdvertisement" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="灌水评论剔除量" prop="noiseFlooding">
          <el-input-number v-model="form.noiseFlooding" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="无意义短句剔除量" prop="noiseMeaningless">
          <el-input-number v-model="form.noiseMeaningless" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="机器人内容剔除量" prop="noiseBot">
          <el-input-number v-model="form.noiseBot" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="空白内容剔除量" prop="noiseBlank">
          <el-input-number v-model="form.noiseBlank" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="违规屏蔽剔除量" prop="noiseViolation">
          <el-input-number v-model="form.noiseViolation" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="仅预览未落库（0否 1是）" prop="previewOnly">
          <el-input v-model="form.previewOnly" placeholder="请输入仅预览未落库（0否 1是）" />
        </el-form-item>
        <el-form-item label="执行状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择执行状态" style="width: 100%">
            <el-option v-for="d in yq_clean_batch_status" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="失败原因" prop="failReason">
          <el-input v-model="form.failReason" placeholder="请输入失败原因" />
        </el-form-item>
        <el-form-item label="耗时（毫秒）" prop="costMs">
          <el-input-number v-model="form.costMs" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
    <CleanReplayDialog ref="replayRef" @success="getList" />
  </div>
</template>

<script setup name="YqCleanBatch" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqCleanBatchForm, YqCleanBatchQuery, YqCleanBatchVO } from '@/api/yuqing/cleanBatch/types';
import { listYqCleanBatch, getYqCleanBatch, delYqCleanBatch, addYqCleanBatch, updateYqCleanBatch } from '@/api/yuqing/cleanBatch/index';
import { optionselectYqTask } from '@/api/yuqing/task/index';
import { optionselectYqChannel } from '@/api/yuqing/channel/index';
import CleanReplayDialog from './CleanReplayDialog.vue';
import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_clean_batch_type, yq_clean_batch_status } = toRefs<any>(useDict('yq_clean_batch_type', 'yq_clean_batch_status'));

const taskOptions = ref<Array<{ label: string; value: any }>>([]);
const channelOptions = ref<Array<{ label: string; value: any }>>([]);
const cleanBatchList = ref<YqCleanBatchVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const cleanBatchRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqCleanBatchForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqCleanBatchQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  batchName: [{ required: true, message: '批次名称不能为空', trigger: 'blur' }],
  batchType: [{ required: true, message: '重跑类型不能为空', trigger: 'change' }],
  status: [{ required: true, message: '执行状态不能为空', trigger: 'change' }]
};

/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
  const taskRes = await optionselectYqTask({});
  taskOptions.value = (taskRes.data ?? []).map((i: any) => ({ label: i.taskName, value: i.taskId }));
  const channelRes = await optionselectYqChannel({});
  channelOptions.value = (channelRes.data ?? []).map((i: any) => ({ label: i.channelName, value: i.channelId }));
}


/** 查询净化批次列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqCleanBatch(queryParams.value);
    cleanBatchList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = { batchId: undefined } as YqCleanBatchForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqCleanBatchQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqCleanBatchVO[]) {
  ids.value = selection.map(item => item.batchId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增净化批次';
}

async function handleUpdate(row?: YqCleanBatchVO) {
  reset();
  const _id = row?.batchId ?? ids.value[0];
  const res = await getYqCleanBatch(_id);
  form.value = res.data as any;

  open.value = true;
  title.value = '修改净化批次';
}

/** 提交表单 */
async function submitForm() {
  await cleanBatchRef.value?.validate();

  if (form.value.batchId != null) {
    await updateYqCleanBatch(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqCleanBatch(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqCleanBatchVO) {
  const _ids = row?.batchId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除净化批次编号为"' + _ids + '"的数据项？');
  await delYqCleanBatch(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/cleanBatch/export', { ...queryParams.value }, `净化批次_${new Date().getTime()}.xlsx`);
}

const replayRef = ref();

/** 打开净化重跑对话框：先预览影响条数，确认后才真正落库 */
function openReplay() {
  replayRef.value?.open();
}

getList();
loadForeignOptions();
</script>
