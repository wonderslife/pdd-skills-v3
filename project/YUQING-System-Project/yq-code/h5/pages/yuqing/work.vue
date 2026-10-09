<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '舆情工作台',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 工作台首页（PRD 模块12 验收标准 2）
 * 展示：待处置预警数 / 当日采集概况 / 待办报告 / 最近研判结论 + 功能宫格
 */
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { listYqAlert } from '@/api/yuqing/alert'
import { listYqStatsDaily } from '@/api/yuqing/statsDaily'
import { listYqReport } from '@/api/yuqing/report'
import { listYqOpinionAnalysis } from '@/api/yuqing/opinionAnalysis'
import {
  ALERT_LEVEL_MAP,
  REPORT_TYPE_MAP,
  REPORT_STATUS_MAP,
  SENTI_ATTR_MAP,
  labelOf,
  sentiClass,
  levelClass,
  reportStatusClass,
} from '@/utils/yuqingDict'

const loading = ref(false)
const pendingAlert = ref(0)
const todayStats = ref<any>({})
const todoReports = ref<any[]>([])
const recentAnalysis = ref<any[]>([])

/** 功能宫格 —— 与 PRD §7.2 手机端菜单规划一一对应 */
const modules = [
  { key: 'task', text: '任务管控', icon: 'list', color: '#1677ff', bg: 'bg-blue', url: '/pages/yuqing/task/manage' },
  { key: 'rule', text: '规则管控', icon: 'settings-filled', color: '#722ed1', bg: 'bg-purple', url: '/pages/yuqing/rule/manage' },
  { key: 'chat', text: '指令交互', icon: 'chat-filled', color: '#13c2c2', bg: 'bg-cyan', url: '/pages/yuqing/chat/index' },
  { key: 'report', text: '报告中心', icon: 'compose', color: '#faad14', bg: 'bg-orange', url: '/pages/yuqing/report/index' },
  { key: 'opinion', text: '台账查阅', icon: 'search', color: '#52c41a', bg: 'bg-green', url: '/pages/yuqing/opinion/index' },
  { key: 'mine', text: '我的', icon: 'person-filled', color: '#8c8c8c', bg: 'bg-gray', url: '/pages/yuqing/mine' },
]

function today() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

onShow(() => {
  load()
})

onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})

async function load() {
  if (loading.value) return
  loading.value = true
  // 四路并发，任一失败不影响其他模块展示
  await Promise.allSettled([loadPendingAlert(), loadStats(), loadReports(), loadAnalysis()])
  loading.value = false
}

async function loadPendingAlert() {
  try {
    const res: any = await listYqAlert({ pageNum: 1, pageSize: 1, status: 'pending' })
    pendingAlert.value = Number(res?.total ?? 0)
  } catch (e) {
    pendingAlert.value = 0
  }
}

async function loadStats() {
  try {
    const res: any = await listYqStatsDaily({ pageNum: 1, pageSize: 1, statsDate: today() })
    const rows = res?.rows ?? []
    todayStats.value = rows[0] ?? {}
  } catch (e) {
    todayStats.value = {}
  }
}

async function loadReports() {
  try {
    const res: any = await listYqReport({ pageNum: 1, pageSize: 5, submitStatus: 'unsubmitted' })
    todoReports.value = res?.rows ?? []
  } catch (e) {
    todoReports.value = []
  }
}

async function loadAnalysis() {
  try {
    const res: any = await listYqOpinionAnalysis({ pageNum: 1, pageSize: 5 })
    recentAnalysis.value = res?.rows ?? []
  } catch (e) {
    recentAnalysis.value = []
  }
}

function go(url: string) {
  uni.navigateTo({ url })
}

function goAlert() {
  uni.navigateTo({ url: '/pages/yuqing/opinion/index?tab=alert' })
}

function goReport(id: any) {
  uni.navigateTo({ url: `/pages/yuqing/report/preview?reportId=${id}` })
}

function goOpinionDetail(item: any) {
  if (item?.opinionId) {
    uni.navigateTo({ url: `/pages/yuqing/opinion/detail?opinionId=${item.opinionId}` })
  }
}

/** 数字千分位 */
function num(v: any) {
  if (v == null || v === '') return '0'
  return Number(v).toLocaleString('en-US')
}
</script>

<template>
  <view class="page">
    <!-- 待处置预警大卡 -->
    <view class="hero" @click="goAlert">
      <view class="hero-left">
        <text class="hero-label">待处置预警</text>
        <text class="hero-num">{{ pendingAlert }}</text>
        <text class="hero-hint">{{ pendingAlert > 0 ? '点击查看预警详情' : '当前无待处置预警' }}</text>
      </view>
      <view class="hero-right">
        <uni-icons type="notification-filled" size="42" color="rgba(255,255,255,0.9)"></uni-icons>
      </view>
    </view>

    <!-- 当日采集概况 -->
    <view class="card">
      <view class="card-title">
        <text class="title-text">当日采集概况</text>
        <text class="title-sub">{{ today() }}</text>
      </view>
      <view class="stat-row">
        <view class="stat-cell">
          <text class="stat-num">{{ num(todayStats.totalCount) }}</text>
          <text class="stat-label">采集总量</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num danger">{{ num(todayStats.negativeCount) }}</text>
          <text class="stat-label">负面</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num warn">{{ num(todayStats.alertCount) }}</text>
          <text class="stat-label">预警</text>
        </view>
        <view class="stat-cell">
          <text class="stat-num success">{{ num(todayStats.pushCount) }}</text>
          <text class="stat-label">已推送</text>
        </view>
      </view>
      <view class="stat-foot">
        <text class="foot-item">去重剔除 {{ num(todayStats.dupCount) }}</text>
        <text class="foot-item">降噪剔除 {{ num(todayStats.rejectedCount) }}</text>
        <text class="foot-item">负面占比 {{ todayStats.negativeRate != null ? todayStats.negativeRate + '%' : '-' }}</text>
      </view>
    </view>

    <!-- 功能宫格 -->
    <view class="card">
      <view class="card-title"><text class="title-text">功能入口</text></view>
      <view class="grid-body">
        <view v-for="m in modules" :key="m.key" class="grid-item" @click="go(m.url)">
          <view class="icon-wrap" :class="m.bg">
            <uni-icons :type="m.icon" size="26" :color="m.color"></uni-icons>
          </view>
          <text class="grid-text">{{ m.text }}</text>
        </view>
      </view>
    </view>

    <!-- 待办报告 -->
    <view class="card">
      <view class="card-title">
        <text class="title-text">待办报告</text>
        <text class="title-more" @click="go('/pages/yuqing/report/index')">全部 ></text>
      </view>
      <view v-if="todoReports.length">
        <view v-for="r in todoReports" :key="r.reportId" class="row" @click="goReport(r.reportId)">
          <view class="row-main">
            <text class="row-title">{{ r.reportName || '未命名报告' }}</text>
            <text class="row-meta">
              {{ labelOf(REPORT_TYPE_MAP, r.reportType) }} · {{ r.reportDate || '-' }}
            </text>
          </view>
          <text class="row-tag" :class="reportStatusClass(r.status)">
            {{ labelOf(REPORT_STATUS_MAP, r.status) }}
          </text>
        </view>
      </view>
      <view v-else class="empty-inline">
        <text class="empty-text">暂无待办报告</text>
      </view>
    </view>

    <!-- 最近研判结论 -->
    <view class="card">
      <view class="card-title">
        <text class="title-text">最近研判结论</text>
      </view>
      <view v-if="recentAnalysis.length">
        <view v-for="a in recentAnalysis" :key="a.analysisId || a.id" class="row" @click="goOpinionDetail(a)">
          <view class="row-main">
            <text class="row-title">{{ a.opinionTitle || a.title || '未关联标题' }}</text>
            <text class="row-meta">
              {{ labelOf(SENTI_ATTR_MAP, a.sentiAttr) }} · {{ labelOf(ALERT_LEVEL_MAP, a.alertLevel) }}
            </text>
          </view>
          <text class="row-tag" :class="sentiClass(a.sentiAttr)">
            {{ labelOf(SENTI_ATTR_MAP, a.sentiAttr) }}
          </text>
        </view>
      </view>
      <view v-else class="empty-inline">
        <text class="empty-text">暂无研判结论</text>
      </view>
    </view>

    <view class="footer-tip">
      <text class="footer-text">{{ loading ? '数据加载中…' : '下拉可刷新' }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.hero {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #1677ff 0%, #3f8cff 100%);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 6px 18px rgba(22, 119, 255, 0.22);

  .hero-left {
    display: flex;
    flex-direction: column;
  }

  .hero-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.88);
  }

  .hero-num {
    font-size: 38px;
    font-weight: 700;
    color: #ffffff;
    line-height: 46px;
  }

  .hero-hint {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.78);
  }
}

.card {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.card-title {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .title-text {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
  }

  .title-sub {
    font-size: 12px;
    color: #999999;
  }

  .title-more {
    font-size: 12px;
    color: #1677ff;
  }
}

.stat-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.stat-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;

  .stat-num {
    font-size: 20px;
    font-weight: 700;
    color: #333333;

    &.danger {
      color: #f56c6c;
    }

    &.warn {
      color: #faad14;
    }

    &.success {
      color: #52c41a;
    }
  }

  .stat-label {
    margin-top: 4px;
    font-size: 12px;
    color: #999999;
  }
}

.stat-foot {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .foot-item {
    font-size: 12px;
    color: #8c8c8c;
  }
}

.grid-body {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.grid-item {
  width: 33.33%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.icon-wrap {
  width: 46px;
  height: 46px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.bg-blue {
  background-color: rgba(22, 119, 255, 0.1);
}

.bg-purple {
  background-color: rgba(114, 46, 209, 0.1);
}

.bg-cyan {
  background-color: rgba(19, 194, 194, 0.1);
}

.bg-orange {
  background-color: rgba(250, 173, 20, 0.1);
}

.bg-green {
  background-color: rgba(82, 196, 26, 0.1);
}

.bg-gray {
  background-color: rgba(140, 140, 140, 0.1);
}

.grid-text {
  font-size: 12px;
  color: #666666;
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.row-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-right: 10px;
  overflow: hidden;
}

.row-title {
  font-size: 14px;
  color: #333333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #999999;
}

.row-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9px;
  flex-shrink: 0;

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

.empty-inline {
  padding: 18px 0;
  display: flex;
  align-items: center;
  justify-content: center;

  .empty-text {
    font-size: 13px;
    color: #b0b0b0;
  }
}

.footer-tip {
  padding: 18px 0 4px;
  text-align: center;

  .footer-text {
    font-size: 12px;
    color: #b0b0b0;
  }
}
</style>
