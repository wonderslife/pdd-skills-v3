<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="模板名称" prop="templateName">
        <el-input v-model="queryParams.templateName" placeholder="请输入模板名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['inspect:itemTemplate:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['inspect:itemTemplate:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['inspect:itemTemplate:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:itemTemplate:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="itemTemplateList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="模板名称" align="center" prop="templateName" width="90" />
      <el-table-column label="模板说明" align="center" prop="description" />
      <el-table-column label="备注" align="center" prop="remark" width="90" />
      <el-table-column label="模板明细数" align="center" width="110">
        <template #default="scope">
          <el-tag :type="(scope.row.detailList?.length ?? 0) > 0 ? 'success' : 'info'">{{ scope.row.detailList?.length ?? 0 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['inspect:itemTemplate:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['inspect:itemTemplate:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="1000px" append-to-body>
      <el-form ref="itemTemplateRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="模板名称" prop="templateName">
          <el-input v-model="form.templateName" placeholder="请输入模板名称" />
        </el-form-item>
        <el-form-item label="模板说明" prop="description">
          <el-input v-model="form.description" placeholder="请输入模板说明" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <el-divider content-position="left">
        模板明细
        <el-button link type="primary" icon="Plus" style="margin-left: 12px" @click="handleAddDetail">添加明细</el-button>
      </el-divider>
      <el-table :data="form.detailList || []" size="small" border>
        <el-table-column label="序号" type="index" width="55" align="center" />
        <el-table-column label="巡检项名称" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.itemName" placeholder="请输入巡检项名称" />
          </template>
        </el-table-column>
        <el-table-column label="巡检项类型" width="130">
          <template #default="{ row }">
            <el-select v-model="row.itemType" placeholder="巡检项类型">
              <el-option v-for="d in sys_item_type" :key="d.value" :label="d.label" :value="d.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="判定标准" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.standard" placeholder="请输入判定标准" />
          </template>
        </el-table-column>
        <el-table-column label="必填" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.required" active-value="1" inactive-value="0" />
          </template>
        </el-table-column>
        <el-table-column label="显示顺序" width="100" align="center">
          <template #default="{ row }">
            <el-input-number v-model="row.orderNum" :min="0" controls-position="right" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" icon="Delete" @click="handleRemoveDetail($index)">删除</el-button>
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

<script setup name="InspectItemTemplate" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { InspectItemTemplateForm, InspectItemTemplateQuery, InspectItemTemplateVO } from '@/api/inspect/itemTemplate/types';
import { listInspectItemTemplate, getInspectItemTemplate, delInspectItemTemplate, addInspectItemTemplate, updateInspectItemTemplate } from '@/api/inspect/itemTemplate/index';
import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { sys_item_type } = useDict('sys_item_type');

const itemTemplateList = ref<InspectItemTemplateVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const itemTemplateRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as InspectItemTemplateForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as InspectItemTemplateQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  templateName: [{ required: true, message: '模板名称不能为空', trigger: 'blur' }],
};



/** 查询巡检项模板列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listInspectItemTemplate(queryParams.value);
    itemTemplateList.value = res.data?.rows ?? [];
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
  form.value = { templateId: undefined, detailList: [] } as InspectItemTemplateForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectItemTemplateQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: InspectItemTemplateVO[]) {
  ids.value = selection.map(item => item.templateId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增巡检项模板';
}

async function handleUpdate(row?: InspectItemTemplateVO) {
  reset();
  const _id = row?.templateId ?? ids.value[0];
  const { data } = await getInspectItemTemplate(_id);
  form.value = data as any;
  if (!form.value.detailList) form.value.detailList = [];
  open.value = true;
  title.value = '修改巡检项模板';
}

/** 明细：新增一行 */
function handleAddDetail() {
  if (!form.value.detailList) form.value.detailList = [];
  form.value.detailList!.push({ itemName: '', itemType: sys_item_type.value?.[0]?.value ?? '', standard: '', required: '1', orderNum: (form.value.detailList?.length ?? 0) });
}

/** 明细：删除一行 */
function handleRemoveDetail(index: number) {
  form.value.detailList?.splice(index, 1);
}


/** 提交表单 */
async function submitForm() {
  await itemTemplateRef.value?.validate();
  // 明细逐行校验：名称不允许为空，否则会往库里塞无意义的空明细
  const details = form.value.detailList ?? [];
  for (let i = 0; i < details.length; i++) {
    if (!details[i].itemName) {
      proxy?.$modal.msgError(`第 ${i + 1} 行模板明细的「巡检项名称」不能为空`);
      return;
    }
  }
  if (form.value.templateId != null) {
    await updateInspectItemTemplate(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addInspectItemTemplate(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: InspectItemTemplateVO) {
  const _ids = row?.templateId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除巡检项模板编号为"' + _ids + '"的数据项？');
  await delInspectItemTemplate(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/inspect/itemTemplate/export', { ...queryParams.value }, `巡检项模板_${new Date().getTime()}.xlsx`);
}

getList();

</script>
