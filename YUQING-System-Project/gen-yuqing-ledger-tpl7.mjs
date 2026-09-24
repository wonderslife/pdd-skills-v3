/**
 * F-016 台账 · 模板 7：PC 端 api 与视图
 *
 * 产物：
 *   pc/api/yuqing/ledger/types.ts                    台账接口类型
 *   pc/api/yuqing/ledger/index.ts                    台账接口
 *   pc/views/yuqing/opinion/index.vue                舆情台账主页面（菜单 component）
 *   pc/views/yuqing/opinion/OpinionDetailDrawer.vue  舆情详情抽屉
 *   pc/views/yuqing/opinion/ClusterTimelineDrawer.vue 事件聚合传播时间轴抽屉
 *   pc/views/yuqing/opinion/ExportLogDialog.vue      导出审计记录对话框
 *
 * 为什么要补 opinion 视图：main 生成器对 opinion 声明了 pcPage:false，
 * 而 yq_menu.sql 里「舆情台账」菜单的 component 就是 yuqing/opinion/index。
 * 缺本文件时菜单点进去是空白页 —— 这是 F-016 必须闭环的一环。
 *
 * 铁律（本项目踩过的坑，务必遵守）：
 *   - types.ts 不得 import PageQuery（全局接口，import 即 TS2305 + TS2339）；
 *   - 凡作为 el-table 行类型的 VO，字段必须全部可选 —— 否则插槽里的
 *     scope.row 传参报 TS2345（DefaultRow 索引签名不满足具名必需属性）；
 *   - AxiosPromise 从 @/utils/api-types，PageResult 从 @/api/types；
 *   - res.data 才是业务数据（AxiosPromise<T> = Promise<RuoYiAjaxResult<T>>）；
 *   - 模板串内不得出现裸反引号与 \${（gen-yuqing-ledger.mjs 会硬拦截）。
 */
export const LEDGER_TPL7 = [

  /* ------------------------------------------------------------ PC api types */
  {
    rel: 'pc/api/yuqing/ledger/types.ts',
    content: `/**
 * 舆情台账 类型定义（F-016）
 *
 * ⚠ 本文件不得 import PageQuery —— 它是全局接口，import 即 TS2305 + TS2339。
 * ⚠ 所有字段可选：本文件里的接口全部会作为 el-table 的行类型，
 *   Element Plus 的 el-table 不是泛型组件，插槽 scope.row 固定为
 *   Record<PropertyKey, any>，字段必需会在 handle(scope.row) 传参处报 TS2345。
 */

/** 台账列表行（对应后端 LedgerRow） */
export interface LedgerRowVO {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  taskName?: string;
  publishTime?: string;
  author?: string;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  heatScore?: number;
  collectSource?: string;
  collectTime?: string;
  analyzeStatus?: string;
  cleanStatus?: string;
  region?: string;
  clusterTitle?: string;
  opinionUrl?: string;
  alertFlag?: string;
  pushFlag?: string;
  clusterId?: string | number;
  /** 检索命中的高亮片段（服务端已转义，可直接 v-html） */
  fragments?: string[];
}

/** 台账分页结果（对应后端 LedgerPage；不使用 PageResult，因为要带 hints/scopeDesc） */
export interface LedgerPageVO {
  rows?: LedgerRowVO[];
  total?: number;
  hints?: string[];
  scopeDesc?: string;
  activeConditions?: number;
  scopeEmpty?: boolean;
}

/** 互动数据快照点 */
export interface LedgerMetricPoint {
  snapshotDate?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  readCount?: number;
  heatScore?: number;
}

/** 研判结论（含历史版本） */
export interface LedgerAnalysisVO {
  analysisId?: string | number;
  topic?: string;
  summary?: string;
  sentiAttr?: string;
  riskAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  tags?: string;
  matchEvidence?: string;
  suggestion?: string;
  confidence?: number;
  modelVersion?: string;
  promptVersion?: string;
  analyzeVersion?: number;
  correctedFlag?: string;
  correctedBy?: string | number;
  correctedTime?: string;
  analyzeTime?: string;
  failReason?: string;
}

/** 预警记录 */
export interface LedgerAlertVO {
  alertId?: string | number;
  alertTitle?: string;
  triggerScene?: string;
  alertLevel?: string;
  triggerValue?: string;
  triggerTime?: string;
  status?: string;
  processRemark?: string;
  processBy?: string | number;
  processByName?: string;
  processTime?: string;
  pushResult?: string;
  ruleName?: string;
}

/** 推送记录 */
export interface LedgerPushVO {
  recordId?: string | number;
  ruleName?: string;
  pushScene?: string;
  pushLevel?: string;
  sendStatus?: string;
  targetIds?: string;
  retryCount?: number;
  failReason?: string;
  sendTime?: string;
  contentDigest?: string;
}

/** 舆情详情（对应后端 LedgerDetail） */
export interface LedgerDetailVO {
  opinionId?: string | number;
  title?: string;
  content?: string;
  opinionUrl?: string;
  urlHash?: string;
  author?: string;
  publishTime?: string;
  region?: string;
  deviceInfo?: string;
  topicTags?: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  readCount?: number;
  heatScore?: number;
  metricTrend?: LedgerMetricPoint[];
  taskId?: string | number;
  taskName?: string;
  channelId?: string | number;
  channelName?: string;
  collectSource?: string;
  collectTime?: string;
  batchNo?: string;
  dupChannelIds?: string;
  cleanStatus?: string;
  noiseReason?: string;
  cleanTime?: string;
  analyzeStatus?: string;
  alertFlag?: string;
  pushFlag?: string;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  tagNames?: string[];
  analysis?: LedgerAnalysisVO;
  analysisHistory?: LedgerAnalysisVO[];
  alerts?: LedgerAlertVO[];
  pushes?: LedgerPushVO[];
  /* ---- 事件聚合块（与后端 LedgerDetail 的「事件聚合块」一一对应） ---- */
  /** 事件聚合ID */
  clusterId?: string | number;
  /** 事件聚合标题 */
  clusterTitle?: string;
}

/** 全文检索命中 */
export interface LedgerSearchHit {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  publishTime?: string;
  sentiAttr?: string;
  riskLevel?: string;
  hitField?: string;
  hitCount?: number;
  fragments?: string[];
  score?: number;
  opinionUrl?: string;
}

/** 全文检索结果 */
export interface LedgerSearchResultVO {
  hits?: LedgerSearchHit[];
  total?: number;
  keyword?: string;
  keywordScope?: string;
  /** inverted-index（Doris 倒排）/ like-scan（镜像库兜底），前端据此标注口径 */
  matchMode?: string;
  hints?: string[];
}

/** 传播时间轴节点 */
export interface LedgerTimelineNode {
  opinionId?: string | number;
  time?: string;
  timeBasis?: string;
  title?: string;
  channelName?: string;
  author?: string;
  sentiAttr?: string;
  riskLevel?: string;
  heatScore?: number;
  opinionUrl?: string;
  /** first / spread / peak / fall */
  stage?: string;
  offsetMinutes?: number;
}

/** 事件聚合视图 */
export interface ClusterViewVO {
  clusterId?: string | number;
  clusterTitle?: string;
  clusterTopic?: string;
  opinionCount?: number;
  firstTime?: string;
  lastTime?: string;
  peakHeat?: number;
  riskLevel?: string;
  stageCount?: Record<string, number>;
  timeline?: LedgerTimelineNode[];
  opinions?: LedgerRowVO[];
  timelineTruncated?: boolean;
}

/** 台账查询参数（与后端 LedgerQuery 一一对应） */
export interface LedgerQueryParams {
  pageNum?: number;
  pageSize?: number;
  collectBeginTime?: string;
  collectEndTime?: string;
  publishBeginTime?: string;
  publishEndTime?: string;
  taskId?: string | number;
  channelId?: string | number;
  sentiAttr?: string;
  riskLevel?: string;
  opinionLevel?: string;
  spreadLevel?: string;
  collectSource?: string;
  cleanStatus?: string;
  analyzeStatus?: string;
  alertFlag?: string;
  tagIds?: Array<string | number>;
  keyword?: string;
  keywordScope?: string;
  clusterId?: string | number;
  orderBy?: string;
  orderDesc?: boolean;
}

/** 导出请求 */
export interface LedgerExportForm {
  query: LedgerQueryParams;
  /** 导出字段（空 = 全部），取值来自接口返回的列目录 */
  columns?: string[];
  /** 是否强制异步 */
  async?: boolean;
  /** 只导前 N 条 */
  rowLimit?: number;
  fileNamePrefix?: string;
  /** ledger / cluster */
  exportScope?: string;
}

/** 导出结果 / 异步任务状态 */
export interface LedgerExportResultVO {
  exportId?: string | number;
  /** sync / async */
  mode?: string;
  /** pending / running / success / failed */
  status?: string;
  rowCount?: number;
  columnCount?: number;
  fileName?: string;
  fileUrl?: string;
  finishTime?: string;
  failReason?: string;
  message?: string;
  syncLimit?: number;
  scopeDesc?: string;
}

/** 导出审计记录 */
export interface LedgerExportLogVO {
  exportId?: string | number;
  exportScope?: string;
  querySummary?: string;
  rowCount?: number;
  columnCount?: number;
  exportMode?: string;
  status?: string;
  fileName?: string;
  fileUrl?: string;
  finishTime?: string;
  failReason?: string;
  operIp?: string;
  createBy?: string | number;
  createTime?: string;
}
`,
  },

  /* ------------------------------------------------------------ PC api */
  {
    rel: 'pc/api/yuqing/ledger/index.ts',
    content: `import request from '@/utils/request';
import type { AxiosPromise } from '@/utils/api-types';
import type { PageResult } from '@/api/types';
import type {
  ClusterViewVO,
  LedgerDetailVO,
  LedgerExportForm,
  LedgerExportLogVO,
  LedgerExportResultVO,
  LedgerPageVO,
  LedgerQueryParams,
  LedgerSearchResultVO
} from './types';

/**
 * 台账组合筛选分页（验收标准 1、2、8、9）
 *
 * 返回体不是标准 PageResult —— 响应里还带 hints（无结果时的放宽建议）、
 * scopeDesc（当前可见范围说明）、scopeEmpty（是否因权限为空），
 * 这些必须与本次查询条件一起回来，否则前端要再发一次请求去问「为什么是空的」。
 */
export const pageLedger = (query?: LedgerQueryParams): AxiosPromise<LedgerPageVO> => {
  return request({
    url: '/yuqing/opinion/list',
    method: 'get',
    params: query
  });
};

/** 舆情详情（验收标准 3） */
export const getLedgerDetail = (opinionId: string | number): AxiosPromise<LedgerDetailVO> => {
  return request({
    url: '/yuqing/opinion/' + opinionId,
    method: 'get'
  });
};

/**
 * 全文检索（验收标准 7）
 *
 * scope: title / content / both；limit 缺省由服务端配置决定。
 */
export const searchLedger = (keyword: string, scope?: string, limit?: number): AxiosPromise<LedgerSearchResultVO> => {
  return request({
    url: '/yuqing/opinion/search',
    method: 'get',
    params: { keyword, scope, limit }
  });
};

/**
 * 导出（验收标准 5、6）
 *
 * 返回体 mode = sync 时直接打开 fileUrl；mode = async 时拿 exportId
 * 轮询 getLedgerExportStatus，完成后同样从 fileUrl 下载。
 */
export const exportLedger = (data: LedgerExportForm): AxiosPromise<LedgerExportResultVO> => {
  return request({
    url: '/yuqing/opinion/export',
    method: 'post',
    data
  });
};

/** 异步导出任务状态（验收标准 6） */
export const getLedgerExportStatus = (exportId: string | number): AxiosPromise<LedgerExportResultVO> => {
  return request({
    url: '/yuqing/opinion/export/' + exportId,
    method: 'get'
  });
};

/** 导出审计记录（验收标准 10） */
export const pageLedgerExportLog = (query?: {
  pageNum?: number;
  pageSize?: number;
  exportScope?: string;
}): AxiosPromise<PageResult<LedgerExportLogVO>> => {
  return request({
    url: '/yuqing/opinion/exportLog/list',
    method: 'get',
    params: query
  });
};

/** 事件聚合视图：事件概要 + 传播时间轴 + 关联舆情（验收标准 4） */
export const getLedgerCluster = (
  clusterId: string | number,
  params?: { nodeLimit?: number; pageNum?: number; pageSize?: number }
): AxiosPromise<ClusterViewVO> => {
  return request({
    url: '/yuqing/cluster/' + clusterId,
    method: 'get',
    params
  });
};

/** 平台字典取值：采集来源等由 dict 提供，这里只在需要时统一导出 */
export const LEDGER_EXPORTABLE_HINT =
  '列顺序由服务端目录固定；未勾选时不传 columns，等同于导出全部可导出字段。';
`,
  },

  /* ------------------------------------------------------------ 台账主页面 */
  {
    rel: 'pc/views/yuqing/opinion/index.vue',
    content: `<template>
  <div class="app-container">
    <!-- 组合筛选（验收标准 1：11 个维度） -->
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
      <el-form-item label="发布时间" prop="publishBeginTime">
        <el-date-picker
          v-model="publishRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="监测任务" prop="taskId">
        <el-select v-model="queryParams.taskId" placeholder="全部任务" clearable filterable style="width: 180px">
          <el-option v-for="t in taskOptions" :key="t.taskId" :label="t.taskName" :value="t.taskId" />
        </el-select>
      </el-form-item>
      <el-form-item label="来源渠道" prop="channelId">
        <el-select v-model="queryParams.channelId" placeholder="全部渠道" clearable filterable style="width: 180px">
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
      <el-form-item label="标签" prop="tagIds">
        <el-select v-model="queryParams.tagIds" multiple collapse-tags clearable placeholder="全部标签" style="width: 200px">
          <el-option v-for="t in tagOptions" :key="t.tagId" :label="t.tagName" :value="t.tagId" />
        </el-select>
      </el-form-item>
      <el-form-item label="采集来源" prop="collectSource">
        <el-select v-model="queryParams.collectSource" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_collect_source" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="清洗状态" prop="cleanStatus">
        <el-select v-model="queryParams.cleanStatus" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_clean_status" :key="d.value" :label="d.label" :value="d.value" />
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
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" @click="openExport" v-hasPermi="['yuqing:opinion:export']">导出Excel</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Tickets" @click="openExportLog" v-hasPermi="['yuqing:opinion:export']">导出记录</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button plain icon="Search" @click="openFullText">全文检索</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <!-- 数据范围说明（验收标准 8：让用户知道自己看到的是授权范围内的数据） -->
    <el-alert
      v-if="scopeDesc"
      :title="'当前数据范围：' + scopeDesc + '（已启用 ' + activeConditions + ' 个筛选条件）'"
      type="info"
      :closable="false"
      class="mb8"
    />

    <el-table v-loading="loading" :data="opinionList" @selection-change="handleSelectionChange" border>
      <el-table-column type="selection" width="45" align="center" />
      <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="260">
        <template #default="scope">
          <el-link v-if="scope.row.opinionUrl" type="primary" :href="scope.row.opinionUrl" target="_blank">
            {{ scope.row.title }}
          </el-link>
          <span v-else>{{ scope.row.title }}</span>
        </template>
      </el-table-column>
      <el-table-column label="来源渠道" prop="channelName" :show-overflow-tooltip="true" width="130" />
      <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
      <el-table-column label="发布作者" prop="author" :show-overflow-tooltip="true" width="120" />
      <el-table-column label="舆情属性" prop="sentiAttr" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_senti_attr" :value="scope.row.sentiAttr" />
        </template>
      </el-table-column>
      <el-table-column label="风险等级" prop="riskLevel" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_risk_level" :value="scope.row.riskLevel" />
        </template>
      </el-table-column>
      <el-table-column label="分级" prop="opinionLevel" width="90" align="center">
        <template #default="scope">
          <dict-tag :options="yq_opinion_level" :value="scope.row.opinionLevel" />
        </template>
      </el-table-column>
      <el-table-column label="热度" prop="heatScore" width="80" align="center" sortable="custom" />
      <el-table-column label="采集时间" prop="collectTime" width="160" align="center" />
      <el-table-column label="研判状态" prop="analyzeStatus" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_analyze_status" :value="scope.row.analyzeStatus" />
        </template>
      </el-table-column>
      <el-table-column label="标记" width="110" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.alertFlag === '1'" size="small" type="danger">已预警</el-tag>
          <el-tag v-if="scope.row.pushFlag === '1'" size="small" type="warning" style="margin-left: 4px">已推送</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="openDetail(scope.row)" v-hasPermi="['yuqing:opinion:query']">详情</el-button>
          <el-button
            v-if="scope.row.clusterId"
            link
            type="primary"
            icon="Connection"
            @click="openCluster(scope.row)"
            v-hasPermi="['yuqing:opinion:query']"
          >
            事件
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态（验收标准 9）：给出可放宽的筛选建议，而不是一句「暂无数据」 -->
    <el-empty v-if="!loading && total === 0" :image-size="90" :description="emptyTitle">
      <div class="empty-hints">
        <div v-for="(h, i) in hints" :key="i" class="empty-hint-item">{{ i + 1 }}. {{ h }}</div>
      </div>
      <el-button v-if="!scopeEmpty" type="primary" plain @click="resetQuery">清空筛选条件</el-button>
    </el-empty>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 详情抽屉 -->
    <OpinionDetailDrawer v-model="detailOpen" :opinion-id="activeOpinionId" />

    <!-- 事件聚合抽屉 -->
    <ClusterTimelineDrawer v-model="clusterOpen" :cluster-id="activeClusterId" />

    <!-- 导出记录 -->
    <ExportLogDialog v-model="exportLogOpen" />

    <!-- 导出对话框（验收标准 5：条数与字段范围可配置） -->
    <el-dialog v-model="exportOpen" title="导出台账" width="640px" append-to-body>
      <el-alert
        :title="'当前筛选条件将导出约 ' + total + ' 条；超过 ' + syncLimit + ' 条将自动转为后台导出任务。'"
        type="info"
        :closable="false"
        class="mb8"
      />
      <el-form label-width="110px">
        <el-form-item label="导出字段">
          <div class="col-box">
            <el-checkbox-group v-model="exportForm.columns">
              <el-checkbox v-for="c in columnOptions" :key="c.field" :value="c.field">{{ c.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
          <div class="tip">不勾选则导出全部 {{ columnOptions.length }} 列。</div>
        </el-form-item>
        <el-form-item label="导出条数">
          <el-radio-group v-model="rowLimitMode">
            <el-radio value="all">全部（最多 {{ maxExportRows }} 条）</el-radio>
            <el-radio value="limit">只导前</el-radio>
          </el-radio-group>
          <el-input-number v-if="rowLimitMode === 'limit'" v-model="exportForm.rowLimit" :min="1" :max="maxExportRows" style="width: 150px; margin-left: 8px" />
        </el-form-item>
        <el-form-item label="强制异步">
          <el-switch v-model="exportForm.async" />
          <span class="tip">开启后立即返回，完成后在「导出记录」中下载。</span>
        </el-form-item>
        <el-form-item label="文件名前缀">
          <el-input v-model="exportForm.fileNamePrefix" placeholder="默认「舆情台账」" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportOpen = false">取消</el-button>
        <el-button type="primary" :loading="exporting" @click="submitExport">开始导出</el-button>
      </template>
    </el-dialog>

    <!-- 全文检索（验收标准 7） -->
    <el-dialog v-model="searchOpen" title="全文检索" width="860px" append-to-body>
      <el-form :inline="true">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="标题或正文关键词" clearable style="width: 240px" @keyup.enter="doSearch" />
        </el-form-item>
        <el-form-item label="范围">
          <el-select v-model="searchForm.scope" style="width: 130px">
            <el-option label="标题+正文" value="both" />
            <el-option label="仅标题" value="title" />
            <el-option label="仅正文" value="content" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" :loading="searching" @click="doSearch">检索</el-button>
        </el-form-item>
      </el-form>
      <el-alert v-if="searchResult.matchMode" :title="matchModeText" type="info" :closable="false" class="mb8" />
      <el-table :data="searchResult.hits || []" max-height="380" border>
        <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="200" />
        <el-table-column label="命中" prop="hitField" width="90" align="center">
          <template #default="scope">
            <el-tag size="small" type="info">{{ hitFieldText(scope.row.hitField) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="命中片段" min-width="320">
          <template #default="scope">
            <!-- fragments 由服务端先转义后标记，直接渲染是安全的 -->
            <div v-for="(f, i) in scope.row.fragments || []" :key="i" class="frag" v-html="f"></div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)" v-hasPermi="['yuqing:opinion:query']">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="searched && (searchResult.hits || []).length === 0" :description="searchEmptyText" :image-size="80" />
      <template #footer>
        <el-button @click="searchOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="YuqingOpinion">
import { ref, reactive, toRefs, computed, onMounted, getCurrentInstance } from 'vue';
import { ElMessage } from 'element-plus';
import { pageLedger, searchLedger, exportLedger, getLedgerExportStatus } from '@/api/yuqing/ledger';
import type { LedgerQueryParams, LedgerRowVO, LedgerSearchResultVO } from '@/api/yuqing/ledger/types';
import { optionselectYqTask } from '@/api/yuqing/task';
import { optionselectYqChannel } from '@/api/yuqing/channel';
import { listYqTag } from '@/api/yuqing/tag';
import OpinionDetailDrawer from './OpinionDetailDrawer.vue';
import ClusterTimelineDrawer from './ClusterTimelineDrawer.vue';
import ExportLogDialog from './ExportLogDialog.vue';

const { proxy } = getCurrentInstance() as any;
const {
  yq_senti_attr,
  yq_risk_level,
  yq_opinion_level,
  yq_spread_level,
  yq_collect_source,
  yq_clean_status,
  yq_analyze_status
} = proxy.useDict(
  'yq_senti_attr',
  'yq_risk_level',
  'yq_opinion_level',
  'yq_spread_level',
  'yq_collect_source',
  'yq_clean_status',
  'yq_analyze_status'
);

/** 导出上限的服务端口径（前端只做提示，真正的钳制在服务端） */
const syncLimit = ref(5000);
const maxExportRows = ref(200000);

/** 与后端 LedgerColumnCatalog 的字段名保持一致；标签文案与 @ExcelProperty 一致 */
const columnOptions = ref<Array<{ field: string; label: string }>>([
  { field: 'opinionId', label: '编号' },
  { field: 'title', label: '舆情标题' },
  { field: 'channelName', label: '来源渠道' },
  { field: 'taskName', label: '所属任务' },
  { field: 'publishTime', label: '发布时间' },
  { field: 'author', label: '发布作者' },
  { field: 'sentiAttr', label: '舆情属性' },
  { field: 'riskLevel', label: '风险等级' },
  { field: 'opinionLevel', label: '舆情分级' },
  { field: 'heatScore', label: '热度' },
  { field: 'collectSource', label: '采集来源' },
  { field: 'collectTime', label: '采集时间' },
  { field: 'analyzeStatus', label: '研判状态' },
  { field: 'cleanStatus', label: '清洗状态' },
  { field: 'region', label: '发布地域' },
  { field: 'clusterTitle', label: '关联事件' },
  { field: 'opinionUrl', label: '原文链接' }
]);

const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const hints = ref<string[]>([]);
const scopeDesc = ref('');
const activeConditions = ref(0);
const scopeEmpty = ref(false);
const opinionList = ref<LedgerRowVO[]>([]);
const taskOptions = ref<any[]>([]);
const channelOptions = ref<any[]>([]);
const tagOptions = ref<any[]>([]);

const collectRange = ref<string[]>([]);
const publishRange = ref<string[]>([]);

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    collectBeginTime: undefined,
    collectEndTime: undefined,
    publishBeginTime: undefined,
    publishEndTime: undefined,
    taskId: undefined,
    channelId: undefined,
    sentiAttr: undefined,
    riskLevel: undefined,
    opinionLevel: undefined,
    spreadLevel: undefined,
    collectSource: undefined,
    cleanStatus: undefined,
    analyzeStatus: undefined,
    tagIds: [],
    keyword: undefined,
    orderBy: undefined,
    orderDesc: true
  } as LedgerQueryParams
});
const { queryParams } = toRefs(data);

const detailOpen = ref(false);
const clusterOpen = ref(false);
const exportLogOpen = ref(false);
const exportOpen = ref(false);
const exporting = ref(false);
const searchOpen = ref(false);
const searching = ref(false);
const searched = ref(false);
const activeOpinionId = ref<string | number>('');
const activeClusterId = ref<string | number>('');

const exportForm = reactive({
  columns: [] as string[],
  async: false,
  rowLimit: 1000,
  fileNamePrefix: ''
});
const rowLimitMode = ref<'all' | 'limit'>('all');

const searchForm = reactive({ keyword: '', scope: 'both' });
const searchResult = ref<LedgerSearchResultVO>({});

const emptyTitle = computed(() => {
  if (scopeEmpty.value) {
    return '没有授权给当前账号的舆情数据';
  }
  return '没有查询到符合条件的舆情';
});

const matchModeText = computed(() => {
  if (searchResult.value.matchMode === 'inverted-index') {
    return '检索口径：Doris 倒排索引';
  }
  return '检索口径：镜像库模糊扫描（未启用倒排索引，结果可能与正式检索存在差异）';
});

const searchEmptyText = computed(() => {
  const hs = searchResult.value.hints || [];
  return hs.length > 0 ? hs[0] : '没有命中结果，可尝试更短的词根或切换检索范围';
});

/** 查询列表（验收标准 1、2、8、9） */
async function getList() {
  loading.value = true;
  try {
    /* 时间区间控件与后端的两个字段之间做一次搬运，避免把区间数组直接发给后端 */
    queryParams.value.collectBeginTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[0] : undefined;
    queryParams.value.collectEndTime = collectRange.value && collectRange.value.length === 2 ? collectRange.value[1] : undefined;
    queryParams.value.publishBeginTime = publishRange.value && publishRange.value.length === 2 ? publishRange.value[0] : undefined;
    queryParams.value.publishEndTime = publishRange.value && publishRange.value.length === 2 ? publishRange.value[1] : undefined;

    const res = await pageLedger(queryParams.value);
    const page = res.data;
    opinionList.value = page?.rows ?? [];
    total.value = page?.total ?? 0;
    hints.value = page?.hints ?? [];
    scopeDesc.value = page?.scopeDesc ?? '';
    activeConditions.value = page?.activeConditions ?? 0;
    scopeEmpty.value = page?.scopeEmpty ?? false;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  collectRange.value = [];
  publishRange.value = [];
  queryParams.value = {
    pageNum: 1,
    pageSize: queryParams.value.pageSize,
    tagIds: [],
    orderDesc: true
  } as LedgerQueryParams;
  getList();
}

function handleSelectionChange() {
  /* 台账当前没有批量操作（写操作归研判/预警链路），保留钩子以便后续扩展 */
}

async function loadOptions() {
  try {
    const [t, c, g] = await Promise.all([
      optionselectYqTask({}),
      optionselectYqChannel({}),
      listYqTag({ pageNum: 1, pageSize: 200 })
    ]);
    taskOptions.value = t.data ?? [];
    channelOptions.value = c.data ?? [];
    tagOptions.value = g.data?.rows ?? [];
  } catch (e) {
    /* 下拉选项加载失败不应阻断台账本身，列表依旧可查 */
  }
}

function openDetail(row: any) {
  if (!row || row.opinionId === undefined || row.opinionId === null) {
    return;
  }
  activeOpinionId.value = row.opinionId;
  detailOpen.value = true;
}

function openCluster(row: any) {
  if (!row || row.clusterId === undefined || row.clusterId === null) {
    return;
  }
  activeClusterId.value = row.clusterId;
  clusterOpen.value = true;
}

function openExport() {
  exportForm.columns = [];
  exportForm.async = false;
  exportForm.rowLimit = Math.min(total.value > 0 ? total.value : 1000, maxExportRows.value);
  exportForm.fileNamePrefix = '';
  rowLimitMode.value = 'all';
  exportOpen.value = true;
}

/** 导出（验收标准 5、6） */
async function submitExport() {
  exporting.value = true;
  try {
    const res = await exportLedger({
      query: { ...queryParams.value, pageNum: undefined, pageSize: undefined },
      columns: exportForm.columns.length > 0 ? exportForm.columns : undefined,
      async: exportForm.async || undefined,
      rowLimit: rowLimitMode.value === 'limit' ? exportForm.rowLimit : undefined,
      fileNamePrefix: exportForm.fileNamePrefix || undefined,
      exportScope: 'ledger'
    });
    const r = res.data;
    if (!r) {
      ElMessage.error('导出未返回结果');
      return;
    }
    if (r.mode === 'sync' && r.fileUrl) {
      /* 同步导出：直接下载，不阻塞页面 */
      downloadByUrl(r.fileUrl, r.fileName);
      ElMessage.success(r.message || '导出完成');
      exportOpen.value = false;
      return;
    }
    exportOpen.value = false;
    ElMessage.info(r.message || '已转为后台导出任务');
    pollExport(r.exportId);
  } finally {
    exporting.value = false;
  }
}

/** 异步导出轮询（验收标准 6：完成后推送下载链接，这里给出页面内的兜底获取方式） */
let pollTimer: any = null;
function pollExport(exportId: string | number | undefined) {
  if (exportId === undefined || exportId === null) {
    return;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  let tries = 0;
  pollTimer = setInterval(async () => {
    tries += 1;
    try {
      const res = await getLedgerExportStatus(exportId);
      const r = res.data;
      if (!r) {
        return;
      }
      if (r.status === 'success' && r.fileUrl) {
        clearInterval(pollTimer);
        pollTimer = null;
        ElMessage.success('后台导出已完成，正在下载');
        downloadByUrl(r.fileUrl, r.fileName);
      } else if (r.status === 'failed') {
        clearInterval(pollTimer);
        pollTimer = null;
        ElMessage.error('后台导出失败：' + (r.failReason || '未知原因'));
      }
    } catch (e) {
      /* 轮询期间的网络抖动不终止任务，下一轮继续 */
    }
    if (tries >= 60 && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
      ElMessage.warning('导出任务仍在进行，请稍后在「导出记录」中查看');
    }
  }, 3000);
}

function downloadByUrl(url: string, fileName?: string) {
  const a = document.createElement('a');
  a.href = url;
  if (fileName) {
    a.download = fileName;
  }
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openExportLog() {
  exportLogOpen.value = true;
}

function openFullText() {
  searchForm.keyword = queryParams.value.keyword || '';
  searchForm.scope = 'both';
  searchResult.value = {};
  searched.value = false;
  searchOpen.value = true;
}

async function doSearch() {
  if (!searchForm.keyword || !searchForm.keyword.trim()) {
    ElMessage.warning('请输入检索关键词');
    return;
  }
  searching.value = true;
  try {
    const res = await searchLedger(searchForm.keyword.trim(), searchForm.scope);
    searchResult.value = res.data ?? {};
    searched.value = true;
  } finally {
    searching.value = false;
  }
}

function hitFieldText(v?: string) {
  if (v === 'title') {
    return '标题';
  }
  if (v === 'content') {
    return '正文';
  }
  if (v === 'both') {
    return '标题+正文';
  }
  return '—';
}

onMounted(() => {
  loadOptions();
  getList();
});
</script>

<style scoped>
.mb8 {
  margin-bottom: 8px;
}
.tip {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.col-box {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: 6px 10px;
  width: 100%;
}
.empty-hints {
  text-align: left;
  max-width: 640px;
  margin: 12px auto 16px;
}
.empty-hint-item {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 22px;
}
.frag {
  font-size: 12px;
  line-height: 20px;
  color: var(--el-text-color-regular);
}
:deep(.yq-hit) {
  color: var(--el-color-danger);
  font-style: normal;
  font-weight: 600;
  background: var(--el-color-danger-light-9);
  padding: 0 2px;
  border-radius: 2px;
}
</style>
`,
  },

  /* ------------------------------------------------------------ 详情抽屉 */
  {
    rel: 'pc/views/yuqing/opinion/OpinionDetailDrawer.vue',
    content: `<template>
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
`,
  },

  /* ------------------------------------------------------------ 事件聚合时间轴 */
  {
    rel: 'pc/views/yuqing/opinion/ClusterTimelineDrawer.vue',
    content: `<template>
  <el-drawer v-model="visible" :title="view.clusterTitle || '事件聚合'" size="58%" append-to-body>
    <div v-loading="loading">
      <el-descriptions :column="3" size="small" border class="mb12">
        <el-descriptions-item label="关联舆情">{{ view.opinionCount ?? 0 }} 条</el-descriptions-item>
        <el-descriptions-item label="首次出现">{{ view.firstTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="最后出现">{{ view.lastTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="峰值热度">{{ view.peakHeat ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="风险等级">
          <dict-tag :options="yq_risk_level" :value="view.riskLevel" />
        </el-descriptions-item>
        <el-descriptions-item label="阶段分布">
          <el-tag v-for="s in stageRows" :key="s.stage" size="small" class="mr4">
            {{ s.label }} {{ s.count }}
          </el-tag>
          <span v-if="stageRows.length === 0">—</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="view.timelineTruncated"
        title="关联舆情较多，时间轴仅展示前若干节点；完整列表见下方表格。"
        type="warning"
        :closable="false"
        class="mb12"
      />

      <el-card shadow="never" class="mb12">
        <template #header><span class="blk-title">传播脉络</span></template>
        <el-timeline>
          <el-timeline-item
            v-for="n in view.timeline || []"
            :key="n.opinionId"
            :timestamp="n.time + '（' + basisText(n.timeBasis) + '）'"
            :type="stageType(n.stage)"
            placement="top"
          >
            <div class="node">
              <el-tag size="small" :type="stageType(n.stage)">{{ stageText(n.stage) }}</el-tag>
              <el-link v-if="n.opinionUrl" type="primary" :href="n.opinionUrl" target="_blank" class="node-title">
                {{ n.title }}
              </el-link>
              <span v-else class="node-title">{{ n.title }}</span>
              <span class="node-meta">
                {{ n.channelName || '—' }} / {{ n.author || '匿名' }} / 热度 {{ n.heatScore ?? '—' }}
              </span>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-if="(view.timeline || []).length === 0" description="暂无时间轴数据" :image-size="60" />
      </el-card>

      <el-card shadow="never">
        <template #header><span class="blk-title">关联舆情</span></template>
        <el-table :data="view.opinions || []" size="small" max-height="320" border>
          <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="220" />
          <el-table-column label="渠道" prop="channelName" width="120" />
          <el-table-column label="发布时间" prop="publishTime" width="160" align="center" />
          <el-table-column label="属性" prop="sentiAttr" width="90" align="center">
            <template #default="scope">
              <dict-tag :options="yq_senti_attr" :value="scope.row.sentiAttr" />
            </template>
          </el-table-column>
          <el-table-column label="热度" prop="heatScore" width="75" align="center" />
        </el-table>
      </el-card>
    </div>
  </el-drawer>
</template>

<script setup lang="ts" name="ClusterTimelineDrawer">
import { ref, watch, computed, getCurrentInstance } from 'vue';
import { getLedgerCluster } from '@/api/yuqing/ledger';
import type { ClusterViewVO } from '@/api/yuqing/ledger/types';

const props = defineProps<{ modelValue: boolean; clusterId?: string | number }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const { proxy } = getCurrentInstance() as any;
const { yq_risk_level, yq_senti_attr } = proxy.useDict('yq_risk_level', 'yq_senti_attr');

const visible = ref(props.modelValue);
const loading = ref(false);
const view = ref<ClusterViewVO>({});

/** 把 stageCount 这个 Map 摊平成数组，避免在模板里做类型断言 */
const stageRows = computed(() => {
  const m = view.value.stageCount || {};
  const order = ['first', 'spread', 'peak', 'fall'];
  const rows: Array<{ stage: string; label: string; count: number }> = [];
  for (const k of order) {
    if (m[k] !== undefined) {
      rows.push({ stage: k, label: stageText(k), count: m[k] });
    }
  }
  for (const k of Object.keys(m)) {
    if (order.indexOf(k) < 0) {
      rows.push({ stage: k, label: stageText(k), count: m[k] });
    }
  }
  return rows;
});

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
  () => props.clusterId,
  () => {
    if (visible.value) {
      load();
    }
  }
);

async function load() {
  if (props.clusterId === undefined || props.clusterId === null || props.clusterId === '') {
    return;
  }
  loading.value = true;
  try {
    const res = await getLedgerCluster(props.clusterId, { pageNum: 1, pageSize: 50 });
    view.value = res.data ?? {};
  } finally {
    loading.value = false;
  }
}

function stageText(s?: string) {
  if (s === 'first') {
    return '首发';
  }
  if (s === 'spread') {
    return '扩散';
  }
  if (s === 'peak') {
    return '峰值';
  }
  if (s === 'fall') {
    return '回落';
  }
  return '—';
}

function stageType(s?: string) {
  if (s === 'first') {
    return 'primary';
  }
  if (s === 'peak') {
    return 'danger';
  }
  if (s === 'spread') {
    return 'warning';
  }
  return 'info';
}

function basisText(b?: string) {
  if (b === 'publish') {
    return '发布时间';
  }
  if (b === 'collect') {
    return '采集时间';
  }
  return b || '时间';
}
</script>

<style scoped>
.mb12 {
  margin-bottom: 12px;
}
.blk-title {
  font-weight: 600;
}
.node-title {
  margin: 0 6px;
  font-weight: 500;
}
.node-meta {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.mr4 {
  margin-right: 4px;
}
</style>
`,
  },

  /* ------------------------------------------------------------ 导出审计记录 */
  {
    rel: 'pc/views/yuqing/opinion/ExportLogDialog.vue',
    content: `<template>
  <el-dialog v-model="visible" title="导出台账记录（审计）" width="900px" append-to-body>
    <el-form :inline="true">
      <el-form-item label="导出范围">
        <el-select v-model="query.exportScope" placeholder="全部" clearable style="width: 150px">
          <el-option label="台账" value="ledger" />
          <el-option label="事件聚合" value="cluster" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" border max-height="420">
      <el-table-column label="导出时间" prop="createTime" width="165" align="center" />
      <el-table-column label="范围" prop="exportScope" width="90" align="center">
        <template #default="scope">
          <el-tag size="small" type="info">{{ scopeText(scope.row.exportScope) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="筛选条件" prop="querySummary" :show-overflow-tooltip="true" min-width="240" />
      <el-table-column label="条数" prop="rowCount" width="80" align="center" />
      <el-table-column label="列数" prop="columnCount" width="70" align="center" />
      <el-table-column label="方式" prop="exportMode" width="80" align="center">
        <template #default="scope">
          <el-tag size="small" :type="scope.row.exportMode === 'async' ? 'warning' : 'success'">
            {{ scope.row.exportMode === 'async' ? '异步' : '同步' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="90" align="center">
        <template #default="scope">
          <el-tag size="small" :type="statusType(scope.row.status)">{{ statusText(scope.row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="IP" prop="operIp" width="120" align="center" />
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="scope">
          <el-button v-if="scope.row.fileUrl" link type="primary" @click="download(scope.row)">下载</el-button>
          <el-tooltip v-else-if="scope.row.failReason" :content="scope.row.failReason" placement="top">
            <span class="fail">失败</span>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="query.pageNum"
      v-model:limit="query.pageSize"
      @pagination="getList"
    />
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="ExportLogDialog">
import { ref, reactive, toRefs, watch } from 'vue';
import { pageLedgerExportLog } from '@/api/yuqing/ledger';
import type { LedgerExportLogVO } from '@/api/yuqing/ledger/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const visible = ref(props.modelValue);
const loading = ref(false);
const total = ref(0);
const list = ref<LedgerExportLogVO[]>([]);

const data = reactive({
  query: { pageNum: 1, pageSize: 10, exportScope: undefined as string | undefined }
});
const { query } = toRefs(data);

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v;
    if (v) {
      query.value.pageNum = 1;
      getList();
    }
  }
);
watch(visible, (v) => emit('update:modelValue', v));

async function getList() {
  loading.value = true;
  try {
    const res = await pageLedgerExportLog(query.value);
    list.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

function handleQuery() {
  query.value.pageNum = 1;
  getList();
}

function resetQuery() {
  query.value = { pageNum: 1, pageSize: 10, exportScope: undefined };
  getList();
}

function scopeText(v?: string) {
  return v === 'cluster' ? '事件聚合' : '台账';
}

function statusText(v?: string) {
  if (v === 'success') {
    return '成功';
  }
  if (v === 'failed') {
    return '失败';
  }
  if (v === 'running') {
    return '导出中';
  }
  return '排队中';
}

function statusType(v?: string) {
  if (v === 'success') {
    return 'success';
  }
  if (v === 'failed') {
    return 'danger';
  }
  return 'warning';
}

function download(row: any) {
  const a = document.createElement('a');
  a.href = row.fileUrl;
  if (row.fileName) {
    a.download = row.fileName;
  }
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
</script>

<style scoped>
.fail {
  color: var(--el-color-danger);
  font-size: 12px;
}
</style>
`,
  },
];
