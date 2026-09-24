<template>
  <el-form ref="presaletailpayRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="订单号" prop="orderNo">
        <el-input v-model="form.orderNo" placeholder="请输入订单号" />
      </el-form-item>
      <el-form-item label="商品ID" prop="goodsId">
        <el-input v-model="form.goodsId" placeholder="请输入商品ID" />
      </el-form-item>
      <el-form-item label="买家ID" prop="buyerId">
        <el-input v-model="form.buyerId" placeholder="请输入买家ID" />
      </el-form-item>
      <el-form-item label="尾款金额" prop="tailAmount">
        <el-input-number v-model="form.tailAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入尾款金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="支付时间" prop="payTime">
        <el-date-picker v-model="form.payTime" type="datetime" placeholder="请选择支付时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
      </el-form-item>
  </el-form>
</template>

<script setup name="PresaleTailPayForm" lang="ts">
import { ref, watch } from 'vue';
import type { PresaleTailPayForm } from '@/api/presale/presaletailpay/types';

const props = defineProps<{
  // 父组件传入的编辑数据
  editData?: PresaleTailPayForm | null;
}>();

const emit = defineEmits<{ submit: [data: PresaleTailPayForm] }>();

const presaletailpayRef = ref()
const form = ref<PresaleTailPayForm>({ id: undefined })

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
  presaletailpayRef.value?.validate((valid: boolean) => {
    if (valid) {
      emit('submit', form.value)
    }
  })
}

defineExpose({ submit, form })
</script>
