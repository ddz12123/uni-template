import { usePreferredDark } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

export const useAppStore = defineStore('app', () => {
  /** 用户设置的主题模式（跟随系统/浅色/深色） */
  const theme = ref<ThemeMode>('auto')
  /** 系统当前主题（由系统监听更新） */
  const systemTheme = ref<'light' | 'dark'>('light')
  /** 状态栏高度，用于自定义导航等场景 */
  const statusBarHeight = ref(0)

  const resolvedTheme = computed<'light' | 'dark'>(() =>
    theme.value === 'auto' ? systemTheme.value : theme.value,
  )

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  /** App 启动时调用：读取系统信息并注册主题变化监听 */
  function initTheme() {
    try {
      statusBarHeight.value = uni.getWindowInfo()?.statusBarHeight ?? 0
    }
    catch {
      statusBarHeight.value = 0
    }

    // #ifdef H5
    // H5 系统主题用 usePreferredDark（内部已处理 matchMedia 监听与旧浏览器兼容，
    // 替代之前手写的 matchMedia + addEventListener/addListener）。
    {
      const prefersDark = usePreferredDark()
      const applySystemTheme = (value: boolean) => {
        systemTheme.value = value ? 'dark' : 'light'
      }
      applySystemTheme(prefersDark.value)
      watch(prefersDark, applySystemTheme)
    }
    // #endif

    // #ifndef H5
    try {
      const baseInfo = (uni.getAppBaseInfo?.() ?? {}) as { theme?: 'light' | 'dark' }
      if (baseInfo.theme === 'light' || baseInfo.theme === 'dark') {
        systemTheme.value = baseInfo.theme
      }
    }
    catch {
      // 低版本基础库可能取不到，保留默认值 light
    }
    try {
      uni.onThemeChange?.((res) => {
        if (res && (res.theme === 'light' || res.theme === 'dark')) {
          systemTheme.value = res.theme
        }
      })
    }
    catch {
      // 部分平台不支持主题监听，忽略
    }
    // #endif
  }

  return { theme, systemTheme, statusBarHeight, resolvedTheme, setTheme, initTheme }
}, {
  persist: {
    pick: ['theme'],
  },
})
