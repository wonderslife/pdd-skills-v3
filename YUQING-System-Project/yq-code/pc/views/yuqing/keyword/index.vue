<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="所属分组" prop="groupId">
        <el-select v-model="queryParams.groupId" placeholder="请选择所属分组" clearable filterable style="width: 200px">
          <el-option v-for="o in keywordGroupOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词文本" prop="keywordText">
        <el-input v-model="queryParams.keywordText" placeholder="请输入关键词文本" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="关键词类型" prop="keywordType">
        <el-select v-model="queryParams.keywordType" placeholder="请选择关键词类型" clearable style="width: 180px">
          <el-option v-for="d in yq_keyword_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['yuqing:keyword:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['yuqing:keyword:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['yuqing:keyword:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['yuqing:keyword:export']" @click="handleExport">导出</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="info" plain icon="Upload" v-hasPermi="['yuqing:keyword:add']" @click="handleImport">导入词表</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="keywordList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="所属分组" align="center" prop="groupName" show-overflow-tooltip />
      <el-table-column label="关键词文本" align="center" prop="keywordText" show-overflow-tooltip />
      <el-table-column label="关键词类型" align="center" prop="keywordType">
        <template #default="scope">
          <dict-tag :options="yq_keyword_type" :value="scope.row.keywordType" />
        </template>
      </el-table-column>
      <el-table-column label="关键词分类" align="center" prop="keywordCategory">
        <template #default="scope">
          <dict-tag :options="yq_keyword_category" :value="scope.row.keywordCategory" />
        </template>
      </el-table-column>
      <el-table-column label="组合表达式（type=combo 必填）" align="center" prop="comboExpression" width="120" show-overflow-tooltip />
      <el-table-column label="被引用次数" align="center" prop="refCount" width="120" show-overflow-tooltip />
      <el-table-column label="状态（0正常 1停用）" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['yuqing:keyword:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['yuqing:keyword:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="keywordRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="所属分组" prop="groupId">
          <el-select v-model="form.groupId" placeholder="请选择所属分组" clearable filterable style="width: 100%">
            <el-option v-for="o in keywordGroupOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词文本" prop="keywordText" required>
          <el-input v-model="form.keywordText" placeholder="请输入关键词文本" />
        </el-form-item>
        <el-form-item label="关键词类型" prop="keywordType">
          <el-select v-model="form.keywordType" placeholder="请选择关键词类型" style="width: 100%">
            <el-option v-for="d in yq_keyword_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词分类" prop="keywordCategory">
          <el-select v-model="form.keywordCategory" placeholder="请选择关键词分类" style="width: 100%">
            <el-option v-for="d in yq_keyword_category" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="组合表达式（type=combo 必填）" prop="comboExpression">
          <el-input v-model="form.comboExpression" placeholder="请输入组合表达式（type=combo 必填）" />
        </el-form-item>
        <el-form-item label="被引用次数" prop="refCount">
          <el-input-number v-model="form.refCount" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态（0正常 1停用）" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态（0正常 1停用）" style="width: 100%">
            <el-option v-for="d in sys_normal_disable" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="请输入备注" />
        </el-form-item>
        <el-form-item v-if="form.comboExpression" label="表达式校验">
          <el-alert v-if="expressionIssues.length === 0" type="success" :closable="false" show-icon title="表达式语法正确，保存后即可用于采集" />
          <el-alert v-else type="error" :closable="false" show-icon :title="expressionIssues.join('；')" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
    <KeywordImportDialog ref="importRef" @success="getList" />
  </div>
</template>

<script setup name="YqKeyword" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { YqKeywordForm, YqKeywordQuery, YqKeywordVO } from '@/api/yuqing/keyword/types';
import { listYqKeyword, getYqKeyword, delYqKeyword, addYqKeyword, updateYqKeyword } from '@/api/yuqing/keyword/index';
import { optionselectYqKeywordGroup } from '@/api/yuqing/keywordGroup/index';
import { watch } from 'vue';
import KeywordImportDialog from './KeywordImportDialog.vue';
import { validateKeywordExpression } from '@/api/yuqing/keyword/import';
import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { yq_keyword_type, yq_keyword_category, sys_normal_disable } = toRefs<any>(useDict('yq_keyword_type', 'yq_keyword_category', 'sys_normal_disable'));

const keywordGroupOptions = ref<Array<{ label: string; value: any }>>([]);
const keywordList = ref<YqKeywordVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const keywordRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as YqKeywordForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as YqKeywordQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  groupId: [{ required: true, message: '所属分组ID不能为空', trigger: 'blur' }],
  keywordText: [{ required: true, message: '关键词文本不能为空', trigger: 'blur' }],
  keywordType: [{ required: true, message: '关键词类型不能为空', trigger: 'change' }],
  keywordCategory: [{ required: true, message: '关键词分类不能为空', trigger: 'change' }]
};

/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
  const keywordGroupRes = await optionselectYqKeywordGroup({});
  keywordGroupOptions.value = (keywordGroupRes.data ?? []).map((i: any) => ({ label: i.groupName, value: i.groupId }));
}


/** 查询关键词列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqKeyword(queryParams.value);
    keywordList.value = res.data?.rows ?? [];
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
  form.value = { keywordId: undefined } as YqKeywordForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as YqKeywordQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: YqKeywordVO[]) {
  ids.value = selection.map(item => item.keywordId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增关键词';
}

async function handleUpdate(row?: YqKeywordVO) {
  reset();
  const _id = row?.keywordId ?? ids.value[0];
  const res = await getYqKeyword(_id);
  form.value = res.data as any;

  open.value = true;
  title.value = '修改关键词';
}

/** 提交表单 */
async function submitForm() {
  await keywordRef.value?.validate();

  if (form.value.keywordId != null) {
    await updateYqKeyword(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addYqKeyword(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: YqKeywordVO) {
  const _ids = row?.keywordId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除关键词编号为"' + _ids + '"的数据项？');
  await delYqKeyword(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/yuqing/keyword/export', { ...queryParams.value }, `关键词_${new Date().getTime()}.xlsx`);
}

const importRef = ref();
const expressionIssues = ref<string[]>([]);
let expressionTimer: any = null;

/** 打开词表导入对话框 */
function handleImport() {
  importRef.value?.open();
}

/** 组合表达式实时校验：录错会「采集成功、入库 0 条」且不报错，必须在录入阶段拦住 */
watch(
  () => form.value.comboExpression,
  (value: string | undefined) => {
    if (expressionTimer) {
      clearTimeout(expressionTimer);
    }
    if (!value || !String(value).trim()) {
      expressionIssues.value = [];
      return;
    }
    expressionTimer = setTimeout(async () => {
      try {
        const res = await validateKeywordExpression(String(value));
        expressionIssues.value = res.data ?? [];
      } catch (e) {
        expressionIssues.value = [];
      }
    }, 400);
  }
);

getList();
loadForeignOptions();
</script>
