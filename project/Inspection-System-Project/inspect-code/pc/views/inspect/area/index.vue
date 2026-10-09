<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="所属机房" prop="roomId">
        <el-select v-model="queryParams.roomId" placeholder="请选择所属机房" clearable style="width: 180px">
          <el-option v-for="o in roomIdOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="父区域（顶级为0）" prop="parentId">
        <el-select v-model="queryParams.parentId" placeholder="请选择父区域（顶级为0）" clearable style="width: 180px">
          <el-option v-for="o in parentIdOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="区域名称" prop="areaName">
        <el-input v-model="queryParams.areaName" placeholder="请输入区域名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['inspect:area:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['inspect:area:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['inspect:area:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:area:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="areaList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="所属机房" align="center" prop="roomName" />
      <el-table-column label="父区域（顶级为0）" align="center" prop="parentName" />
      <el-table-column label="区域名称" align="center" prop="areaName" width="90" />
      <el-table-column label="显示顺序" align="center" prop="orderNum" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="备注" align="center" prop="remark" width="90" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['inspect:area:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['inspect:area:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="areaRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="所属机房" prop="roomId">
          <el-select v-model="form.roomId" placeholder="请选择所属机房" clearable style="width: 100%">
            <el-option v-for="o in roomIdOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="父区域（顶级为0）" prop="parentId">
          <el-select v-model="form.parentId" placeholder="请选择父区域（顶级为0）" clearable style="width: 100%">
            <el-option v-for="o in parentIdOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="区域名称" prop="areaName">
          <el-input v-model="form.areaName" placeholder="请输入区域名称" />
        </el-form-item>
        <el-form-item label="显示顺序" prop="orderNum">
          <el-input-number v-model="form.orderNum" :min="0" placeholder="请输入显示顺序" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="d in sys_normal_disable" :key="d.value" :value="d.value">{{ d.label }}</el-radio>
          </el-radio-group>
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

<script setup name="InspectArea" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { InspectAreaForm, InspectAreaQuery, InspectAreaVO } from '@/api/inspect/area/types';
import { listInspectArea, getInspectArea, delInspectArea, addInspectArea, updateInspectArea } from '@/api/inspect/area/index';
import { useDict } from '@/utils/dict';
import { optionselectInspectRoom } from '@/api/inspect/room';
import { optionselectInspectArea } from '@/api/inspect/area';
const { proxy } = getCurrentInstance() as any;
const { sys_normal_disable } = useDict('sys_normal_disable');

const areaList = ref<InspectAreaVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const areaRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as InspectAreaForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as InspectAreaQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  roomId: [{ required: true, message: '所属机房ID不能为空', trigger: 'blur' }],
  areaName: [{ required: true, message: '区域名称不能为空', trigger: 'blur' }],
};

/** 关联下拉选项 */
const roomIdOptions = ref<Array<{ label: string; value: any }>>([]);
const parentIdOptions = ref<Array<{ label: string; value: any }>>([]);

/** 查询区域列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listInspectArea(queryParams.value);
    areaList.value = res.data?.rows ?? [];
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
  form.value = { areaId: undefined } as InspectAreaForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectAreaQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: InspectAreaVO[]) {
  ids.value = selection.map(item => item.areaId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增区域';
}

async function handleUpdate(row?: InspectAreaVO) {
  reset();
  const _id = row?.areaId ?? ids.value[0];
  const { data } = await getInspectArea(_id);
  form.value = data as any;
  open.value = true;
  title.value = '修改区域';
}


/** 提交表单 */
async function submitForm() {
  await areaRef.value?.validate();
  if (form.value.areaId != null) {
    await updateInspectArea(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addInspectArea(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: InspectAreaVO) {
  const _ids = row?.areaId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除区域编号为"' + _ids + '"的数据项？');
  await delInspectArea(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/inspect/area/export', { ...queryParams.value }, `区域_${new Date().getTime()}.xlsx`);
}

/** 加载关联下拉选项（不加载则下拉框为空） */
async function loadForeignOptions() {
  const roomIdRes = await optionselectInspectRoom({});
  const parentIdRes = await optionselectInspectArea({});
  roomIdOptions.value = (roomIdRes.data ?? []).map((i: any) => ({ label: i.roomName, value: i.roomId }));
  parentIdOptions.value = [{ label: '顶级', value: 0 }, ...(parentIdRes.data ?? []).map((i: any) => ({ label: i.areaName, value: i.areaId }))];
}

getList();
loadForeignOptions();
</script>
