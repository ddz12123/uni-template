/**
 * SFC 类型垫片：让 `tsc --noEmit` 能解析 `import App from './App.vue'`。
 * HBuilderX 运行时自带 vue，这里只补类型，不影响编译运行。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}

/**
 * 媒体资源 import 垫片：仅为 `import logo from '@/static/logo.png'` 这类写法提供类型。
 * 注意：业务资源不要用 import（会被打进小程序包，切 CDN 后失效），
 * 统一用 utils/static.ts 的 resolveStatic(path) 按 URL 引用；
 * import 只用于必须随包的资源（如 tabBar 图标）。
 */
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.jpeg' {
  const src: string
  export default src
}
declare module '*.gif' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}
declare module '*.webp' {
  const src: string
  export default src
}
declare module '*.mp3' {
  const src: string
  export default src
}
declare module '*.mp4' {
  const src: string
  export default src
}
