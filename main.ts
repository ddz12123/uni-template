import { createSSRApp } from 'vue'
import App from './App.vue'
import { i18n } from './locale'
import { pinia } from './store'
import { reportLog } from './utils/report'
import { shareMixin } from './utils/share'

export function createApp() {
  const app = createSSRApp(App)
  // Vue 组件渲染 / 生命周期报错兜底（小程序端以 App.onError 为主，这里互为备份）
  app.config.errorHandler = (err, _instance, info) => {
    const message = err instanceof Error ? err.stack || err.message : String(err)
    reportLog({ type: 'error', message: `VueError(${info}): ${message}` })
  }
  // 全局分享：所有页面默认可发送给朋友 / 分享到朋友圈，定制见 utils/share.ts
  app.mixin(shareMixin)
  app.use(pinia)
  // 国际化：页面模板用 $t，setup 内用 useI18n，setup 外用 @/locale 的 t，切换用 setLocale
  app.use(i18n)
  return {
    app,
  }
}
