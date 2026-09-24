<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>仪表盘</h1>
      <span>{{ userStore.userInfo?.name || '用户' }}</span>
      <button @click="userStore.logout(); .push('/login')">退出</button>
    </header>
    
    <main class="dashboard-content">
      <section class="stats-grid">
        <div class="stat-card">待办任务: {{ pendingCount }}</div>
        <div class="stat-card">已办事项: {{ completedCount }}</div>
        <div class="stat-card">我的发起: {{ myInstances }}</div>
      </section>
      
      <section class="quick-actions">
        <button @click="startWorkflow">发起新流程</button>
        <button>查看借调记录</button>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useResponsive } from '@/composables/useResponsive'

const userStore = useUserStore()
const { breakpoint } = useResponsive()

const pendingCount = ref(0)
const completedCount = ref(0)
const myInstances = ref(0)

function startWorkflow() {
  alert('启动工作流 (Phase 5 集成)')
}

onMounted(async => {
})
</script>

<style scoped>
.dashboard { padding: 24px; }
.dashboard-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
}
@media (max-width: 768px) {
  .stats-grid { grid-template-columns: 1fr; }
  .dashboard { padding: 12px; }
}
</style>
