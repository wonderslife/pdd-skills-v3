import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('access_token') || '')
  const refreshToken = ref<string>(localStorage.getItem('refresh_token') || '')
  const userInfo = ref<any>(null)

  const isLoggedIn = computed(() => !!token.value)
  
  async function login(username: string, password: string) {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await response.json()
    
    if (data.code === 200) {
      setToken(data.data.access_token, data.data.refresh_token)
      userInfo.value = data.data.user
    }
    return data
  }

  function setToken(access: string, refresh?: string) {
    token.value = access
    if (refresh) refreshToken.value = refresh
    localStorage.setItem('access_token', access)
    if (refresh) localStorage.setItem('refresh_token', refresh)
  }

  function logout() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  return { token, refreshToken, userInfo, isLoggedIn, login, setToken, logout }
})
