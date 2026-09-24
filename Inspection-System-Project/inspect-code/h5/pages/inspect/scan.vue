<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '机房巡检',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white'
  },
})

import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { modal } from '@/plugins'
import { resolveInspectScan } from '@/api/inspect/scan'
import { getInspectAbnormalCount } from '@/api/inspect/stats'

/** 最近扫码记录在本地存储中的 key */
const RECENT_KEY = 'inspect_recent_scan'
/** 最近扫码记录最多保留条数（PRD 模块 7 验收标准 7） */
const RECENT_MAX = 10

const manualCode = ref('')
const resolving = ref(false)
const abnormalCount = ref(0)
const recentList = ref<any[]>([])
/** H5 内置扫码浮层 */
const scanning = ref(false)
const scanTip = ref('将二维码放入框内')

let videoEl: any = null
let mediaStream: any = null
let detectTimer: any = null

/** 顶部状态文案 */
const statusText = computed(() => {
  if (abnormalCount.value > 0) return `有 ${abnormalCount.value} 条异常待处理`
  return '暂无待处理异常'
})

onLoad((options: any) => {
  // 手机相机扫码会直接打开本页并带上 p 参数，这里自动进入巡检流程
  const code = options?.p || options?.code || options?.pointCode
  if (code) {
    handleResolve(decodeURIComponent(String(code)))
  }
})

onShow(() => {
  loadAbnormalCount()
  loadRecent()
})

/** 未处理异常数 */
async function loadAbnormalCount() {
  try {
    const data: any = await getInspectAbnormalCount(undefined)
    abnormalCount.value = Number(data || 0)
  } catch (e) {
    // 登录态异常时静默处理，避免打断巡检流程
  }
}

/** 最近扫码记录（本地存储） */
function loadRecent() {
  try {
    recentList.value = uni.getStorageSync(RECENT_KEY) || []
  } catch (e) {
    recentList.value = []
  }
}

function pushRecent(point: any) {
  if (!point || !point.pointId) return
  const list = (recentList.value || []).filter((i) => i.pointId !== point.pointId)
  list.unshift({
    pointId: point.pointId,
    pointName: point.pointName,
    pointCode: point.pointCode,
    roomName: point.roomName,
    time: Date.now(),
    payload: point.scanContent || '',
  })
  recentList.value = list.slice(0, RECENT_MAX)
  uni.setStorageSync(RECENT_KEY, recentList.value)
}

function clearRecent() {
  uni.removeStorageSync(RECENT_KEY)
  recentList.value = []
}

/** 解析二维码内容 / 点位编码，成功后进入巡检执行页 */
async function handleResolve(content: string, silent = false) {
  if (!content) return
  if (resolving.value) return
  resolving.value = true
  uni.showLoading({ title: '解析中' })
  try {
    const point: any = await resolveInspectScan(content)
    uni.hideLoading()
    if (point?.inspectedInCycle) {
      const go = await modal.confirm('该点位本周期已巡检，是否查看历史记录？')
      if (go) {
        uni.navigateTo({ url: '/pages/inspect/records' })
      }
      return
    }
    point.scanContent = content
    pushRecent(point)
    uni.navigateTo({
      url: `/pages/inspect/execute?pointId=${point.pointId}`,
    })
  } catch (e: any) {
    uni.hideLoading()
    // 请求失败的具体文案已由拦截器 toast 出来，这里只负责保留手动输入入口
    if (!silent) {
      manualCode.value = manualCode.value || ''
    }
  } finally {
    resolving.value = false
  }
}

/** 点击扫一扫 */
function handleScan() {
  // #ifdef H5
  startH5Scan()
  return
  // #endif
  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    scanType: ['qrCode'],
    success: (res: any) => {
      handleResolve(res.result)
    },
    fail: () => {
      modal.msg('未识别到二维码，请手动输入点位编码')
    },
  })
  // #endif
}

/* ---------------- H5 内置扫码（BarcodeDetector + getUserMedia，零依赖） ---------------- */

function startH5Scan() {
  const win: any = typeof window !== 'undefined' ? window : null
  const nav: any = typeof navigator !== 'undefined' ? navigator : null
  const supported = !!win && 'BarcodeDetector' in win && !!(nav?.mediaDevices && nav.mediaDevices.getUserMedia)
  if (!supported) {
    modal.alert('当前浏览器不支持内置扫码：请直接用手机相机扫描二维码（会自动打开本页），或手动输入点位编码。')
    return
  }
  if (!win.isSecureContext) {
    modal.alert('内置扫码需要 HTTPS 环境，请使用手机相机扫描二维码，或手动输入点位编码。')
    return
  }
  scanning.value = true
  scanTip.value = '正在启动摄像头...'
  // 等浮层渲染完成后再挂载 video
  setTimeout(openCamera, 300)
}

async function openCamera() {
  const doc: any = typeof document !== 'undefined' ? document : null
  const nav: any = typeof navigator !== 'undefined' ? navigator : null
  const win: any = typeof window !== 'undefined' ? window : null
  if (!doc || !nav) return
  try {
    const box = doc.getElementById('h5-scanner-box')
    if (!box) return
    box.innerHTML = ''
    const video = doc.createElement('video')
    video.setAttribute('playsinline', 'true')
    video.setAttribute('autoplay', 'true')
    video.setAttribute('muted', 'true')
    video.style.width = '100%'
    video.style.height = '100%'
    video.style.objectFit = 'cover'
    box.appendChild(video)
    videoEl = video

    mediaStream = await nav.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    video.srcObject = mediaStream
    await video.play()
    scanTip.value = '将二维码放入框内'

    const detector = new win.BarcodeDetector({ formats: ['qr_code'] })
    detectTimer = setInterval(async () => {
      if (!videoEl || videoEl.readyState < 2) return
      try {
        const codes = await detector.detect(videoEl)
        if (codes && codes.length > 0) {
          const raw = codes[0].rawValue
          stopH5Scan()
          if (raw) handleResolve(raw)
        }
      } catch (e) {
        // 单帧识别失败可忽略，等待下一帧
      }
    }, 400)
  } catch (e: any) {
    stopH5Scan()
    modal.alert('无法打开摄像头（可能被拒绝授权），请改用手机相机扫描或手动输入点位编码。')
  }
}

function stopH5Scan() {
  if (detectTimer) {
    clearInterval(detectTimer)
    detectTimer = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t: any) => t.stop())
    mediaStream = null
  }
  if (videoEl) {
    videoEl.srcObject = null
    videoEl = null
  }
  scanning.value = false
}

/** 手动输入点位编码 */
function handleManual() {
  const code = (manualCode.value || '').trim()
  if (!code) {
    modal.msg('请输入点位编码')
    return
  }
  handleResolve(code)
}

/** 点击最近记录快速重入 */
function handleRecent(item: any) {
  if (item.pointId) {
    uni.navigateTo({ url: `/pages/inspect/execute?pointId=${item.pointId}` })
    return
  }
  if (item.payload) handleResolve(item.payload)
}

function goRecords() {
  uni.navigateTo({ url: '/pages/inspect/records' })
}

function goMyPoints() {
  uni.navigateTo({ url: '/pages/inspect/points' })
}
</script>

<template>
  <view class="page">
    <!-- 顶部概览 -->
    <view class="hero">
      <view class="hero-title">扫码巡检</view>
      <view class="hero-sub">{{ statusText }}</view>
    </view>

    <view class="body">
      <!-- 扫码主入口 -->
      <view class="scan-card">
        <view class="scan-icon">
          <uni-icons type="scan" size="60" color="#1677ff"></uni-icons>
        </view>
        <view class="scan-title">扫描机房二维码</view>
        <view class="scan-desc">对准点位张贴的二维码即可进入巡检</view>
        <button class="primary-btn" :loading="resolving" @click="handleScan">扫一扫</button>
      </view>

      <!-- 手动输入兜底 -->
      <view class="card">
        <view class="card-title">二维码磨损？手动输入点位编码</view>
        <view class="manual-row">
          <input
            v-model="manualCode"
            class="manual-input"
            type="text"
            placeholder="例如 RM-A-001"
            confirm-type="search"
            @confirm="handleManual"
          />
          <button class="mini-btn" :disabled="resolving" @click="handleManual">查询</button>
        </view>
      </view>

      <!-- 快捷入口 -->
      <view class="card">
        <view class="entry" @click="goRecords">
          <uni-icons type="list" size="20" color="#1677ff"></uni-icons>
          <text class="entry-text">我的巡检记录</text>
          <uni-icons type="right" size="16" color="#c0c4cc"></uni-icons>
        </view>
        <view class="divider"></view>
        <view class="entry" @click="goMyPoints">
          <uni-icons type="location" size="20" color="#1677ff"></uni-icons>
          <text class="entry-text">可巡检点位</text>
          <uni-icons type="right" size="16" color="#c0c4cc"></uni-icons>
        </view>
      </view>

      <!-- 最近扫码 -->
      <view v-if="recentList.length" class="card">
        <view class="card-head">
          <text class="card-title">最近扫码</text>
          <text class="clear-btn" @click="clearRecent">清空</text>
        </view>
        <view v-for="(item, idx) in recentList" :key="item.pointId" class="recent-item" @click="handleRecent(item)">
          <view class="recent-main">
            <text class="recent-name">{{ item.pointName }}</text>
            <text class="recent-sub">{{ item.roomName || '' }} · {{ item.pointCode }}</text>
          </view>
          <uni-icons type="right" size="16" color="#c0c4cc"></uni-icons>
          <view v-if="idx < recentList.length - 1" class="divider"></view>
        </view>
      </view>
    </view>

    <!-- H5 内置扫码浮层 -->
    <view v-if="scanning" class="scanner-mask">
      <view id="h5-scanner-box" class="scanner-box"></view>
      <view class="scanner-frame"></view>
      <view class="scanner-tip">{{ scanTip }}</view>
      <button class="cancel-btn" @click="stopH5Scan">取消扫描</button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding-bottom: 24px;
}

.hero {
  background: linear-gradient(135deg, #1677ff 0%, #3c96f3 100%);
  padding: 28px 24px 56px;
  color: #ffffff;

  .hero-title {
    font-size: 24px;
    font-weight: 700;
  }

  .hero-sub {
    margin-top: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
  }
}

.body {
  margin-top: -36px;
  padding: 0 16px;
}

.scan-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 28px 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);

  .scan-icon {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background-color: rgba(22, 119, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }

  .scan-title {
    font-size: 17px;
    font-weight: 600;
    color: #333333;
  }

  .scan-desc {
    margin-top: 6px;
    font-size: 12px;
    color: #999999;
  }
}

.primary-btn {
  margin-top: 18px;
  width: 100%;
  height: 44px;
  line-height: 44px;
  border-radius: 22px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 16px;
  border: none;
}

.card {
  margin-top: 16px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #333333;
}

.clear-btn {
  font-size: 12px;
  color: #999999;
}

.manual-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 12px;
}

.manual-input {
  flex: 1;
  height: 40px;
  background-color: #f5f6f8;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #333333;
}

.mini-btn {
  margin-left: 10px;
  height: 40px;
  line-height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 14px;
  border: none;
}

.entry {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px 2px;

  .entry-text {
    flex: 1;
    margin-left: 10px;
    font-size: 15px;
    color: #333333;
  }
}

.divider {
  height: 1px;
  background-color: #f0f2f5;
}

.recent-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 12px 2px;
  position: relative;

  .recent-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .recent-name {
    font-size: 15px;
    color: #333333;
  }

  .recent-sub {
    margin-top: 4px;
    font-size: 12px;
    color: #999999;
  }
}

/* H5 扫码浮层 */
.scanner-mask {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: #000000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.scanner-box {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.scanner-frame {
  width: 240px;
  height: 240px;
  border: 2px solid #1677ff;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  position: relative;
  z-index: 2;
}

.scanner-tip {
  position: relative;
  z-index: 2;
  margin-top: 24px;
  color: #ffffff;
  font-size: 14px;
}

.cancel-btn {
  position: relative;
  z-index: 2;
  margin-top: 32px;
  padding: 0 28px;
  height: 40px;
  line-height: 40px;
  border-radius: 20px;
  background-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-size: 14px;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
</style>
