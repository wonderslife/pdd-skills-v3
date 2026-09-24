import { ref, onMounted, onUnmounted } from 'vue'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
}

export function useResponsive() {
  const width = ref(window.innerWidth)
  const height = ref(window.innerHeight)

  const breakpoint = ref<Breakpoint>('xs')

  function update() {
    width.value = window.innerWidth
    height.value = window.innerHeight
    
    if (width.value >= BREAKPOINTS.xxl) breakpoint.value = 'xxl'
    else if (width.value >= BREAKPOINTS.xl) breakpoint.value = 'xl'
    else if (width.value >= BREAKPOINTS.lg) breakpoint.value = 'lg'
    else if (width.value >= BREAKPOINTS.md) breakpoint.value = 'md'
    else if (width.value >= BREAKPOINTS.sm) breakpoint.value = 'sm'
    else breakpoint.value = 'xs'
  }

  const isMobile = () => ['xs', 'sm'].includes(breakpoint.value)
  const isTablet = () => breakpoint.value === 'md'
  const isDesktop = () => ['lg', 'xl', 'xxl'].includes(breakpoint.value)

  onMounted(() => {
    update()
    window.addEventListener('resize', update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
  })

  return {
    width,
    height,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
  }
}
