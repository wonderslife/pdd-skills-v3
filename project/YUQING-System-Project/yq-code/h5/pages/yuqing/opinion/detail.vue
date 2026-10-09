<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '舆情详情',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 台账详情（PRD 模块12 验收标准 9）
 * 展示舆情原文要点 + 研判结论 + 关联预警，并支持预警处置（写入操作日志）。
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getYqOpinion } from '@/api/yuqing/opinion'
import { listYqOpinionAnalysis } from '@/api/yuqing/opinionAnalysis'
import { listYqAlert, updateYqAlert } from '@/api/yuqing/alert'
import { modal } from '@/plugins'
import {
  SENTI_ATTR_MAP,
  OPINION_LEVEL_MAP,
  RISK_LEVEL_MAP,
  SPREAD_LEVEL_MAP,
  ALERT_LEVEL_MAP,
  ALERT_STATUS_MAP,
  ALERT_SCENE_MAP,
  ANALYZE_STATUS_MAP,
  labelOf,
  sentiClass,
  levelClass,
  alertStatusClass,
} from '@/utils/yuqingDict'

const opinionId = ref('')
const alertId = ref('')
const opinion = ref<any>({})
const analysis = ref<any>({})
const alert = ref<any>({})
const loading = ref(false)
const processing = ref(false)

const processDialog = ref(false)
const processForm = ref({ status: 'handled', processRemark: '' })

onLoad(async (options: any) => {
  opinionId.value = String(options?.opinionId || '')
  alertId.value = String(options?.alertId || '')
  await loadAll()
})

async function loadAll() {
  if (loading.value) return
  loading.value = true
  uni.showLoading({ title: '加载中' })
  await Promise.allSettled([loadOpinion(), loadAnalysis(), loadAlert()])
  uni.hideLoading()
  loading.value = false
}

async function loadOpinion() {
  if (!opinionId.value) return
  try {
    const res: any = await getYqOpinion(opinionId.value)
    opinion.value = res?.data ?? res ?? {}
  } catch (e) {
    opinion.value = {}
  }
}

async function loadAnalysis() {
  if (!opinionId.value) return
  try {
    const res: any = await listYqOpinionAnalysis({ pageNum: 1, pageSize: 1, opinionId: opinionId.value })
    analysis.value = res?.rows?.[0] ?? {}
  } catch (e) {
    analysis.value = {}
  }
}

async function loadAlert() {
  try {
    if (alertId.value) {
      const res: any = await listYqAlert({ pageNum: 1, pageSize: 1, alertId: alertId.value })
      alert.value = res?.rows?.[0] ?? {}
      return
    }
    if (opinionId.value) {
      const res: any = await listYqAlert({ pageNum: 1, pageSize: 1, opinionId: opinionId.value })
      alert.value = res?.rows?.[0] ?? {}
    }
  } catch (e) {
    alert.value = {}
  }
}

function openProcess() {
  processForm.value = { status: alert.value.status === 'pending' ? 'handled' : alert.value.status, processRemark: '' }
  processDialog.value = true
}

/** 提交处置 —— 后端按登录用户写入 processBy / processTime 及操作日志 */
async function submitProcess() {
  if (!alert.value?.alertId) return
  if (processForm.value.status === 'handled' && !processForm.value.processRemark.trim()) {
    modal.msg('处置为「已处置」时请填写处置说明')
    return
  }
  if (processing.value) return
  processing.value = true
  try {
    await updateYqAlert({
      alertId: alert.value.alertId,
      status: processForm.value.status,
      processRemark: processForm.value.processRemark.trim(),
    })
    alert.value.status = processForm.value.status
    alert.value.processRemark = processForm.value.processRemark
    processDialog.value = false
    modal.msg('处置已提交')
  } catch (e) {
    // 拦截器已提示
  } finally {
    processing.value = false
  }
}

function openSource() {
  const url = opinion.value?.opinionUrl
  if (!url) {
    modal.msg('无原文链接')
    return
  }
  // #ifdef H5
  window.open(url, '_blank')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制', icon: 'none' }) })
  // #endif
}

function num(v: any) {
  if (v == null || v === '') return '0'
  return Number(v).toLocaleString('en-US')
}
</script>

<template>
  <view class="page">
    <!-- 舆情主体 -->
    <view class="card">
      <view class="title-row">
        <text class="title">{{ opinion.title || '无标题' }}</text>
        <text class="badge" :class="sentiClass(opinion.sentiAttr)">
          {{ labelOf(SENTI_ATTR_MAP, opinion.sentiAttr) }}
        </text>
      </view>
      <view class="tags">
        <text class="tag" :class="levelClass(opinion.opinionLevel)">
          {{ labelOf(OPINION_LEVEL_MAP, opinion.opinionLevel) }}
        </text>
        <text class="tag">风险 {{ labelOf(RISK_LEVEL_MAP, opinion.riskLevel) }}</text>
        <text class="tag">传播 {{ labelOf(SPREAD_LEVEL_MAP, opinion.spreadLevel) }}</text>
      </view>
      <view class="meta">
        <text class="meta-item">作者：{{ opinion.author || '-' }}</text>
        <text class="meta-item">发布：{{ opinion.publishTime || '-' }}</text>
        <text class="meta-item">地域：{{ opinion.region || '-' }}</text>
        <text class="meta-item">采集：{{ opinion.collectTime || '-' }}</text>
      </view>
      <view class="metrics">
        <view class="metric"><text class="m-num">{{ num(opinion.likeCount) }}</text><text class="m-label">点赞</text></view>
        <view class="metric"><text class="m-num">{{ num(opinion.commentCount) }}</text><text class="m-label">评论</text></view>
        <view class="metric"><text class="m-num">{{ num(opinion.shareCount) }}</text><text class="m-label">转发</text></view>
        <view class="metric"><text class="m-num">{{ num(opinion.readCount) }}</text><text class="m-label">阅读</text></view>
      </view>
    </view>

    <!-- 正文（纯文本展示，避免 HTML 注入） -->
    <view v-if="opinion.content" class="card">
      <view class="section-title">原文内容</view>
      <text class="content">{{ opinion.content }}</text>
    </view>

    <!-- 研判结论 -->
    <view class="card">
      <view class="section-title">
        研判结论
        <text class="section-sub">{{ labelOf(ANALYZE_STATUS_MAP, analysis.analyzeStatus) }}</text>
      </view>
      <view v-if="analysis && (analysis.summary || analysis.conclusion)">
        <text class="content">{{ analysis.summary || analysis.conclusion }}</text>
        <view class="kv">
          <text class="kv-item">热度分值：{{ analysis.heatScore != null ? analysis.heatScore : '-' }}</text>
          <text class="kv-item">事件聚合：{{ analysis.clusterId || '-' }}</text>
        </view>
      </view>
      <view v-else class="empty-inline"><text class="empty-text">暂无研判结论</text></view>
    </view>

    <!-- 预警信息 -->
    <view class="card">
      <view class="section-title">
        预警信息
        <text v-if="alert.alertLevel" class="badge" :class="levelClass(alert.alertLevel)">
          {{ labelOf(ALERT_LEVEL_MAP, alert.alertLevel) }}
        </text>
      </view>
      <view v-if="alert.alertId">
        <view class="meta">
          <text class="meta-item">预警标题：{{ alert.alertTitle || '-' }}</text>
          <text class="meta-item">触发场景：{{ labelOf(ALERT_SCENE_MAP, alert.triggerScene) }}</text>
          <text class="meta-item">触发值：{{ alert.triggerValue || '-' }}</text>
          <text class="meta-item">触发时间：{{ alert.triggerTime || '-' }}</text>
          <text class="meta-item">处置人：{{ alert.processByName || '-' }}</text>
          <text class="meta-item">处置时间：{{ alert.processTime || '-' }}</text>
        </view>
        <view v-if="alert.processRemark" class="remark">
          <text class="remark-text">处置说明：{{ alert.processRemark }}</text>
        </view>
        <view class="alert-foot">
          <text class="status" :class="alertStatusClass(alert.status)">{{ labelOf(ALERT_STATUS_MAP, alert.status) }}</text>
          <text class="process-btn" @click="openProcess">处置</text>
        </view>
      </view>
      <view v-else class="empty-inline"><text class="empty-text">该舆情未触发预警</text></view>
    </view>

    <view class="bottom-bar">
      <button class="btn ghost" @click="loadAll">刷新</button>
      <button class="btn primary" @click="openSource">查看原文</button>
    </view>

    <!-- 处置弹窗 -->
    <view v-if="processDialog" class="mask" @click="processDialog = false">
      <view class="dialog" @click.stop>
        <view class="dialog-title">预警处置</view>
        <text class="dialog-label">处置状态</text>
        <view class="chips">
          <text
            v-for="(label, val) in ALERT_STATUS_MAP"
            :key="val"
            class="chip"
            :class="{ active: processForm.status === val }"
            @click="processForm.status = val"
          >
            {{ label }}
          </text>
        </view>
        <text class="dialog-label">处置说明</text>
        <textarea v-model="processForm.processRemark" class="dialog-textarea" placeholder="请填写处置说明（已处置时必填）" />
        <view class="dialog-btns">
          <button class="dialog-btn cancel" @click="processDialog = false">取消</button>
          <button class="dialog-btn confirm" :loading="processing" @click="submitProcess">提交</button>
        </view>
      </view>
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

.card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.title-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;

  .title {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
    flex: 1;
    padding-right: 10px;
    line-height: 23px;
  }

  .badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 9px;
    flex-shrink: 0;
  }
}

.tags {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .tag {
    font-size: 11px;
    color: #8c8c8c;
    background-color: rgba(140, 140, 140, 0.12);
    border-radius: 9px;
    padding: 3px 10px;
    margin: 0 8px 6px 0;
  }
}

.badge {
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

.meta {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .meta-item {
    width: 50%;
    font-size: 12px;
    color: #666666;
    line-height: 21px;
  }
}

.metrics {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: row;
}

.metric {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;

  .m-num {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
  }

  .m-label {
    margin-top: 2px;
    font-size: 11px;
    color: #999999;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .section-sub {
    font-size: 12px;
    font-weight: 400;
    color: #999999;
  }
}

.content {
  font-size: 14px;
  color: #444444;
  line-height: 23px;
}

.kv {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .kv-item {
    width: 50%;
    font-size: 12px;
    color: #999999;
    line-height: 21px;
  }
}

.remark {
  margin-top: 10px;
  background-color: #f7f8fa;
  border-radius: 8px;
  padding: 10px 12px;

  .remark-text {
    font-size: 13px;
    color: #666666;
    line-height: 20px;
  }
}

.alert-foot {
  margin-top: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .status {
    font-size: 13px;

    &.danger {
      color: #f56c6c;
    }

    &.warning {
      color: #faad14;
    }

    &.success {
      color: #52c41a;
    }

    &.info {
      color: #8c8c8c;
    }
  }

  .process-btn {
    font-size: 13px;
    color: #1677ff;
  }
}

.empty-inline {
  padding: 16px 0;
  text-align: center;

  .empty-text {
    font-size: 13px;
    color: #b0b0b0;
  }
}

.bottom-bar {
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
}

.mask {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog {
  width: 310px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 20px 16px 16px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
  text-align: center;
  margin-bottom: 14px;
}

.dialog-label {
  display: block;
  font-size: 12px;
  color: #999999;
  margin: 10px 0 6px;
}

.chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.chip {
  font-size: 13px;
  color: #666666;
  background-color: #f5f6f8;
  border-radius: 16px;
  padding: 6px 14px;
  margin: 0 8px 8px 0;
  border: 1px solid transparent;

  &.active {
    color: #1677ff;
    background-color: rgba(22, 119, 255, 0.1);
    border-color: #1677ff;
  }
}

.dialog-textarea {
  width: 100%;
  height: 74px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #333333;
  box-sizing: border-box;
}

.dialog-btns {
  margin-top: 18px;
  display: flex;
  flex-direction: row;
}

.dialog-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  border-radius: 8px;
  font-size: 15px;
  border: none;

  &.cancel {
    margin-right: 10px;
    background-color: #f5f6f8;
    color: #666666;
  }

  &.confirm {
    background-color: #1677ff;
    color: #ffffff;
  }
}
</style>
