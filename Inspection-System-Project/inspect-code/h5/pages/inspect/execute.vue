<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '巡检执行',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white'
  },
})

import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { modal } from '@/plugins'
import { getInspectPoint } from '@/api/inspect/point'
import { submitInspectRecord } from '@/api/inspect/record'
import { uploadInspectPhoto } from '@/api/inspect/photo'
import { CYCLE_TYPE_MAP, POINT_STATUS_MAP, labelOf } from '@/utils/inspectDict'

/** 单个巡检项最多照片数（与后端 MAX_PHOTO_PER_POINT 保持一致） */
const MAX_PHOTO = 5

const pointId = ref<string | number | null>(null)
const point = ref<any>(null)
const items = ref<any[]>([])
const overallRemark = ref('')
const loading = ref(true)
const submitting = ref(false)
const startTs = ref(Date.now())
/** 本周期已巡检标记（后端 resolveScan 返回，进入本页前已拦截，这里做二次防御） */
const inspectedInCycle = ref(false)

/** 已填写的巡检项数 */
const doneCount = computed(() => items.value.filter((i: any) => i.result).length)
const totalCount = computed(() => items.value.length)
const cycleText = computed(() => {
  if (!point.value) return '-'
  const base = labelOf(CYCLE_TYPE_MAP, point.value.cycleType)
  return point.value.cycleType === 'custom' ? `${base}（每 ${point.value.cycleValue || '-'} 天）` : base
})

onLoad((options: any) => {
  pointId.value = options?.pointId ?? null
  if (!pointId.value) {
    modal.alert('缺少点位信息，请重新扫码')
    return
  }
  loadPoint()
})

async function loadPoint() {
  loading.value = true
  try {
    const data: any = await getInspectPoint(pointId.value)
    point.value = data
    inspectedInCycle.value = !!data?.inspectedInCycle
    items.value = (data?.itemList || []).map((it: any) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      itemType: it.itemType || 'radio',
      standard: it.standard,
      required: it.required,
      orderNum: it.orderNum,
      // 表单字段
      result: '',
      value: '',
      description: '',
      photos: [],
      uploading: false,
    }))
    if (!items.value.length) {
      modal.alert('该点位未配置巡检项，请联系管理员在 PC 端补充后再巡检')
    }
  } catch (e) {
    // 错误文案已由请求拦截器 toast
  } finally {
    loading.value = false
  }
}

/** 选择判定结果 */
function selectResult(item: any, result: string) {
  item.result = result
  if (result !== 'abnormal') {
    item.description = ''
  }
}

/** 拍照 / 选图并上传 */
async function choosePhoto(item: any) {
  if (item.result !== 'abnormal') {
    modal.msg('请先把该项判定为「异常」再上传照片')
    return
  }
  if (item.photos.length >= MAX_PHOTO) {
    modal.msg(`单个巡检项最多上传 ${MAX_PHOTO} 张照片`)
    return
  }
  uni.chooseImage({
    count: MAX_PHOTO - item.photos.length,
    sizeType: ['compressed', 'original'],
    sourceType: ['camera', 'album'],
    success: async (res: any) => {
      const paths: string[] = res.tempFilePaths || []
      item.uploading = true
      for (const p of paths) {
        try {
          const data: any = await uploadInspectPhoto(p)
          item.photos.push({
            originalUrl: data?.originalUrl,
            originalSize: data?.originalSize,
            compressedUrl: data?.compressedUrl,
            compressedSize: data?.compressedSize,
            fileName: data?.fileName,
            localPath: p,
          })
        } catch (e) {
          modal.msgError('照片上传失败，请重试')
        }
      }
      item.uploading = false
    },
    fail: () => {
      modal.msg('已取消选择')
    },
  })
}

function removePhoto(item: any, index: number) {
  item.photos.splice(index, 1)
}

function previewPhoto(item: any, index: number) {
  const urls = item.photos.map((p: any) => p.localPath || p.originalUrl).filter(Boolean)
  if (!urls.length) return
  uni.previewImage({ urls, current: index })
}

/** 前端校验 */
function validate(): string | null {
  if (inspectedInCycle.value) {
    return '该点位本周期已巡检，无需重复提交'
  }
  if (!items.value.length) {
    return '该点位未配置巡检项'
  }
  for (let i = 0; i < items.value.length; i++) {
    const it = items.value[i]
    if (!it.result) {
      return `第 ${i + 1} 项「${it.itemName}」未选择判定结果`
    }
    if (it.result === 'abnormal') {
      if (!it.description || !String(it.description).trim()) {
        return `第 ${i + 1} 项「${it.itemName}」异常说明不能为空`
      }
      if (!it.photos.length) {
        return `第 ${i + 1} 项「${it.itemName}」异常必须上传至少 1 张照片`
      }
    }
  }
  return null
}

/** 提交巡检记录 */
async function handleSubmit() {
  if (submitting.value) return
  const err = validate()
  if (err) {
    modal.msg(err)
    return
  }
  const duration = Math.max(1, Math.round((Date.now() - startTs.value) / 1000))
  const payload = {
    pointId: point.value.pointId,
    duration,
    remark: overallRemark.value,
    itemResults: items.value.map((it: any, idx: number) => ({
      itemId: it.itemId,
      itemName: it.itemName,
      result: it.result,
      value: it.value,
      description: it.result === 'abnormal' ? it.description : '',
      orderNum: it.orderNum ?? idx,
      photos: it.photos.map((p: any) => ({
        originalUrl: p.originalUrl,
        originalSize: p.originalSize,
        compressedUrl: p.compressedUrl,
        compressedSize: p.compressedSize,
        fileName: p.fileName,
      })),
    })),
  }

  submitting.value = true
  uni.showLoading({ title: '提交中' })
  try {
    await submitInspectRecord(payload)
    uni.hideLoading()
    submitting.value = false
    modal.msgSuccess('巡检记录已提交')
    setTimeout(() => {
      // 返回扫码首页，便于继续巡检下一个点位
      uni.navigateBack({
        fail: () => uni.reLaunch({ url: '/pages/inspect/scan' }),
      })
    }, 800)
  } catch (e) {
    uni.hideLoading()
    submitting.value = false
  }
}

function goRecords() {
  uni.navigateTo({ url: '/pages/inspect/records' })
}
</script>

<template>
  <view class="page">
    <!-- 点位信息 -->
    <view class="point-card">
      <view class="point-head">
        <text class="point-name">{{ point?.pointName || '加载中...' }}</text>
        <text class="point-status">{{ labelOf(POINT_STATUS_MAP, point?.status) }}</text>
      </view>
      <view class="point-meta">
        <text class="meta-item">编码：{{ point?.pointCode || '-' }}</text>
        <text class="meta-item">机房：{{ point?.roomName || '-' }}</text>
        <text class="meta-item">区域：{{ point?.areaName || '-' }}</text>
        <text class="meta-item">位置：{{ point?.location || '-' }}</text>
        <text class="meta-item">周期：{{ cycleText }}</text>
        <text class="meta-item">上次巡检：{{ point?.lastInspectTime || '暂无' }}</text>
      </view>
      <view v-if="point?.gpsEnabled === '1'" class="gps-tip">
        <uni-icons type="location-filled" size="14" color="#faad14"></uni-icons>
        <text class="gps-text">该点位已开启 GPS 校验，请确保在点位现场提交</text>
      </view>
    </view>

    <!-- 进度 -->
    <view class="progress-card">
      <text class="progress-text">已填 {{ doneCount }} / {{ totalCount }} 项</text>
      <view class="progress-tip">
        <text>判定为「异常」的巡检项必须填写说明并上传至少 1 张照片</text>
      </view>
    </view>

    <view v-if="inspectedInCycle" class="warn-card">
      <uni-icons type="info-filled" size="16" color="#e6a23c"></uni-icons>
      <text class="warn-text">该点位本周期已巡检，提交将被服务端拒绝</text>
    </view>

    <!-- 巡检项 -->
    <view v-for="(item, idx) in items" :key="item.itemId" class="item-card">
      <view class="item-head">
        <text class="item-index">{{ idx + 1 }}</text>
        <text class="item-name">{{ item.itemName }}</text>
        <text v-if="item.required === '1'" class="item-required">必填</text>
      </view>
      <view v-if="item.standard" class="item-standard">判定标准：{{ item.standard }}</view>

      <!-- 判定结果 -->
      <view class="result-row">
        <view
          class="result-btn"
          :class="{ active: item.result === 'normal', normal: item.result === 'normal' }"
          @click="selectResult(item, 'normal')"
        >
          正常
        </view>
        <view
          class="result-btn"
          :class="{ active: item.result === 'abnormal', abnormal: item.result === 'abnormal' }"
          @click="selectResult(item, 'abnormal')"
        >
          异常
        </view>
        <view
          class="result-btn"
          :class="{ active: item.result === 'na' }"
          @click="selectResult(item, 'na')"
        >
          不适用
        </view>
      </view>

      <!-- 数值 -->
      <view v-if="item.itemType === 'number'" class="field-row">
        <text class="field-label">填写数值</text>
        <input v-model="item.value" class="field-input" type="digit" placeholder="请输入数值" />
      </view>

      <!-- 异常说明 -->
      <view v-if="item.result === 'abnormal'" class="field-row column">
        <text class="field-label">异常说明（必填）</text>
        <textarea
          v-model="item.description"
          class="field-textarea"
          placeholder="请描述异常现象"
          :maxlength="500"
        />
      </view>

      <!-- 照片 -->
      <view class="photo-area">
        <view class="photo-label">
          <text>{{ item.result === 'abnormal' ? '现场照片（至少 1 张）' : '现场照片（选填）' }}</text>
          <text class="photo-count">{{ item.photos.length }}/{{ MAX_PHOTO }}</text>
        </view>
        <view class="photo-grid">
          <view v-for="(p, pi) in item.photos" :key="pi" class="photo-wrap">
            <image class="photo" :src="p.localPath || p.originalUrl" mode="aspectFill" @click="previewPhoto(item, pi)" />
            <view class="photo-del" @click="removePhoto(item, pi)">
              <uni-icons type="closeempty" size="12" color="#ffffff"></uni-icons>
            </view>
          </view>
          <view
            v-if="item.photos.length < MAX_PHOTO"
            class="photo-add"
            :class="{ disabled: item.result !== 'abnormal' }"
            @click="choosePhoto(item)"
          >
            <uni-icons v-if="!item.uploading" type="camera-filled" size="24" color="#9aa4b2"></uni-icons>
            <text v-else class="uploading">上传中</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 整体备注 -->
    <view class="item-card">
      <view class="field-row column">
        <text class="field-label">整体备注（选填）</text>
        <textarea v-model="overallRemark" class="field-textarea" placeholder="本点位整体情况说明" :maxlength="500" />
      </view>
    </view>

    <!-- 提交 -->
    <view class="footer">
      <button class="ghost-btn" @click="goRecords">我的记录</button>
      <button class="submit-btn" :loading="submitting" :disabled="inspectedInCycle" @click="handleSubmit">
        提交巡检
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px 120px;
}

.point-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.point-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .point-name {
    font-size: 18px;
    font-weight: 600;
    color: #333333;
  }

  .point-status {
    font-size: 12px;
    color: #1677ff;
    background-color: rgba(22, 119, 255, 0.1);
    padding: 2px 10px;
    border-radius: 10px;
  }
}

.point-meta {
  margin-top: 10px;
  display: flex;
  flex-direction: column;

  .meta-item {
    font-size: 13px;
    color: #666666;
    line-height: 22px;
  }
}

.gps-tip {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: rgba(250, 173, 20, 0.1);
  border-radius: 8px;
  padding: 8px 10px;

  .gps-text {
    margin-left: 6px;
    font-size: 12px;
    color: #d48806;
  }
}

.progress-card {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;

  .progress-text {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
  }

  .progress-tip {
    margin-top: 6px;
    font-size: 12px;
    color: #999999;
  }
}

.warn-card {
  margin-top: 12px;
  background-color: rgba(230, 162, 60, 0.12);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: row;
  align-items: center;

  .warn-text {
    margin-left: 6px;
    font-size: 13px;
    color: #b8860b;
  }
}

.item-card {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
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
    font-weight: 600;
    color: #333333;
  }

  .item-required {
    font-size: 11px;
    color: #f56c6c;
  }
}

.item-standard {
  margin-top: 6px;
  font-size: 12px;
  color: #999999;
}

.result-row {
  margin-top: 12px;
  display: flex;
  flex-direction: row;
}

.result-btn {
  flex: 1;
  height: 36px;
  line-height: 36px;
  text-align: center;
  font-size: 14px;
  color: #666666;
  background-color: #f5f6f8;
  border-radius: 8px;
  margin-right: 8px;

  &:last-child {
    margin-right: 0;
  }

  &.active {
    color: #ffffff;
    background-color: #1677ff;
  }

  &.active.normal {
    background-color: #52c41a;
  }

  &.active.abnormal {
    background-color: #f56c6c;
  }
}

.field-row {
  margin-top: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;

  &.column {
    flex-direction: column;
    align-items: stretch;
  }

  .field-label {
    font-size: 13px;
    color: #666666;
    margin-bottom: 6px;
  }

  .field-input {
    flex: 1;
    height: 38px;
    background-color: #f5f6f8;
    border-radius: 8px;
    padding: 0 12px;
    font-size: 14px;
  }

  .field-textarea {
    width: 100%;
    height: 76px;
    background-color: #f5f6f8;
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    box-sizing: border-box;
  }
}

.photo-area {
  margin-top: 12px;

  .photo-label {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: #666666;
  }

  .photo-count {
    font-size: 12px;
    color: #999999;
  }
}

.photo-grid {
  margin-top: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.photo-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  margin-right: 10px;
  margin-bottom: 10px;

  .photo {
    width: 80px;
    height: 80px;
    border-radius: 8px;
  }

  .photo-del {
    position: absolute;
    right: -6px;
    top: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.photo-add {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px dashed #d9dde3;
  background-color: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: center;

  &.disabled {
    opacity: 0.5;
  }

  .uploading {
    font-size: 12px;
    color: #9aa4b2;
  }
}

.footer {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: row;
  box-sizing: border-box;

  .ghost-btn {
    flex: 1;
    height: 44px;
    line-height: 44px;
    border-radius: 22px;
    background-color: #f0f2f5;
    color: #333333;
    font-size: 15px;
    border: none;
    margin-right: 10px;
  }

  .submit-btn {
    flex: 2;
    height: 44px;
    line-height: 44px;
    border-radius: 22px;
    background-color: #1677ff;
    color: #ffffff;
    font-size: 16px;
    border: none;
  }
}
</style>
