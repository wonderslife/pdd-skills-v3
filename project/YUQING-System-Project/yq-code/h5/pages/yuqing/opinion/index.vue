<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '台账查阅',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 台账查阅（PRD 模块12 验收标准 9）
 * 三个视图：预警台账 / 研判结论 / 舆情明细，与 PC 端实时同源。
 */
import { ref } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { listYqAlert } from '@/api/yuqing/alert'
import { listYqOpinionAnalysis } from '@/api/yuqing/opinionAnalysis'
import { listYqOpinion } from '@/api/yuqing/opinion'
import {
  ALERT_LEVEL_MAP,
  ALERT_STATUS_MAP,
  SENTI_ATTR_MAP,
  OPINION_LEVEL_MAP,
  ANALYZE_STATUS_MAP,
  labelOf,
  sentiClass,
  levelClass,
  alertStatusClass,
} from '@/utils/yuqingDict'

type TabKey = 'alert' | 'analysis' | 'opinion'

const tab = ref<TabKey>('alert')
const taskId = ref('')

const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const pageNum = ref(1)
const pageSize = 10

/** 预警状态筛选 */
const alertStatus = ref('')

onLoad((options: any) => {
  if (options?.tab === 'alert' || options?.tab === 'analysis' || options?.tab === 'opinion') {
    tab.value = options.tab
  }
  if (options?.taskId) taskId.value = String(options.taskId)
  refresh()
})

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(() => loadMore())

function switchTab(t: TabKey) {
  if (tab.value === t) return
  tab.value = t
  refresh()
}

function switchAlertStatus(s: string) {
  alertStatus.value = s
  refresh()
}

async function refresh() {
  pageNum.value = 1
  finished.value = false
  list.value = []
  await load()
}

async function loadMore() {
  if (finished.value || loading.value) return
  pageNum.value += 1
  await load()
}

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const params: any = { pageNum: pageNum.value, pageSize }
    let res: any
    if (tab.value === 'alert') {
      if (alertStatus.value) params.status = alertStatus.value
      res = await listYqAlert(params)
    } else if (tab.value === 'analysis') {
      res = await listYqOpinionAnalysis(params)
    } else {
      if (taskId.value) params.taskId = taskId.value
      res = await listYqOpinion(params)
    }
    const rows = res?.rows ?? []
    const count = Number(res?.total ?? 0)
    total.value = count
    list.value = pageNum.value === 1 ? rows : [...list.value, ...rows]
    finished.value = list.value.length >= count || rows.length < pageSize
  } catch (e) {
    finished.value = true
  } finally {
    loading.value = false
  }
}

function goAlertDetail(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/opinion/detail?alertId=${item.alertId}&opinionId=${item.opinionId || ''}` })
}

function goAnalysisDetail(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/opinion/detail?opinionId=${item.opinionId || ''}` })
}

function goOpinionDetail(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/opinion/detail?opinionId=${item.opinionId}` })
}

function openLink(url: string) {
  if (!url) return
  // #ifdef H5
  window.open(url, '_blank')
  return
  // #endif
  // #ifndef H5
  uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制', icon: 'none' }) })
  // #endif
}
</script>

<template>
  <view class="page">
    <view class="tabs">
      <text class="tab" :class="{ active: tab === 'alert' }" @click="switchTab('alert')">预警台账</text>
      <text class="tab" :class="{ active: tab === 'analysis' }" @click="switchTab('analysis')">研判结论</text>
      <text class="tab" :class="{ active: tab === 'opinion' }" @click="switchTab('opinion')">舆情明细</text>
    </view>

    <!-- 预警状态筛选 -->
    <view v-if="tab === 'alert'" class="filters">
      <text class="filter" :class="{ active: alertStatus === '' }" @click="switchAlertStatus('')">全部</text>
      <text
        v-for="(label, val) in ALERT_STATUS_MAP"
        :key="val"
        class="filter"
        :class="{ active: alertStatus === val }"
        @click="switchAlertStatus(val)"
      >
        {{ label }}
      </text>
    </view>

    <view v-if="taskId" class="task-tip">
      <text class="tip-text">已按任务筛选</text>
      <text class="tip-clear" @click="taskId = ''; refresh()">清除</text>
    </view>

    <view class="summary"><text class="summary-text">共 {{ total }} 条</text></view>

    <!-- 预警台账 -->
    <template v-if="tab === 'alert'">
      <view v-for="item in list" :key="item.alertId" class="card" @click="goAlertDetail(item)">
        <view class="card-head">
          <text class="card-title">{{ item.alertTitle || '未命名预警' }}</text>
          <text class="badge" :class="levelClass(item.alertLevel)">{{ labelOf(ALERT_LEVEL_MAP, item.alertLevel) }}</text>
        </view>
        <view class="meta">
          <text class="meta-item">触发场景：{{ labelOf(ALERT_LEVEL_MAP, item.triggerScene) }}</text>
          <text class="meta-item">触发值：{{ item.triggerValue || '-' }}</text>
          <text class="meta-item">触发时间：{{ item.triggerTime || '-' }}</text>
          <text class="meta-item">关联舆情：{{ item.opinionTitle || '-' }}</text>
        </view>
        <view class="foot">
          <text class="status" :class="alertStatusClass(item.status)">{{ labelOf(ALERT_STATUS_MAP, item.status) }}</text>
          <text class="arrow">详情 ></text>
        </view>
      </view>
    </template>

    <!-- 研判结论 -->
    <template v-if="tab === 'analysis'">
      <view v-for="a in list" :key="a.analysisId || a.id" class="card" @click="goAnalysisDetail(a)">
        <view class="card-head">
          <text class="card-title">{{ a.opinionTitle || a.title || '研判结论' }}</text>
          <text class="badge" :class="sentiClass(a.sentiAttr)">{{ labelOf(SENTI_ATTR_MAP, a.sentiAttr) }}</text>
        </view>
        <view class="meta">
          <text class="meta-item">分级：{{ labelOf(OPINION_LEVEL_MAP, a.opinionLevel) }}</text>
          <text class="meta-item">风险：{{ labelOf(OPINION_LEVEL_MAP, a.riskLevel) }}</text>
          <text class="meta-item">热度：{{ a.heatScore != null ? a.heatScore : '-' }}</text>
          <text class="meta-item">状态：{{ labelOf(ANALYZE_STATUS_MAP, a.analyzeStatus) }}</text>
        </view>
        <view v-if="a.summary || a.conclusion" class="conclusion">
          <text class="conclusion-text">{{ a.summary || a.conclusion }}</text>
        </view>
        <view class="foot">
          <text class="status info">详情 ></text>
        </view>
      </view>
    </template>

    <!-- 舆情明细 -->
    <template v-if="tab === 'opinion'">
      <view v-for="o in list" :key="o.opinionId" class="card" @click="goOpinionDetail(o)">
        <view class="card-head">
          <text class="card-title">{{ o.title || '无标题' }}</text>
          <text class="badge" :class="sentiClass(o.sentiAttr)">{{ labelOf(SENTI_ATTR_MAP, o.sentiAttr) }}</text>
        </view>
        <view class="meta">
          <text class="meta-item">作者：{{ o.author || '-' }}</text>
          <text class="meta-item">发布：{{ o.publishTime || '-' }}</text>
          <text class="meta-item">分级：{{ labelOf(OPINION_LEVEL_MAP, o.opinionLevel) }}</text>
          <text class="meta-item">热度：{{ o.heatScore != null ? o.heatScore : '-' }}</text>
        </view>
        <view class="foot">
          <text v-if="o.opinionUrl" class="link" @click.stop="openLink(o.opinionUrl)">原文链接</text>
          <text class="arrow">详情 ></text>
        </view>
      </view>
    </template>

    <view v-if="!list.length && !loading" class="empty">
      <uni-icons type="search" size="46" color="#c0c4cc"></uni-icons>
      <text class="empty-text">暂无数据</text>
    </view>

    <view v-if="list.length && finished" class="load-more"><text class="load-more-text">没有更多了</text></view>
    <view v-if="loading" class="load-more"><text class="load-more-text">加载中...</text></view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.tabs {
  display: flex;
  flex-direction: row;
  background-color: #ffffff;
  border-radius: 10px;
  padding: 4px;
}

.tab {
  flex: 1;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 14px;
  color: #666666;
  border-radius: 8px;

  &.active {
    color: #ffffff;
    background-color: #1677ff;
  }
}

.filters {
  margin-top: 12px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.filter {
  font-size: 12px;
  color: #666666;
  background-color: #ffffff;
  border-radius: 14px;
  padding: 5px 13px;
  margin: 0 8px 8px 0;

  &.active {
    color: #ffffff;
    background-color: #1677ff;
  }
}

.task-tip {
  margin-top: 10px;
  background-color: rgba(22, 119, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .tip-text {
    font-size: 12px;
    color: #1677ff;
  }

  .tip-clear {
    font-size: 12px;
    color: #f56c6c;
  }
}

.summary {
  padding: 12px 2px 10px;

  .summary-text {
    font-size: 13px;
    color: #999999;
  }
}

.card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.card-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;

  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
    flex: 1;
    padding-right: 10px;
    line-height: 22px;
  }

  .badge {
    font-size: 11px;
    padding: 2px 9px;
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

.conclusion {
  margin-top: 10px;
  background-color: #f7f8fa;
  border-radius: 8px;
  padding: 10px 12px;

  .conclusion-text {
    font-size: 13px;
    color: #666666;
    line-height: 20px;
  }
}

.foot {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .status {
    font-size: 12px;

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
      color: #1677ff;
    }
  }

  .link {
    font-size: 12px;
    color: #1677ff;
  }

  .arrow {
    font-size: 12px;
    color: #1677ff;
  }
}

.empty {
  margin-top: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .empty-text {
    margin-top: 12px;
    font-size: 14px;
    color: #b0b0b0;
  }
}

.load-more {
  padding: 16px 0;
  text-align: center;

  .load-more-text {
    font-size: 12px;
    color: #b0b0b0;
  }
}
</style>
