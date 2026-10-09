<template>
  <div class="app-container">
    <!-- 组合筛选（验收标准 5、6、8：状态 + 失败 + 已修正都是独立维度） -->
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true" size="default">
      <el-form-item label="采集时间" prop="collectBeginTime">
        <el-date-picker
          v-model="collectRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 340px"
        />
      </el-form-item>
      <el-form-item label="监测任务" prop="taskId">
        <el-select v-model="queryParams.taskId" placeholder="全部任务" clearable filterable style="width: 175px">
          <el-option v-for="t in taskOptions" :key="t.taskId" :label="t.taskName" :value="t.taskId" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源渠道" prop="channelId">
        <el-select v-model="queryParams.channelId" placeholder="全部渠道" clearable filterable style="width: 175px">
          <el-option v-for="c in channelOptions" :key="c.channelId" :label="c.channelName" :value="c.channelId" />
        </el-select>
      </el-form-item>
      <el-form-item label="舆情属性" prop="sentiAttr">
        <el-select v-model="queryParams.sentiAttr" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_senti_attr" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="风险等级" prop="riskLevel">
        <el-select v-model="queryParams.riskLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_risk_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="舆情分级" prop="opinionLevel">
        <el-select v-model="queryParams.opinionLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_opinion_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="传播量级" prop="spreadLevel">
        <el-select v-model="queryParams.spreadLevel" placeholder="全部" clearable style="width: 120px">
          <el-option v-for="d in yq_spread_level" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="研判状态" prop="analyzeStatus">
        <el-select v-model="queryParams.analyzeStatus" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_analyze_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词" prop="keyword">
        <el-input v-model="queryParams.keyword" placeholder="标题/正文关键词" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="仅看失败">
        <el-switch v-model="queryParams.onlyFailed" />
      </el-form-item>
      <el-form-item label="仅看已修正">
        <el-checkbox v-model="correctedOnly" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="MagicStick" :loading="batching" @click="openBatch" v-hasPermi="['yuqing:opinion:analyze']">批量研判</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="RefreshRight" :loading="retrying" @click="handleRetry" v-hasPermi="['yuqing:opinion:analyze']">重试失败项</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Unlock" :disabled="selectedIds.length === 0" @click="handleRelease" v-hasPermi="['yuqing:opinion:analyze']">释放卡住</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Histogram" @click="openModel" v-hasPermi="['yuqing:model:iterate']">模型版本</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 数据范围说明（让研判员知道自己看到的是授权范围内的数据） -->
    <el-alert v-if="scopeDesc" :title="'当前数据范围：' + scopeDesc" type="info" :closable="false" class="mb8" />

    <!-- 各状态条数（验收标准 5：台账可按状态筛选） -->
    <div class="status-bar">
      <el-tag type="info" effect="plain" class="status-item" @click="filterStatus('pending')">待研判 {{ statusOf('pending') }}</el-tag>
      <el-tag type="warning" effect="plain" class="status-item" @click="filterStatus('processing')">处理中 {{ statusOf('processing') }}</el-tag>
      <el-tag type="success" effect="plain" class="status-item" @click="filterStatus('completed')">已完成 {{ statusOf('completed') }}</el-tag>
      <el-tag type="danger" effect="plain" class="status-item" @click="filterStatus('failed')">失败 {{ statusOf('failed') }}</el-tag>
      <span class="status-tip">点击标签即可按该状态筛选</span>
    </div>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- ============================================ 舆情研判 -->
      <el-tab-pane label="舆情研判" name="opinion">
        <el-table v-loading="loading" :data="analysisList" @selection-change="handleSelectionChange" border>
          <el-table-column type="selection" width="45" align="center" />
          <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="240">
            <template #default="scope">
              <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">
                {{ scope.row.title }}
              </el-link>
              <span v-else>{{ scope.row.title }}</span>
            </template>
          </el-table-column>
          <!-- 结论侧：未研判时为空，模板要容忍空白 -->
          <el-table-column label="研判主题" prop="topic" :show-overflow-tooltip="true" min-width="160">
            <template #default="scope">
              <span v-if="scope.row.topic">{{ scope.row.topic }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="来源渠道" prop="channelName" :show-overflow-tooltip="true" width="120" />
          <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
          <el-table-column label="舆情属性" prop="sentiAttr" width="95" align="center">
            <template #default="scope">
              <dict-tag v-if="scope.row.sentiAttr" :options="yq_senti_attr" :value="scope.row.sentiAttr" />
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
            <template #default="scope">
              <dict-tag v-if="scope.row.riskLevel" :options="yq_risk_level" :value="scope.row.riskLevel" />
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="分级" prop="opinionLevel" width="90" align="center">
            <template #default="scope">
              <dict-tag v-if="scope.row.opinionLevel" :options="yq_opinion_level" :value="scope.row.opinionLevel" />
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="热度" prop="heatScore" width="75" align="center" />
          <el-table-column label="置信度" prop="confidence" width="85" align="center">
            <template #default="scope">
              <span v-if="scope.row.confidence !== null && scope.row.confidence !== undefined">{{ scope.row.confidence }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="研判状态" prop="analyzeStatus" width="95" align="center">
            <template #default="scope">
              <dict-tag :options="yq_analyze_status" :value="scope.row.analyzeStatus" />
            </template>
          </el-table-column>
          <!-- 验收标准 11：模型版本与提示词版本可追溯 -->
          <el-table-column label="结论版本" width="150" align="center">
            <template #default="scope">
              <div v-if="scope.row.modelVersion">{{ scope.row.modelVersion }}</div>
              <div v-if="scope.row.promptVersion" class="muted">{{ scope.row.promptVersion }}</div>
              <span v-if="!scope.row.modelVersion && !scope.row.promptVersion" class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="标记" width="95" align="center">
            <template #default="scope">
              <el-tag v-if="scope.row.correctedFlag === '1'" size="small" type="warning">已修正</el-tag>
              <el-tag v-if="scope.row.alertFlag === '1'" size="small" type="danger" style="margin-left: 4px">已预警</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="View" @click="openDetail(scope.row)" v-hasPermi="['yuqing:opinion:query']">详情</el-button>
              <el-button link type="primary" icon="Refresh" @click="handleReanalyze(scope.row)" v-hasPermi="['yuqing:opinion:analyze']">重研判</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态：给出可放宽的筛选建议，而不是一句「暂无数据」 -->
        <el-empty v-if="!loading && total === 0" :image-size="90" :description="emptyTitle">
          <div class="empty-hints">
            <div v-for="(h, i) in hints" :key="i" class="empty-hint-item">{{ i + 1 }}. {{ h }}</div>
          </div>
          <el-button v-if="!scopeEmpty" type="primary" plain @click="resetQuery">清空筛选条件</el-button>
        </el-empty>

        <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
      </el-tab-pane>

      <!-- ============================================ 事件聚合 -->
      <el-tab-pane label="事件聚合" name="cluster">
        <el-form :inline="true" size="default" class="mb8">
          <el-form-item label="事件关键词">
            <el-input v-model="clusterQuery.keyword" placeholder="事件标题 / 主题" clearable style="width: 240px" @keyup.enter="handleClusterQuery" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleClusterQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetClusterQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="clusterLoading" :data="clusterList" border>
          <el-table-column label="事件标题" prop="clusterTitle" :show-overflow-tooltip="true" min-width="220" />
          <el-table-column label="事件主题" prop="clusterTopic" :show-overflow-tooltip="true" min-width="150">
            <template #default="scope">
              <span v-if="scope.row.clusterTopic">{{ scope.row.clusterTopic }}</span>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="舆情条数" width="110" align="center">
            <template #default="scope">
              <span>{{ scope.row.visibleCount || 0 }}</span>
              <span v-if="scope.row.opinionCount > scope.row.visibleCount" class="muted"> / {{ scope.row.opinionCount }}</span>
            </template>
          </el-table-column>
          <el-table-column label="起止时间" width="185" align="center">
            <template #default="scope">
              <div>{{ scope.row.firstTime }}</div>
              <div class="muted">{{ scope.row.lastTime }}</div>
            </template>
          </el-table-column>
          <el-table-column label="峰值热度" prop="peakHeat" width="95" align="center" />
          <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
            <template #default="scope">
              <dict-tag v-if="scope.row.riskLevel" :options="yq_risk_level" :value="scope.row.riskLevel" />
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <!-- 验收标准 4：聚合详情按时间轴展示传播脉络，这里先给出阶段分布 -->
          <el-table-column label="传播阶段" min-width="230">
            <template #default="scope">
              <span v-if="scope.row.spreadSummary">{{ scope.row.spreadSummary }}</span>
              <span v-else class="muted">—</span>
              <div class="stage-row">
                <el-tag
                  v-for="(cnt, key) in scope.row.stageCount || {}"
                  :key="key"
                  size="small"
                  effect="plain"
                  class="stage-tag"
                >
                  {{ stageText(key) }} {{ cnt }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Connection" @click="openCluster(scope.row)" v-hasPermi="['yuqing:opinion:query']">传播脉络</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="!clusterLoading && clusterTotal === 0" :image-size="80" description="暂无聚合事件" />
        <pagination
          v-show="clusterTotal > 0"
          :total="clusterTotal"
          v-model:page="clusterQuery.pageNum"
          v-model:limit="clusterQuery.pageSize"
          @pagination="getClusterList"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 研判详情抽屉（验收标准 7、8、9） -->
    <AnalysisDetailDrawer v-model="detailOpen" :opinion-id="activeOpinionId" @refresh="getList" />

    <!-- 事件聚合抽屉（验收标准 4） -->
    <ClusterViewDrawer v-model="clusterOpen" :cluster-id="activeClusterId" />

    <!-- 批量执行结果（验收标准 6、10） -->
    <el-dialog v-model="batchOpen" title="研判执行结果" width="760px" append-to-body>
      <el-alert
        v-if="batchResult.batchNo"
        :title="'批次 ' + batchResult.batchNo + ' · 触发方式 ' + triggerText(batchResult.trigger)"
        type="success"
        :closable="false"
        class="mb8"
      />
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="扫描总数">{{ batchResult.total || 0 }}</el-descriptions-item>
        <el-descriptions-item label="成功认领">{{ batchResult.claimed || 0 }}</el-descriptions-item>
        <el-descriptions-item label="已处理">{{ batchResult.processed || 0 }}</el-descriptions-item>
        <el-descriptions-item label="成功">{{ batchResult.succeeded || 0 }}</el-descriptions-item>
        <el-descriptions-item label="失败">{{ batchResult.failed || 0 }}</el-descriptions-item>
        <el-descriptions-item label="跳过">{{ batchResult.skipped || 0 }}</el-descriptions-item>
        <el-descriptions-item label="大模型">{{ batchResult.llmUsed || 0 }}</el-descriptions-item>
        <el-descriptions-item label="规则兜底">{{ batchResult.ruleUsed || 0 }}</el-descriptions-item>
        <el-descriptions-item label="自动打标">{{ batchResult.tagged || 0 }}</el-descriptions-item>
        <el-descriptions-item label="新建事件">{{ batchResult.clusterCreated || 0 }}</el-descriptions-item>
        <el-descriptions-item label="并入事件">{{ batchResult.clusterJoined || 0 }}</el-descriptions-item>
        <el-descriptions-item label="剩余待处理">{{ batchResult.remaining || 0 }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="batchResult.truncated"
        title="本批已达到条数上限提前结束，剩余条目未处理，可再次点击「批量研判」继续。"
        type="warning"
        :closable="false"
        class="mb8 batch-gap"
      />
      <el-alert v-if="batchResult.scopeDesc" :title="'数据范围：' + batchResult.scopeDesc" type="info" :closable="false" class="mb8" />

      <!-- 失败明细：不阻塞其它舆情研判是验收标准 6 的核心，必须让用户看见 -->
      <div v-if="(batchResult.failures || []).length > 0" class="fail-box">
        <div class="fail-title">失败明细（最多保留 20 条）</div>
        <el-table :data="batchResult.failures || []" max-height="240" size="small" border>
          <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="180" />
          <el-table-column label="原因" prop="reason" :show-overflow-tooltip="true" min-width="220" />
          <el-table-column label="尝试" prop="attempt" width="65" align="center" />
          <el-table-column label="可重试" width="80" align="center">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.retryable ? 'success' : 'info'">{{ scope.row.retryable ? '是' : '否' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="batchOpen = false">关闭</el-button>
        <el-button type="primary" @click="afterBatch">刷新列表</el-button>
      </template>
    </el-dialog>

    <!-- 模型版本（验收标准 11） -->
    <el-dialog v-model="modelOpen" title="模型版本" width="860px" append-to-body>
      <el-alert
        title="每次研判都会记录模型版本与提示词版本；回滚只切换当前生效版本，不修改历史结论。"
        type="info"
        :closable="false"
        class="mb8"
      />
      <el-table v-loading="modelLoading" :data="modelList" border max-height="420">
        <el-table-column label="版本名称" prop="versionName" min-width="150" />
        <el-table-column label="类型" prop="modelType" width="110" align="center">
          <template #default="scope">
            <dict-tag v-if="scope.row.modelType" :options="yq_model_type" :value="scope.row.modelType" />
          </template>
        </el-table-column>
        <el-table-column label="提供方" prop="provider" width="120" align="center" />
        <el-table-column label="样本数" prop="sampleCount" width="85" align="center" />
        <el-table-column label="准确率" prop="evalAccuracy" width="85" align="center" />
        <el-table-column label="训练时间" prop="trainTime" width="160" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.isActive === '1' || scope.row.isActive === 'Y'" size="small" type="success">生效中</el-tag>
            <el-tag v-else size="small" type="info">历史</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" :show-overflow-tooltip="true" min-width="140" />
        <el-table-column label="操作" width="95" align="center" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.isActive !== '1' && scope.row.isActive !== 'Y'"
              link
              type="primary"
              @click="handleRollback(scope.row)"
              v-hasPermi="['yuqing:model:rollback']"
            >
              回滚
            </el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="modelOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="YuqingAnalysis">
import { ref, reactive, toRefs, computed, onMounted, getCurrentInstance } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  pageAnalysis,
  pageCluster,
  batchAnalyze,
  analyzeOne,
  retryAnalysis,
  releaseProcessing,
  listModelVersion,
  rollbackModelVersion
} from '@/api/yuqing/analysis';
import type {
  AnalysisQueryParams,
  AnalysisRowVO,
  AnalysisBatchResultVO,
  ClusterCardVO,
  ModelVersionVO
} from '@/api/yuqing/analysis/types';
import { optionselectYqTask } from '@/api/yuqing/task';
import { optionselectYqChannel } from '@/api/yuqing/channel';
import AnalysisDetailDrawer from './AnalysisDetailDrawer.vue';
import ClusterViewDrawer from './ClusterViewDrawer.vue';

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_opinion_level, yq_spread_level, yq_analyze_status, yq_model_type } =
  proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_opinion_level', 'yq_spread_level', 'yq_analyze_status', 'yq_model_type');

/**
 * 传播阶段中文名。
 *
 * ⚠ 这里的 key 来自后端 SpreadStageClassifier（大写 FIRST/SPREAD/PEAK/FALL），
 * 与 yq_spread_level 字典（千/万/十万/viral 的量级）不是一回事，
 * 所以必须本地映射，不能走 useDict —— 走字典会一个都匹不上，整列显示原始英文。
 */
const STAGE_LABELS: Record<string, string> = {
  FIRST: '首发',
  SPREAD: '扩散',
  PEAK: '峰值',
  FALL: '回落'
};

const loading = ref(false);
const clusterLoading = ref(false);
const modelLoading = ref(false);
const batching = ref(false);
const retrying = ref(false);
const showSearch = ref(true);
const activeTab = ref('opinion');

const analysisList = ref<AnalysisRowVO[]>([]);
const clusterList = ref<ClusterCardVO[]>([]);
const modelList = ref<ModelVersionVO[]>([]);
const total = ref(0);
const clusterTotal = ref(0);
const statusCount = ref<Record<string, number>>({});
const hints = ref<string[]>([]);
const scopeDesc = ref('');
const scopeEmpty = ref(false);
const selectedIds = ref<Array<string | number>>([]);
const taskOptions = ref<any[]>([]);
const channelOptions = ref<any[]>([]);
const collectRange = ref<string[]>([]);
const correctedOnly = ref(false);

const detailOpen = ref(false);
const clusterOpen = ref(false);
const batchOpen = ref(false);
const modelOpen = ref(false);
const batchResult = ref<AnalysisBatchResultVO>({});
const activeOpinionId = ref<string | number>();
const activeClusterId = ref<string | number>();

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    onlyFailed: false
  } as AnalysisQueryParams,
  clusterQuery: {
    pageNum: 1,
    pageSize: 10,
    keyword: undefined
  } as { pageNum: number; pageSize: number; keyword?: string }
});
const { queryParams, clusterQuery } = toRefs(data);

const emptyTitle = computed(() => {
  return '暂无待研判舆情';
});

function statusOf(key: string): number {
  const m = statusCount.value;
  const v = m ? m[key] : 0;
  return v === undefined || v === null ? 0 : v;
}

function stageText(key: string | number | symbol): string {
  const k = String(key).toUpperCase();
  return STAGE_LABELS[k] || String(key);
}

function triggerText(t?: string): string {
  if (t === 'job') {
    return '定时任务';
  }
  if (t === 'manual') {
    return '人工触发';
  }
  return t || '—';
}

/** 列表查询（验收标准 5、7、8） */
async function getList() {
  loading.value = true;
  try {
    queryParams.value.collectBeginTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[0] : undefined;
    queryParams.value.collectEndTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[1] : undefined;
    queryParams.value.correctedFlag = correctedOnly.value ? '1' : undefined;

    const res = await pageAnalysis(queryParams.value);
    const page = res.data;
    analysisList.value = page?.rows ?? [];
    total.value = page?.total ?? 0;
    statusCount.value = page?.statusCount ?? {};
    hints.value = page?.hints ?? [];
    scopeDesc.value = page?.scopeDesc ?? '';
    scopeEmpty.value = page?.scopeEmpty ?? false;
  } finally {
    loading.value = false;
  }
}

/** 事件聚合列表（验收标准 4、10） */
async function getClusterList() {
  clusterLoading.value = true;
  try {
    const res = await pageCluster(clusterQuery.value);
    const page = res.data;
    clusterList.value = (page?.rows ?? []) as ClusterCardVO[];
    clusterTotal.value = Number(page?.total ?? 0);
  } finally {
    clusterLoading.value = false;
  }
}

function onTabChange(name: string | number) {
  if (name === 'cluster') {
    getClusterList();
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  collectRange.value = [];
  correctedOnly.value = false;
  queryParams.value = {
    pageNum: 1,
    pageSize: queryParams.value.pageSize,
    onlyFailed: false
  } as AnalysisQueryParams;
  handleQuery();
}

function filterStatus(status: string) {
  queryParams.value.analyzeStatus = status;
  if (status !== 'failed') {
    queryParams.value.onlyFailed = false;
  }
  handleQuery();
}

function handleClusterQuery() {
  clusterQuery.value.pageNum = 1;
  getClusterList();
}

function resetClusterQuery() {
  clusterQuery.value = { pageNum: 1, pageSize: clusterQuery.value.pageSize, keyword: undefined };
  getClusterList();
}

function handleSelectionChange(rows: AnalysisRowVO[]) {
  selectedIds.value = (rows || []).map((r) => r.opinionId).filter((id) => id !== undefined && id !== null) as Array<string | number>;
}

function openDetail(row: AnalysisRowVO) {
  activeOpinionId.value = row.opinionId;
  detailOpen.value = true;
}

function openCluster(row: ClusterCardVO) {
  activeClusterId.value = row.clusterId;
  clusterOpen.value = true;
}

/** 批量研判（验收标准 1、6、10）：先问条数，避免一发就是几千条 */
async function openBatch() {
  const input = await ElMessageBox.prompt('本批最多研判多少条？（留空使用服务端默认值）', '批量研判', {
    confirmButtonText: '开始研判',
    cancelButtonText: '取消',
    inputPattern: /^[0-9]*$/,
    inputErrorMessage: '请输入正整数',
    inputValue: ''
  }).catch(() => null);
  if (!input) {
    return;
  }
  const raw = (input as any).value;
  const limit = raw === '' || raw === undefined || raw === null ? undefined : Number(raw);
  batching.value = true;
  try {
    const res = await batchAnalyze(queryParams.value, limit);
    batchResult.value = res.data ?? {};
    batchOpen.value = true;
  } finally {
    batching.value = false;
  }
}

/** 重试失败项（验收标准 6） */
async function handleRetry() {
  retrying.value = true;
  try {
    const res = await retryAnalysis(queryParams.value);
    batchResult.value = res.data ?? {};
    batchOpen.value = true;
  } finally {
    retrying.value = false;
  }
}

/** 单条重研判（验收标准 6、7） */
async function handleReanalyze(row: AnalysisRowVO) {
  await ElMessageBox.confirm('确认对该条舆情重新研判？将追加一个新版本结论。', '重新研判', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  });
  const res = await analyzeOne(row.opinionId as string | number, true);
  batchResult.value = res.data ?? {};
  batchOpen.value = true;
}

/**
 * 释放卡住的 processing。
 *
 * 服务端没有「按时间自动回收」的能力（yq_opinion 无认领时间列），
 * 所以必须给研判员一个手动出口 —— 否则一条卡住的行会永久占着 processing。
 */
async function handleRelease() {
  if (selectedIds.value.length === 0) {
    ElMessage.warning('请先勾选要释放的记录');
    return;
  }
  await ElMessageBox.confirm('确认把选中的 ' + selectedIds.value.length + ' 条从「处理中」释放为「待研判」？', '释放卡住', {
    confirmButtonText: '确认释放',
    cancelButtonText: '取消',
    type: 'warning'
  });
  const res = await releaseProcessing(selectedIds.value);
  ElMessage.success('已释放 ' + (res.data ?? 0) + ' 条');
  getList();
}

function afterBatch() {
  batchOpen.value = false;
  getList();
}

async function openModel() {
  modelOpen.value = true;
  modelLoading.value = true;
  try {
    const res = await listModelVersion();
    modelList.value = (res.data ?? []) as ModelVersionVO[];
  } finally {
    modelLoading.value = false;
  }
}

/** 模型版本回滚（验收标准 11）：只切当前生效版本，不动历史结论 */
async function handleRollback(row: ModelVersionVO) {
  const input = await ElMessageBox.prompt('回滚到「' + row.versionName + '」，请填写回滚原因（将写入该版本备注）', '模型版本回滚', {
    confirmButtonText: '确认回滚',
    cancelButtonText: '取消',
    inputValue: ''
  }).catch(() => null);
  if (!input) {
    return;
  }
  const res = await rollbackModelVersion(row.modelVersionId as string | number, (input as any).value);
  ElMessage.success('回滚完成，影响 ' + (res.data ?? 0) + ' 行');
  openModel();
}

onMounted(() => {
  getList();
  optionselectYqTask().then((res: any) => {
    taskOptions.value = res.data ?? [];
  });
  optionselectYqChannel().then((res: any) => {
    channelOptions.value = res.data ?? [];
  });
});
</script>

<style scoped>
.status-bar {
  margin-bottom: 12px;
}
.status-item {
  margin-right: 8px;
  cursor: pointer;
}
.status-tip {
  color: #909399;
  font-size: 12px;
}
.muted {
  color: #c0c4cc;
}
.stage-row {
  margin-top: 4px;
}
.stage-tag {
  margin-right: 4px;
  margin-bottom: 2px;
}
.empty-hints {
  margin: 10px 0;
  color: #909399;
  font-size: 13px;
  text-align: left;
}
.empty-hint-item {
  line-height: 22px;
}
.batch-gap {
  margin-top: 12px;
}
.fail-box {
  margin-top: 12px;
}
.fail-title {
  margin-bottom: 6px;
  font-weight: 600;
}
</style>
