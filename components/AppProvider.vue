<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'

// 每个页面以 <AppProvider> 作为根容器：
// 1. wd-config-provider 联动 Wot UI 组件库的暗黑模式（theme="dark" 时挂 .wot-theme-dark 类）
// 2. .app-theme-light / .app-theme-dark 类同步页面侧 --app-* 变量（见 styles/tokens.scss），
//    保证「手动切换主题」与系统主题不一致时，组件库与业务样式仍然一致
const appStore = useAppStore()
const resolvedTheme = computed(() => appStore.resolvedTheme)
</script>

<template>
  <wd-config-provider :theme="resolvedTheme">
    <view class="app-root" :class="`app-theme-${resolvedTheme}`">
      <slot />
    </view>
    <!-- 如需使用 useToast() / useDialog() 等 hooks，请在使用的页面内显式挂载 <wd-toast /> 等组件实例 -->
  </wd-config-provider>
</template>

<style lang="scss" scoped>
.app-root {
  min-height: 100vh;
  background-color: var(--app-bg);
}
</style>
