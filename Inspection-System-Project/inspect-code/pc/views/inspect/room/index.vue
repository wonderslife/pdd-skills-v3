<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="90px">
      <el-form-item label="机房名称" prop="roomName">
        <el-input v-model="queryParams.roomName" placeholder="请输入机房名称" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="机房编码" prop="roomCode">
        <el-input v-model="queryParams.roomCode" placeholder="请输入机房编码" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="负责人姓名" prop="managerName">
        <el-input v-model="queryParams.managerName" placeholder="请输入负责人姓名" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['inspect:room:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" v-hasPermi="['inspect:room:edit']" @click="handleUpdate()">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['inspect:room:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" v-hasPermi="['inspect:room:export']" @click="handleExport">导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="roomList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="机房名称" align="center" prop="roomName" width="90" />
      <el-table-column label="机房编码" align="center" prop="roomCode" />
      <el-table-column label="机房地址" align="center" prop="address" />
      <el-table-column label="负责人姓名" align="center" prop="managerName" width="90" />
      <el-table-column label="负责人电话" align="center" prop="managerPhone" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="备注" align="center" prop="remark" width="90" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" width="160" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['inspect:room:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['inspect:room:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="700px" append-to-body>
      <el-form ref="roomRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="机房名称" prop="roomName">
          <el-input v-model="form.roomName" placeholder="请输入机房名称" />
        </el-form-item>
        <el-form-item label="机房编码" prop="roomCode">
          <el-input v-model="form.roomCode" placeholder="请输入机房编码" />
        </el-form-item>
        <el-form-item label="机房地址" prop="address">
          <el-input v-model="form.address" placeholder="请输入机房地址" />
        </el-form-item>
        <el-form-item label="负责人姓名" prop="managerName">
          <el-input v-model="form.managerName" placeholder="请输入负责人姓名" />
        </el-form-item>
        <el-form-item label="负责人电话" prop="managerPhone">
          <el-input v-model="form.managerPhone" placeholder="请输入负责人电话" />
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

<script setup name="InspectRoom" lang="ts">
import { ref, reactive, toRefs, getCurrentInstance } from 'vue';
import type { InspectRoomForm, InspectRoomQuery, InspectRoomVO } from '@/api/inspect/room/types';
import { listInspectRoom, getInspectRoom, delInspectRoom, addInspectRoom, updateInspectRoom } from '@/api/inspect/room/index';
import { useDict } from '@/utils/dict';

const { proxy } = getCurrentInstance() as any;
const { sys_normal_disable } = useDict('sys_normal_disable');

const roomList = ref<InspectRoomVO[]>([]);
const open = ref(false);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const title = ref('');
const roomRef = ref();
const queryRef = ref();

const data = reactive({
  form: {} as InspectRoomForm,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as InspectRoomQuery
});
const { queryParams, form } = toRefs(data);

const rules = {
  roomName: [{ required: true, message: '机房名称不能为空', trigger: 'blur' }],
  roomCode: [{ required: true, message: '机房编码不能为空', trigger: 'blur' }],
  address: [{ required: true, message: '机房地址不能为空', trigger: 'blur' }],
  managerName: [{ required: true, message: '负责人姓名不能为空', trigger: 'blur' }],
  managerPhone: [{ required: true, message: '负责人电话不能为空', trigger: 'blur' }],
};



/** 查询机房列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listInspectRoom(queryParams.value);
    roomList.value = res.data?.rows ?? [];
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
  form.value = { roomId: undefined } as InspectRoomForm;
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as InspectRoomQuery;
  queryRef.value?.resetFields();
  handleQuery();
}

function handleSelectionChange(selection: InspectRoomVO[]) {
  ids.value = selection.map(item => item.roomId!) as Array<string | number>;
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

function handleAdd() {
  reset();
  open.value = true;
  title.value = '新增机房';
}

async function handleUpdate(row?: InspectRoomVO) {
  reset();
  const _id = row?.roomId ?? ids.value[0];
  const { data } = await getInspectRoom(_id);
  form.value = data as any;
  open.value = true;
  title.value = '修改机房';
}


/** 提交表单 */
async function submitForm() {
  await roomRef.value?.validate();
  if (form.value.roomId != null) {
    await updateInspectRoom(form.value);
    proxy?.$modal.msgSuccess('修改成功');
  } else {
    await addInspectRoom(form.value);
    proxy?.$modal.msgSuccess('新增成功');
  }
  open.value = false;
  getList();
}

async function handleDelete(row?: InspectRoomVO) {
  const _ids = row?.roomId ?? ids.value;
  await proxy?.$modal.confirm('是否确认删除机房编号为"' + _ids + '"的数据项？');
  await delInspectRoom(_ids);
  proxy?.$modal.msgSuccess('删除成功');
  getList();
}

/** 导出 */
function handleExport() {
  proxy?.download('/inspect/room/export', { ...queryParams.value }, `机房_${new Date().getTime()}.xlsx`);
}

getList();

</script>
