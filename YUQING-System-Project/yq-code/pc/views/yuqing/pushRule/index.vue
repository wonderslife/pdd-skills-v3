<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="queryParams.ruleName" placeholder="请输入规则名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="推送级别" prop="pushLevel">
        <el-select v-model="queryParams.pushLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标类型" prop="targetType">
        <el-select v-model="queryParams.targetType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_target" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd()">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Refresh" :loading="flushing" @click="handleFlush()">刷出顺延批量</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="ruleList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="规则名称" prop="ruleName" :show-overflow-tooltip="true" min-width="160" />
      <el-table-column label="推送场景" prop="pushScenes" :show-overflow-tooltip="true" min-width="180" />
      <el-table-column label="推送级别" prop="pushLevel" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_level" :value="scope.row.pushLevel" />
        </template>
      </el-table-column>
      <el-table-column label="目标类型" prop="targetType" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_target" :value="scope.row.targetType" />
        </template>
      </el-table-column>
      <el-table-column label="目标ID" prop="targetIds" :show-overflow-tooltip="true" min-width="140" />
      <el-table-column label="推送模板" prop="templateName" width="140" align="center" />
      <el-table-column label="免打扰" width="130" align="center">
        <template #default="scope">
          <span>{{ scope.row.quietStart }} ~ {{ scope.row.quietEnd }}</span>
        </template>
      </el-table-column>
      <el-table-column label="重试上限" prop="maxRetry" width="90" align="center" />
      <el-table-column label="状态" prop="status" width="80" align="center">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" @pagination="getList" />

    <el-dialog v-model="open" :title="title" width="720px" append-to-body>
      <el-form ref="ruleRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="推送场景" prop="pushScenes">
          <el-select v-model="sceneList" multiple placeholder="请选择推送场景" style="width: 100%">
            <el-option v-for="d in yq_push_scene" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="推送级别" prop="pushLevel">
              <el-select v-model="form.pushLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="推送模板" prop="pushTemplateId">
              <el-select v-model="form.pushTemplateId" placeholder="不选则用内置模板" clearable style="width: 100%">
                <el-option v-for="t in templateOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="form.pushLevel === 'scheduled'" label="定时批量 cron" prop="scheduleCron">
          <el-input v-model="form.scheduleCron" placeholder="如 0 0 9 * * ?（留空则由定时任务按节拍刷出）" maxlength="50" />
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="目标类型" prop="targetType">
              <el-select v-model="form.targetType" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_target" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标ID" prop="targetIds">
              <el-input v-model="form.targetIds" placeholder="角色ID / 部门ID / 用户ID，逗号分隔" maxlength="1000" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="免打扰开始" prop="quietStart">
              <el-input v-model="form.quietStart" placeholder="HH:mm，如 22:00" maxlength="5" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="免打扰结束" prop="quietEnd">
              <el-input v-model="form.quietEnd" placeholder="HH:mm，如 08:00" maxlength="5" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" show-icon title="免打扰时段内，定时批量会顺延到时段结束再发；高风险即时推送会穿透（可在配置中关闭）。开始与结束相同视为未配置。" />
        <el-form-item label="重试上限" prop="maxRetry">
          <el-input-number v-model="form.maxRetry" :min="0" :max="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in sys_normal_disable" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
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

<script setup name="YqPushRule" lang="ts">
import { ref, reactive, toRefs, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqPushRuleForm, YqPushRuleQuery, YqPushRuleVO } from '@/api/yuqing/pushRule/types';
import { listYqPushRule, getYqPushRule, delYqPushRule, addYqPushRule, updateYqPushRule } from '@/api/yuqing/pushRule/index';
import { optionselectYqPushTemplate } from '@/api/yuqing/pushTemplate/index';
import { flushPush } from '@/api/yuqing/push/dispatch';
import { useDict } from '@/utils/dict';

const { yq_push_level, yq_push_scene, yq_push_target, sys_normal_disable } = toRefs<any>(
  useDict('yq_push_level', 'yq_push_scene', 'yq_push_target', 'sys_normal_disable')
);

const loading = ref(true);
const showSearch = ref(true);
const flushing = ref(false);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const ruleList = ref<YqPushRuleVO[]>([]);
const templateOptions = ref<Array<{ label: string; value: any }>>([]);
const queryRef = ref();
const ruleRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, ruleName: undefined, pushLevel: undefined, targetType: undefined } as YqPushRuleQuery,
  form: {} as YqPushRuleForm
});
const { queryParams, form } = toRefs(data);

const sceneList = computed({
  get() {
    const v = form.value.pushScenes;
    return v ? String(v).split(',').filter((s) => s) : [];
  },
  set(val: string[]) {
    form.value.pushScenes = val.join(',');
  }
});

const rules = {
  ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
  pushScenes: [{ required: true, message: '至少选择一个推送场景', trigger: 'change' }],
  pushLevel: [{ required: true, message: '推送级别不能为空', trigger: 'change' }],
  targetType: [{ required: true, message: '目标类型不能为空', trigger: 'change' }],
  targetIds: [{ required: true, message: '目标ID不能为空', trigger: 'blur' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqPushRule(queryParams.value);
    ruleList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

async function loadTemplates() {
  const res = await optionselectYqPushTemplate({});
  templateOptions.value = (res.data || []).map((t: any) => ({ label: t.templateName, value: t.templateId }));
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = {
    ruleId: undefined,
    ruleName: undefined,
    pushScenes: 'high_risk',
    pushLevel: 'immediate',
    scheduleCron: undefined,
    pushTemplateId: undefined,
    targetType: 'user',
    targetIds: undefined,
    quietStart: '22:00',
    quietEnd: '08:00',
    maxRetry: 3,
    status: '0'
  } as YqPushRuleForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqPushRuleQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqPushRuleVO[]) {
  ids.value = selection.map((item) => item.ruleId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增推送规则';
}

async function handleUpdate(row?: YqPushRuleVO) {
  reset();
  const _id = row?.ruleId ?? ids.value[0];
  const res = await getYqPushRule(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改推送规则';
}

async function submitForm() {
  await ruleRef.value?.validate();
  if (form.value.ruleId != null) {
    await updateYqPushRule(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqPushRule(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqPushRuleVO) {
  const target = row?.ruleId ? [row.ruleId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条推送规则？', '提示', { type: 'warning' });
  await delYqPushRule(target);
  ElMessage.success('删除成功');
  await getList();
}

async function handleFlush() {
  flushing.value = true;
  try {
    const res = await flushPush();
    ElMessage.success('已刷出 ' + (res.data || 0) + ' 条顺延的定时批量推送');
  } finally {
    flushing.value = false;
  }
}

onMounted(() => {
  getList();
  loadTemplates();
});
</script>
