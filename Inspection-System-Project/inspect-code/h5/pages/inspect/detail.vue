<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '巡检记录详情',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white'
  },
})

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getInspectRecord } from '@/api/inspect/record'
import {
  ITEM_RESULT_MAP,
  RECORD_RESULT_MAP,
  RECORD_SOURCE_MAP,
  labelOf,
} from '@/utils/inspectDict'

const recordId = ref<string | number | null>(null)
const detail = ref<any>(null)
const loading = ref(true)

/** 汇总全部照片，供大图预览 */
const allPhotos = computed(() => {
  const set: string[] = []
  const push = (u: string) => {
    if (u && set.indexOf(u) < 0) set.push(u)
  }
  ;(detail.value?.itemResults || []).forEach((it: any) => {
    ;(it.photoUrls || []).forEach((u: string) => push(u))
  })
  return set
})

onLoad((options: any) => {
  recordId.value = options?.recordId ?? null
  if (recordId.value) load()
  else loading.value = false
})

async function load() {
  loading.value = true
  try {
    const data: any = await getInspectRecord(recordId.value)
    detail.value = data
  } catch (e) {
    // 错误文案已由拦截器 toast
  } finally {
    loading.value = false
  }
}

function previewItem(photos: string[], index: number) {
  if (!photos || !photos.length) return
  uni.previewImage({ urls: photos, current: index })
}

function previewAll(index: number) {
  if (!allPhotos.value.length) return
  uni.previewImage({ urls: allPhotos.value, current: index })
}

function itemClass(result: string) {
  if (result === 'abnormal') return 'danger'
  if (result === 'normal') return 'success'
  return 'info'
}
</script>

<template>
  <view class="page">
    <view class="card">
      <view class="head">
        <text class="name">{{ detail?.pointName || '巡检记录' }}</text>
        <text class="result">{{ labelOf(RECORD_RESULT_MAP, detail?.result) }}</text>
      </view>
      <view class="meta">
        <view class="meta-row"><text class="label">所属机房</text><text class="value">{{ detail?.roomName || '-' }}</text></view>
        <view class="meta-row"><text class="label">巡检时间</text><text class="value">{{ detail?.inspectTime || '-' }}</text></view>
        <view class="meta-row"><text class="label">数据来源</text><text class="value">{{ labelOf(RECORD_SOURCE_MAP, detail?.source) }}</text></view>
        <view class="meta-row"><text class="label">耗时</text><text class="value">{{ detail?.duration != null ? detail.duration + ' 秒' : '-' }}</text></view>
        <view class="meta-row"><text class="label">异常项数</text><text class="value">{{ detail?.abnormalCount ?? 0 }}</text></view>
        <view class="meta-row"><text class="label">巡检备注</text><text class="value">{{ detail?.remark || '-' }}</text></view>
        <view class="meta-row"><text class="label">管理员备注</text><text class="value">{{ detail?.adminRemark || '-' }}</text></view>
      </view>
    </view>

    <view class="section-title">巡检项明细</view>
    <view v-for="(item, idx) in detail?.itemResults || []" :key="idx" class="card item-card">
      <view class="item-head">
        <text class="item-index">{{ idx + 1 }}</text>
        <text class="item-name">{{ item.itemName }}</text>
        <text class="item-result" :class="itemClass(item.result)">{{ labelOf(ITEM_RESULT_MAP, item.result) }}</text>
      </view>
      <view v-if="item.value" class="item-line">数值：{{ item.value }}</view>
      <view v-if="item.description" class="item-line danger-text">异常说明：{{ item.description }}</view>
      <view v-if="item.photoUrls && item.photoUrls.length" class="photo-grid">
        <image
          v-for="(url, pi) in item.photoUrls"
          :key="pi"
          class="photo"
          :src="url"
          mode="aspectFill"
          @click="previewItem(item.photoUrls, pi)"
        />
      </view>
    </view>

    <template v-if="allPhotos.length">
      <view class="section-title">全部照片（{{ allPhotos.length }} 张）</view>
      <view class="card">
        <view class="photo-grid">
          <image
            v-for="(url, pi) in allPhotos"
            :key="pi"
            class="photo"
            :src="url"
            mode="aspectFill"
            @click="previewAll(pi)"
          />
        </view>
      </view>
    </template>

    <view v-if="!loading && !detail" class="empty">
      <text class="empty-text">未找到该巡检记录</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px 32px;
}

.card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .name {
    font-size: 17px;
    font-weight: 600;
    color: #333333;
  }

  .result {
    font-size: 12px;
    color: #1677ff;
    background-color: rgba(22, 119, 255, 0.1);
    padding: 2px 10px;
    border-radius: 10px;
  }
}

.meta {
  margin-top: 10px;
}

.meta-row {
  display: flex;
  flex-direction: row;
  padding: 4px 0;

  .label {
    width: 90px;
    font-size: 13px;
    color: #999999;
  }

  .value {
    flex: 1;
    font-size: 13px;
    color: #333333;
  }
}

.section-title {
  padding: 6px 2px 10px;
  font-size: 14px;
  font-weight: 600;
  color: #333333;
}

.item-head {
  display: flex;
  flex-direction: row;
  align-items: center;

  .item-index {
    width: 20px;
    height: 20px;
    line-height: 20px;
    text-align: center;
    border-radius: 50%;
    background-color: #1677ff;
    color: #ffffff;
    font-size: 12px;
  }

  .item-name {
    flex: 1;
    margin-left: 8px;
    font-size: 15px;
    color: #333333;
  }

  .item-result {
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

.item-line {
  margin-top: 8px;
  font-size: 13px;
  color: #666666;
}

.danger-text {
  color: #f56c6c;
}

.photo-grid {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .photo {
    width: 90px;
    height: 90px;
    border-radius: 8px;
    margin-right: 10px;
    margin-bottom: 10px;
  }
}

.empty {
  margin-top: 120px;
  text-align: center;

  .empty-text {
    font-size: 14px;
    color: #999999;
  }
}
</style>
