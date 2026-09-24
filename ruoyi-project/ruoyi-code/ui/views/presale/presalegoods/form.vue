<template>
  <el-form ref="presalegoodsRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="商品标题" prop="title">
        <el-input v-model="form.title" placeholder="请输入商品标题" />
      </el-form-item>
      <el-form-item label="售价" prop="price">
        <el-input-number v-model="form.price" :precision="2" :min="0" :max="9999999999" placeholder="请输入售价" style="width: 100%" />
      </el-form-item>
      <el-form-item label="定金金额" prop="depositAmount">
        <el-input-number v-model="form.depositAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入定金金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="尾款金额" prop="tailAmount">
        <el-input-number v-model="form.tailAmount" :precision="2" :min="0" :max="9999999999" placeholder="请输入尾款金额" style="width: 100%" />
      </el-form-item>
      <el-form-item label="预售截止时间" prop="presaleEndTime">
        <el-date-picker v-model="form.presaleEndTime" type="datetime" placeholder="请选择预售截止时间" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
      </el-form-item>
      <el-form-item label="限购数量" prop="limitQuantity">
        <el-input-number v-model="form.limitQuantity" :min="0" :max="999999999" placeholder="请输入限购数量" style="width: 100%" />
      </el-form-item>
      <el-form-item label="库存" prop="stock">
        <el-input-number v-model="form.stock" :min="0" :max="999999999" placeholder="请输入库存" style="width: 100%" />
      </el-form-item>
  </el-form>
</template>

<script setup name="PresaleGoodsForm" lang="ts">
import { ref, watch } from 'vue';
import type { PresaleGoodsForm } from '@/api/presale/presalegoods/types';

const props = defineProps<{
  // 父组件传入的编辑数据
  editData?: PresaleGoodsForm | null;
}>();

const emit = defineEmits<{ submit: [data: PresaleGoodsForm] }>();

const presalegoodsRef = ref()
const form = ref<PresaleGoodsForm>({ id: undefined })

const rules = {
  title: [{ required: true, message: '商品标题不能为空', trigger: 'blur' }],
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
  presalegoodsRef.value?.validate((valid: boolean) => {
    if (valid) {
      emit('submit', form.value)
    }
  })
}

defineExpose({ submit, form })
</script>
