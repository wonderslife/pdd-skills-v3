<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '报告预览',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 报告预览与提交（PRD 模块12 验收标准 7、9）
 *
 * 安全要点：报告正文由后端大模型/模板渲染产出，属于不可信内容，
 * 渲染前必须做白名单净化，防止存储型 XSS（PRD §9 安全要求）。
 */
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getYqReport, updateYqReport } from '@/api/yuqing/report'
import { modal } from '@/plugins'
import { REPORT_TYPE_MAP, REPORT_STATUS_MAP, SUBMIT_STATUS_MAP, labelOf, reportStatusClass } from '@/utils/yuqingDict'

const reportId = ref('')
const report = ref<any>({})
const loading = ref(false)
const submitting = ref(false)

/**
 * HTML 净化（白名单策略）
 * 1) 去掉危险标签 script/style/iframe/object/embed/link/meta/base/form
 * 2) 去掉所有 on* 内联事件属性
 * 3) 去掉 javascript:/vbscript:/data:text/html 协议
 * 4) 去掉 srcdoc / style 中的 expression()
 */
function sanitizeHtml(raw: string): string {
  if (!raw) return ''
  let html = String(raw)

  // 1) 危险标签整体剔除（含内容）
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  // 自闭合/未闭合的危险标签
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')

  // 2) 内联事件属性（onclick=、onerror= 等）
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // 3) 危险协议
  html = html.replace(/(href|src|xlink:href)\s*=\s*("|')?\s*(javascript|vbscript|data)\s*:[^"'>\s]*("|')?/gi, '$1="#"')

  // 4) srcdoc 与 css expression
  html = html.replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*')/gi, '')
  html = html.replace(/expression\s*\(/gi, '')

  return html
}

const safeContent = computed(() => sanitizeHtml(report.value?.content || ''))

onLoad(async (options: any) => {
  reportId.value = String(options?.reportId || '')
  if (!reportId.value) {
    modal.msg('缺少报告标识')
    return
  }
  await load()
})

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const res: any = await getYqReport(reportId.value)
    report.value = res?.data ?? res ?? {}
  } catch (e) {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

/** 线上提交 */
async function submitReport() {
  if (submitting.value) return
  if (report.value?.status === 'generating') {
    modal.msg('报告正在生成中，请稍后再提交')
    return
  }
  if (report.value?.submitStatus === 'submitted') {
    modal.msg('该报告已提交')
    return
  }
  const ok = await modal.confirm('确认提交该报告？提交后将记录操作日志。')
  if (!ok) return
  submitting.value = true
  try {
    await updateYqReport({ reportId: reportId.value, submitStatus: 'submitted' })
    report.value.submitStatus = 'submitted'
    modal.msg('提交成功')
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

/** 下载报告文件（PDF/Word） */
function download() {
  const url = report.value?.fileUrl
  if (!url) {
    modal.msg('报告文件尚未生成')
    return
  }
  // #ifdef H5
  window.open(url, '_blank')
  return
  // #endif
  // #ifndef H5
  uni.downloadFile({
    url,
    success: (res: any) => {
      uni.openDocument({ filePath: res.tempFilePath, showMenu: true })
    },
  })
  // #endif
}

function previewFormat() {
  return report.value?.fileFormat || 'html'
}
</script>

<template>
  <view class="page">
    <view class="head-card">
      <text class="head-title">{{ report.reportName || '舆情报告' }}</text>
      <view class="head-tags">
        <text class="tag">{{ labelOf(REPORT_TYPE_MAP, report.reportType) }}</text>
        <text class="tag" :class="reportStatusClass(report.status)">{{ labelOf(REPORT_STATUS_MAP, report.status) }}</text>
        <text class="tag" :class="report.submitStatus === 'submitted' ? 'success' : 'warning'">
          {{ labelOf(SUBMIT_STATUS_MAP, report.submitStatus) }}
        </text>
      </view>
      <view class="head-meta">
        <text class="meta-item">报告日期：{{ report.reportDate || '-' }}</text>
        <text class="meta-item">模板：{{ report.templateName || '-' }}</text>
        <text class="meta-item">版本：v{{ report.version != null ? report.version : 1 }}</text>
        <text class="meta-item">提交时间：{{ report.submitTime || '-' }}</text>
      </view>
    </view>

    <view class="content-card">
      <!-- 净化后的正文（白名单，防 XSS） -->
      <rich-text v-if="safeContent" class="rich" :nodes="safeContent"></rich-text>
      <view v-else class="no-content">
        <uni-icons type="compose" size="40" color="#c0c4cc"></uni-icons>
        <text class="no-text">
          {{ report.status === 'generating' ? '报告生成中，请稍后刷新' : '暂无报告正文' }}
        </text>
      </view>
    </view>

    <view class="file-line" v-if="report.fileUrl">
      <text class="file-text">附件格式：{{ previewFormat().toUpperCase() }}</text>
      <text class="file-download" @click="download">下载报告</text>
    </view>

    <view class="submit-bar">
      <button class="btn ghost" @click="load">刷新</button>
      <button
        class="btn primary"
        :loading="submitting"
        :disabled="report.submitStatus === 'submitted'"
        @click="submitReport"
      >
        {{ report.submitStatus === 'submitted' ? '已提交' : '线上提交' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(90px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.head-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.head-title {
  font-size: 17px;
  font-weight: 600;
  color: #333333;
  display: block;
}

.head-tags {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  color: #8c8c8c;
  background-color: rgba(140, 140, 140, 0.12);
  border-radius: 9px;
  padding: 3px 10px;
  margin: 0 8px 6px 0;

  &.danger {
    color: #f56c6c;
    background-color: rgba(245, 108, 108, 0.12);
  }

  &.warning {
    color: #faad14;
    background-color: rgba(250, 173, 20, 0.14);
  }

  &.success {
    color: #52c41a;
    background-color: rgba(82, 196, 26, 0.12);
  }

  &.info {
    color: #8c8c8c;
    background-color: rgba(140, 140, 140, 0.12);
  }
}

.head-meta {
  margin-top: 12px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .meta-item {
    width: 50%;
    font-size: 12px;
    color: #999999;
    line-height: 21px;
  }
}

.content-card {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  min-height: 220px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.rich {
  font-size: 14px;
  line-height: 24px;
  color: #333333;
}

.no-content {
  padding-top: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .no-text {
    margin-top: 12px;
    font-size: 13px;
    color: #b0b0b0;
  }
}

.file-line {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .file-text {
    font-size: 13px;
    color: #666666;
  }

  .file-download {
    font-size: 13px;
    color: #1677ff;
  }
}

.submit-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: row;
}

.btn {
  flex: 1;
  height: 44px;
  line-height: 44px;
  border-radius: 22px;
  font-size: 15px;
  border: none;

  &.ghost {
    margin-right: 12px;
    background-color: #f5f6f8;
    color: #666666;
  }

  &.primary {
    background-color: #1677ff;
    color: #ffffff;
  }

  &[disabled] {
    background-color: #c8c9cc;
    color: #ffffff;
  }
}
</style>
