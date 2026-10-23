import { usePreferredDark } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import themeConfig from '@/theme.json'

export type ThemeMode = 'light' | 'dark' | 'auto'

interface NativeThemeConfig {
  navBgColor: string
  navTxtStyle: 'black' | 'white'
  bgColor: string
  tabBgColor: string
  tabColor: string
  tabSelectedColor: string
  tabBorderStyle: 'black' | 'white'
}

const nativeThemes = themeConfig as Record<'light' | 'dark', NativeThemeConfig>

export const useAppStore = defineStore(
  'app',
  () => {
    /** 用户设置的主题模式（跟随系统/浅色/深色） */
    const theme = ref<ThemeMode>('auto')
    /** 系统当前主题（由系统监听更新） */
    const systemTheme = ref<'light' | 'dark'>('light')
    /** 状态栏高度，用于自定义导航等场景 */
    const statusBarHeight = ref(0)

    const resolvedTheme = computed<'light' | 'dark'>(() =>
      theme.value === 'auto' ? systemTheme.value : theme.value,
    )

    function applyBackgroundColor() {
      const currentTheme = nativeThemes[resolvedTheme.value]
      try {
        uni.setBackgroundColor?.({
          backgroundColor: currentTheme.bgColor,
          backgroundColorTop: currentTheme.bgColor,
          backgroundColorBottom: currentTheme.bgColor,
        })
      } catch {
        // 当前平台不支持动态背景色时忽略
      }
      // #ifdef H5
      // H5 没有原生窗口，直接同步文档背景，避免手动主题与系统主题相反时露出系统底色
      if (typeof document !== 'undefined') {
        document.documentElement.style.backgroundColor = currentTheme.bgColor
        if (document.body) {
          document.body.style.backgroundColor = currentTheme.bgColor
        }
      }
      // #endif
    }

    function applyNativeTheme() {
      const currentTheme = nativeThemes[resolvedTheme.value]
      try {
        uni.setNavigationBarColor?.({
          frontColor: currentTheme.navTxtStyle === 'white' ? '#ffffff' : '#000000',
          backgroundColor: currentTheme.navBgColor,
        })
      } catch {
        // 当前平台没有原生导航栏时忽略
      }
      try {
        uni.setTabBarStyle?.({
          color: currentTheme.tabColor,
          selectedColor: currentTheme.tabSelectedColor,
          backgroundColor: currentTheme.tabBgColor,
          // 边框颜色同样以 theme.json 为唯一来源，与 pages.json 的 @tabBorderStyle 保持一致
          borderStyle: currentTheme.tabBorderStyle,
        })
      } catch {
        // 当前平台没有 TabBar 时忽略
      }
      applyBackgroundColor()
    }

    function setTheme(mode: ThemeMode) {
      theme.value = mode
      applyNativeTheme()
    }

    /** App 启动时调用：读取系统信息并注册主题变化监听 */
    function initTheme() {
      try {
        statusBarHeight.value = uni.getWindowInfo()?.statusBarHeight ?? 0
      } catch {
        statusBarHeight.value = 0
      }

      // #ifdef H5
      // H5 系统主题用 usePreferredDark（内部已处理 matchMedia 监听与旧浏览器兼容，
      // 替代之前手写的 matchMedia + addEventListener/addListener）。
      {
        const prefersDark = usePreferredDark()
        const applySystemTheme = (value: boolean) => {
          systemTheme.value = value ? 'dark' : 'light'
          applyNativeTheme()
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
      } catch {
        // 低版本基础库可能取不到，保留默认值 light
      }
      try {
        uni.onThemeChange?.((res) => {
          if (res && (res.theme === 'light' || res.theme === 'dark')) {
            systemTheme.value = res.theme
            applyNativeTheme()
          }
        })
      } catch {
        // 部分平台不支持主题监听，忽略
      }
      // #endif

      applyNativeTheme()
    }

    return {
      theme,
      systemTheme,
      statusBarHeight,
      resolvedTheme,
      setTheme,
      initTheme,
      applyNativeTheme,
      applyBackgroundColor,
    }
  },
  {
    persist: {
      pick: ['theme'],
    },
  },
)
