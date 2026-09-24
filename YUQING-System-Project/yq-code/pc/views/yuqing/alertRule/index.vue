<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="queryParams.ruleName" placeholder="请输入规则名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="预警级别" prop="alertLevel">
        <el-select v-model="queryParams.alertLevel" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_alert_level" :key="d.value" :label="d.label" :value="d.value" />
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
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="ruleList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="规则名称" prop="ruleName" :show-overflow-tooltip="true" min-width="150" />
      <el-table-column label="触发场景" prop="triggerScenes" :show-overflow-tooltip="true" min-width="180" />
      <el-table-column label="统计窗口(分)" prop="windowMinutes" width="110" align="center" />
      <el-table-column label="条数阈值" prop="countThreshold" width="90" align="center" />
      <el-table-column label="热度阈值" prop="heatThreshold" width="90" align="center" />
      <el-table-column label="风险阈值" prop="riskLevelThreshold" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_risk_level" :value="scope.row.riskLevelThreshold" />
        </template>
      </el-table-column>
      <el-table-column label="传播阈值" prop="spreadThreshold" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_spread_level" :value="scope.row.spreadThreshold" />
        </template>
      </el-table-column>
      <el-table-column label="突发倍数" prop="burstRatio" width="90" align="center" />
      <el-table-column label="最小条数" prop="minBurstCount" width="90" align="center" />
      <el-table-column label="冷却(分)" prop="cooldownMinutes" width="90" align="center" />
      <el-table-column label="预警级别" prop="alertLevel" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_alert_level" :value="scope.row.alertLevel" />
        </template>
      </el-table-column>
      <el-table-column label="推送级别" prop="pushLevel" width="100" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_level" :value="scope.row.pushLevel" />
        </template>
      </el-table-column>
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

    <el-dialog v-model="open" :title="title" width="760px" append-to-body>
      <el-form ref="ruleRef" :model="form" :rules="rules" label-width="130px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="规则名称" prop="ruleName">
              <el-input v-model="form.ruleName" placeholder="请输入规则名称" maxlength="50" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="触发场景" prop="triggerScenes">
              <el-select v-model="sceneList" multiple placeholder="请选择触发场景" style="width: 100%">
                <el-option v-for="d in yq_alert_scene" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="统计时间窗口" prop="windowMinutes">
              <el-input-number v-model="form.windowMinutes" :min="1" :max="1440" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="条数阈值" prop="countThreshold">
              <el-input-number v-model="form.countThreshold" :min="0" :max="100000" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="热度阈值" prop="heatThreshold">
              <el-input-number v-model="form.heatThreshold" :min="0" :max="100" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="最低触发风险等级" prop="riskLevelThreshold">
              <el-select v-model="form.riskLevelThreshold" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最低触发传播量级" prop="spreadThreshold">
              <el-select v-model="form.spreadThreshold" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_spread_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="8">
            <el-form-item label="突发增量倍数" prop="burstRatio">
              <el-input-number v-model="form.burstRatio" :min="0.1" :max="999" :step="0.1" :precision="2" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="突发最小条数" prop="minBurstCount">
              <el-input-number v-model="form.minBurstCount" :min="1" :max="10000" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="事件冷却(分钟)" prop="cooldownMinutes">
              <el-input-number v-model="form.cooldownMinutes" :min="1" :max="10080" controls-position="right" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="重点专项标签" prop="topicTags">
          <el-input v-model="form.topicTags" placeholder="逗号分隔；命中舆情话题标签即触发 special_topic 场景" maxlength="500" />
        </el-form-item>
        <el-row>
          <el-col :span="12">
            <el-form-item label="预警级别" prop="alertLevel">
              <el-select v-model="form.alertLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_alert_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联动推送级别" prop="pushLevel">
              <el-select v-model="form.pushLevel" placeholder="请选择" style="width: 100%">
                <el-option v-for="d in yq_push_level" :key="d.value" :label="d.label" :value="d.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="额外通知人" prop="notifyUserIds">
          <el-input v-model="form.notifyUserIds" placeholder="用户ID，逗号分隔（可为空）" maxlength="1000" />
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

<script setup name="YqAlertRule" lang="ts">
import { ref, reactive, toRefs, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqAlertRuleForm, YqAlertRuleQuery, YqAlertRuleVO } from '@/api/yuqing/alertRule/types';
import { listYqAlertRule, getYqAlertRule, delYqAlertRule, addYqAlertRule, updateYqAlertRule } from '@/api/yuqing/alertRule/index';
import { useDict } from '@/utils/dict';

const { yq_alert_level, yq_alert_scene, yq_risk_level, yq_spread_level, yq_push_level, sys_normal_disable } = toRefs<any>(
  useDict('yq_alert_level', 'yq_alert_scene', 'yq_risk_level', 'yq_spread_level', 'yq_push_level', 'sys_normal_disable')
);

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const ruleList = ref<YqAlertRuleVO[]>([]);
const queryRef = ref();
const ruleRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, ruleName: undefined, alertLevel: undefined } as YqAlertRuleQuery,
  form: {} as YqAlertRuleForm
});
const { queryParams, form } = toRefs(data);

/** 场景多选与 form.triggerScenes 的双向桥接 */
const sceneList = computed({
  get() {
    const v = form.value.triggerScenes;
    return v ? String(v).split(',').filter((s) => s) : [];
  },
  set(val: string[]) {
    form.value.triggerScenes = val.join(',');
  }
});

const rules = {
  ruleName: [{ required: true, message: '规则名称不能为空', trigger: 'blur' }],
  triggerScenes: [{ required: true, message: '至少选择一个触发场景', trigger: 'change' }],
  windowMinutes: [{ required: true, message: '统计时间窗口不能为空', trigger: 'blur' }],
  alertLevel: [{ required: true, message: '预警级别不能为空', trigger: 'change' }],
  pushLevel: [{ required: true, message: '联动推送级别不能为空', trigger: 'change' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqAlertRule(queryParams.value);
    ruleList.value = res.data?.rows || [];
    total.value = res.data?.total || 0;
  } finally {
    loading.value = false;
  }
}

function cancel() {
  open.value = false;
  reset();
}

function reset() {
  form.value = {
    ruleId: undefined,
    ruleName: undefined,
    triggerScenes: 'new_negative,high_risk',
    windowMinutes: 10,
    countThreshold: 0,
    heatThreshold: 0,
    riskLevelThreshold: 'moderate',
    spreadThreshold: 'medium',
    burstRatio: 3,
    minBurstCount: 5,
    cooldownMinutes: 360,
    topicTags: undefined,
    alertLevel: 'warning',
    pushLevel: 'immediate',
    notifyUserIds: undefined,
    status: '0'
  } as YqAlertRuleForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqAlertRuleQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqAlertRuleVO[]) {
  ids.value = selection.map((item) => item.ruleId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增预警规则';
}

async function handleUpdate(row?: YqAlertRuleVO) {
  reset();
  const _id = row?.ruleId ?? ids.value[0];
  const res = await getYqAlertRule(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改预警规则';
}

async function submitForm() {
  await ruleRef.value?.validate();
  if (form.value.ruleId != null) {
    await updateYqAlertRule(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqAlertRule(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqAlertRuleVO) {
  const target = row?.ruleId ? [row.ruleId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条预警规则？', '提示', { type: 'warning' });
  await delYqAlertRule(target);
  ElMessage.success('删除成功');
  await getList();
}

onMounted(() => {
  getList();
});
</script>
