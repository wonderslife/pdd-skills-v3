<template>
  <el-form ref="presaleorderRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="订单号" prop="orderNo">
        <el-input v-model="form.orderNo" placeholder="请输入订单号" />
      </el-form-item>
      <el-form-item label="商品ID" prop="goodsId">
        <el-input v-model="form.goodsId" placeholder="请输入商品ID" />
      </el-form-item>
      <el-form-item label="商品标题" prop="goodsTitle">
        <el-input v-model="form.goodsTitle" placeholder="请输入商品标题" />
      </el-form-item>
      <el-form-item label="买家ID" prop="buyerId">
        <el-input v-model="form.buyerId" placeholder="请输入买家ID" />
      </el-form-item>
      <el-form-item label="定金金额" prop="depositAmount">
        <el-input-number v-model="form.depositAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入定金金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="尾款金额" prop="tailAmount">
        <el-input-number v-model="form.tailAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入尾款金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="总金额" prop="totalAmount">
        <el-input-number v-model="form.totalAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入总金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="物流单号" prop="shippingNo">
        <el-input v-model="form.shippingNo" placeholder="请输入物流单号" />
      </el-form-item>
      <el-form-item label="支付时间" prop="payTime">
        <el-date-picker v-model="form.payTime" type="datetime" placeholder="请选择支付时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
      </el-form-item>
  </el-form>
</template>

<script setup name="PresaleOrderForm" lang="ts">
import { ref, watch } from 'vue';
import type { PresaleOrderForm } from '@/api/presale/presaleorder/types';

const props = defineProps<{
  // 父组件传入的编辑数据
  editData?: PresaleOrderForm | null;
}>();

const emit = defineEmits<{ submit: [data: PresaleOrderForm] }>();

const presaleorderRef = ref()
const form = ref<PresaleOrderForm>({ id: undefined })

const rules = {

}

watch(
  () => props.editData,
  (val) => {
    if (val) {
      form.value = { ...val }
    }
  },
  { immediate: true }
)

/** 提交表单 */
function submit() {
  presaleorderRef.value?.validate((valid: boolean) => {
    if (valid) {
      emit('submit', form.value)
    }
  })
}

defineExpose({ submit, form })
</script>
