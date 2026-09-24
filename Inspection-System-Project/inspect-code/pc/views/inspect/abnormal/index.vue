<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="80px">
      <el-form-item label="所属机房" prop="roomId">
        <el-select v-model="queryParams.roomId" placeholder="请选择机房" clearable filterable style="width: 170px">
          <el-option v-for="o in roomOptions" :key="o.roomId" :label="o.roomName" :value="o.roomId!" />
        </el-select>
      </el-form-item>
      <el-form-item label="处理状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 150px">
          <el-option v-for="d in sys_abnormal_status" :key="d.value" :label="d.label" :value="d.value" />
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
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:abnormal:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="abnormalList">
      <el-table-column label="点位名称" align="center" prop="pointName" min-width="140" show-overflow-tooltip />
      <el-table-column label="所属机房" align="center" prop="roomName" width="130" />
      <el-table-column label="巡检项" align="center" prop="itemName" min-width="130" show-overflow-tooltip />
      <el-table-column label="异常说明" align="center" prop="description" min-width="180" show-overflow-tooltip />
      <el-table-column label="巡检时间" align="center" prop="inspectTime" width="170" />
      <el-table-column label="处理状态" align="center" prop="status" width="110">
        <template #default="scope">
          <dict-tag :options="sys_abnormal_status" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="处理说明" align="center" prop="processRemark" min-width="160" show-overflow-tooltip />
      <el-table-column label="处理时间" align="center" prop="processTime" width="170" />
      <el-table-column label="操作" align="center" width="180" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="View" v-hasPermi="['inspect:abnormal:query']" @click="handleDetail(scope.row)">详情</el-button>
          <el-button
            link
            type="primary"
            icon="Check"
            v-hasPermi="['inspect:abnormal:process']"
            :disabled="scope.row.status === 'processed'"
            @click="handleProcess(scope.row)"
          >
            标记已处理
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 详情 -->
    <el-dialog title="异常项详情" v-model="detailOpen" width="900px" append-to-body>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="点位名称">{{ detail?.pointName }}</el-descriptions-item>
        <el-descriptions-item label="所属机房">{{ detail?.roomName }}</el-descriptions-item>
        <el-descriptions-item label="巡检项">{{ detail?.itemName }}</el-descriptions-item>
        <el-descriptions-item label="巡检时间">{{ detail?.inspectTime }}</el-descriptions-item>
        <el-descriptions-item label="处理状态">
          <dict-tag :options="sys_abnormal_status" :value="detail?.status" />
        </el-descriptions-item>
        <el-descriptions-item label="处理时间">{{ detail?.processTime || '-' }}</el-descriptions-item>
        <el-descriptions-item label="异常说明" :span="2">{{ detail?.description || '-' }}</el-descriptions-item>
        <el-descriptions-item label="处理说明" :span="2">{{ detail?.processRemark || '-' }}</el-descriptions-item>
      </el-descriptions>
      <template v-if="detail?.photoUrls?.length">
        <el-divider content-position="left">现场照片</el-divider>
        <div class="photo-list">
          <el-image
            v-for="(url, pi) in detail.photoUrls"
            :key="pi"
            :src="url"
            :preview-src-list="detail.photoUrls"
            :initial-index="pi"
            fit="cover"
            class="photo-thumb"
          />
        </div>
      </template>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailOpen = false">关 闭</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 标记已处理 -->
    <el-dialog title="标记已处理" v-model="processOpen" width="560px" append-to-body>
      <el-form label-width="90px">
        <el-form-item label="处理说明">
          <el-input v-model="processRemark" type="textarea" :rows="4" placeholder="请填写处理措施与结果" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitProcess">确 定</el-button>
          <el-button @click="processOpen = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="InspectAbnormal" lang="ts">
import { ref, reactive, toRefs } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import { download } from '@/utils/request';
import { useDict } from '@/utils/dict';
import type { InspectAbnormalQuery, InspectAbnormalVO } from '@/api/inspect/abnormal/types';
import { listInspectAbnormal, getInspectAbnormal, processInspectAbnormal } from '@/api/inspect/abnormal';
import { optionselectInspectRoom } from '@/api/inspect/room';

const { sys_abnormal_status } = useDict('sys_abnormal_status');

const abnormalList = ref<InspectAbnormalVO[]>([]);
const roomOptions = ref<any[]>([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const dateRange = ref<string[]>([]);
const queryRef = ref();

const detailOpen = ref(false);
const detail = ref<InspectAbnormalVO | null>(null);

const processOpen = ref(false);
const processRemark = ref('');
const currentId = ref<string | number | null>(null);

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, status: 'pending' } as InspectAbnormalQuery
});
const { queryParams } = toRefs(data);

async function getList() {
  loading.value = true;
  const q: any = { ...queryParams.value };
  if (dateRange.value && dateRange.value.length === 2) {
    q.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] };
  }
  const [err, res] = await to(listInspectAbnormal(q));
  loading.value = false;
  if (err) return;
  abnormalList.value = res!.data?.rows ?? [];
  total.value = res!.data?.total ?? 0;
}

async function loadRooms() {
  const { data } = await optionselectInspectRoom({});
  roomOptions.value = data ?? [];
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  dateRange.value = [];
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectAbnormalQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

async function handleDetail(row: InspectAbnormalVO) {
  const [err, res] = await to(getInspectAbnormal(row.abnormalId!));
  if (err) return;
  detail.value = res?.data ?? null;
  detailOpen.value = true;
}

function handleProcess(row: InspectAbnormalVO) {
  currentId.value = row.abnormalId!;
  processRemark.value = '';
  processOpen.value = true;
}

async function submitProcess() {
  if (!processRemark.value) {
    modal.msgError('处理说明不能为空');
    return;
  }
  const [err] = await to(processInspectAbnormal(currentId.value!, processRemark.value));
  if (err) return;
  modal.msgSuccess('已标记为处理完成');
  processOpen.value = false;
  getList();
}

function handleExport() {
  const q: any = { ...queryParams.value };
  if (dateRange.value && dateRange.value.length === 2) {
    q.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] };
  }
  download('/inspect/abnormal/export', q, `异常项_${new Date().getTime()}.xlsx`);
}

loadRooms();
getList();
</script>

<style scoped>
.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-thumb {
  width: 110px;
  height: 110px;
  border-radius: 6px;
}
</style>
