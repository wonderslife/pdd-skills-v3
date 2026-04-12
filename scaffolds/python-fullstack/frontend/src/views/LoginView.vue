<template>
  <div class="login-container">
    <form @submit.prevent="handleLogin" class="login-form">
      <h2>登录</h2>
      <input v-model="username" type="text" placeholder="用户名" required />
      <input v-model="password" type="password" placeholder="密码" required />
      <button type="submit">登录</button>
      <div class="oauth-section">
        <p>其他登录方式:</p>
        <div class="oauth-buttons">
          <button type="button" @click="oauthLogin('wecom')">企业微信</button>
          <button type="button" @click="oauthLogin('dingtalk')">钉钉</button>
          <button type="button" @click="oauthLogin('feishu')">飞书</button>
          <button type="button" @click="oauthLogin('wechat_open')">微信</button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const username = ref('')
const password = ref('')

async function handleLogin() {
  await userStore.login(username.value, password.value)
  router.push('/dashboard')
}

function oauthLogin(provider: string) {
  window.location.href = /api/v1/auth//callback
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--bg-page);
}

.login-form {
  background: var(--bg-white);
  padding: 2rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 400px;
}

.oauth-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.oauth-buttons button {
  padding: 6px 12px;
  font-size: 12px;
}
</style>
