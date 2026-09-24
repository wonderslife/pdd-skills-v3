<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="来源舆情ID" prop="opinionId">
        <el-input v-model="queryParams.opinionId" placeholder="请输入来源舆情ID" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="案例类型" prop="caseType">
        <el-select v-model="queryParams.caseType" placeholder="请选择案例类型" clearable style="width: 180px">
          <el-option v-for="d in yq_case_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="案例标题" prop="caseTitle">
        <el-input v-model="queryParams.caseTitle" placeholder="请输入案例标题" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:knowledge:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:knowledge:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:knowledge:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:knowledge:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="knowledgeList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="来源舆情ID" align="center" prop="opinionId" width="120" show-overflow-tooltip />
      <el-table-column label="案例类型" align="center" prop="caseType">
        <template #default="scope">
          <dict-tag :options="yq_case_type" :value="scope.row.caseType" />
        </template>
      </el-table-column>
      <el-table-column label="案例标题" align="center" prop="caseTitle" show-overflow-tooltip />
      <el-table-column label="舆情链接" align="center" prop="opinionUrl" width="120" show-overflow-tooltip />
      <el-table-column label="分级标签" align="center" prop="levelTags" width="120" show-overflow-tooltip />
      <el-table-column label="处置记录" align="center" prop="processRecord" width="120" show-overflow-tooltip />
      <el-table-column label="人工修正标注" align="center" prop="manualCorrection" width="120" show-overflow-tooltip />
      <el-table-column label="场景分类" align="center" prop="sceneCategory" width="120" show-overflow-tooltip />
      <el-table-column label="风险特征" align="center" prop="riskFeature" width="120" show-overflow-tooltip />
      <el-table-column label="关键词特征" align="center" prop="keywordFeature" width="120" show-overflow-tooltip />
      <el-table-column label="状态（0有效 1已淘汰）" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:knowledge:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:knowledge:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="knowledgeRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="来源舆情ID" prop="opinionId">
          <el-input v-model="form.opinionId" placeholder="请输入来源舆情ID" />
        </el-form-item>
        <el-form-item label="案例类型" prop="caseType">
          <el-select v-model="form.caseType" placeholder="请选择案例类型" style="width: 100%">
            <el-option v-for="d in yq_case_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="案例标题" prop="caseTitle" required>
          <el-input v-model="form.caseTitle" placeholder="请输入案例标题" />
        </el-form-item>
        <el-form-item label="原始数据快照（JSON）" prop="originData">
          <el-input v-model="form.originData" type="textarea" :rows="4" placeholder="请输入原始数据快照（JSON）" />
        </el-form-item>
        <el-form-item label="舆情链接" prop="opinionUrl">
          <el-input v-model="form.opinionUrl" placeholder="请输入舆情链接" />
        </el-form-item>
        <el-form-item label="研判结果快照" prop="analyzeResult">
          <el-input v-model="form.analyzeResult" type="textarea" :rows="4" placeholder="请输入研判结果快照" />
        </el-form-item>
        <el-form-item label="分级标签" prop="levelTags">
          <el-input v-model="form.levelTags" placeholder="请输入分级标签" />
        </el-form-item>
        <el-form-item label="处置记录" prop="processRecord">
          <el-input v-model="form.processRecord" placeholder="请输入处置记录" />
        </el-form-item>
        <el-form-item label="人工修正标注" prop="manualCorrection">
          <el-input v-model="form.manualCorrection" placeholder="请输入人工修正标注" />
        </el-form-item>
        <el-form-item label="场景分类" prop="sceneCategory">
          <el-input v-model="form.sceneCategory" placeholder="请输入场景分类" />
        </el-form-item>
        <el-form-item label="风险特征" prop="riskFeature">
          <el-input v-model="form.riskFeature" placeholder="请输入风险特征" />
        </el-form-item>
        <el-form-item label="关键词特征" prop="keywordFeature">
          <el-input v-model="form.keywordFeature" placeholder="请输入关键词特征" />
        </el-form-item>
        <el-form-item label="状态（0有效 1已淘汰）" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态（0有效 1已淘汰）" style="width: 100%">
            <el-option v-for="d in sys_normal_disable" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
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

<script setup name="YqKnowledge" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqKnowledgeForm, YqKnowledgeQuery, YqKnowledgeVO } from '@/api/yuqing/knowledge/types';
import { listYqKnowledge, getYqKnowledge, delYqKnowledge, addYqKnowledge, updateYqKnowledge } from '@/api/yuqing/knowledge/index';

import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_case_type, sys_normal_disable } = toRefs<any>(useDict('yq_case_type', 'sys_normal_disable'));

const knowledgeList = ref<YqKnowledgeVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const knowledgeRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqKnowledgeForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqKnowledgeQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  caseType: [{ required: true, message: '案例类型不能为空', trigger: 'change' }],
  caseTitle: [{ required: true, message: '案例标题不能为空', trigger: 'blur' }]
};


/** 查询知识库案例列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqKnowledge(queryParams.value);
    knowledgeList.value = res.data?.rows ?? [];
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
  form.value = { knowledgeId: undefined } as YqKnowledgeForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqKnowledgeQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqKnowledgeVO[]) {
  ids.value = selection.map(item => item.knowledgeId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增知识库案例';
}

async function handleUpdate(row?: YqKnowledgeVO) {
  reset();
  const _id = row?.knowledgeId ?? ids.value[0];
  const res = await getYqKnowledge(_id);
  form.value = res.data as any;

  open.value = true;
  title.value = '修改知识库案例';
}

/** 提交表单 */
async function submitForm() {
  await knowledgeRef.value?.validate();

  if (form.value.knowledgeId != null) {
    await updateYqKnowledge(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqKnowledge(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqKnowledgeVO) {
  const _ids = row?.knowledgeId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除知识库案例编号为"' + _ids + '"的数据项？');
  await delYqKnowledge(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/knowledge/export', { ...queryParams.value }, `知识库案例_${new Date().getTime()}.xlsx`);
}

getList();
</script>
