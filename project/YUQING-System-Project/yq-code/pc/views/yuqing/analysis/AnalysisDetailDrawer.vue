<template>
  <el-drawer v-model="visible" :title="drawerTitle" size="70%" append-to-body @open="load">
    <div v-loading="loading" class="detail-body">
      <template v-if="detail">
        <!-- ============================================ 结论区（验收标准 7） -->
        <el-card shadow="never" class="sec">
          <template #header>
            <div class="sec-head">
              <span>研判结论</span>
              <span class="sec-right">
                <el-tag v-if="sourceText" size="small" :type="sourceTagType">{{ sourceText }}</el-tag>
                <el-tag v-if="conclusion && conclusion.correctedFlag === '1'" size="small" type="warning" style="margin-left: 6px">已人工修正</el-tag>
              </span>
            </div>
          </template>
          <template v-if="conclusion">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="研判主题">{{ conclusion.topic || '—' }}</el-descriptions-item>
              <el-descriptions-item label="置信度">{{ conclusion.confidence === null || conclusion.confidence === undefined ? '—' : conclusion.confidence }}</el-descriptions-item>
              <el-descriptions-item label="情感倾向">
                <dict-tag v-if="conclusion.sentiAttr" :options="yq_senti_attr" :value="conclusion.sentiAttr" />
                <span v-else>—</span>
              </el-descriptions-item>
              <el-descriptions-item label="风险等级">
                <dict-tag v-if="conclusion.riskLevel" :options="yq_risk_level" :value="conclusion.riskLevel" />
                <span v-else>—</span>
              </el-descriptions-item>
              <el-descriptions-item label="风险属性">{{ conclusion.riskAttr || '—' }}</el-descriptions-item>
              <el-descriptions-item label="舆情分级">
                <dict-tag v-if="conclusion.opinionLevel" :options="yq_opinion_level" :value="conclusion.opinionLevel" />
                <span v-else>—</span>
              </el-descriptions-item>
              <el-descriptions-item label="核心内容提炼" :span="2">{{ conclusion.summary || '—' }}</el-descriptions-item>
              <el-descriptions-item label="处置建议" :span="2">{{ conclusion.suggestion || '—' }}</el-descriptions-item>
              <!-- 验收标准 3：变体命中依据 -->
              <el-descriptions-item label="命中依据" :span="2">
                <div v-if="conclusion.matchEvidence" class="pre-wrap">{{ conclusion.matchEvidence }}</div>
                <span v-else>—</span>
                <div v-if="(detail.variantHits || []).length > 0" class="variant-box">
                  <el-tag v-for="(v, i) in detail.variantHits" :key="i" size="small" type="warning" effect="plain" class="variant-tag">{{ v }}</el-tag>
                </div>
              </el-descriptions-item>
              <!-- 验收标准 11：模型版本与提示词版本可追溯 -->
              <el-descriptions-item label="模型版本">{{ conclusion.modelVersion || '—' }}</el-descriptions-item>
              <el-descriptions-item label="提示词版本">{{ conclusion.promptVersion || '—' }}</el-descriptions-item>
              <el-descriptions-item label="研判版本">第 {{ conclusion.analyzeVersion || 1 }} 次</el-descriptions-item>
              <el-descriptions-item label="研判时间">{{ conclusion.analyzeTime || '—' }}</el-descriptions-item>
              <el-descriptions-item v-if="conclusion.failReason" label="失败原因" :span="2">
                <span class="fail-text">{{ conclusion.failReason }}</span>
              </el-descriptions-item>
            </el-descriptions>

            <!-- 标签来源拆分：模型打的 vs 人打的，一眼分得清 -->
            <div class="tag-sec">
              <div class="tag-line">
                <span class="tag-label">模型标签：</span>
                <template v-if="(detail.modelTagNames || []).length > 0">
                  <el-tag v-for="t in detail.modelTagNames" :key="'m-' + t" size="small" effect="plain" class="variant-tag">{{ t }}</el-tag>
                </template>
                <span v-else class="muted">无</span>
              </div>
              <div class="tag-line">
                <span class="tag-label">人工标签：</span>
                <template v-if="(detail.manualTagNames || []).length > 0">
                  <el-tag v-for="t in detail.manualTagNames" :key="'h-' + t" size="small" type="success" effect="plain" class="variant-tag">{{ t }}</el-tag>
                </template>
                <span v-else class="muted">无</span>
              </div>
            </div>

            <!-- 验收标准 8：修正留痕 -->
            <el-descriptions v-if="conclusion.correctedFlag === '1'" :column="2" border size="small" class="correct-box">
              <el-descriptions-item label="修正人">{{ detail.correctedByName || conclusion.correctedBy || '—' }}</el-descriptions-item>
              <el-descriptions-item label="修正时间">{{ conclusion.correctedTime || '—' }}</el-descriptions-item>
            </el-descriptions>
          </template>
          <el-empty v-else :image-size="70" description="该舆情尚无研判结论，可点击右上角「重新研判」生成" />

          <div class="sec-actions">
            <el-button type="primary" icon="Edit" :disabled="!conclusion || !conclusion.topic" @click="openCorrect" v-hasPermi="['yuqing:opinion:correct']">人工修正</el-button>
            <el-button plain icon="Refresh" :loading="reanalyzing" @click="reanalyze" v-hasPermi="['yuqing:opinion:analyze']">重新研判</el-button>
          </div>
        </el-card>

        <!-- ============================================ 舆情原文 -->
        <el-card shadow="never" class="sec">
          <template #header>
            <div class="sec-head">
              <span>舆情原文</span>
              <el-link v-if="opinionRef && opinionRef.opinionUrl" type="primary" :href="opinionRef.opinionUrl" target="_blank">打开原链接</el-link>
            </div>
          </template>
          <div v-if="opinionRef" class="opinion-title">{{ opinionRef.title }}</div>
          <!-- 纯文本渲染：正文来自外部采集，绝不使用 v-html -->
          <div v-if="opinionRef" class="pre-wrap content-box">{{ opinionRef.content }}</div>
          <el-descriptions v-if="opinionRef" :column="2" border size="small" class="opinion-desc">
            <el-descriptions-item label="来源渠道">{{ opinionRef.channelName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="所属任务">{{ opinionRef.taskName || '—' }}</el-descriptions-item>
            <el-descriptions-item label="发布作者">{{ opinionRef.author || '—' }}</el-descriptions-item>
            <el-descriptions-item label="发布时间">{{ opinionRef.publishTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="采集时间">{{ opinionRef.collectTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="发布地域">{{ opinionRef.region || '—' }}</el-descriptions-item>
            <el-descriptions-item label="热度">{{ opinionRef.heatScore === null || opinionRef.heatScore === undefined ? '—' : opinionRef.heatScore }}</el-descriptions-item>
            <el-descriptions-item label="关联事件">{{ opinionRef.clusterTitle || '—' }}</el-descriptions-item>
            <el-descriptions-item label="互动数据" :span="2">
              阅读 {{ nz(opinionRef.readCount) }} · 点赞 {{ nz(opinionRef.likeCount) }} · 评论 {{ nz(opinionRef.commentCount) }} · 转发 {{ nz(opinionRef.shareCount) }}
            </el-descriptions-item>
          </el-descriptions>
          <el-empty v-else :image-size="70" description="舆情记录不可见或已不存在" />
        </el-card>

        <!-- ============================================ 历史版本（验收标准 11） -->
        <el-card v-if="(opinionRef?.analysisHistory || []).length > 0" shadow="never" class="sec">
          <template #header><span>历史研判版本（共 {{ (opinionRef?.analysisHistory || []).length }} 次）</span></template>
          <el-table :data="opinionRef?.analysisHistory || []" size="small" border max-height="260">
            <el-table-column label="版本" prop="analyzeVersion" width="65" align="center" />
            <el-table-column label="主题" prop="topic" :show-overflow-tooltip="true" min-width="150" />
            <el-table-column label="情感" prop="sentiAttr" width="85" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.sentiAttr" :options="yq_senti_attr" :value="scope.row.sentiAttr" />
              </template>
            </el-table-column>
            <el-table-column label="风险" prop="riskLevel" width="85" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.riskLevel" :options="yq_risk_level" :value="scope.row.riskLevel" />
              </template>
            </el-table-column>
            <el-table-column label="模型版本" prop="modelVersion" width="120" align="center" />
            <el-table-column label="提示词" prop="promptVersion" width="90" align="center" />
            <el-table-column label="来源" width="80" align="center">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.correctedFlag === '1' ? 'warning' : 'info'">{{ scope.row.correctedFlag === '1' ? '人工' : '模型' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="研判时间" prop="analyzeTime" width="160" align="center" />
          </el-table>
        </el-card>

        <!-- ============================================ 预警与推送（来自 F-016 详情） -->
        <el-card v-if="(opinionRef?.alerts || []).length > 0 || (opinionRef?.pushes || []).length > 0" shadow="never" class="sec">
          <template #header><span>预警与推送</span></template>
          <el-table v-if="(opinionRef?.alerts || []).length > 0" :data="opinionRef?.alerts || []" size="small" border max-height="200" class="mb8">
            <el-table-column label="预警标题" prop="alertTitle" :show-overflow-tooltip="true" min-width="180" />
            <el-table-column label="等级" prop="alertLevel" width="90" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.alertLevel" :options="yq_alert_level" :value="scope.row.alertLevel" />
              </template>
            </el-table-column>
            <el-table-column label="触发时间" prop="triggerTime" width="160" align="center" />
            <el-table-column label="状态" prop="status" width="90" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.status" :options="yq_alert_status" :value="scope.row.status" />
              </template>
            </el-table-column>
          </el-table>
          <el-table v-if="(opinionRef?.pushes || []).length > 0" :data="opinionRef?.pushes || []" size="small" border max-height="200">
            <el-table-column label="推送场景" prop="pushScene" width="110" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.pushScene" :options="yq_push_scene" :value="scope.row.pushScene" />
              </template>
            </el-table-column>
            <el-table-column label="发送状态" prop="sendStatus" width="100" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.sendStatus" :options="yq_push_status" :value="scope.row.sendStatus" />
              </template>
            </el-table-column>
            <el-table-column label="发送时间" prop="sendTime" width="160" align="center" />
            <el-table-column label="内容摘要" prop="contentDigest" :show-overflow-tooltip="true" min-width="200" />
          </el-table>
        </el-card>
      </template>
      <el-empty v-else-if="!loading" :image-size="80" description="未获取到详情" />
    </div>

    <!-- 人工修正（验收标准 8、9） -->
    <AnalysisCorrectDialog v-model="correctOpen" :detail="detail" @success="onCorrected" />
  </el-drawer>
</template>

<script setup lang="ts" name="AnalysisDetailDrawer">
import { ref, computed, getCurrentInstance } from 'vue';
import { ElMessage } from 'element-plus';
import { getAnalysisDetail, analyzeOne } from '@/api/yuqing/analysis';
import type { AnalysisDetailViewVO } from '@/api/yuqing/analysis/types';
import type { LedgerAnalysisVO } from '@/api/yuqing/ledger/types';
import AnalysisCorrectDialog from './AnalysisCorrectDialog.vue';

const props = defineProps<{
  modelValue: boolean;
  opinionId?: string | number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'refresh'): void;
}>();

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_opinion_level, yq_alert_level, yq_alert_status, yq_push_scene, yq_push_status } =
  proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_opinion_level', 'yq_alert_level', 'yq_alert_status', 'yq_push_scene', 'yq_push_status');

const loading = ref(false);
const reanalyzing = ref(false);
const correctOpen = ref(false);
const detail = ref<AnalysisDetailViewVO | null>(null);

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const opinionRef = computed(() => detail.value?.opinion);

/** 结论永远取「最新一版」：详情接口返回的 analysis 就是最新版 */
const conclusion = computed<LedgerAnalysisVO | undefined>(() => opinionRef.value?.analysis);

const drawerTitle = computed(() => {
  const t = opinionRef.value?.title;
  return t ? '研判详情 · ' + t : '研判详情';
});

const sourceText = computed(() => {
  const s = detail.value?.conclusionSource;
  if (s === 'llm') {
    return '大模型研判';
  }
  if (s === 'rule') {
    return '规则兜底';
  }
  if (s === 'manual') {
    return '人工修正';
  }
  return '';
});

const sourceTagType = computed(() => {
  const s = detail.value?.conclusionSource;
  if (s === 'llm') {
    return 'success';
  }
  if (s === 'manual') {
    return 'warning';
  }
  return 'info';
});

function nz(v?: number): number {
  return v === null || v === undefined ? 0 : v;
}

async function load() {
  if (props.opinionId === undefined || props.opinionId === null) {
    return;
  }
  loading.value = true;
  try {
    const res = await getAnalysisDetail(props.opinionId);
    detail.value = res.data ?? null;
  } finally {
    loading.value = false;
  }
}

function openCorrect() {
  correctOpen.value = true;
}

function onCorrected() {
  /* 修正后重新拉一次详情：分级与标签都变了，本地拼不出来 */
  load();
  emit('refresh');
}

async function reanalyze() {
  reanalyzing.value = true;
  try {
    const res = await analyzeOne(props.opinionId as string | number, true);
    const r = res.data;
    if (r && (r.failed || 0) > 0) {
      const first = (r.failures || [])[0];
      ElMessage.warning('研判失败：' + ((first && first.reason) || '未知原因'));
    } else {
      ElMessage.success('研判完成');
    }
    load();
    emit('refresh');
  } finally {
    reanalyzing.value = false;
  }
}
</script>

<style scoped>
.detail-body {
  min-height: 200px;
}
.sec {
  margin-bottom: 12px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sec-right {
  font-size: 12px;
}
.sec-actions {
  margin-top: 12px;
  text-align: right;
}
.pre-wrap {
  white-space: pre-wrap;
  word-break: break-all;
}
.content-box {
  margin: 8px 0 12px;
  padding: 10px;
  background: #fafafa;
  border-radius: 4px;
  max-height: 300px;
  overflow: auto;
}
.opinion-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}
.opinion-desc {
  margin-top: 6px;
}
.variant-box {
  margin-top: 6px;
}
.variant-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}
.tag-sec {
  margin-top: 12px;
}
.tag-line {
  margin-bottom: 6px;
}
.tag-label {
  font-size: 13px;
  color: #606266;
}
.correct-box {
  margin-top: 12px;
}
.fail-text {
  color: #f56c6c;
}
.muted {
  color: #c0c4cc;
}
</style>
