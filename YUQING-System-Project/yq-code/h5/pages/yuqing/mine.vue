<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '我的',
    navigationBarBackgroundColor: '#1677ff',
    navigationBarTextStyle: 'white',
  },
})

/**
 * H5 我的（PRD §7.2 手机端菜单：个人信息、免打扰时段设置）
 * 免打扰时段：企业微信推送的静默窗口，保存在本地并随下次配置变更同步。
 */
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/store/user'
import { useTokenStore } from '@/store/token'
import { modal } from '@/plugins'

const userStore = useUserStore()
const tokenStore = useTokenStore()

const DND_KEY = 'yq_dnd_range'

const userInfo = computed(() => (userStore as any).userInfo ?? {})
const displayName = computed(
  () => userInfo.value.name || userInfo.value.nickName || userInfo.value.userName || '未登录用户'
)

/** 免打扰时段 */
const dndStart = ref('22:00')
const dndEnd = ref('08:00')
const dndEnabled = ref(false)

onShow(() => {
  loadDnd()
})

function loadDnd() {
  try {
    const saved = uni.getStorageSync(DND_KEY)
    if (saved) {
      const cfg = typeof saved === 'string' ? JSON.parse(saved) : saved
      dndEnabled.value = Boolean(cfg.enabled)
      dndStart.value = cfg.start || '22:00'
      dndEnd.value = cfg.end || '08:00'
    }
  } catch (e) {
    // 忽略解析失败，使用默认值
  }
}

function saveDnd() {
  if (dndEnabled.value && dndStart.value === dndEnd.value) {
    modal.msg('开始时间与结束时间不能相同')
    return
  }
  uni.setStorageSync(DND_KEY, JSON.stringify({ enabled: dndEnabled.value, start: dndStart.value, end: dndEnd.value }))
  modal.msg('免打扰时段已保存')
}

async function logout() {
  const ok = await modal.confirm('确认退出登录？')
  if (!ok) return
  try {
    await (userStore as any).clearUserInfo?.()
    tokenStore.logout?.()
  } catch (e) {
    // 忽略登出接口异常，本地状态一并清理
  }
  uni.reLaunch({ url: '/pages/login' })
}

const modules = [
  { key: 'task', text: '我的任务', url: '/pages/yuqing/task/manage', icon: 'list', color: '#1677ff', bg: 'bg-blue' },
  { key: 'report', text: '我的报告', url: '/pages/yuqing/report/index', icon: 'compose', color: '#faad14', bg: 'bg-orange' },
  { key: 'opinion', text: '台账查阅', url: '/pages/yuqing/opinion/index', icon: 'search', color: '#52c41a', bg: 'bg-green' },
  { key: 'rule', text: '规则管控', url: '/pages/yuqing/rule/manage', icon: 'settings-filled', color: '#722ed1', bg: 'bg-purple' },
]

function go(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <!-- 个人信息 -->
    <view class="profile-card">
      <image class="avatar" :src="userInfo.avatar || '/static/images/profile.jpg'" mode="aspectFill" />
      <view class="profile-main">
        <text class="profile-name">{{ displayName }}</text>
        <text class="profile-sub">舆情监测平台 · 企业微信端</text>
      </view>
    </view>

    <!-- 常用入口 -->
    <view class="card">
      <view class="grid-body">
        <view v-for="m in modules" :key="m.key" class="grid-item" @click="go(m.url)">
          <view class="icon-wrap" :class="m.bg">
            <uni-icons :type="m.icon" size="24" :color="m.color"></uni-icons>
          </view>
          <text class="grid-text">{{ m.text }}</text>
        </view>
      </view>
    </view>

    <!-- 免打扰时段 -->
    <view class="card">
      <view class="card-head">
        <text class="card-title">免打扰时段</text>
        <switch :checked="dndEnabled" color="#1677ff" @change="(e: any) => (dndEnabled = e.detail.value)" />
      </view>
      <text class="card-desc">开启后，该时段内的常规定时推送将延后至时段结束，紧急预警不受影响。</text>
      <view v-if="dndEnabled" class="time-row">
        <view class="time-cell">
          <text class="time-label">开始</text>
          <picker mode="time" :value="dndStart" @change="(e: any) => (dndStart = e.detail.value)">
            <text class="time-value">{{ dndStart }}</text>
          </picker>
        </view>
        <text class="time-sep">至</text>
        <view class="time-cell">
          <text class="time-label">结束</text>
          <picker mode="time" :value="dndEnd" @change="(e: any) => (dndEnd = e.detail.value)">
            <text class="time-value">{{ dndEnd }}</text>
          </picker>
        </view>
      </view>
      <button v-if="dndEnabled" class="save-btn" @click="saveDnd">保存设置</button>
    </view>

    <!-- 退出 -->
    <view class="card logout-card">
      <text class="logout-text" @click="logout">退出登录</text>
    </view>

    <view class="version"><text class="version-text">全自动化舆情监测研判报送平台 · H5 v1.0.0</text></view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: #f5f6f8;
  padding: 12px 16px calc(24px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.profile-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: linear-gradient(135deg, #1677ff 0%, #3f8cff 100%);
  border-radius: 14px;
  padding: 20px 16px;
  box-shadow: 0 6px 18px rgba(22, 119, 255, 0.22);
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  border: 2px solid rgba(255, 255, 255, 0.6);
}

.profile-main {
  margin-left: 14px;
  display: flex;
  flex-direction: column;
}

.profile-name {
  font-size: 17px;
  font-weight: 600;
  color: #ffffff;
}

.profile-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
}

.card {
  margin-top: 12px;
  background-color: #ffffff;
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.grid-body {
  display: flex;
  flex-direction: row;
}

.grid-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 0;
}

.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 6px;
}

.bg-blue {
  background-color: rgba(22, 119, 255, 0.1);
}

.bg-orange {
  background-color: rgba(250, 173, 20, 0.1);
}

.bg-green {
  background-color: rgba(82, 196, 26, 0.1);
}

.bg-purple {
  background-color: rgba(114, 46, 209, 0.1);
}

.grid-text {
  font-size: 12px;
  color: #666666;
}

.card-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  .card-title {
    font-size: 15px;
    font-weight: 600;
    color: #333333;
  }
}

.card-desc {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #999999;
  line-height: 19px;
}

.time-row {
  margin-top: 14px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.time-cell {
  flex: 1;
  background-color: #f5f6f8;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;

  .time-label {
    font-size: 11px;
    color: #999999;
  }

  .time-value {
    margin-top: 4px;
    font-size: 17px;
    font-weight: 600;
    color: #1677ff;
  }
}

.time-sep {
  padding: 0 12px;
  font-size: 13px;
  color: #999999;
}

.save-btn {
  margin-top: 14px;
  height: 40px;
  line-height: 40px;
  border-radius: 20px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 14px;
  border: none;
}

.logout-card {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-text {
  font-size: 15px;
  color: #f56c6c;
}

.version {
  margin-top: 24px;
  text-align: center;

  .version-text {
    font-size: 11px;
    color: #b0b0b0;
  }
}
</style>
