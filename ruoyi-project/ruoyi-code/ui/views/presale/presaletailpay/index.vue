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
        <el-button type="primary" plain icon="Plus" v-hasPermi="['presale:tail:pay:add']" @click="handleAdd">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" v-hasPermi="['presale:tail:pay:remove']" @click="handleDelete()">删除</el-button>
      </el-col>
    </el-row>

    <el-table v-loading="loading" :data="presaletailpayList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="编号" align="center" prop="id" />
      <el-table-column label="订单号" align="center" prop="orderNo" />
      <el-table-column label="商品ID" align="center" prop="goodsId" />
      <el-table-column label="买家ID" align="center" prop="buyerId" />
      <el-table-column label="尾款金额" align="center" prop="tailAmount" width="120" />
      <el-table-column label="支付时间" align="center" prop="payTime" width="120" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180" />
      <el-table-column label="操作" align="center" class-name="operation-col">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" v-hasPermi="['presale:tail:pay:edit']" @click="handleUpdate(scope.row)">修改</el-button>
          <el-button link type="danger" icon="Delete" v-hasPermi="['presale:tail:pay:remove']" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="title" v-model="open" width="900px" append-to-body>
      <PresaleTailPayForm ref="presaletailpayFormRef" :edit-data="form" @submit="handleSubmit" />
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="presaletailpayFormRef?.submit()">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PresaleTailPay" lang="ts">
import { ref, reactive, toRefs } from 'vue';
import { to } from 'await-to-js';
import modal from '@/plugins/modal';
import type { PresaleTailPayForm as PresaleTailPayFormType, PresaleTailPayQuery, PresaleTailPayVO } from '@/api/presale/presaletailpay/types';
import { listPresaleTailPay, getPresaleTailPay, delPresaleTailPay, addPresaleTailPay, updatePresaleTailPay } from '@/api/presale/presaletailpay/index';
import PresaleTailPayForm from './form.vue';

const presaletailpayList = ref([])
const open = ref(false)
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const multiple = ref(true)
const total = ref(0)
const title = ref('')
const presaletailpayFormRef = ref()
const queryRef = ref()

const data = reactive({
  form: {} as PresaleTailPayFormType,
  queryParams: {
    pageNum: 1,
    pageSize: 10
  } as PresaleTailPayQuery
})

const { queryParams, form } = toRefs(data)

/** 查询PresaleTailPay列表 */
async function getList() {
  loading.value = true
  const res = await listPresaleTailPay(queryParams.value)
  presaletailpayList.value = res.data?.rows ?? []
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
  queryParams.value = { pageNum: 1, pageSize: 10 } as PresaleTailPayQuery
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
  title.value = '添加PresaleTailPay'
}

async function handleUpdate(row: PresaleTailPayVO) {
  reset()
  const _id = row.id ?? ids.value[0]
  const { data } = await getPresaleTailPay(_id)
  form.value = data
  open.value = true
  title.value = '修改PresaleTailPay'
}

/** 子组件校验通过后回调 */
async function handleSubmit(data: PresaleTailPayFormType) {
  if (data.id != null) {
    await updatePresaleTailPay(data)
    modal.msgSuccess('修改成功')
  } else {
    await addPresaleTailPay(data)
    modal.msgSuccess('新增成功')
  }
  open.value = false
  getList()
}

async function handleDelete(row?: PresaleTailPayVO) {
  const _ids = row?.id ?? ids.value
  const [err] = await to(modal.confirm('是否确认删除PresaleTailPay编号为"' + _ids + '"的数据项？') as any)
  if (err) return
  await delPresaleTailPay(_ids)
  getList()
  modal.msgSuccess('删除成功')
}

getList()
</script>
