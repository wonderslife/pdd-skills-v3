<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '我的巡检记录',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white'
  },
})

import { ref } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { listMyInspectRecord } from '@/api/inspect/record'
import { RECORD_RESULT_MAP, RECORD_SOURCE_MAP, labelOf } from '@/utils/inspectDict'

const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const pageNum = ref(1)
const pageSize = 10

onLoad(() => {
  refresh()
})

onPullDownRefresh(async () => {
  await refresh()
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  loadMore()
})

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
    const res: any = await listMyInspectRecord({ pageNum: pageNum.value, pageSize })
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

function goDetail(item: any) {
  uni.navigateTo({ url: `/pages/inspect/detail?recordId=${item.recordId}` })
}

/** 结果标签样式 */
function resultClass(result: string) {
  if (result === 'completed_abnormal') return 'danger'
  if (result === 'completed_normal') return 'success'
  return 'info'
}
</script>

<template>
  <view class="page">
    <view v-if="list.length" class="summary">
      <text class="summary-text">共 {{ total }} 条巡检记录</text>
    </view>

    <view v-for="item in list" :key="item.recordId" class="record-card" @click="goDetail(item)">
      <view class="record-head">
        <text class="record-name">{{ item.pointName || '未知点位' }}</text>
        <text class="record-result" :class="resultClass(item.result)">{{ labelOf(RECORD_RESULT_MAP, item.result) }}</text>
      </view>
      <view class="record-meta">
        <text class="meta-item">机房：{{ item.roomName || '-' }}</text>
        <text class="meta-item">巡检时间：{{ item.inspectTime || '-' }}</text>
        <text class="meta-item">来源：{{ labelOf(RECORD_SOURCE_MAP, item.source) }}</text>
      </view>
      <view class="record-foot">
        <text v-if="item.abnormalCount > 0" class="abnormal-tag">异常 {{ item.abnormalCount }} 项</text>
        <text v-else class="normal-tag">无异常</text>
        <text class="duration">{{ item.duration != null ? item.duration + ' 秒' : '' }}</text>
      </view>
    </view>

    <view v-if="!list.length && !loading" class="empty">
      <uni-icons type="folder-add" size="48" color="#c0c4cc"></uni-icons>
      <text class="empty-text">暂无巡检记录</text>
      <button class="empty-btn" @click="refresh">重新加载</button>
    </view>

    <view v-if="list.length && finished" class="load-more">
      <text class="load-more-text">没有更多了</text>
    </view>
    <view v-if="loading" class="load-more">
      <text class="load-more-text">加载中...</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px 24px;
}

.summary {
  padding: 4px 2px 10px;

  .summary-text {
    font-size: 13px;
    color: #999999;
  }
}

.record-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.record-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .record-name {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
  }

  .record-result {
    font-size: 12px;
    padding: 2px 10px;
    border-radius: 10px;

    &.success {
      color: #52c41a;
      background-color: rgba(82, 196, 26, 0.12);
    }

    &.danger {
      color: #f56c6c;
      background-color: rgba(245, 108, 108, 0.12);
    }

    &.info {
      color: #8c8c8c;
      background-color: rgba(140, 140, 140, 0.12);
    }
  }
}

.record-meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;

  .meta-item {
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.record-foot {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .abnormal-tag {
    font-size: 12px;
    color: #f56c6c;
  }

  .normal-tag {
    font-size: 12px;
    color: #52c41a;
  }

  .duration {
    font-size: 12px;
    color: #999999;
  }
}

.empty {
  margin-top: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .empty-text {
    margin-top: 12px;
    font-size: 14px;
    color: #999999;
  }

  .empty-btn {
    margin-top: 20px;
    height: 38px;
    line-height: 38px;
    padding: 0 26px;
    border-radius: 19px;
    background-color: #1677ff;
    color: #ffffff;
    font-size: 14px;
    border: none;
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
