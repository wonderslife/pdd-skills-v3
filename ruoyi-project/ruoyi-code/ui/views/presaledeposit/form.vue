<template>
  <el-form ref="presaledepositRef" :model="form" :rules="rules" label-width="80px">
    <el-form-item label="状态" prop="status">
      <el-radio-group v-model="form.status">
        <el-radio value="0">正常</el-radio>
        <el-radio value="1">停用</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="备注" prop="remark">
      <el-input v-model="form.remark" type="textarea" placeholder="请输入备注" />
    </el-form-item>
  </el-form>
</template>

<script setup name="PresaleDepositForm">
import { ref, reactive, watch, getCurrentInstance } from "vue"

const props = defineProps({
  // 父组件传入的编辑数据
  editData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['submit'])

const { proxy } = getCurrentInstance()

const formRef = ref(null)
const form = ref({
  id: null,
  status: '0',
  remark: null
})

const rules = {
  remark: [{ required: false }]
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
  formRef.value.validate(valid => {
    if (valid) {
      emit('submit', form.value)
    }
  })
}

defineExpose({ submit, form })
</script>
