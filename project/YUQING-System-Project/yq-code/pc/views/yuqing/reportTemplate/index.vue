<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="模板名称" prop="templateName">
        <el-input v-model="queryParams.templateName" placeholder="请输入模板名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="报告类型" prop="reportType">
        <el-select v-model="queryParams.reportType" placeholder="请选择报告类型" clearable style="width: 180px">
          <el-option v-for="d in yq_report_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="是否同类型默认（0否 1是）" prop="isDefault">
        <el-input v-model="queryParams.isDefault" placeholder="请输入是否同类型默认（0否 1是）" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:reportTemplate:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:reportTemplate:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:reportTemplate:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:reportTemplate:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="reportTemplateList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="模板名称" align="center" prop="templateName" show-overflow-tooltip />
      <el-table-column label="报告类型" align="center" prop="reportType">
        <template #default="scope">
          <dict-tag :options="yq_report_type" :value="scope.row.reportType" />
        </template>
      </el-table-column>
      <el-table-column label="是否同类型默认（0否 1是）" align="center" prop="isDefault" width="120" show-overflow-tooltip />
      <el-table-column label="封面字段（JSON）" align="center" prop="coverFields" width="120" show-overflow-tooltip />
      <el-table-column label="正文字体" align="center" prop="fontFamily" width="120" show-overflow-tooltip />
      <el-table-column label="标题编号规则" align="center" prop="headingNumberRule">
        <template #default="scope">
          <dict-tag :options="yq_heading_number" :value="scope.row.headingNumberRule" />
        </template>
      </el-table-column>
      <el-table-column label="状态（0正常 1停用）" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="报告模板章节数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.sectionList?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.sectionList?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:reportTemplate:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:reportTemplate:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="1000px" append-to-body>
      <el-form ref="reportTemplateRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="模板名称" prop="templateName" required>
          <el-input v-model="form.templateName" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="报告类型" prop="reportType">
          <el-select v-model="form.reportType" placeholder="请选择报告类型" style="width: 100%">
            <el-option v-for="d in yq_report_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="是否同类型默认（0否 1是）" prop="isDefault">
          <el-input v-model="form.isDefault" placeholder="请输入是否同类型默认（0否 1是）" />
        </el-form-item>
        <el-form-item label="封面字段（JSON）" prop="coverFields">
          <el-input v-model="form.coverFields" placeholder="请输入封面字段（JSON）" />
        </el-form-item>
        <el-form-item label="正文字体" prop="fontFamily">
          <el-input v-model="form.fontFamily" placeholder="请输入正文字体" />
        </el-form-item>
        <el-form-item label="标题编号规则" prop="headingNumberRule">
          <el-select v-model="form.headingNumberRule" placeholder="请选择标题编号规则" style="width: 100%">
            <el-option v-for="d in yq_heading_number" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态（0正常 1停用）" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态（0正常 1停用）" style="width: 100%">
            <el-option v-for="d in sys_normal_disable" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-divider content-position="left">
        章节
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAddSectionList">添加章节</el-button>
      </el-divider>
      <el-table :data="form.sectionList || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
        <el-table-column label="章节编码" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.sectionCode" placeholder="请输入章节编码" />
          </template>
        </el-table-column>
        <el-table-column label="章节标题" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.sectionName" placeholder="请输入章节标题" />
          </template>
        </el-table-column>
        <el-table-column label="排序" width="110" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.orderNum" :min="0" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="是否必含（0否 1是）" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.required" placeholder="请输入是否必含（0否 1是）" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemoveSectionList($index)">删除</el-button>
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

<script setup name="YqReportTemplate" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqReportTemplateForm, YqReportTemplateQuery, YqReportTemplateVO } from '@/api/yuqing/reportTemplate/types';
import { listYqReportTemplate, getYqReportTemplate, delYqReportTemplate, addYqReportTemplate, updateYqReportTemplate } from '@/api/yuqing/reportTemplate/index';

import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_report_type, yq_heading_number, sys_normal_disable } = toRefs<any>(useDict('yq_report_type', 'yq_heading_number', 'sys_normal_disable'));

const reportTemplateList = ref<YqReportTemplateVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const reportTemplateRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqReportTemplateForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqReportTemplateQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  templateName: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
  reportType: [{ required: true, message: '报告类型不能为空', trigger: 'change' }]
};


/** 报告模板章节：新增一行 */
function handleAddSectionList() {
  if (!form.value.sectionList) form.value.sectionList = [];
  form.value.sectionList!.push({ sectionCode: '', sectionName: '', orderNum: 0, required: '' });
}

/** 报告模板章节：删除一行 */
function handleRemoveSectionList(index: number) {
  form.value.sectionList?.splice(index, 1);
}

/** 查询报告模板列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqReportTemplate(queryParams.value);
    reportTemplateList.value = res.data?.rows ?? [];
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
  form.value = { templateId: undefined, sectionList: [] } as YqReportTemplateForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqReportTemplateQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqReportTemplateVO[]) {
  ids.value = selection.map(item => item.templateId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增报告模板';
}

async function handleUpdate(row?: YqReportTemplateVO) {
  reset();
  const _id = row?.templateId ?? ids.value[0];
  const res = await getYqReportTemplate(_id);
  form.value = res.data as any;
  if (!form.value.sectionList) form.value.sectionList = [];
  open.value = true;
  title.value = '修改报告模板';
}

/** 提交表单 */
async function submitForm() {
  await reportTemplateRef.value?.validate();
  const sectionList = form.value.sectionList ?? [];
  for (let i = 0; i < sectionList.length; i++) {
    if (!sectionList[i].sectionCode) {
      proxy?.$modal.msgError(`第 ${i + 1} 行报告模板章节的「章节编码」不能为空`);
      return;
    }
  }
  if (form.value.templateId != null) {
    await updateYqReportTemplate(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqReportTemplate(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqReportTemplateVO) {
  const _ids = row?.templateId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除报告模板编号为"' + _ids + '"的数据项？');
  await delYqReportTemplate(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/reportTemplate/export', { ...queryParams.value }, `报告模板_${new Date().getTime()}.xlsx`);
}

getList();
</script>
