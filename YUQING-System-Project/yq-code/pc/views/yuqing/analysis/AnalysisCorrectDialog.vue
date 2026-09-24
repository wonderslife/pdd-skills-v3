<template>
  <el-dialog v-model="visible" title="人工修正研判结论" width="680px" append-to-body @open="init">
    <el-alert
      title="修正后会自动回写主表的舆情属性、风险等级与分级，并登记为待标注训练样本；修正记录永久留痕。"
      type="info"
      :closable="false"
      class="mb8"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="情感倾向" prop="sentiAttr">
        <el-select v-model="form.sentiAttr" placeholder="请选择" style="width: 220px" @change="onSentiChange">
          <el-option v-for="d in yq_senti_attr" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="风险等级" prop="riskLevel">
        <el-select v-model="form.riskLevel" placeholder="请选择" :disabled="!isNegative" style="width: 220px">
          <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <span v-if="!isNegative" class="tip">非负面舆情无风险属性，风险等级固定为「一般」</span>
      </el-form-item>
      <el-form-item label="舆情分级" prop="opinionLevel">
        <el-select v-model="form.opinionLevel" placeholder="请选择" style="width: 220px">
          <el-option v-for="d in yq_opinion_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="人工标签">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          collapse-tags
          collapse-tags-tooltip
          placeholder="可输入新标签后回车"
          style="width: 100%"
        >
          <el-option v-for="t in tagOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <div class="tip">
          此处只管理「人工标签」，模型标签不受影响；清空此项会删掉该舆情全部人工标签。
        </div>
      </el-form-item>
      <el-form-item label="修正说明">
        <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="简要说明修正理由，便于复盘模型偏差" />
      </el-form-item>
      <el-form-item label="登记样本">
        <el-switch v-model="form.createSample" />
        <span class="tip">开启后把本次修正登记为待标注训练样本（验收标准 9），用于后续模型迭代</span>
      </el-form-item>
    </el-form>

    <!-- 修正前后对照：修正是覆盖式提交，必须让用户看清改了什么 -->
    <el-card shadow="never" class="diff-card">
      <template #header><span>修正对照</span></template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="情感倾向">
          <span class="old">{{ before.sentiAttr || '—' }}</span>
          <span class="arrow">→</span>
          <span class="new">{{ form.sentiAttr || '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <span class="old">{{ before.riskLevel || '—' }}</span>
          <span class="arrow">→</span>
          <span class="new">{{ isNegative ? form.riskLevel || '—' : 'general' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="舆情分级">
          <span class="old">{{ before.opinionLevel || '—' }}</span>
          <span class="arrow">→</span>
          <span class="new">{{ form.opinionLevel || '—' }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">提交修正</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="AnalysisCorrectDialog">
import { ref, reactive, computed, getCurrentInstance } from 'vue';
import { ElMessage } from 'element-plus';
import { correctAnalysis } from '@/api/yuqing/analysis';
import type { AnalysisCorrectForm, AnalysisDetailViewVO } from '@/api/yuqing/analysis/types';

const props = defineProps<{
  modelValue: boolean;
  detail?: AnalysisDetailViewVO | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'success'): void;
}>();

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_opinion_level } = proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_opinion_level');

const formRef = ref();
const submitting = ref(false);
const tagOptions = ref<string[]>([]);

/** 修正前快照：仅用于页面上做对照，不参与提交 */
const before = reactive({
  sentiAttr: '' as string | undefined,
  riskLevel: '' as string | undefined,
  opinionLevel: '' as string | undefined
});

const form = reactive<AnalysisCorrectForm>({
  opinionId: undefined,
  sentiAttr: undefined,
  riskLevel: undefined,
  opinionLevel: undefined,
  tags: [],
  remark: '',
  createSample: true
});

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const isNegative = computed(() => form.sentiAttr === 'negative');

const rules = {
  sentiAttr: [{ required: true, message: '请选择情感倾向', trigger: 'change' }],
  riskLevel: [{ required: true, message: '请选择风险等级', trigger: 'change' }],
  opinionLevel: [{ required: true, message: '请选择舆情分级', trigger: 'change' }]
};

/**
 * 打开时用当前结论预填。
 *
 * 标签只预填**人工标签**（manualTagNames），不填模型标签 ——
 * 因为提交的 tags 只覆盖 manual 来源，把模型标签带进来会让用户以为
 * 提交后模型标签也归他管，实际不会。
 */
function init() {
  const a = props.detail?.opinion?.analysis;
  form.opinionId = props.detail?.opinion?.opinionId;
  form.sentiAttr = a?.sentiAttr || undefined;
  form.riskLevel = a?.riskLevel || undefined;
  form.opinionLevel = a?.opinionLevel || undefined;
  form.tags = (props.detail?.manualTagNames || []).slice();
  form.remark = '';
  form.createSample = true;
  before.sentiAttr = a?.sentiAttr || undefined;
  before.riskLevel = a?.riskLevel || undefined;
  before.opinionLevel = a?.opinionLevel || undefined;

  /* 候选标签 = 模型标签 + 人工标签，都是该舆情上真实出现过的词 */
  const merged: string[] = [];
  (props.detail?.modelTagNames || []).forEach((t) => {
    if (merged.indexOf(t) < 0) {
      merged.push(t);
    }
  });
  (props.detail?.manualTagNames || []).forEach((t) => {
    if (merged.indexOf(t) < 0) {
      merged.push(t);
    }
  });
  tagOptions.value = merged;
}

/** 切到非负面时把风险等级拉回一般，避免提交出「正面 + 严重」这种矛盾组合 */
function onSentiChange(v: string) {
  if (v !== 'negative') {
    form.riskLevel = 'general';
  }
}

async function submit() {
  await formRef.value.validate();
  if (form.opinionId === undefined || form.opinionId === null) {
    ElMessage.error('缺少舆情编号，无法提交');
    return;
  }
  submitting.value = true;
  try {
    await correctAnalysis({
      opinionId: form.opinionId,
      sentiAttr: form.sentiAttr,
      riskLevel: isNegative.value ? form.riskLevel : 'general',
      opinionLevel: form.opinionLevel,
      tags: form.tags,
      remark: form.remark,
      createSample: form.createSample
    });
    ElMessage.success('修正已提交');
    visible.value = false;
    emit('success');
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.tip {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
.diff-card {
  margin-top: 6px;
}
.old {
  color: #909399;
  text-decoration: line-through;
}
.arrow {
  margin: 0 6px;
  color: #c0c4cc;
}
.new {
  color: #67c23a;
  font-weight: 600;
}
</style>
