/**
 * 全局分享（mixin 方案）：main.ts 里 `app.mixin(shareMixin)` 一次接入，所有页面生效，
 * 无需逐页处理，也不要逐页处理。
 *
 * 默认行为：
 * - 标题取 VITE_APP_TITLE，路径取当前页（含页面参数），并开启“发送给朋友 / 分享到朋友圈”菜单
 *
 * 某页需要定制分享内容：
 * - 用 options 写法在页面里覆盖 onShareAppMessage / onShareTimeline 即可（组件选项会覆盖 mixin）
 * - 不要用 setup 的 onShareAppMessage 做覆盖：与全局 mixin 同存时 setup 版可能被吞掉
 *  （dcloudio/uni-app#3084），示例见 README
 */

function getCurrentShareTarget(): { path: string, query: string } {
  try {
    const pages = getCurrentPages()
    const current = (pages[pages.length - 1] as any) ?? {}
    const route: string = current.route ?? ''
    if (!route) {
      return { path: '/pages/index/index', query: '' }
    }
    const options: Record<string, any> = current.options ?? {}
    const query = Object.entries(options)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    return { path: `/${route}${query ? `?${query}` : ''}`, query }
  }
  catch {
    return { path: '/pages/index/index', query: '' }
  }
}

function defaultTitle(): string {
  return import.meta.env.VITE_APP_TITLE ?? 'uni-app 企业模板'
}

export const shareMixin = {
  /** 每个页面 show 时确保分享菜单可用（菜单状态是按页的，写在全局一次即可） */
  onShow() {
    // #ifdef MP-WEIXIN
    try {
      uni.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      })
    }
    catch {
      // 低版本基础库不支持，忽略（注册了钩子后仍可发送给朋友）
    }
    // #endif
  },

  /** 发送给朋友：默认当前页，页面可用 options 同名钩子覆盖 */
  onShareAppMessage() {
    // #ifdef MP-WEIXIN
    return {
      title: defaultTitle(),
      path: getCurrentShareTarget().path,
    }
    // #endif
  },

  /** 分享到朋友圈：默认当前页参数，页面可用 options 同名钩子覆盖 */
  onShareTimeline() {
    // #ifdef MP-WEIXIN
    const target = getCurrentShareTarget()
    return {
      title: defaultTitle(),
      query: target.query,
    }
    // #endif
  },
}
