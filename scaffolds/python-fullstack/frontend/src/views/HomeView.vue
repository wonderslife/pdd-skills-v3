<template>
  <div class="home">
    <h1>PDD-Scaffold</h1>
    <p>PRD驱动开发脚手架</p>
  </div>
</template>

<script setup lang="ts">
import { useResponsive } from '@/composables/useResponsive'

const { breakpoint, isMobile, isDesktop } = useResponsive()
</script>

<style scoped>
.home {
  text-align: center;
  padding: 2rem;
}
</style>
