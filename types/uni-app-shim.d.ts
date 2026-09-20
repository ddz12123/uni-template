/**
 * HBuilderX 内置模块 `@dcloudio/uni-app` 的最小类型声明。
 * 运行时由 HBuilderX 提供，这里只为 `tsc --noEmit` / 编辑器提示服务。
 */
declare module '@dcloudio/uni-app' {
  // ---- 应用级 ----
  export function onLaunch(fn: (options?: Record<string, any>) => void): void
  export function onShow(fn: (options?: Record<string, any>) => void): void
  export function onHide(fn: () => void): void
  export function onError(fn: (error: string) => void): void
  export function onPageNotFound(fn: (options?: Record<string, any>) => void): void
  export function onUnhandledRejection(fn: (options?: Record<string, any>) => void): void
  export function onThemeChange(fn: (options?: Record<string, any>) => void): void
  // ---- 页面级（页面 setup 顶层调用） ----
  export function onLoad(fn: (query?: Record<string, string>) => void): void
  export function onReady(fn: () => void): void
  export function onUnload(fn: () => void): void
  export function onPullDownRefresh(fn: () => void): void
  export function onReachBottom(fn: () => void): void
  export function onShareAppMessage(fn: (res?: Record<string, any>) => Record<string, any>): void
  export function onShareTimeline(fn: () => Record<string, any>): void
}
