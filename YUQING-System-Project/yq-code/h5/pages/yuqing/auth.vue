<script lang="ts" setup>
definePage({
  style: {
    navigationBarTitleText: '企业微信免登',
    navigationBarBackgroundColor: '#ffffff',
  },
})

/**
 * 企业微信网页授权免登入口（PRD 模块12 验收标准 1）
 *
 * 流程：企业微信工作台 → 本页(携带 code) → 后端换取成员身份并绑定若依账号
 *      → 写入 token → 拉取用户信息 → 进入 H5 工作台
 *
 * 降级策略：后端免登接口不可用（尚未实现 / 未配置 CorpId）时，
 *          自动跳转账号密码登录，不阻塞用户使用。
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { wecomAuth } from '@/api/yuqing/wecom'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { setToken } from '@/utils/auth'

const status = ref<'working' | 'fail'>('working')
const tipText = ref('正在校验企业微信身份…')

onLoad(async (options: any) => {
  const code = options?.code
  if (!code) {
    // 非企业微信环境直接进入应用，走常规登录
    tipText.value = '未检测到企业微信授权信息，即将跳转登录'
    setTimeout(() => uni.reLaunch({ url: '/pages/login' }), 800)
    return
  }
  await doAuth(String(code))
})

async function doAuth(code: string) {
  try {
    const res: any = await wecomAuth(code)
    const token = res?.access_token || res?.accessToken || res?.token || ''
    if (!token) throw new Error('免登未返回令牌')

    // 写入全局令牌（H5 与 App 端共用 'App-Token'）
    setToken(token)
    const tokenStore = useTokenStore()
    tokenStore.setTokenInfo(res)

    // 拉取用户信息与权限，失败不阻塞（工作台只读展示可先进入）
    const userStore = useUserStore()
    try {
      await userStore.fetchUserInfo()
    } catch (e) {
      console.warn('[yuqing/wecom] 拉取用户信息失败', e)
    }

    uni.reLaunch({ url: '/pages/yuqing/work' })
  } catch (e: any) {
    status.value = 'fail'
    tipText.value = e?.msg || e?.message || '企业微信免登失败，请使用账号密码登录'
    setTimeout(() => uni.reLaunch({ url: '/pages/login' }), 1500)
  }
}

function goLogin() {
  uni.reLaunch({ url: '/pages/login' })
}
</script>

<template>
  <view class="auth-page">
    <view class="logo-wrap">
      <uni-icons type="chatboxes-filled" size="56" color="#1677ff"></uni-icons>
    </view>
    <text class="auth-title">全自动化舆情监测研判报送平台</text>
    <text class="auth-sub">企业微信工作台免登</text>

    <view class="auth-status">
      <text class="dot" :class="status"></text>
      <text class="status-text">{{ tipText }}</text>
    </view>

    <button v-if="status === 'fail'" class="auth-btn" @click="goLogin">前往登录</button>
  </view>
</template>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  background-color: #f5f6f8;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 140px;
  box-sizing: border-box;
}

.logo-wrap {
  width: 88px;
  height: 88px;
  border-radius: 24px;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 20px rgba(22, 119, 255, 0.12);
}

.auth-title {
  margin-top: 22px;
  font-size: 17px;
  font-weight: 600;
  color: #333333;
}

.auth-sub {
  margin-top: 8px;
  font-size: 13px;
  color: #999999;
}

.auth-status {
  margin-top: 40px;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: #1677ff;

  &.fail {
    background-color: #f56c6c;
  }
}

.status-text {
  font-size: 13px;
  color: #666666;
}

.auth-btn {
  margin-top: 32px;
  height: 40px;
  line-height: 40px;
  padding: 0 32px;
  border-radius: 20px;
  background-color: #1677ff;
  color: #ffffff;
  font-size: 14px;
  border: none;
}
</style>
