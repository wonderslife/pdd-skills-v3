<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="任务名称" prop="taskName">
        <el-input v-model="queryParams.taskName" placeholder="请输入任务名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="任务类型" prop="taskType">
        <el-select v-model="queryParams.taskType" placeholder="请选择任务类型" clearable style="width: 180px">
          <el-option v-for="d in yq_task_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="任务来源" prop="taskSource">
        <el-select v-model="queryParams.taskSource" placeholder="请选择任务来源" clearable style="width: 180px">
          <el-option v-for="d in yq_task_source" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:task:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:task:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:task:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:task:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="taskList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="任务名称" align="center" prop="taskName" show-overflow-tooltip />
      <el-table-column label="任务类型" align="center" prop="taskType">
        <template #default="scope">
          <dict-tag :options="yq_task_type" :value="scope.row.taskType" />
        </template>
      </el-table-column>
      <el-table-column label="任务来源" align="center" prop="taskSource">
        <template #default="scope">
          <dict-tag :options="yq_task_source" :value="scope.row.taskSource" />
        </template>
      </el-table-column>
      <el-table-column label="采集策略" align="center" prop="collectStrategy">
        <template #default="scope">
          <dict-tag :options="yq_collect_strategy" :value="scope.row.collectStrategy" />
        </template>
      </el-table-column>
      <el-table-column label="采集间隔（秒）" align="center" prop="collectInterval" width="120" show-overflow-tooltip />
      <el-table-column label="分级规则" align="center" prop="levelRuleName" show-overflow-tooltip />
      <el-table-column label="预警规则" align="center" prop="alertRuleName" show-overflow-tooltip />
      <el-table-column label="推送规则" align="center" prop="pushRuleName" show-overflow-tooltip />
      <el-table-column label="任务生效起始" align="center" prop="startTime" width="120" show-overflow-tooltip />
      <el-table-column label="任务结束时间（常态化为空）" align="center" prop="endTime" width="120" show-overflow-tooltip />
      <el-table-column label="最近一次调度时间" align="center" prop="lastScheduleTime" width="120" show-overflow-tooltip />
      <el-table-column label="状态（0正常 1停用）" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="任务关键词关联数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.keywordList?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.keywordList?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="任务渠道关联数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.channelList?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.channelList?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:task:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:task:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="1000px" append-to-body>
      <el-form ref="taskRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="任务名称" prop="taskName" required>
          <el-input v-model="form.taskName" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="任务类型" prop="taskType">
          <el-select v-model="form.taskType" placeholder="请选择任务类型" style="width: 100%">
            <el-option v-for="d in yq_task_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务来源" prop="taskSource">
          <el-select v-model="form.taskSource" placeholder="请选择任务来源" style="width: 100%">
            <el-option v-for="d in yq_task_source" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="采集策略" prop="collectStrategy">
          <el-select v-model="form.collectStrategy" placeholder="请选择采集策略" style="width: 100%">
            <el-option v-for="d in yq_collect_strategy" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="采集间隔（秒）" prop="collectInterval">
          <el-input-number v-model="form.collectInterval" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="分级规则" prop="levelRuleId">
          <el-select v-model="form.levelRuleId" placeholder="请选择分级规则" clearable filterable style="width: 100%">
            <el-option v-for="o in levelRuleOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警规则" prop="alertRuleId">
          <el-select v-model="form.alertRuleId" placeholder="请选择预警规则" clearable filterable style="width: 100%">
            <el-option v-for="o in alertRuleOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="推送规则" prop="pushRuleId">
          <el-select v-model="form.pushRuleId" placeholder="请选择推送规则" clearable filterable style="width: 100%">
            <el-option v-for="o in pushRuleOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务生效起始" prop="startTime">
          <el-date-picker v-model="form.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择任务生效起始" style="width: 100%" />
        </el-form-item>
        <el-form-item label="任务结束时间（常态化为空）" prop="endTime">
          <el-date-picker v-model="form.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择任务结束时间（常态化为空）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="最近一次调度时间" prop="lastScheduleTime">
          <el-date-picker v-model="form.lastScheduleTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="请选择最近一次调度时间" style="width: 100%" />
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
      <el-divider content-position="left">
        关键词关联
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAddKeywordList">添加关键词关联</el-button>
      </el-divider>
      <el-table :data="form.keywordList || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
        <el-table-column label="关键词" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row.keywordId" placeholder="请选择关键词" clearable filterable>
              <el-option v-for="o in keywordOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="任务级匹配策略（覆盖全局）" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.matchStrategy" placeholder="请输入任务级匹配策略（覆盖全局）" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemoveKeywordList($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">
        渠道关联
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAddChannelList">添加渠道关联</el-button>
      </el-divider>
      <el-table :data="form.channelList || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
        <el-table-column label="渠道" min-width="200">
          <template #default="{ row }">
            <el-select v-model="row.channelId" placeholder="请选择渠道" clearable filterable>
              <el-option v-for="o in channelOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="任务级频率覆盖（秒）" width="110" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.overrideInterval" :min="0" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemoveChannelList($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="YqTask" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqTaskForm, YqTaskQuery, YqTaskVO } from '@/api/yuqing/task/types';
import { listYqTask, getYqTask, delYqTask, addYqTask, updateYqTask } from '@/api/yuqing/task/index';
import { optionselectYqLevelRule } from '@/api/yuqing/levelRule/index';
import { optionselectYqAlertRule } from '@/api/yuqing/alertRule/index';
import { optionselectYqPushRule } from '@/api/yuqing/pushRule/index';
import { optionselectYqKeyword } from '@/api/yuqing/keyword/index';
import { optionselectYqChannel } from '@/api/yuqing/channel/index';
import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_task_type, yq_task_source, yq_collect_strategy, sys_normal_disable } = toRefs<any>(useDict('yq_task_type', 'yq_task_source', 'yq_collect_strategy', 'sys_normal_disable'));

const levelRuleOptions = ref<Array<{ label: string; value: any }>>([]);
const alertRuleOptions = ref<Array<{ label: string; value: any }>>([]);
const pushRuleOptions = ref<Array<{ label: string; value: any }>>([]);
const keywordOptions = ref<Array<{ label: string; value: any }>>([]);
const channelOptions = ref<Array<{ label: string; value: any }>>([]);
const taskList = ref<YqTaskVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const taskRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqTaskForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqTaskQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  taskName: [{ required: true, message: '任务名称不能为空', trigger: 'blur' }],
  taskType: [{ required: true, message: '任务类型不能为空', trigger: 'change' }],
  taskSource: [{ required: true, message: '任务来源不能为空', trigger: 'change' }],
  collectStrategy: [{ required: true, message: '采集策略不能为空', trigger: 'change' }],
  collectInterval: [{ required: true, message: '采集间隔（秒）不能为空', trigger: 'change' }],
  startTime: [{ required: true, message: '任务生效起始不能为空', trigger: 'blur' }]
};

/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
  const levelRuleRes = await optionselectYqLevelRule({});
  levelRuleOptions.value = (levelRuleRes.data ?? []).map((i: any) => ({ label: i.ruleName, value: i.ruleId }));
  const alertRuleRes = await optionselectYqAlertRule({});
  alertRuleOptions.value = (alertRuleRes.data ?? []).map((i: any) => ({ label: i.ruleName, value: i.ruleId }));
  const pushRuleRes = await optionselectYqPushRule({});
  pushRuleOptions.value = (pushRuleRes.data ?? []).map((i: any) => ({ label: i.ruleName, value: i.ruleId }));
  const keywordRes = await optionselectYqKeyword({});
  keywordOptions.value = (keywordRes.data ?? []).map((i: any) => ({ label: i.keywordText, value: i.keywordId }));
  const channelRes = await optionselectYqChannel({});
  channelOptions.value = (channelRes.data ?? []).map((i: any) => ({ label: i.channelName, value: i.channelId }));
}


/** 任务关键词关联：新增一行 */
function handleAddKeywordList() {
  if (!form.value.keywordList) form.value.keywordList = [];
  form.value.keywordList!.push({ keywordId: undefined, matchStrategy: '' });
}

/** 任务关键词关联：删除一行 */
function handleRemoveKeywordList(index: number) {
  form.value.keywordList?.splice(index, 1);
}

/** 任务渠道关联：新增一行 */
function handleAddChannelList() {
  if (!form.value.channelList) form.value.channelList = [];
  form.value.channelList!.push({ channelId: undefined, overrideInterval: 0 });
}

/** 任务渠道关联：删除一行 */
function handleRemoveChannelList(index: number) {
  form.value.channelList?.splice(index, 1);
}

/** 查询监测任务列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqTask(queryParams.value);
    taskList.value = res.data?.rows ?? [];
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
  form.value = { taskId: undefined, keywordList: [], channelList: [] } as YqTaskForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqTaskQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqTaskVO[]) {
  ids.value = selection.map(item => item.taskId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增监测任务';
}

async function handleUpdate(row?: YqTaskVO) {
  reset();
  const _id = row?.taskId ?? ids.value[0];
  const res = await getYqTask(_id);
  form.value = res.data as any;
  if (!form.value.keywordList) form.value.keywordList = [];
  if (!form.value.channelList) form.value.channelList = [];
  open.value = true;
  title.value = '修改监测任务';
}

/** 提交表单 */
async function submitForm() {
  await taskRef.value?.validate();
  const keywordList = form.value.keywordList ?? [];
  for (let i = 0; i < keywordList.length; i++) {
    if (!keywordList[i].matchStrategy) {
      proxy?.$modal.msgError(`第 ${i + 1} 行任务关键词关联的「任务级匹配策略（覆盖全局）」不能为空`);
      return;
    }
  }
  const channelList = form.value.channelList ?? [];
  for (let i = 0; i < channelList.length; i++) {
    if (!channelList[i].channelId) {
      proxy?.$modal.msgError(`第 ${i + 1} 行任务渠道关联的「渠道ID」不能为空`);
      return;
    }
  }
  if (form.value.taskId != null) {
    await updateYqTask(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqTask(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqTaskVO) {
  const _ids = row?.taskId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除监测任务编号为"' + _ids + '"的数据项？');
  await delYqTask(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/task/export', { ...queryParams.value }, `监测任务_${new Date().getTime()}.xlsx`);
}

getList();
loadForeignOptions();
</script>
