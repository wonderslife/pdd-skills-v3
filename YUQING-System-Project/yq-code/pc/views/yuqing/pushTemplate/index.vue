<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="模板名称" prop="templateName">
        <el-input v-model="queryParams.templateName" placeholder="请输入模板名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="内容形式" prop="contentType">
        <el-select v-model="queryParams.contentType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="d in yq_push_content_type" :key="d.value" :label="d.label" :value="d.value" />
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

    <el-table v-loading="loading" :data="tplList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="模板名称" prop="templateName" :show-overflow-tooltip="true" min-width="160" />
      <el-table-column label="内容形式" prop="contentType" width="110" align="center">
        <template #default="scope">
          <dict-tag :options="yq_push_content_type" :value="scope.row.contentType" />
        </template>
      </el-table-column>
      <el-table-column label="包含字段" prop="fieldList" :show-overflow-tooltip="true" min-width="240" />
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
      <el-form ref="tplRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="form.templateName" placeholder="请输入模板名称" maxlength="50" />
        </el-form-item>
        <el-form-item label="内容形式" prop="contentType">
          <el-radio-group v-model="form.contentType">
            <el-radio v-for="d in yq_push_content_type" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="模板正文" prop="bodyTemplate">
          <el-input v-model="form.bodyTemplate" type="textarea" :rows="8" placeholder="支持占位符：{title} {level} {channel} {content} {url} {pushTime}" />
        </el-form-item>
        <el-form-item label="包含字段" prop="fieldList">
          <el-input v-model="form.fieldList" placeholder="逗号分隔，如：标题,等级,平台,时间,内容,风险,态势,链接,建议,推送时间" maxlength="1000" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon title="统一模板固定包含 10 要素：舆情标题、舆情等级、发布平台、发布时间、舆情核心内容、风险分析、传播态势、舆情原文链接、处置建议、推送时间。长正文会自动截断并保留原文链接。" />
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

<script setup name="YqPushTemplate" lang="ts">
import { ref, reactive, toRefs, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { YqPushTemplateForm, YqPushTemplateQuery, YqPushTemplateVO } from '@/api/yuqing/pushTemplate/types';
import { listYqPushTemplate, getYqPushTemplate, delYqPushTemplate, addYqPushTemplate, updateYqPushTemplate } from '@/api/yuqing/pushTemplate/index';
import { useDict } from '@/utils/dict';

const { yq_push_content_type, sys_normal_disable } = toRefs<any>(useDict('yq_push_content_type', 'sys_normal_disable'));

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const title = ref('');
const open = ref(false);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const tplList = ref<YqPushTemplateVO[]>([]);
const queryRef = ref();
const tplRef = ref();

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, templateName: undefined, contentType: undefined } as YqPushTemplateQuery,
  form: {} as YqPushTemplateForm
});
const { queryParams, form } = toRefs(data);

const rules = {
  templateName: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  contentType: [{ required: true, message: '内容形式不能为空', trigger: 'change' }],
  bodyTemplate: [{ required: true, message: '模板正文不能为空', trigger: 'blur' }],
  fieldList: [{ required: true, message: '包含字段不能为空', trigger: 'blur' }]
};

async function getList() {
  loading.value = true;
  try {
    const res = await listYqPushTemplate(queryParams.value);
    tplList.value = res.data?.rows || [];
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
    templateId: undefined,
    templateName: undefined,
    contentType: 'detail',
    bodyTemplate: undefined,
    fieldList: '标题,等级,平台,时间,内容,风险,态势,链接,建议,推送时间',
    status: '0'
  } as YqPushTemplateForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqPushTemplateQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqPushTemplateVO[]) {
  ids.value = selection.map((item) => item.templateId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增推送模板';
}

async function handleUpdate(row?: YqPushTemplateVO) {
  reset();
  const _id = row?.templateId ?? ids.value[0];
  const res = await getYqPushTemplate(_id);
  form.value = res.data as any;
  open.value = true;
  title.value = '修改推送模板';
}

async function submitForm() {
  await tplRef.value?.validate();
  if (form.value.templateId != null) {
    await updateYqPushTemplate(form.value);
    ElMessage.success('修改成功');
  } else {
    await addYqPushTemplate(form.value);
    ElMessage.success('新增成功');
  }
  open.value = false;
  await getList();
}

async function handleDelete(row?: YqPushTemplateVO) {
  const target = row?.templateId ? [row.templateId] : ids.value;
  await ElMessageBox.confirm('是否确认删除选中的 ' + target.length + ' 条推送模板？', '提示', { type: 'warning' });
  await delYqPushTemplate(target);
  ElMessage.success('删除成功');
  await getList();
}

onMounted(() => {
  getList();
});
</script>
