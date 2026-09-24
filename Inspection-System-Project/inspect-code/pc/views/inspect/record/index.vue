<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="80px">
      <el-form-item label="所属机房" prop="roomId">
        <el-select v-model="queryParams.roomId" placeholder="请选择机房" clearable filterable style="width: 170px">
          <el-option v-for="o in roomOptions" :key="o.roomId" :label="o.roomName" :value="o.roomId!" />
        </el-select>
      </el-form-item>
      <el-form-item label="巡检点位" prop="pointId">
        <el-select v-model="queryParams.pointId" placeholder="请选择点位" clearable filterable style="width: 190px">
          <el-option
            v-for="p in pointOptions"
            :key="p.pointId"
            :label="`${p.pointName}（${p.pointCode}）`"
            :value="p.pointId!"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="巡检结果" prop="result">
        <el-select v-model="queryParams.result" placeholder="请选择结果" clearable style="width: 170px">
          <el-option v-for="d in sys_inspect_result" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="数据来源" prop="source">
        <el-select v-model="queryParams.source" placeholder="请选择来源" clearable style="width: 150px">
          <el-option v-for="d in sys_inspect_source" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="巡检时间">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['inspect:record:supplement']" @click="handleSupplement">
          逾期补录
        </el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:record:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="recordList">
      <el-table-column label="巡检点位" align="center" prop="pointName" min-width="140" show-overflow-tooltip />
      <el-table-column label="所属机房" align="center" prop="roomName" width="130" />
      <el-table-column label="巡检员" align="center" prop="inspectorName" width="110" />
      <el-table-column label="巡检时间" align="center" prop="inspectTime" width="170" />
      <el-table-column label="耗时" align="center" width="90">
        <template #default="{ row }">{{ row.duration != null ? row.duration + 's' : '-' }}</template>
      </el-table-column>
      <el-table-column label="巡检结果" align="center" prop="result" width="130">
        <template #default="scope">
          <dict-tag :options="sys_inspect_result" :value="scope.row.result" />
        </template>
      </el-table-column>
      <el-table-column label="异常项" align="center" prop="abnormalCount" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.abnormalCount > 0" type="danger">{{ row.abnormalCount }}</el-tag>
          <span v-else>0</span>
        </template>
      </el-table-column>
      <el-table-column label="数据来源" align="center" prop="source" width="110">
        <template #default="scope">
          <dict-tag :options="sys_inspect_source" :value="scope.row.source" />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="170" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="handleDetail(scope.row)">详情</el-button>
          <el-button link type="primary" icon="Edit" v-hasPermi="['inspect:record:remark']" @click="handleRemark(scope.row)">备注</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 详情 -->
    <el-dialog title="巡检记录详情" v-model="detailOpen" width="1000px" append-to-body>
      <InspectRecordDetail :record-id="currentRecordId" />
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 逾期补录 -->
    <el-dialog title="巡检逾期补录" v-model="supplementOpen" width="1080px" append-to-body>
      <el-alert
        title="补录不受「H5 同周期禁止重复」限制，用于修正漏检；记录来源将标记为 PC 补录，并写入操作日志。"
        type="warning"
        :closable="false"
        style="margin-bottom: 12px"
      />
      <InspectRecordSupplement ref="supplementFormRef" @submit="handleSupplementSubmit" />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="supplementFormRef?.submit()">确 定</el-button>
          <el-button @click="supplementOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 追加管理员备注 -->
    <el-dialog title="追加管理员备注" v-model="remarkOpen" width="560px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="备注内容">
          <el-input v-model="remarkText" type="textarea" :rows="4" placeholder="已提交记录不可修改，仅可追加备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitRemark">确 定</el-button>
          <el-button @click="remarkOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="InspectRecord" lang="ts">
import { ref, reactive, toRefs } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { useDict } from '@/utils/dict';
import type { InspectRecordQuery, InspectRecordSubmitForm, InspectRecordVO } from '@/api/inspect/record/types';
import { listInspectRecord, supplementInspectRecord, remarkInspectRecord } from '@/api/inspect/record';
import { optionselectInspectRoom } from '@/api/inspect/room';
import { optionselectInspectPoint } from '@/api/inspect/point';
import InspectRecordDetail from './detail.vue';
import InspectRecordSupplement from './supplement.vue';

const { sys_inspect_result, sys_inspect_source } = useDict('sys_inspect_result', 'sys_inspect_source');

const recordList = ref<InspectRecordVO[]>([]);
const roomOptions = ref<any[]>([]);
const pointOptions = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const dateRange = ref<string[]>([]);
const queryRef = ref();

const detailOpen = ref(false);
const currentRecordId = ref<string | number | null>(null);

const supplementOpen = ref(false);
const supplementFormRef = ref();

const remarkOpen = ref(false);
const remarkText = ref('');
const currentRemarkId = ref<string | number | null>(null);

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10 } as InspectRecordQuery
});
const { queryParams } = toRefs(data);

/** 查询列表 */
async function getList() {
  loading.value = true;
  const q: any = { ...queryParams.value };
  if (dateRange.value && dateRange.value.length === 2) {
    q.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] };
  }
  const [err, res] = await to(listInspectRecord(q));
  loading.value = false;
  if (err) return;
  recordList.value = res!.data?.rows ?? [];
  total.value = res!.data?.total ?? 0;
}

async function loadOptions() {
  const [r1, r2] = await Promise.all([optionselectInspectRoom({}), optionselectInspectPoint({})]);
  roomOptions.value = r1.data ?? [];
  pointOptions.value = r2.data ?? [];
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  dateRange.value = [];
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectRecordQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleDetail(row: InspectRecordVO) {
  currentRecordId.value = row.recordId!;
  detailOpen.value = true;
}

function handleSupplement() {
  supplementFormRef.value?.reset();
  supplementOpen.value = true;
}

/** 补录提交 */
async function handleSupplementSubmit(data: InspectRecordSubmitForm) {
  const [err] = await to(supplementInspectRecord(data));
  if (err) return;
  modal.msgSuccess('补录成功');
  supplementOpen.value = false;
  getList();
}

function handleRemark(row: InspectRecordVO) {
  currentRemarkId.value = row.recordId!;
  remarkText.value = row.adminRemark ?? '';
  remarkOpen.value = true;
}

async function submitRemark() {
  if (!remarkText.value) {
    modal.msgError('备注内容不能为空');
    return;
  }
  const [err] = await to(remarkInspectRecord(currentRemarkId.value!, remarkText.value));
  if (err) return;
  modal.msgSuccess('备注已追加');
  remarkOpen.value = false;
  getList();
}

function handleExport() {
  const q: any = { ...queryParams.value };
  if (dateRange.value && dateRange.value.length === 2) {
    q.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] };
  }
  download('/inspect/record/export', q, `巡检记录_${new Date().getTime()}.xlsx`);
}

loadOptions();
getList();
</script>
