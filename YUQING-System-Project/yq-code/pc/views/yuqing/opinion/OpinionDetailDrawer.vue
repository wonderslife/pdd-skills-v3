<template>
  <el-drawer v-model="visible" :title="detail.title || '舆情详情'" size="62%" append-to-body>
    <div v-loading="loading">
      <!-- 原文 -->
      <el-card shadow="never" class="blk">
        <template #header>
          <span class="blk-title">原文内容</span>
          <el-link v-if="detail.opinionUrl" type="primary" :href="detail.opinionUrl" target="_blank" class="blk-extra">
            打开原始链接
          </el-link>
        </template>
        <div class="meta-line">
          <el-tag size="small">{{ detail.channelName || '未知渠道' }}</el-tag>
          <el-tag size="small" type="info">{{ detail.author || '匿名' }}</el-tag>
          <el-tag size="small" type="info">发布 {{ detail.publishTime || '—' }}</el-tag>
          <el-tag size="small" type="info">采集 {{ detail.collectTime || '—' }}</el-tag>
          <dict-tag :options="yq_senti_attr" :value="detail.sentiAttr" />
          <dict-tag :options="yq_risk_level" :value="detail.riskLevel" />
          <dict-tag :options="yq_opinion_level" :value="detail.opinionLevel" />
        </div>
        <!-- 正文一律以纯文本渲染：原文可能含 HTML，用 v-html 会引入 XSS -->
        <pre class="content">{{ detail.content || '（无正文）' }}</pre>
      </el-card>

      <!-- 互动数据 -->
      <el-card shadow="never" class="blk">
        <template #header><span class="blk-title">互动数据</span></template>
        <el-row :gutter="12">
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ fmt(detail.readCount) }}</div><div class="metric-k">阅读</div></div></el-col>
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ fmt(detail.likeCount) }}</div><div class="metric-k">点赞</div></div></el-col>
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ fmt(detail.commentCount) }}</div><div class="metric-k">评论</div></div></el-col>
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ fmt(detail.shareCount) }}</div><div class="metric-k">转发</div></div></el-col>
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ fmt(detail.heatScore) }}</div><div class="metric-k">热度</div></div></el-col>
          <el-col :span="4"><div class="metric"><div class="metric-v">{{ (detail.metricTrend || []).length }}</div><div class="metric-k">快照点</div></div></el-col>
        </el-row>
        <el-table v-if="(detail.metricTrend || []).length > 0" :data="detail.metricTrend" size="small" max-height="200" class="mt8">
          <el-table-column label="快照日期" prop="snapshotDate" width="110" align="center" />
          <el-table-column label="阅读" prop="readCount" align="center" />
          <el-table-column label="点赞" prop="likeCount" align="center" />
          <el-table-column label="评论" prop="commentCount" align="center" />
          <el-table-column label="转发" prop="shareCount" align="center" />
          <el-table-column label="热度" prop="heatScore" align="center" />
        </el-table>
      </el-card>

      <!-- 溯源字段 -->
      <el-card shadow="never" class="blk">
        <template #header><span class="blk-title">完整溯源</span></template>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="舆情ID">{{ detail.opinionId }}</el-descriptions-item>
          <el-descriptions-item label="所属任务">{{ detail.taskName || detail.taskId || '—' }}</el-descriptions-item>
          <el-descriptions-item label="采集批次">{{ detail.batchNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="采集来源">
            <dict-tag :options="yq_collect_source" :value="detail.collectSource" />
          </el-descriptions-item>
          <el-descriptions-item label="发布地域">{{ detail.region || '—' }}</el-descriptions-item>
          <el-descriptions-item label="URL 指纹">{{ detail.urlHash || '—' }}</el-descriptions-item>
          <el-descriptions-item label="原始链接" :span="2">
            <el-link v-if="detail.opinionUrl" type="primary" :href="detail.opinionUrl" target="_blank">
              {{ detail.opinionUrl }}
            </el-link>
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="清洗状态">
            <dict-tag :options="yq_clean_status" :value="detail.cleanStatus" />
          </el-descriptions-item>
          <el-descriptions-item label="降噪原因">{{ detail.noiseReason || '—' }}</el-descriptions-item>
          <el-descriptions-item label="重复渠道">{{ detail.dupChannelIds || '—' }}</el-descriptions-item>
          <el-descriptions-item label="标签">
            <el-tag v-for="t in detail.tagNames || []" :key="t" size="small" class="mr4">{{ t }}</el-tag>
            <span v-if="(detail.tagNames || []).length === 0">—</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 研判结论 -->
      <el-card shadow="never" class="blk">
        <template #header>
          <span class="blk-title">研判结论</span>
          <el-tag size="small" type="info" class="blk-extra">
            {{ detail.analyzeStatus || '待研判' }}
          </el-tag>
        </template>
        <template v-if="detail.analysis">
          <el-descriptions :column="2" size="small" border>
            <el-descriptions-item label="主题" :span="2">{{ detail.analysis.topic || '—' }}</el-descriptions-item>
            <el-descriptions-item label="模型版本">{{ detail.analysis.modelVersion || '—' }}</el-descriptions-item>
            <el-descriptions-item label="置信度">{{ detail.analysis.confidence ?? '—' }}</el-descriptions-item>
            <el-descriptions-item label="人工修正">
              <el-tag v-if="detail.analysis.correctedFlag === '1'" size="small" type="warning">
                已修正（{{ detail.analysis.correctedTime || '—' }}）
              </el-tag>
              <span v-else>未修正</span>
            </el-descriptions-item>
            <el-descriptions-item label="研判时间">{{ detail.analysis.analyzeTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="结论摘要" :span="2">
              <div class="pre-wrap">{{ detail.analysis.summary || '—' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="处置建议" :span="2">
              <div class="pre-wrap">{{ detail.analysis.suggestion || '—' }}</div>
            </el-descriptions-item>
            <el-descriptions-item label="命中证据" :span="2">
              <div class="pre-wrap">{{ detail.analysis.matchEvidence || '—' }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <el-empty v-else description="该舆情尚未完成研判" :image-size="60" />
        <div v-if="(detail.analysisHistory || []).length > 1" class="mt8">
          <el-divider content-position="left">历史版本</el-divider>
          <el-table :data="detail.analysisHistory" size="small" max-height="200">
            <el-table-column label="版本" prop="analyzeVersion" width="70" align="center" />
            <el-table-column label="时间" prop="analyzeTime" width="160" align="center" />
            <el-table-column label="属性" prop="sentiAttr" width="90" align="center" />
            <el-table-column label="摘要" prop="summary" :show-overflow-tooltip="true" min-width="200" />
          </el-table>
        </div>
      </el-card>

      <!-- 预警记录 -->
      <el-card shadow="never" class="blk">
        <template #header><span class="blk-title">预警记录</span></template>
        <el-table :data="detail.alerts || []" size="small" max-height="220" border>
          <el-table-column label="预警标题" prop="alertTitle" :show-overflow-tooltip="true" min-width="180" />
          <el-table-column label="级别" prop="alertLevel" width="90" align="center" />
          <el-table-column label="触发值" prop="triggerValue" width="110" align="center" />
          <el-table-column label="触发时间" prop="triggerTime" width="160" align="center" />
          <el-table-column label="状态" prop="status" width="90" align="center" />
          <el-table-column label="命中规则" prop="ruleName" :show-overflow-tooltip="true" min-width="140" />
        </el-table>
        <el-empty v-if="(detail.alerts || []).length === 0" description="无预警记录" :image-size="60" />
      </el-card>

      <!-- 推送记录 -->
      <el-card shadow="never" class="blk">
        <template #header><span class="blk-title">推送记录</span></template>
        <el-table :data="detail.pushes || []" size="small" max-height="220" border>
          <el-table-column label="推送规则" prop="ruleName" :show-overflow-tooltip="true" min-width="150" />
          <el-table-column label="场景" prop="pushScene" width="130" align="center" />
          <el-table-column label="方式" prop="pushLevel" width="100" align="center" />
          <el-table-column label="状态" prop="sendStatus" width="90" align="center" />
          <el-table-column label="重试" prop="retryCount" width="70" align="center" />
          <el-table-column label="推送时间" prop="sendTime" width="160" align="center" />
          <el-table-column label="失败原因" prop="failReason" :show-overflow-tooltip="true" min-width="140" />
        </el-table>
        <el-empty v-if="(detail.pushes || []).length === 0" description="无推送记录" :image-size="60" />
      </el-card>
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="OpinionDetailDrawer">
import { ref, watch, getCurrentInstance } from 'vue';
import { getLedgerDetail } from '@/api/yuqing/ledger';
import type { LedgerDetailVO } from '@/api/yuqing/ledger/types';

const props = defineProps<{ modelValue: boolean; opinionId?: string | number }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_opinion_level, yq_collect_source, yq_clean_status } =
  proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_opinion_level', 'yq_collect_source', 'yq_clean_status');

const visible = ref(props.modelValue);
const loading = ref(false);
const detail = ref<LedgerDetailVO>({});

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v;
    if (v) {
      load();
    }
  }
);
watch(visible, (v) => emit('update:modelValue', v));
watch(
  () => props.opinionId,
  () => {
    if (visible.value) {
      load();
    }
  }
);

async function load() {
  if (props.opinionId === undefined || props.opinionId === null || props.opinionId === '') {
    return;
  }
  loading.value = true;
  try {
    const res = await getLedgerDetail(props.opinionId);
    detail.value = res.data ?? {};
  } finally {
    loading.value = false;
  }
}

function fmt(v?: number) {
  return v === undefined || v === null ? '—' : v;
}
</script>

<style scoped>
.blk {
  margin-bottom: 12px;
}
.blk-title {
  font-weight: 600;
}
.blk-extra {
  float: right;
}
.meta-line {
  margin-bottom: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.content {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 22px;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}
.pre-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}
.metric {
  text-align: center;
  padding: 4px 0;
}
.metric-v {
  font-size: 18px;
  font-weight: 600;
}
.metric-k {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mt8 {
  margin-top: 8px;
}
.mr4 {
  margin-right: 4px;
}
</style>
