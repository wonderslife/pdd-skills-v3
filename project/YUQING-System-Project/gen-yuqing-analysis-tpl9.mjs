/**
 * F-007 研判 · 模板 9：PC 端视图
 *
 * 产物：
 *   pc/views/yuqing/analysis/index.vue                 研判中心主页面（菜单 component）
 *   pc/views/yuqing/analysis/AnalysisDetailDrawer.vue  研判详情抽屉
 *   pc/views/yuqing/analysis/AnalysisCorrectDialog.vue 人工修正对话框
 *   pc/views/yuqing/analysis/ClusterViewDrawer.vue     事件聚合抽屉
 *
 * 为什么必须补这 4 个视图：yq_menu.sql 里「研判中心」菜单的 component
 * 就是 yuqing/analysis/index，缺文件时菜单点进去是空白页。
 *
 * 渲染口径（安全）：
 *   - 舆情正文、模型主题、摘要、处置建议、变体命中说明**一律纯文本插值**
 *     （{{ }}），全站不使用 v-html —— 这些字段来自大模型与外部采集，
 *     是典型的存储型 XSS 入口。服务端已做白名单净化，前端再断掉 v-html
 *     这条路径，形成两道防线。
 *
 * 铁律：模板串内不得出现裸反引号与 \${，也不得出现真实 CR/TAB
 * （gen-yuqing-analysis.mjs 会硬拦截）。
 */
export const ANALYSIS_TPL9 = [

  /* ------------------------------------------------------------ 研判中心主页面 */
  {
    rel: 'pc/views/yuqing/analysis/index.vue',
    content: `<template>
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
`,
  },

  /* ------------------------------------------------------------ 研判详情抽屉 */
  {
    rel: 'pc/views/yuqing/analysis/AnalysisDetailDrawer.vue',
    content: `<template>
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
`,
  },

  /* ------------------------------------------------------------ 人工修正对话框 */
  {
    rel: 'pc/views/yuqing/analysis/AnalysisCorrectDialog.vue',
    content: `<template>
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
`,
  },

  /* ------------------------------------------------------------ 事件聚合抽屉 */
  {
    rel: 'pc/views/yuqing/analysis/ClusterViewDrawer.vue',
    content: `<template>
  <el-drawer v-model="visible" title="事件传播脉络" size="76%" append-to-body @open="load">
    <div v-loading="loading" class="cluster-body">
      <template v-if="cluster">
        <!-- ============================================ 事件概要（验收标准 4、10） -->
        <el-card shadow="never" class="sec">
          <template #header>
            <div class="sec-head">
              <span>{{ cluster.clusterTitle || '未命名事件' }}</span>
              <el-tag v-if="cluster.clusterId" size="small" type="info">聚合编号 {{ cluster.clusterId }}</el-tag>
            </div>
          </template>
          <el-descriptions :column="3" border size="small">
            <el-descriptions-item label="事件主题">{{ cluster.clusterTopic || '—' }}</el-descriptions-item>
            <el-descriptions-item label="起始时间">{{ cluster.firstTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="最近时间">{{ cluster.lastTime || '—' }}</el-descriptions-item>
            <el-descriptions-item label="舆情条数">{{ cluster.opinionCount || 0 }}</el-descriptions-item>
            <el-descriptions-item label="峰值热度">{{ cluster.peakHeat === null || cluster.peakHeat === undefined ? '—' : cluster.peakHeat }}</el-descriptions-item>
            <el-descriptions-item label="风险等级">
              <dict-tag v-if="cluster.riskLevel" :options="yq_risk_level" :value="cluster.riskLevel" />
              <span v-else>—</span>
            </el-descriptions-item>
          </el-descriptions>

          <!-- 阶段分布：点击某一阶段可只看该阶段的节点 -->
          <div class="stage-bar">
            <span class="stage-label">传播阶段（点击筛选）：</span>
            <el-tag
              v-for="(cnt, key) in cluster.stageCount || {}"
              :key="key"
              size="small"
              effect="plain"
              :type="stageFilter === String(key).toUpperCase() ? 'primary' : 'info'"
              class="stage-item"
              @click="toggleStage(String(key))"
            >
              {{ stageText(key) }} {{ cnt }}
            </el-tag>
            <el-button v-if="stageFilter" link type="primary" @click="stageFilter = ''">清除筛选</el-button>
          </div>
          <el-alert
            v-if="cluster.timelineTruncated"
            title="时间轴节点过多已截断显示，未展示的部分请用「关联舆情」列表查看。"
            type="warning"
            :closable="false"
            class="mb8"
          />
        </el-card>

        <!-- ============================================ 传播时间轴（验收标准 4） -->
        <el-card shadow="never" class="sec">
          <template #header>
            <span>传播时间轴（{{ filteredTimeline.length }} 个节点）</span>
          </template>
          <el-timeline v-if="filteredTimeline.length > 0">
            <el-timeline-item
              v-for="node in filteredTimeline"
              :key="String(node.opinionId) + '-' + node.time"
              :timestamp="node.time"
              :type="stageTimelineType(node.stage)"
              placement="top"
            >
              <div class="tl-item">
                <div class="tl-head">
                  <el-tag size="small" effect="plain" class="tl-stage">{{ stageText(node.stage) }}</el-tag>
                  <el-link v-if="node.opinionUrl" type="primary" :href="node.opinionUrl" target="_blank" class="tl-title">{{ node.title }}</el-link>
                  <span v-else class="tl-title">{{ node.title }}</span>
                </div>
                <div class="tl-meta">
                  <span>{{ node.channelName || '未知渠道' }}</span>
                  <span v-if="node.author"> · {{ node.author }}</span>
                  <span v-if="node.heatScore !== null && node.heatScore !== undefined"> · 热度 {{ node.heatScore }}</span>
                  <span v-if="node.offsetMinutes !== null && node.offsetMinutes !== undefined"> · 距首发 {{ offsetText(node.offsetMinutes) }}</span>
                  <dict-tag v-if="node.sentiAttr" :options="yq_senti_attr" :value="node.sentiAttr" class="tl-dict" />
                  <dict-tag v-if="node.riskLevel" :options="yq_risk_level" :value="node.riskLevel" class="tl-dict" />
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else :image-size="80" :description="stageFilter ? '该阶段暂无节点' : '暂无传播节点'" />
        </el-card>

        <!-- ============================================ 关联舆情 -->
        <el-card v-if="(cluster.opinions || []).length > 0" shadow="never" class="sec">
          <template #header>
            <span>关联舆情（当前可见 {{ (cluster.opinions || []).length }} 条）</span>
          </template>
          <el-table :data="cluster.opinions || []" size="small" border max-height="320">
            <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="220">
              <template #default="scope">
                <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">{{ scope.row.title }}</el-link>
                <span v-else>{{ scope.row.title }}</span>
              </template>
            </el-table-column>
            <el-table-column label="渠道" prop="channelName" width="110" align="center" />
            <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
            <el-table-column label="热度" prop="heatScore" width="75" align="center" />
            <el-table-column label="舆情属性" prop="sentiAttr" width="95" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.sentiAttr" :options="yq_senti_attr" :value="scope.row.sentiAttr" />
              </template>
            </el-table-column>
            <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
              <template #default="scope">
                <dict-tag v-if="scope.row.riskLevel" :options="yq_risk_level" :value="scope.row.riskLevel" />
              </template>
            </el-table-column>
            <el-table-column label="研判状态" prop="analyzeStatus" width="95" align="center">
              <template #default="scope">
                <dict-tag :options="yq_analyze_status" :value="scope.row.analyzeStatus" />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </template>
      <el-empty v-else-if="!loading" :image-size="80" description="未获取到事件信息" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="ClusterViewDrawer">
import { ref, computed, getCurrentInstance } from 'vue';
import { getLedgerCluster } from '@/api/yuqing/ledger';
import type { ClusterViewVO, LedgerTimelineNode } from '@/api/yuqing/ledger/types';

const props = defineProps<{
  modelValue: boolean;
  clusterId?: string | number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const { proxy } = getCurrentInstance() as any;
const { yq_senti_attr, yq_risk_level, yq_analyze_status } = proxy.useDict('yq_senti_attr', 'yq_risk_level', 'yq_analyze_status');

/**
 * 阶段中文名。
 *
 * ⚠ 两处来源的大小写不同，这里统一按大写查表：
 *   - F-007 的 ClusterCard.stageCount 键是大写 FIRST/SPREAD/PEAK/FALL；
 *   - F-016 的传播时间轴节点 stage 是小写 first/spread/peak/fall。
 * 不归一化会出现「分布标签是中文、时间轴标签是英文」的割裂。
 */
const STAGE_LABELS: Record<string, string> = {
  FIRST: '首发',
  SPREAD: '扩散',
  PEAK: '峰值',
  FALL: '回落'
};

const loading = ref(false);
const cluster = ref<ClusterViewVO | null>(null);
const stageFilter = ref('');

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const timeline = computed<LedgerTimelineNode[]>(() => cluster.value?.timeline ?? []);

const filteredTimeline = computed<LedgerTimelineNode[]>(() => {
  const f = stageFilter.value;
  if (!f) {
    return timeline.value;
  }
  return timeline.value.filter((n) => String(n.stage || '').toUpperCase() === f);
});

function stageText(key: string | number | undefined): string {
  if (key === undefined || key === null) {
    return '—';
  }
  const k = String(key).toUpperCase();
  return STAGE_LABELS[k] || String(key);
}

function toggleStage(key: string) {
  const k = key.toUpperCase();
  stageFilter.value = stageFilter.value === k ? '' : k;
}

/** 时间轴节点圆点颜色：首发偏蓝、峰值标红，与「看传播节奏」的直觉一致 */
function stageTimelineType(stage?: string): string {
  const k = String(stage || '').toUpperCase();
  if (k === 'PEAK') {
    return 'danger';
  }
  if (k === 'FIRST') {
    return 'primary';
  }
  if (k === 'FALL') {
    return 'info';
  }
  return 'warning';
}

function offsetText(minutes?: number): string {
  const m = Number(minutes || 0);
  if (m < 60) {
    return m + ' 分钟';
  }
  if (m < 1440) {
    return (m / 60).toFixed(1) + ' 小时';
  }
  return (m / 1440).toFixed(1) + ' 天';
}

async function load() {
  if (props.clusterId === undefined || props.clusterId === null) {
    return;
  }
  loading.value = true;
  stageFilter.value = '';
  try {
    const res = await getLedgerCluster(props.clusterId, { nodeLimit: 200 });
    cluster.value = res.data ?? null;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.cluster-body {
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
.stage-bar {
  margin-top: 12px;
}
.stage-label {
  font-size: 13px;
  color: #606266;
  margin-right: 6px;
}
.stage-item {
  margin-right: 6px;
  cursor: pointer;
}
.tl-item {
  padding-bottom: 4px;
}
.tl-head {
  display: flex;
  align-items: center;
}
.tl-stage {
  margin-right: 8px;
}
.tl-title {
  font-weight: 600;
}
.tl-meta {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
}
.tl-dict {
  margin-left: 6px;
}
</style>
`,
  },
];
