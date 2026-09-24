<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '报告中心',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 报告中心（PRD 模块12 验收标准 7、9）
 * 一键触发报告生成、查看报告台账、进入在线预览与线上提交。
 */
import { ref } from 'vue'
import { onShow, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { listYqReport, addYqReport } from '@/api/yuqing/report'
import { listYqReportTemplate } from '@/api/yuqing/reportTemplate'
import { modal } from '@/plugins'
import { REPORT_TYPE_MAP, REPORT_STATUS_MAP, SUBMIT_STATUS_MAP, labelOf, reportStatusClass } from '@/utils/yuqingDict'

const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const pageNum = ref(1)
const pageSize = 10

const filterType = ref('')
const generating = ref(false)

onShow(() => refresh())

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(() => loadMore())

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
    const res: any = await listYqReport({
      pageNum: pageNum.value,
      pageSize,
      reportType: filterType.value || undefined,
    })
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

function switchType(t: string) {
  filterType.value = t
  refresh()
}

/** 一键生成：默认取该类型下第一个可用模板 */
async function generate(type: string) {
  if (generating.value) return
  generating.value = true
  uni.showLoading({ title: '提交生成' })
  try {
    let templateId: any = undefined
    try {
      const tpl: any = await listYqReportTemplate({ pageNum: 1, pageSize: 1, status: '0' })
      templateId = tpl?.rows?.[0]?.templateId
    } catch (e) {
      // 无模板也可生成（后端使用默认模板）
    }
    const today = new Date()
    const reportDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`
    await addYqReport({ reportType: type, reportDate, templateId, triggerType: 'manual' })
    uni.hideLoading()
    modal.msg('已提交生成，完成后可在列表中查看')
    refresh()
  } catch (e) {
    uni.hideLoading()
  } finally {
    generating.value = false
  }
}

function goPreview(item: any) {
  uni.navigateTo({ url: `/pages/yuqing/report/preview?reportId=${item.reportId}` })
}

/** 生成失败时展示原因 */
function failReason(item: any) {
  if (item.status !== 'failed') return ''
  return item.failReason ? `失败原因：${item.failReason}` : '生成失败'
}
</script>

<template>
  <view class="page">
    <!-- 一键生成 -->
    <view class="gen-card">
      <text class="gen-title">一键出报</text>
      <view class="gen-btns">
        <text class="gen-btn" @click="generate('flash')">
          <uni-icons type="paperplane-filled" size="18" color="#ffffff"></uni-icons>
          <text class="gen-text">快报</text>
        </text>
        <text class="gen-btn" @click="generate('daily')">
          <uni-icons type="calendar-filled" size="18" color="#ffffff"></uni-icons>
          <text class="gen-text">日报</text>
        </text>
        <text class="gen-btn" @click="generate('monthly')">
          <uni-icons type="bars" size="18" color="#ffffff"></uni-icons>
          <text class="gen-text">月报</text>
        </text>
        <text class="gen-btn" @click="generate('special')">
          <uni-icons type="star-filled" size="18" color="#ffffff"></uni-icons>
          <text class="gen-text">专项</text>
        </text>
      </view>
    </view>

    <!-- 类型筛选 -->
    <view class="filters">
      <text class="filter" :class="{ active: filterType === '' }" @click="switchType('')">全部</text>
      <text
        v-for="(label, val) in REPORT_TYPE_MAP"
        :key="val"
        class="filter"
        :class="{ active: filterType === val }"
        @click="switchType(val)"
      >
        {{ label }}
      </text>
    </view>

    <view class="summary"><text class="summary-text">共 {{ total }} 份报告</text></view>

    <view v-for="item in list" :key="item.reportId" class="report-card" @click="goPreview(item)">
      <view class="rc-head">
        <text class="rc-name">{{ item.reportName || '未命名报告' }}</text>
        <text class="rc-status" :class="reportStatusClass(item.status)">
          {{ labelOf(REPORT_STATUS_MAP, item.status) }}
        </text>
      </view>
      <view class="rc-meta">
        <text class="meta-item">类型：{{ labelOf(REPORT_TYPE_MAP, item.reportType) }}</text>
        <text class="meta-item">日期：{{ item.reportDate || '-' }}</text>
        <text class="meta-item">模板：{{ item.templateName || '-' }}</text>
        <text class="meta-item">纳入舆情：{{ item.opinionCount != null ? item.opinionCount : '-' }} 条</text>
      </view>
      <view class="rc-foot">
        <text class="submit-tag" :class="item.submitStatus === 'submitted' ? 'ok' : 'no'">
          {{ labelOf(SUBMIT_STATUS_MAP, item.submitStatus) }}
        </text>
        <text v-if="failReason(item)" class="fail-text">{{ failReason(item) }}</text>
        <text v-else class="view-text">查看详情 ></text>
      </view>
    </view>

    <view v-if="!list.length && !loading" class="empty">
      <uni-icons type="compose" size="46" color="#c0c4cc"></uni-icons>
      <text class="empty-text">暂无报告</text>
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

.gen-card {
  background: linear-gradient(135deg, #1677ff 0%, #3f8cff 100%);
  border-radius: 14px;
  padding: 16px;
  box-shadow: 0 6px 18px rgba(22, 119, 255, 0.22);

  .gen-title {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
  }
}

.gen-btns {
  margin-top: 14px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.gen-btn {
  flex: 1;
  margin-right: 8px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.18);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  &:last-child {
    margin-right: 0;
  }

  .gen-text {
    margin-left: 4px;
    font-size: 13px;
    color: #ffffff;
  }
}

.filters {
  margin-top: 14px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.filter {
  font-size: 13px;
  color: #666666;
  background-color: #ffffff;
  border-radius: 15px;
  padding: 6px 15px;
  margin: 0 8px 8px 0;

  &.active {
    color: #ffffff;
    background-color: #1677ff;
  }
}

.summary {
  padding: 4px 2px 10px;

  .summary-text {
    font-size: 13px;
    color: #999999;
  }
}

.report-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.rc-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .rc-name {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
    flex: 1;
    padding-right: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rc-status {
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

.rc-meta {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .meta-item {
    width: 50%;
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.rc-foot {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .submit-tag {
    font-size: 12px;

    &.ok {
      color: #52c41a;
    }

    &.no {
      color: #faad14;
    }
  }

  .fail-text {
    font-size: 12px;
    color: #f56c6c;
    flex: 1;
    text-align: right;
    padding-left: 10px;
  }

  .view-text {
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
