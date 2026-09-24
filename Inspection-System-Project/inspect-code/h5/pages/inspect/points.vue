<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '可巡检点位',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white'
  },
})

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { myInspectPointList } from '@/api/inspect/point'
import { POINT_STATUS_MAP, labelOf } from '@/utils/inspectDict'

const list = ref<any[]>([])
const loading = ref(true)
const keyword = ref('')

/** 按关键字过滤（点位名称 / 编码 / 机房） */
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((i: any) => {
    return (
      String(i.pointName || '').toLowerCase().indexOf(kw) >= 0 ||
      String(i.pointCode || '').toLowerCase().indexOf(kw) >= 0 ||
      String(i.roomName || '').toLowerCase().indexOf(kw) >= 0
    )
  })
})

onLoad(() => {
  load()
})

async function load() {
  loading.value = true
  try {
    const data: any = await myInspectPointList()
    list.value = data || []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function goExecute(item: any) {
  uni.navigateTo({ url: `/pages/inspect/execute?pointId=${item.pointId}` })
}
</script>

<template>
  <view class="page">
    <view class="search-box">
      <input v-model="keyword" class="search-input" type="text" placeholder="搜索点位名称 / 编码 / 机房" />
    </view>

    <view class="count-tip">共 {{ filtered.length }} 个可巡检点位</view>

    <view v-for="item in filtered" :key="item.pointId" class="point-card" @click="goExecute(item)">
      <view class="point-head">
        <text class="point-name">{{ item.pointName }}</text>
        <text class="point-status">{{ labelOf(POINT_STATUS_MAP, item.status) }}</text>
      </view>
      <view class="point-meta">
        <text class="meta-item">编码：{{ item.pointCode }}</text>
        <text class="meta-item">机房：{{ item.roomName || '-' }}</text>
        <text class="meta-item">位置：{{ item.location || '-' }}</text>
      </view>
      <view class="point-foot">
        <text class="last-time">上次巡检：{{ item.lastInspectTime || '暂无' }}</text>
        <uni-icons type="right" size="16" color="#c0c4cc"></uni-icons>
      </view>
    </view>

    <view v-if="!loading && !filtered.length" class="empty">
      <uni-icons type="location" size="48" color="#c0c4cc"></uni-icons>
      <text class="empty-text">暂无可巡检点位</text>
      <button class="empty-btn" @click="load">重新加载</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px 24px;
}

.search-box {
  background-color: #ffffff;
  border-radius: 10px;
  padding: 6px 12px;

  .search-input {
    height: 36px;
    font-size: 14px;
    color: #333333;
  }
}

.count-tip {
  padding: 12px 2px 8px;
  font-size: 13px;
  color: #999999;
}

.point-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.point-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .point-name {
    font-size: 16px;
    font-weight: 600;
    color: #333333;
  }

  .point-status {
    font-size: 12px;
    color: #52c41a;
    background-color: rgba(82, 196, 26, 0.12);
    padding: 2px 10px;
    border-radius: 10px;
  }
}

.point-meta {
  margin-top: 8px;

  .meta-item {
    display: block;
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.point-foot {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .last-time {
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
</style>
