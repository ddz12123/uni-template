<script setup lang="ts">
import { onError, onLaunch, onPageNotFound } from '@dcloudio/uni-app'
import { syncNativeLocale } from '@/locale'
import { useAppStore } from '@/store/modules/app'
import { initErrorReport, reportLog } from '@/utils/report'
import { checkMiniProgramUpdate } from '@/utils/update'

// uni-app Vue3 官方应用生命周期：onError 与小程序 App.onError 时机一致，
// 比 defineOptions 写法更可靠（HBuilderX 编译 script setup 时选项式 onError 可能丢失）。
onError((message: string) => {
  reportLog({ type: 'error', message: `App.onError: ${message}` })
})

// 野路径（如扫码进已下线页面）：上报后回到首页，避免停在微信原生错误页
onPageNotFound((res?: Record<string, any>) => {
  reportLog({ type: 'error', message: `PageNotFound: ${JSON.stringify(res ?? {})}` })
  const target = '/pages/index/index'
  const badPath = typeof res?.path === 'string' ? `/${res.path}` : ''
  if (badPath && badPath !== target) {
    uni.reLaunch({ url: target })
  }
})

onLaunch(() => {
  // 全局错误上报
  initErrorReport()
  // 小程序新版本检查（有更新会弹窗提示重启）
  checkMiniProgramUpdate()
  // 主题初始化（读取系统主题并注册监听）
  useAppStore().initTheme()
  // 小程序端按持久化语言兜底刷新原生 tabBar 文字（H5/App 由框架处理 %key%）
  syncNativeLocale()
})
</script>

<style lang="scss">
@use './styles/index.scss';
</style>
