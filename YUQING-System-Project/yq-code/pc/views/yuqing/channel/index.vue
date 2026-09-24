<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="渠道名称" prop="channelName">
        <el-input v-model="queryParams.channelName" placeholder="请输入渠道名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="渠道类别" prop="channelCategory">
        <el-select v-model="queryParams.channelCategory" placeholder="请选择渠道类别" clearable style="width: 180px">
          <el-option v-for="d in yq_channel_category" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="域名或平台标识" prop="channelDomain">
        <el-input v-model="queryParams.channelDomain" placeholder="请输入域名或平台标识" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:channel:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:channel:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:channel:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:channel:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="channelList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="渠道名称" align="center" prop="channelName" show-overflow-tooltip />
      <el-table-column label="渠道类别" align="center" prop="channelCategory">
        <template #default="scope">
          <dict-tag :options="yq_channel_category" :value="scope.row.channelCategory" />
        </template>
      </el-table-column>
      <el-table-column label="域名或平台标识" align="center" prop="channelDomain" show-overflow-tooltip />
      <el-table-column label="站点适配器标识（YAML 配置键）" align="center" prop="adapterClass" width="120" show-overflow-tooltip />
      <el-table-column label="绑定采集器ID" align="center" prop="collectorId" width="120" show-overflow-tooltip />
      <el-table-column label="渠道级频率覆盖（秒）" align="center" prop="intervalOverride" width="120" show-overflow-tooltip />
      <el-table-column label="请求间隔（毫秒）" align="center" prop="requestInterval" width="120" show-overflow-tooltip />
      <el-table-column label="并发上限" align="center" prop="concurrencyLimit" width="120" show-overflow-tooltip />
      <el-table-column label="代理池分组ID" align="center" prop="proxyGroupId" width="120" show-overflow-tooltip />
      <el-table-column label="UA 池ID" align="center" prop="uaPoolId" width="120" show-overflow-tooltip />
      <el-table-column label="失败率告警阈值（%）" align="center" prop="failRateThreshold" width="120" show-overflow-tooltip />
      <el-table-column label="最近采集时间" align="center" prop="lastCollectTime" width="120" show-overflow-tooltip />
      <el-table-column label="状态（0正常 1停用）" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:channel:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:channel:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="channelRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="渠道名称" prop="channelName" required>
          <el-input v-model="form.channelName" placeholder="请输入渠道名称" />
        </el-form-item>
        <el-form-item label="渠道类别" prop="channelCategory">
          <el-select v-model="form.channelCategory" placeholder="请选择渠道类别" style="width: 100%">
            <el-option v-for="d in yq_channel_category" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="域名或平台标识" prop="channelDomain">
          <el-input v-model="form.channelDomain" placeholder="请输入域名或平台标识" />
        </el-form-item>
        <el-form-item label="站点适配器标识（YAML 配置键）" prop="adapterClass">
          <el-input v-model="form.adapterClass" placeholder="请输入站点适配器标识（YAML 配置键）" />
        </el-form-item>
        <el-form-item label="绑定采集器ID" prop="collectorId">
          <el-input v-model="form.collectorId" placeholder="请输入绑定采集器ID" />
        </el-form-item>
        <el-form-item label="渠道级频率覆盖（秒）" prop="intervalOverride">
          <el-input-number v-model="form.intervalOverride" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="请求间隔（毫秒）" prop="requestInterval">
          <el-input-number v-model="form.requestInterval" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="并发上限" prop="concurrencyLimit">
          <el-input-number v-model="form.concurrencyLimit" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="代理池分组ID" prop="proxyGroupId">
          <el-input v-model="form.proxyGroupId" placeholder="请输入代理池分组ID" />
        </el-form-item>
        <el-form-item label="UA 池ID" prop="uaPoolId">
          <el-input v-model="form.uaPoolId" placeholder="请输入UA 池ID" />
        </el-form-item>
        <el-form-item label="失败率告警阈值（%）" prop="failRateThreshold">
          <el-input-number v-model="form.failRateThreshold" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最近采集时间" prop="lastCollectTime">
          <el-date-picker v-model="form.lastCollectTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择最近采集时间" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态（0正常 1停用）" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态（0正常 1停用）" style="width: 100%">
            <el-option v-for="d in sys_normal_disable" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="请输入备注" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqChannel" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqChannelForm, YqChannelQuery, YqChannelVO } from '@/api/yuqing/channel/types';
import { listYqChannel, getYqChannel, delYqChannel, addYqChannel, updateYqChannel } from '@/api/yuqing/channel/index';

import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_channel_category, sys_normal_disable } = toRefs<any>(useDict('yq_channel_category', 'sys_normal_disable'));

const channelList = ref<YqChannelVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const channelRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqChannelForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqChannelQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  channelName: [{ required: true, message: '渠道名称不能为空', trigger: 'blur' }],
  channelCategory: [{ required: true, message: '渠道类别不能为空', trigger: 'change' }]
};


/** 查询采集渠道列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqChannel(queryParams.value);
    channelList.value = res.data?.rows ?? [];
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
  form.value = { channelId: undefined } as YqChannelForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqChannelQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqChannelVO[]) {
  ids.value = selection.map(item => item.channelId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增采集渠道';
}

async function handleUpdate(row?: YqChannelVO) {
  reset();
  const _id = row?.channelId ?? ids.value[0];
  const res = await getYqChannel(_id);
  form.value = res.data as any;

  open.value = true;
  title.value = '修改采集渠道';
}

/** 提交表单 */
async function submitForm() {
  await channelRef.value?.validate();

  if (form.value.channelId != null) {
    await updateYqChannel(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqChannel(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqChannelVO) {
  const _ids = row?.channelId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除采集渠道编号为"' + _ids + '"的数据项？');
  await delYqChannel(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/channel/export', { ...queryParams.value }, `采集渠道_${new Date().getTime()}.xlsx`);
}

getList();
</script>
