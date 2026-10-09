<template>
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
