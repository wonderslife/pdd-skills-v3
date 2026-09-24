/**
 * F-014 日报生成 · 模板分片 5/5
 * 归属：PC 端 api + views + 离线自测
 *
 * 产物：
 *   pc/api/yuqing/report/index.ts
 *   pc/api/yuqing/report/types.ts
 *   pc/views/yuqing/report/index.vue
 *   test/java/org/dromara/yuqing/report/F014ReportTest.java
 *
 * ⚠ 主生成器已产 pc/api/yuqing/report/{index.ts,types.ts} 的基础 CRUD。
 *   本生成器**接管覆盖**这两个文件（在主生成器里 report 声明了
 *   ctrl:false / pcPage:false，即前端 api 的生成也被让出）。
 *   deploy 时会显示「~2 覆盖」，属预期。
 *
 * ⚠ 三层转义：Vue/TS 产物严禁出现反引号与 \${，模板串一律用单引号拼接。
 */
export const REPORT_TPL5 = [
  /* ------------------------------------------------------------ PC api types */
  {
    rel: 'pc/api/yuqing/report/types.ts',
    content: `/**
 * 舆情报告 类型定义（F-014）
 *
 * ⚠ 本文件不得 import PageQuery —— 它是全局接口，import 即 TS2305 + TS2339。
 */
export interface YqReportVO {
  reportId?: string | number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  templateId?: string | number;
  templateName?: string;
  triggerType?: string;
  content?: string;
  fileUrl?: string;
  fileFormat?: string;
  version?: number;
  status?: string;
  submitStatus?: string;
  submitBy?: string | number;
  submitByName?: string;
  submitTime?: string;
  failReason?: string;
  opinionCount?: number;
  createTime?: string;
}

export interface YqReportForm {
  reportId?: string | number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  templateId?: string | number;
  triggerType?: string;
  content?: string;
  fileUrl?: string;
  fileFormat?: string;
  version?: number;
  status?: string;
  failReason?: string;
}

export interface YqReportQuery {
  pageNum?: number;
  pageSize?: number;
  reportName?: string;
  reportType?: string;
  reportDate?: string;
  status?: string;
  submitStatus?: string;
}

/** 生成请求 */
export interface ReportGenerateForm {
  reportType: string;
  reportDate: string;
  templateId?: string | number;
  reportName?: string;
  overwrite?: boolean;
  pushAfter?: boolean;
}

/** 生成结果 */
export interface ReportGenerateResult {
  reportId?: string | number;
  reportName?: string;
  status?: string;
  version?: number;
  fileUrl?: string;
  fileFormat?: string;
  failReason?: string;
  opinionCount?: number;
  contentLength?: number;
  generatedAt?: string;
  notices?: string[];
}

/** 报告纳入的舆情条目 */
export interface ReportOpinionRow {
  opinionId?: string | number;
  title?: string;
  channelName?: string;
  sentiAttr?: string;
  riskLevel?: string;
  heatScore?: number;
  readCount?: number;
  shareCount?: number;
  commentCount?: number;
  opinionUrl?: string;
  publishTime?: string;
}

/** 条目增删请求 */
export interface ReportOpinionForm {
  reportId: string | number;
  addOpinionIds?: Array<string | number>;
  removeOpinionIds?: Array<string | number>;
  remark?: string;
}
`,
  },

  /* ------------------------------------------------------------ PC api index */
  {
    rel: 'pc/api/yuqing/report/index.ts',
    content: `import request from '@/utils/request';
import type { AxiosPromise } from '@/utils/api-types';
import type { PageResult } from '@/api/types';
import type {
  ReportGenerateForm,
  ReportGenerateResult,
  ReportOpinionForm,
  ReportOpinionRow,
  YqReportForm,
  YqReportQuery,
  YqReportVO
} from './types';

/** 查询舆情报告列表 */
export const listYqReport = (query?: YqReportQuery): AxiosPromise<PageResult<YqReportVO>> => {
  return request({
    url: '/yuqing/report/list',
    method: 'get',
    params: query
  });
};

/** 查询舆情报告下拉选项 */
export const optionselectYqReport = (query?: YqReportQuery): AxiosPromise<YqReportVO[]> => {
  return request({
    url: '/yuqing/report/optionselect',
    method: 'get',
    params: query
  });
};

/** 获取舆情报告详情 */
export const getYqReport = (reportId: string | number): AxiosPromise<YqReportVO> => {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'get'
  });
};

/** 新增舆情报告 */
export const addYqReport = (data: YqReportForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report',
    method: 'post',
    data
  });
};

/** 修改舆情报告 */
export const updateYqReport = (data: YqReportForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report',
    method: 'put',
    data
  });
};

/** 删除舆情报告 */
export const delYqReport = (reportId: string | number | Array<string | number>): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/' + reportId,
    method: 'delete'
  });
};

/** 生成报告（验收标准 1 / 2 / 10） */
export const generateYqReport = (data: ReportGenerateForm): AxiosPromise<ReportGenerateResult> => {
  return request({
    url: '/yuqing/report/generate',
    method: 'post',
    data
  });
};

/** 重新生成（验收标准 7） */
export const regenerateYqReport = (
  reportId: string | number,
  keepVersions = true
): AxiosPromise<ReportGenerateResult> => {
  return request({
    url: '/yuqing/report/regenerate/' + reportId,
    method: 'post',
    params: { keepVersions }
  });
};

/** 查询报告纳入的舆情条目（验收标准 3） */
export const listReportOpinions = (reportId: string | number): AxiosPromise<ReportOpinionRow[]> => {
  return request({
    url: '/yuqing/report/opinions/' + reportId,
    method: 'get'
  });
};

/** 增删报告舆情条目（验收标准 3） */
export const adjustReportOpinions = (data: ReportOpinionForm): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/opinions',
    method: 'put',
    data
  });
};

/** 提交报告（验收标准 11） */
export const submitYqReport = (
  reportId: string | number,
  submitTarget?: string
): AxiosPromise<void> => {
  return request({
    url: '/yuqing/report/submit/' + reportId,
    method: 'post',
    params: { submitTarget }
  });
};

/** 推送报告到企业微信（验收标准 6） */
export const pushYqReport = (reportId: string | number): AxiosPromise<any> => {
  return request({
    url: '/yuqing/report/push/' + reportId,
    method: 'post'
  });
};

/** 导出报告文件下载链接（验收标准 5） */
export const exportReportUrl = (reportId: string | number, format = 'docx'): string => {
  return import.meta.env.VITE_APP_BASE_API + '/yuqing/report/export/' + reportId + '?format=' + format;
};
`,
  },

  /* ------------------------------------------------------------ PC 页面 */
  {
    rel: 'pc/views/yuqing/report/index.vue',
    content: `<template>
  <div class="app-container">
    <el-form v-show="showSearch" ref="queryRef" :model="queryParams" :inline="true">
      <el-form-item label="报告名称" prop="reportName">
        <el-input v-model="queryParams.reportName" placeholder="请输入报告名称" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="报告类型" prop="reportType">
        <el-select v-model="queryParams.reportType" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_report_type" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="归属日期" prop="reportDate">
        <el-date-picker v-model="queryParams.reportDate" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" clearable style="width: 160px" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_report_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="提交状态" prop="submitStatus">
        <el-select v-model="queryParams.submitStatus" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="d in yq_report_submit_status" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="openGenerate" v-hasPermi="['yuqing:report:generate']">生成日报</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate" v-hasPermi="['yuqing:report:edit']">修改</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple" @click="handleDelete" v-hasPermi="['yuqing:report:remove']">删除</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="warning" plain icon="Download" :disabled="single" @click="handleExportFile()" v-hasPermi="['yuqing:report:export']">导出文件</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="reportList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="50" align="center" />
      <el-table-column label="报告名称" prop="reportName" :show-overflow-tooltip="true" min-width="200" />
      <el-table-column label="类型" prop="reportType" width="90" align="center">
        <template #default="scope">
          <dict-tag :options="yq_report_type" :value="scope.row.reportType" />
        </template>
      </el-table-column>
      <el-table-column label="归属日期" prop="reportDate" width="110" align="center" />
      <el-table-column label="使用模板" prop="templateName" :show-overflow-tooltip="true" width="150" />
      <el-table-column label="生成方式" prop="triggerType" width="95" align="center">
        <template #default="scope">
          <dict-tag :options="yq_report_trigger" :value="scope.row.triggerType" />
        </template>
      </el-table-column>
      <el-table-column label="状态" prop="status" width="100" align="center">
        <template #default="scope">
          <el-tag v-if="scope.row.status === 'failed'" type="danger">生成失败</el-tag>
          <el-tag v-else-if="scope.row.status === 'generating'" type="warning">生成中</el-tag>
          <el-tag v-else-if="scope.row.status === 'published'" type="success">已提交</el-tag>
          <el-tag v-else>已生成</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="版本" prop="version" width="70" align="center" />
      <el-table-column label="纳入条数" prop="opinionCount" width="95" align="center" />
      <el-table-column label="失败原因" prop="failReason" :show-overflow-tooltip="true" min-width="160" />
      <el-table-column label="操作" width="300" align="center" fixed="right">
        <template #default="scope">
          <el-button link type="primary" icon="View" @click="openDetail(scope.row)">正文</el-button>
          <el-button link type="primary" icon="Edit" @click="openOpinions(scope.row)" v-hasPermi="['yuqing:report:edit']">条目</el-button>
          <el-button link type="primary" icon="Refresh" @click="handleRegenerate(scope.row)" v-hasPermi="['yuqing:report:generate']">重生成</el-button>
          <el-button link type="primary" icon="Promotion" @click="handlePush(scope.row)" v-hasPermi="['yuqing:report:push']">推送</el-button>
          <el-button link type="success" icon="Upload" @click="handleSubmit(scope.row)" v-hasPermi="['yuqing:report:submit']">提交</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <!-- 生成对话框 -->
    <el-dialog v-model="generateOpen" title="生成报告" width="520px" append-to-body>
      <el-form ref="generateRef" :model="generateForm" :rules="generateRules" label-width="100px">
        <el-form-item label="报告类型" prop="reportType">
          <el-select v-model="generateForm.reportType" style="width: 100%">
            <el-option v-for="d in yq_report_type" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属日期" prop="reportDate">
          <el-date-picker v-model="generateForm.reportDate" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
        <el-form-item label="使用模板" prop="templateId">
          <el-select v-model="generateForm.templateId" placeholder="不套模板（全章节输出）" clearable style="width: 100%">
            <el-option v-for="t in templateOptions" :key="t.templateId" :label="t.templateName" :value="t.templateId" />
          </el-select>
        </el-form-item>
        <el-form-item label="报告名称" prop="reportName">
          <el-input v-model="generateForm.reportName" placeholder="留空自动生成「舆情日报 YYYY-MM-DD」" />
        </el-form-item>
        <el-form-item label="覆盖草稿">
          <el-switch v-model="generateForm.overwrite" />
          <span class="tip">同日已有草稿时覆盖重建；关闭则跳过</span>
        </el-form-item>
        <el-form-item label="生成后推送">
          <el-switch v-model="generateForm.pushAfter" />
          <span class="tip">按推送规则发送至企业微信</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateOpen = false">取消</el-button>
        <el-button type="primary" :loading="generating" @click="submitGenerate">开始生成</el-button>
      </template>
    </el-dialog>

    <!-- 正文预览 -->
    <el-dialog v-model="detailOpen" :title="current.reportName" width="900px" append-to-body>
      <div class="notice-box" v-if="current.failReason">
        <el-alert type="error" :title="'生成失败：' + current.failReason" :closable="false" />
      </div>
      <div class="meta-line">
        <el-tag size="small">类型 {{ current.reportType }}</el-tag>
        <el-tag size="small" type="info">日期 {{ current.reportDate }}</el-tag>
        <el-tag size="small" type="info">版本 v{{ current.version }}</el-tag>
        <el-tag size="small" type="warning">纳入 {{ current.opinionCount }} 条</el-tag>
        <el-button v-if="current.fileUrl" link type="primary" @click="downloadFile(current)">下载文件</el-button>
      </div>
      <pre class="content-pre">{{ current.content }}</pre>
      <template #footer>
        <el-button type="primary" @click="handleExportFile(current)">导出 Word</el-button>
        <el-button type="success" @click="handleExportPdf(current)">导出 PDF</el-button>
        <el-button @click="detailOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 条目增删 -->
    <el-dialog v-model="opinionOpen" title="调整纳入条目" width="900px" append-to-body>
      <el-alert type="info" :closable="false" title="手工补充的条目在重新生成时会保留；已提交的报告不可调整。" class="mb8" />
      <el-row :gutter="10" class="mb8">
        <el-col :span="1.5">
          <el-button type="primary" plain icon="Plus" @click="openAddOpinion">补充舆情</el-button>
        </el-col>
      </el-row>
      <el-table :data="opinionList" v-loading="opinionLoading" max-height="360">
        <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="240" />
        <el-table-column label="属性" prop="sentiAttr" width="90" align="center">
          <template #default="scope">
            <dict-tag :options="yq_senti_attr" :value="scope.row.sentiAttr" />
          </template>
        </el-table-column>
        <el-table-column label="热度" prop="heatScore" width="80" align="center" />
        <el-table-column label="操作" width="90" align="center">
          <template #default="scope">
            <el-button link type="danger" icon="Delete" @click="removeOpinion(scope.row)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="opinionOpen = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 补充舆情选择 -->
    <el-dialog v-model="addOpinionOpen" title="补充舆情到报告" width="760px" append-to-body>
      <el-form :inline="true">
        <el-form-item label="标题">
          <el-input v-model="opinionQuery.title" placeholder="标题关键词" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="searchOpinion">搜索</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="opinionCandidates" v-loading="candidateLoading" max-height="320" @selection-change="onCandidateChange">
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column label="标题" prop="title" :show-overflow-tooltip="true" min-width="240" />
        <el-table-column label="热度" prop="heatScore" width="80" align="center" />
        <el-table-column label="采集日期" prop="collectDate" width="110" align="center" />
      </el-table>
      <template #footer>
        <el-button @click="addOpinionOpen = false">取消</el-button>
        <el-button type="primary" @click="confirmAddOpinion">加入报告</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts" name="Report">
import { ref, reactive, toRefs, onMounted, getCurrentInstance } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import {
  listYqReport,
  getYqReport,
  addYqReport,
  updateYqReport,
  delYqReport,
  generateYqReport,
  regenerateYqReport,
  listReportOpinions,
  adjustReportOpinions,
  submitYqReport,
  pushYqReport,
  exportReportUrl
} from '@/api/yuqing/report';
import { listYqReportTemplate } from '@/api/yuqing/reportTemplate';
import { listYqOpinion } from '@/api/yuqing/opinion';
import type {
  YqReportVO,
  YqReportForm,
  YqReportQuery,
  ReportGenerateForm,
  ReportOpinionRow
} from '@/api/yuqing/report/types';

const { proxy } = getCurrentInstance() as any;
const { yq_report_type, yq_report_status, yq_report_trigger, yq_report_submit_status, yq_senti_attr } =
  proxy.useDict('yq_report_type', 'yq_report_status', 'yq_report_trigger', 'yq_report_submit_status', 'yq_senti_attr');

const loading = ref(true);
const showSearch = ref(true);
const ids = ref<Array<string | number>>([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const reportList = ref<YqReportVO[]>([]);
const templateOptions = ref<any[]>([]);

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    reportName: undefined,
    reportType: undefined,
    reportDate: undefined,
    status: undefined,
    submitStatus: undefined
  } as YqReportQuery,
  current: {} as YqReportVO
});
const { queryParams, current } = toRefs(data);

const generateOpen = ref(false);
const generating = ref(false);
const generateForm = ref<ReportGenerateForm>({ reportType: 'daily', reportDate: '', overwrite: false, pushAfter: false });
const generateRules = {
  reportType: [{ required: true, message: '请选择报告类型', trigger: 'change' }],
  reportDate: [{ required: true, message: '请选择归属日期', trigger: 'change' }]
};
const generateRef = ref<FormInstance>();

const detailOpen = ref(false);
const opinionOpen = ref(false);
const opinionLoading = ref(false);
const opinionList = ref<ReportOpinionRow[]>([]);
const addOpinionOpen = ref(false);
const candidateLoading = ref(false);
const opinionCandidates = ref<any[]>([]);
const selectedCandidates = ref<any[]>([]);
const opinionQuery = reactive({ title: '' });
const activeReportId = ref<string | number>('');

/** 查询列表 */
async function getList() {
  loading.value = true;
  try {
    const res = await listYqReport(queryParams.value);
    reportList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
}

async function loadTemplates() {
  try {
    const res = await listYqReportTemplate({ pageNum: 1, pageSize: 200 });
    templateOptions.value = res.data?.rows ?? [];
  } catch {
    templateOptions.value = [];
  }
}

function handleQuery() {
  queryParams.value.pageNum = 1;
  getList();
}

function resetQuery() {
  proxy.resetForm('queryRef');
  handleQuery();
}

function handleSelectionChange(selection: YqReportVO[]) {
  ids.value = selection.map((i) => i.reportId);
  single.value = selection.length !== 1;
  multiple.value = !selection.length;
}

/* ------------------------------------------------------------ 生成 */

function openGenerate() {
  generateForm.value = { reportType: 'daily', reportDate: '', templateId: undefined, reportName: undefined, overwrite: false, pushAfter: false };
  generateOpen.value = true;
}

function submitGenerate() {
  generateRef.value?.validate((valid: boolean) => {
    if (!valid) return;
    generating.value = true;
    generateYqReport(generateForm.value).then((res) => {
      const r = res.data;
      if (!r) {
        ElMessage.success('生成请求已提交');
      } else if (r.status === 'failed') {
        ElMessage.error('生成失败：' + (r.failReason || '未知原因'));
      } else {
        ElMessage.success(r.status === 'generating' ? '生成中' : '生成完成，纳入 ' + (r.opinionCount || 0) + ' 条');
        if (r.notices && r.notices.length) {
          r.notices.forEach((n: string) => ElMessage.warning(n));
        }
      }
      generating.value = false;
      generateOpen.value = false;
      getList();
    }).catch(() => {
      generating.value = false;
    });
  });
}

function handleRegenerate(row?: YqReportVO) {
  ElMessageBox.confirm('确认重新生成「' + row.reportName + '」？将覆盖当前草稿并递增版本号。', '提示', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    regenerateYqReport(row.reportId).then((res) => {
      const r = res.data;
      if (!r) {
        ElMessage.success('重新生成请求已提交');
      } else if (r.status === 'failed') {
        ElMessage.error('重新生成失败：' + (r.failReason || '未知原因'));
      } else {
        ElMessage.success('重新生成完成 v' + r.version);
      }
      getList();
    });
  }).catch(() => {});
}

/* ------------------------------------------------------------ 详情 / 导出 */

function openDetail(row?: YqReportVO) {
  getYqReport(row.reportId).then((res) => {
    current.value = res.data || row;
    detailOpen.value = true;
  }).catch(() => {
    current.value = row;
    detailOpen.value = true;
  });
}

function handleExportFile(row?: YqReportVO) {
  if (!row || !row.reportId) {
    ElMessage.warning('请先选择一条报告');
    return;
  }
  window.open(exportReportUrl(row.reportId, 'docx'), '_blank');
}

function handleExportPdf(row?: YqReportVO) {
  if (!row || !row.reportId) return;
  window.open(exportReportUrl(row.reportId, 'pdf'), '_blank');
}

function downloadFile(row?: YqReportVO) {
  if (!row.fileUrl) return;
  window.open(row.fileUrl, '_blank');
}

/* ------------------------------------------------------------ 条目调整 */

function openOpinions(row?: YqReportVO) {
  activeReportId.value = row.reportId;
  opinionOpen.value = true;
  loadOpinions();
}

function loadOpinions() {
  opinionLoading.value = true;
  listReportOpinions(activeReportId.value).then((res) => {
    opinionList.value = res.data || [];
    opinionLoading.value = false;
  }).catch(() => {
    opinionLoading.value = false;
  });
}

function openAddOpinion() {
  opinionQuery.title = '';
  opinionCandidates.value = [];
  selectedCandidates.value = [];
  addOpinionOpen.value = true;
  searchOpinion();
}

function searchOpinion() {
  candidateLoading.value = true;
  listYqOpinion({ pageNum: 1, pageSize: 50, title: opinionQuery.title } as any).then((res) => {
    opinionCandidates.value = res.data?.rows ?? [];
    candidateLoading.value = false;
  }).catch(() => {
    candidateLoading.value = false;
  });
}

function onCandidateChange(rows: any[]) {
  selectedCandidates.value = rows;
}

function confirmAddOpinion() {
  if (!selectedCandidates.value.length) {
    ElMessage.warning('请先勾选要补充的舆情');
    return;
  }
  adjustReportOpinions({
    reportId: activeReportId.value,
    addOpinionIds: selectedCandidates.value.map((c) => c.opinionId)
  }).then(() => {
    ElMessage.success('已补充 ' + selectedCandidates.value.length + ' 条');
    addOpinionOpen.value = false;
    loadOpinions();
    getList();
  }).catch(() => {
    // 失败提示由响应拦截器统一处理
  });
}

function removeOpinion(row?: ReportOpinionRow) {
  adjustReportOpinions({
    reportId: activeReportId.value,
    removeOpinionIds: [row.opinionId]
  }).then(() => {
    ElMessage.success('已移除');
    loadOpinions();
    getList();
  });
}

/* ------------------------------------------------------------ 提交 / 推送 */

function handleSubmit(row?: YqReportVO) {
  ElMessageBox.prompt('请输入提报对象（如单位名称 / 接收人），可留空。', '提交报告', {
    confirmButtonText: '提交',
    cancelButtonText: '取消',
    inputPlaceholder: '提报对象'
  }).then(({ value }: any) => {
    submitYqReport(row.reportId, value).then(() => {
      ElMessage.success('提交成功');
      getList();
    });
  }).catch(() => {});
}

function handlePush(row?: YqReportVO) {
  ElMessageBox.confirm('确认把「' + row.reportName + '」推送至企业微信？', '提示', {
    confirmButtonText: '推送',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    pushYqReport(row.reportId).then((res) => {
      ElMessage.success(res.data || '推送完成');
      getList();
    });
  }).catch(() => {});
}

/* ------------------------------------------------------------ CRUD */

function handleUpdate() {
  const id = ids.value[0];
  getYqReport(id).then((res) => {
    current.value = res.data;
    detailOpen.value = true;
  });
}

function handleDelete() {
  ElMessageBox.confirm('确认删除选中的 ' + ids.value.length + ' 条报告？', '提示', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    delYqReport(ids.value).then(() => {
      ElMessage.success('删除成功');
      getList();
    });
  }).catch(() => {});
}

onMounted(() => {
  getList();
  loadTemplates();
});
</script>

<style scoped>
.mb8 {
  margin-bottom: 8px;
}
.tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}
.meta-line {
  margin-bottom: 10px;
}
.meta-line .el-tag {
  margin-right: 8px;
}
.notice-box {
  margin-bottom: 10px;
}
.content-pre {
  max-height: 480px;
  overflow: auto;
  background: #f6f8fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
`,
  },

  /* ------------------------------------------------------------ 离线自测 */
  {
    rel: 'test/java/org/dromara/yuqing/report/F014ReportTest.java',
    content: `package org.dromara.yuqing.report;

import org.dromara.yuqing.report.build.DailyReportBuilder;
import org.dromara.yuqing.report.build.ReportFileName;
import org.dromara.yuqing.report.build.ReportScopeResolver;
import org.dromara.yuqing.report.domain.DailyAlertRow;
import org.dromara.yuqing.report.domain.DailyHotRow;
import org.dromara.yuqing.report.domain.DailyReportContext;
import org.dromara.yuqing.report.render.DocumentFormat;
import org.dromara.yuqing.report.render.MarkdownToHtml;
import org.dromara.yuqing.report.render.RenderResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * F-014 日报生成 离线自测（不依赖 Spring 容器与数据库）
 *
 * <p>覆盖范围：**纯函数**与不可变对象 —— 正文构建器、文件名清洗、
 * 范围解析、Markdown→HTML、格式枚举。渲染器（WordRenderer / PdfRenderer）
 * 与 ExtServiceImpl 依赖三方库与数据库，不在此测。</p>
 *
 * @author ruoyi
 */
@DisplayName("F-014 日报生成")
public class F014ReportTest {

    private static final LocalDate D = LocalDate.of(2026, 9, 22);

    private DailyReportContext baseCtx() {
        DailyReportContext ctx = new DailyReportContext();
        ctx.setReportDate(D);
        return ctx;
    }

    /* ------------------------------------------------------------ 标题与骨架 */

    @Test
    @DisplayName("无报告名时标题为「舆情日报 YYYY-MM-DD」")
    void 标题默认值() {
        String t = DailyReportBuilder.title(baseCtx(), D);
        assertEquals("舆情日报 2026-09-22", t);
    }

    @Test
    @DisplayName("指定报告名时以指定值为准")
    void 标题优先用指定名() {
        DailyReportContext ctx = baseCtx();
        ctx.setReportName("台风梅花舆情专报");
        assertEquals("台风梅花舆情专报", DailyReportBuilder.title(ctx, D));
    }

    @Test
    @DisplayName("正文以 H1 标题开头且含统计日期")
    void 正文骨架完整() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.startsWith("# 舆情日报 2026-09-22"), "应以 H1 标题开头");
        assertTrue(md.contains("统计日期：2026-09-22"), "应含统计日期");
        assertTrue(md.contains("### 八、当日新增预警"), "应含预警章节");
        assertTrue(md.contains("### 九、重点舆情详情"), "应含重点舆情章节");
    }

    @Test
    @DisplayName("无分析交接件时给出明确提示而非空白")
    void 无分析数据时提示() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.contains("未取到当日分析批次数据"), "应提示缺分析数据");
    }

    @Test
    @DisplayName("交接件自带的一级标题会被剥掉，避免出现两个 H1")
    void 剥离交接件一级标题() {
        DailyReportContext ctx = baseCtx();
        org.dromara.yuqing.analytics.ReportSection s = new org.dromara.yuqing.analytics.ReportSection();
        s.setMarkdown("# 多维分析日报\\n\\n### 一、总体态势\\n\\n- 总量 100 条");
        ctx.setSection(s);
        String md = DailyReportBuilder.build(ctx);
        long h1 = md.lines().filter(l -> l.startsWith("# ")).count();
        assertEquals(1L, h1, "正文应只有一个 H1");
        assertTrue(md.contains("### 一、总体态势"), "应保留交接件的二级结构");
    }

    /* ------------------------------------------------------------ 预警章节 */

    @Test
    @DisplayName("预警空清单输出「当日无新增预警」")
    void 预警为空时给出说明() {
        String md = DailyReportBuilder.build(baseCtx());
        assertTrue(md.contains("当日无新增预警"));
    }

    @Test
    @DisplayName("预警按表头七列输出且等级/场景/状态被翻译为中文")
    void 预警表格渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "台风话题负面聚集", "urgent", "keyword",
            "台风", "微博", LocalDateTime.of(2026, 9, 22, 10, 30), "pending")));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("| 序号 | 预警等级 | 触发场景 | 预警内容 | 来源渠道 | 触发时间 | 状态 |"));
        assertTrue(md.contains("紧急"), "urgent 应译为紧急");
        assertTrue(md.contains("关键词命中"), "keyword 应译为关键词命中");
        assertTrue(md.contains("未处置"), "pending 应译为未处置");
        assertTrue(md.contains("2026-09-22 10:30"), "时间应按 yyyy-MM-dd HH:mm 输出");
    }

    @Test
    @DisplayName("预警标题中的竖线与换行会被清洗，避免表格错列")
    void 预警标题清洗竖线() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "标题|带竖线\\n带换行", "notice", "heat",
            null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertFalse(md.contains("标题|带竖线"), "竖线应被替换");
        assertTrue(md.contains("标题/带竖线"), "竖线应替换为斜杠");
    }

    /* ------------------------------------------------------------ 重点舆情 */

    @Test
    @DisplayName("重点舆情按列表输出，含平台/属性/热度与互动数")
    void 重点舆情渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(9L, "某地暴雨", "新闻网站", "negative", "high",
            88, 12000L, 340L, 210L, "https://example.com/a", LocalDateTime.of(2026, 9, 22, 8, 0))));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("1. **某地暴雨**"));
        assertTrue(md.contains("平台：新闻网站"));
        assertTrue(md.contains("风险：高"), "high 应译为高");
        assertTrue(md.contains("热度：88"));
        assertTrue(md.contains("阅读 12000 / 转发 340 / 评论 210"));
        assertTrue(md.contains("https://example.com/a"));
    }

    @Test
    @DisplayName("非 http(s) 的链接被隐藏，不写入正文")
    void 非法链接被隐藏() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(9L, "标题", null, null, null,
            null, null, null, null, "javascript:alert(1)", null)));
        String md = DailyReportBuilder.build(ctx);
        assertFalse(md.contains("javascript:"), "非 http(s) 链接必须被拒绝");
        assertTrue(md.contains("链接格式异常"));
    }

    @Test
    @DisplayName("标题含 ** 时先摘除，避免破坏加粗配平")
    void 标题加粗符号被摘除() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "**重点** 事件", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("1. **重点 事件**"), "内部 ** 应被摘除但外层保留");
    }

    @Test
    @DisplayName("热度与互动数为 null 时按 0 输出，不出现 null 字样")
    void 空数值按零输出() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("热度：0"));
        assertTrue(md.contains("阅读 0 / 转发 0 / 评论 0"));
        assertFalse(md.contains("null"), "正文不应出现 null");
    }

    /* ------------------------------------------------------------ 模板裁剪 */

    @Test
    @DisplayName("模板空清单 = 不裁剪，全章节输出")
    void 模板空清单不裁剪() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("### 九、重点舆情详情"));
    }

    @Test
    @DisplayName("模板未勾选 hot 时不输出重点舆情章节")
    void 模板裁剪生效() {
        DailyReportContext ctx = baseCtx();
        ctx.setRequiredSections(List.of("alert"));
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "标题", null, null, null,
            null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("### 八、当日新增预警"), "alert 在清单内应输出");
        assertFalse(md.contains("### 九、重点舆情详情"), "hot 不在清单内应裁剪");
    }

    /* ------------------------------------------------------------ 提示区 */

    @Test
    @DisplayName("取数降级说明写入生成提示区")
    void 提示区渲染() {
        DailyReportContext ctx = baseCtx();
        ctx.setNotices(List.of("多维分析数据获取失败：连接超时", "已保留人工补充的舆情 3 条"));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("> **生成提示**"));
        assertTrue(md.contains("> - 多维分析数据获取失败：连接超时"));
        assertTrue(md.contains("> - 已保留人工补充的舆情 3 条"));
    }

    @Test
    @DisplayName("空提示项被忽略，不产出空的引用行")
    void 空提示被忽略() {
        DailyReportContext ctx = baseCtx();
        List<String> notices = new ArrayList<>();
        notices.add("正常提示");
        notices.add("");
        notices.add(null);
        ctx.setNotices(notices);
        String md = DailyReportBuilder.build(ctx);
        assertEquals(1L, md.lines().filter(l -> l.startsWith("> - ")).count());
    }

    @Test
    @DisplayName("收尾统计条数正确")
    void 收尾统计() {
        DailyReportContext ctx = baseCtx();
        ctx.setHotOpinions(List.of(
            new DailyHotRow(1L, "a", null, null, null, null, null, null, null, null, null),
            new DailyHotRow(2L, "b", null, null, null, null, null, null, null, null, null)));
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "x", null, null, null, null, null, null)));
        String md = DailyReportBuilder.build(ctx);
        assertTrue(md.contains("共纳入舆情 2 条、预警 1 条"));
    }

    @Test
    @DisplayName("同一上下文重复构建结果完全一致（确定性）")
    void 构建确定性() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "x", "urgent", "heat", "v", "微博",
            LocalDateTime.of(2026, 9, 22, 1, 2), "pending")));
        ctx.setHotOpinions(List.of(new DailyHotRow(1L, "t", "c", "negative", "high",
            50, 1L, 2L, 3L, "https://a.b", LocalDateTime.of(2026, 9, 22, 3, 4))));
        assertEquals(DailyReportBuilder.build(ctx), DailyReportBuilder.build(ctx));
    }

    @Test
    @DisplayName("null 上下文不抛异常")
    void 空上下文安全() {
        String md = DailyReportBuilder.build(null);
        assertNotNull(md);
        assertTrue(md.contains("舆情日报"));
    }

    /* ------------------------------------------------------------ 范围解析 */

    @Test
    @DisplayName("日报范围为当日 00:00 至当日 24:00（同一天）")
    void 日报范围同一天() {
        var scope = ReportScopeResolver.daily(D);
        assertEquals(D, scope.getDateFrom());
        assertEquals(D, scope.getDateTo());
    }

    @Test
    @DisplayName("日报日期为空时默认取昨天")
    void 日报默认昨天() {
        var scope = ReportScopeResolver.daily(null);
        assertEquals(LocalDate.now().minusDays(1), scope.getDateFrom());
    }

    @Test
    @DisplayName("月报范围覆盖整月首末")
    void 月报范围整月() {
        var scope = ReportScopeResolver.monthly(2026, 2);
        assertEquals(LocalDate.of(2026, 2, 1), scope.getDateFrom());
        assertEquals(LocalDate.of(2026, 2, 28), scope.getDateTo());
    }

    @Test
    @DisplayName("闰年二月月报末位为 29")
    void 闰年月报() {
        var scope = ReportScopeResolver.monthly(2024, 2);
        assertEquals(LocalDate.of(2024, 2, 29), scope.getDateTo());
    }

    /* ------------------------------------------------------------ 文件名 */

    @Test
    @DisplayName("无报告名时按类型与日期生成文件名")
    void 文件名默认() {
        assertEquals("舆情日报-20260922.docx", ReportFileName.of("daily", D, null, "docx"));
        assertEquals("舆情月报-20260901.pdf", ReportFileName.of("monthly", LocalDate.of(2026, 9, 1), null, "pdf"));
    }

    @Test
    @DisplayName("文件名清洗路径分隔符与非法字符")
    void 文件名清洗() {
        String n = ReportFileName.sanitize("9月/22日 报告:第一版*终稿?");
        assertFalse(n.contains("/"));
        assertFalse(n.contains(":"));
        assertFalse(n.contains("*"));
        assertFalse(n.contains("?"));
        assertTrue(n.contains("9月"));
    }

    @Test
    @DisplayName("清洗后为空时回落「舆情报告」")
    void 文件名回落() {
        String n = ReportFileName.sanitize("///");
        assertFalse(n.isBlank());
        assertEquals("___", n);
    }

    @Test
    @DisplayName("超长文件名按 UTF-8 字节截断不超过 120")
    void 文件名长度限制() {
        String longName = "舆情报告".repeat(60);
        String n = ReportFileName.sanitize(longName);
        assertTrue(n.getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 120);
    }

    /* ------------------------------------------------------------ 格式枚举 */

    @Test
    @DisplayName("格式解析支持大小写与别名")
    void 格式解析() {
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("docx"));
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("DOCX"));
        assertEquals(DocumentFormat.DOCX, DocumentFormat.of("word"));
        assertEquals(DocumentFormat.PDF, DocumentFormat.of("PDF"));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("md"));
    }

    @Test
    @DisplayName("未知格式回落 MARKDOWN 而非抛异常")
    void 格式回落() {
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("exe"));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of(null));
        assertEquals(DocumentFormat.MARKDOWN, DocumentFormat.of("  "));
    }

    /* ------------------------------------------------------------ Markdown→HTML */

    @Test
    @DisplayName("HTML 转义阻断 XSS：标签被转义为实体")
    void html转义阻断xss() {
        String html = MarkdownToHtml.toBody("<script>alert(1)</script>");
        assertFalse(html.contains("<script>"), "不允许出现原始 script 标签");
        assertTrue(html.contains("&lt;script&gt;"));
    }

    @Test
    @DisplayName("HTML 转义覆盖引号与 & 符号")
    void html转义覆盖特殊字符() {
        String html = MarkdownToHtml.inline("a & b \\" c ' d");
        assertTrue(html.contains("&amp;"));
        assertTrue(html.contains("&quot;"));
        assertTrue(html.contains("&#39;"));
    }

    @Test
    @DisplayName("标题层级正确映射为 h1/h2/h3")
    void html标题映射() {
        String html = MarkdownToHtml.toBody("# 一级\\n## 二级\\n### 三级");
        assertTrue(html.contains("<h1>一级</h1>"));
        assertTrue(html.contains("<h2>二级</h2>"));
        assertTrue(html.contains("<h3>三级</h3>"));
    }

    @Test
    @DisplayName("无序列表合并为单个 ul")
    void html列表合并() {
        String html = MarkdownToHtml.toBody("- a\\n- b\\n- c");
        assertEquals(1, countOf(html, "<ul>"));
        assertEquals(3, countOf(html, "<li>"));
        assertEquals(1, countOf(html, "</ul>"));
    }

    @Test
    @DisplayName("表格含表头行时首行用 th")
    void html表格表头() {
        String html = MarkdownToHtml.toBody("| a | b |\\n| --- | --- |\\n| 1 | 2 |");
        assertTrue(html.contains("<th>a</th>"));
        assertTrue(html.contains("<td>1</td>"));
        assertEquals(2, countOf(html, "<tr>"));
    }

    @Test
    @DisplayName("引用行转 blockquote")
    void html引用() {
        String html = MarkdownToHtml.toBody("> 数据截止时间：2026-09-22");
        assertTrue(html.contains("<blockquote>"));
    }

    @Test
    @DisplayName("空正文返回占位段落")
    void html空正文() {
        String html = MarkdownToHtml.toBody("");
        assertTrue(html.contains("暂无内容"));
        assertTrue(MarkdownToHtml.toBody(null).contains("暂无内容"));
    }

    @Test
    @DisplayName("粗体先转义再开标签，顺序不可反")
    void html粗体转义顺序() {
        String html = MarkdownToHtml.inline("**<b>x</b>**");
        assertTrue(html.contains("<strong>"));
        assertFalse(html.contains("<b>"), "内部标签必须被转义");
        assertTrue(html.contains("&lt;b&gt;"));
    }

    @Test
    @DisplayName("日报正文可完整转 HTML 且标签配平")
    void 日报正文转html配平() {
        DailyReportContext ctx = baseCtx();
        ctx.setAlerts(List.of(new DailyAlertRow(1L, "预警", "urgent", "keyword", "值", "微博",
            LocalDateTime.of(2026, 9, 22, 9, 0), "pending")));
        String md = DailyReportBuilder.build(ctx);
        String html = MarkdownToHtml.toBody(md);
        assertEquals(countOf(html, "<table>"), countOf(html, "</table>"));
        assertEquals(countOf(html, "<ul>"), countOf(html, "</ul>"));
        assertFalse(html.contains("<script>"));
    }

    /* ------------------------------------------------------------ 渲染结果 */

    @Test
    @DisplayName("渲染结果 ok/fail 语义正确")
    void 渲染结果语义() {
        RenderResult ok = RenderResult.ok(DocumentFormat.PDF, "a.pdf", new byte[]{1, 2, 3});
        assertTrue(ok.ok());
        assertEquals(3, ok.size());

        RenderResult fail = RenderResult.fail(DocumentFormat.PDF, "a.pdf", "字体缺失");
        assertFalse(fail.ok());
        assertEquals(0, fail.size());
        assertTrue(fail.message().contains("字体缺失"));
    }

    /* ------------------------------------------------------------ 工具 */

    private static int countOf(String s, String sub) {
        int c = 0;
        int i = 0;
        while ((i = s.indexOf(sub, i)) >= 0) {
            c++;
            i += sub.length();
        }
        return c;
    }
}
`,
  },
];
