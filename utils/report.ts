import { APP_VERSION } from '@/config'

/**
 * 错误与日志上报：
 * - 开发环境 console 打印，生产包关闭（避免日志泄露与性能损耗），上报始终发送
 * - 网络发送带节流：相同错误（类型+页面+信息）合并，同批次最多 20 条、队列最多 200 条，
 *   防止错误风暴刷屏；上报延迟 ≤3 秒，后台行为不阻塞业务
 * - 直连 uni.request，不走业务请求层，避免互相依赖
 */

export interface ReportPayload {
  type: 'error' | 'log'
  message: string
  page?: string
  extra?: Record<string, any>
  time: string
  version: string
}

function getCurrentPage(): string {
  try {
    const pages = getCurrentPages()
    return (pages[pages.length - 1] as any)?.route ?? ''
  }
  catch {
    return ''
  }
}

export function reportLog(payload: Omit<ReportPayload, 'time' | 'version' | 'page'> & { page?: string }) {
  const entry: ReportPayload = {
    page: getCurrentPage(),
    time: new Date().toISOString(),
    version: APP_VERSION,
    ...payload,
  }
  // 生产包关闭控制台打印，避免日志泄露与性能损耗；上报仍正常发送
  if (import.meta.env.DEV) {
    console.warn('[reportLog]', entry)
  }

  const url = import.meta.env.VITE_REPORT_URL
  if (!url) {
    return
  }
  enqueueReport(entry)
}

/* ------------------------------ 上报节流 ------------------------------ */

const FLUSH_DELAY_MS = 3000
const MAX_PER_FLUSH = 20
const MAX_QUEUE = 200

interface PendingReport {
  entry: ReportPayload
  /** 相同错误在本次发送前又出现了几次 */
  count: number
}

const pendingReports = new Map<string, PendingReport>()
let droppedCount = 0
let flushTimer: ReturnType<typeof setTimeout> | undefined

function reportKey(entry: ReportPayload): string {
  return `${entry.type}|${entry.page ?? ''}|${entry.message}`
}

function scheduleFlush() {
  if (flushTimer) {
    return
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    flushReports()
  }, FLUSH_DELAY_MS)
}

/** 相同错误合并为一条（extra.repeatCount 记次数），超限的按批次发，队列满了丢最旧的 */
function enqueueReport(entry: ReportPayload) {
  const key = reportKey(entry)
  const hit = pendingReports.get(key)
  if (hit) {
    hit.count += 1
  }
  else {
    if (pendingReports.size >= MAX_QUEUE) {
      const oldest = pendingReports.keys().next()
      if (!oldest.done) {
        pendingReports.delete(oldest.value)
      }
      droppedCount += 1
    }
    pendingReports.set(key, { entry, count: 1 })
  }
  scheduleFlush()
}

function flushReports() {
  const url = import.meta.env.VITE_REPORT_URL
  if (!url) {
    pendingReports.clear()
    droppedCount = 0
    return
  }
  if (pendingReports.size === 0) {
    return
  }
  const batch = [...pendingReports.entries()].slice(0, MAX_PER_FLUSH)
  for (const [key] of batch) {
    pendingReports.delete(key)
  }
  batch.forEach(([, { entry, count }], index) => {
    const payload: ReportPayload = { ...entry }
    if (count > 1) {
      payload.extra = { ...(payload.extra ?? {}), repeatCount: count }
    }
    if (index === 0 && droppedCount > 0) {
      payload.extra = { ...(payload.extra ?? {}), dropped: droppedCount }
      droppedCount = 0
    }
    uni.request({
      url,
      method: 'POST',
      data: payload,
      fail: () => {},
    })
  })
  if (pendingReports.size > 0) {
    scheduleFlush()
  }
}

/** 注册全局未捕获异常监听；App 级 onError 在 App.vue 中通过 onError 钩子捕获 */
export function initErrorReport() {
  // 小程序 App.onError 兜底：与 App.vue 的 onError 互为备份，避免某一处失效导致漏报
  try {
    uni.onError?.((message: string) => {
      reportLog({ type: 'error', message: `uni.onError: ${message}` })
    })
  }
  catch {
    // 部分平台不支持，忽略
  }
  try {
    uni.onUnhandledRejection?.(((res: { reason?: unknown }) => {
      const reason = res?.reason
      const message = reason instanceof Error ? (reason.stack || reason.message) : String(reason)
      reportLog({ type: 'error', message: `UnhandledRejection: ${message}` })
    }) as any)
  }
  catch {
    // 部分平台不支持，忽略
  }
}
