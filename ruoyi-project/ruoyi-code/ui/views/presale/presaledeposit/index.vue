<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" v-hasPermi="['presale:deposit:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['presale:deposit:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
    </el-row>

    <el-table v-loading="loading" :data="presaledepositList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="订单号" align="center" prop="orderNo" />
      <el-table-column label="商品ID" align="center" prop="goodsId" />
      <el-table-column label="买家ID" align="center" prop="buyerId" />
      <el-table-column label="定金金额" align="center" prop="depositAmount" width="120" />
      <el-table-column label="支付时间" align="center" prop="payTime" width="120" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" class-name="operation-col">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['presale:deposit:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['presale:deposit:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="900px" append-to-body>
      <PresaleDepositForm ref="presaledepositFormRef" :edit-data="form" @submit="handleSubmit" />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="presaledepositFormRef?.submit()">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PresaleDeposit" lang="ts">
import { ref, reactive, toRefs } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import type { PresaleDepositForm as PresaleDepositFormType, PresaleDepositQuery, PresaleDepositVO } from '@/api/presale/presaledeposit/types';
import { listPresaleDeposit, getPresaleDeposit, delPresaleDeposit, addPresaleDeposit, updatePresaleDeposit } from '@/api/presale/presaledeposit/index';
import PresaleDepositForm from './form.vue';

const presaledepositList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const presaledepositFormRef = ref()
const queryRef = ref()

const data = reactive({
  form: {} as PresaleDepositFormType,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as PresaleDepositQuery
})

const { queryParams, form } = toRefs(data)

/** 查询PresaleDeposit列表 */
async function getList() {
  loading.value = true
  const res = await listPresaleDeposit(queryParams.value)
  presaledepositList.value = res.data?.rows ?? []
  total.value = res.data?.total ?? 0
  loading.value = false
}

function cancel() {
  open.value = false
  reset()
}

/** 重置操作表单 */
function reset() {
  form.value = {
    id: null
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

/** 重置查询条件 */
function resetQuery() {
  queryParams.value = { pageNum: 1, pageSize: 10 } as PresaleDepositQuery
  queryRef.value?.resetFields()
  handleQuery()
}

function handleSelectionChange(selection) {
  ids.value = selection.map(item => item.id)
  multiple.value = !selection.length
}

function handleAdd() {
  reset()
  open.value = true
  title.value = '添加PresaleDeposit'
}

async function handleUpdate(row: PresaleDepositVO) {
  reset()
  const _id = row.id ?? ids.value[0]
  const { data } = await getPresaleDeposit(_id)
  form.value = data
  open.value = true
  title.value = '修改PresaleDeposit'
}

/** 子组件校验通过后回调 */
async function handleSubmit(data: PresaleDepositFormType) {
  if (data.id != null) {
    await updatePresaleDeposit(data)
    modal.msgSuccess('修改成功')
  } else {
    await addPresaleDeposit(data)
    modal.msgSuccess('新增成功')
  }
  open.value = false
  getList()
}

async function handleDelete(row?: PresaleDepositVO) {
  const _ids = row?.id ?? ids.value
  const [err] = await to(modal.confirm('是否确认删除PresaleDeposit编号为"' + _ids + '"的数据项？') as any)
  if (err) return
  await delPresaleDeposit(_ids)
  getList()
  modal.msgSuccess('删除成功')
}

getList()
</script>
