import { APP_VERSION } from '@/config'

/**
 * 错误与日志上报：
 * - 开发环境 console 打印，生产包关闭（避免日志泄露与性能损耗），上报始终发送
 * - 网络发送带节流：相同错误（类型+页面+信息）合并，同批次最多 20 条、队列最多 200 条，
 *   防止错误风暴刷屏；上报延迟 ≤3 秒，后台行为不阻塞业务
 * - 发送失败按 3s/6s 指数退避重试，最多发送 3 次；4xx（408/429 除外）视为配置或鉴权错误直接丢弃，
 *   避免上报地址配错时在前后台无限循环请求
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
  } catch {
    return ''
  }
}

export function reportLog(
  payload: Omit<ReportPayload, 'time' | 'version' | 'page'> & { page?: string },
) {
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
const MAX_FLUSH_DELAY_MS = 30000
/** 单条上报最多发送次数（含首次），失败后不再重试，避免无限循环 */
const MAX_ATTEMPTS = 3
const MAX_PER_FLUSH = 20
const MAX_QUEUE = 200

interface PendingReport {
  entry: ReportPayload
  /** 相同错误在本次发送前又出现了几次 */
  count: number
  /** 已发送次数（含首次），用于判断是否还能重试 */
  attempts: number
}

const pendingReports = new Map<string, PendingReport>()
let droppedCount = 0
let flushTimer: ReturnType<typeof setTimeout> | undefined
let flushDueAt = 0

function reportKey(entry: ReportPayload): string {
  return `${entry.type}|${entry.page ?? ''}|${entry.message}`
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  const dueAt = Date.now() + delay
  if (flushTimer) {
    // 已有更晚的定时器时保留退避时间，避免新入队的错误把重试间隔缩短
    if (flushDueAt >= dueAt) {
      return
    }
    clearTimeout(flushTimer)
  }
  flushDueAt = dueAt
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    flushDueAt = 0
    flushReports()
  }, delay)
}

/** 相同错误合并为一条（extra.repeatCount 记次数），超限的按批次发，队列满了丢最旧的 */
function enqueueReport(entry: ReportPayload, count = 1, attempts = 0, delay = FLUSH_DELAY_MS) {
  const key = reportKey(entry)
  const hit = pendingReports.get(key)
  if (hit) {
    hit.count += count
    hit.attempts = Math.max(hit.attempts, attempts)
  } else {
    if (pendingReports.size >= MAX_QUEUE) {
      const oldest = pendingReports.keys().next()
      if (!oldest.done) {
        pendingReports.delete(oldest.value)
      }
      droppedCount += 1
    }
    pendingReports.set(key, { entry, count, attempts })
  }
  scheduleFlush(delay)
}

/** 408/429 虽属 4xx，但仍可能是临时问题，允许退避重试；其余 4xx 重试无意义 */
function isRetryableStatus(statusCode: number): boolean {
  return statusCode >= 500 || statusCode === 408 || statusCode === 429
}

/** 发送失败：按次数退避重试，达到上限或遇到不可重试状态码时丢弃 */
function handleSendFailure(
  entry: ReportPayload,
  count: number,
  attempts: number,
  statusCode?: number,
) {
  if (statusCode !== undefined && !isRetryableStatus(statusCode)) {
    droppedCount += count
    return
  }
  const nextAttempts = attempts + 1
  if (nextAttempts >= MAX_ATTEMPTS) {
    droppedCount += count
    return
  }
  const delay = Math.min(FLUSH_DELAY_MS * 2 ** (nextAttempts - 1), MAX_FLUSH_DELAY_MS)
  enqueueReport(entry, count, nextAttempts, delay)
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
  const droppedForBatch = droppedCount
  batch.forEach(([, { entry, count, attempts }], index) => {
    const payload: ReportPayload = { ...entry }
    if (count > 1) {
      payload.extra = { ...(payload.extra ?? {}), repeatCount: count }
    }
    if (index === 0 && droppedForBatch > 0) {
      payload.extra = { ...(payload.extra ?? {}), dropped: droppedForBatch }
    }
    uni.request({
      url,
      method: 'POST',
      data: payload,
      success: (response) => {
        const statusCode = response?.statusCode ?? 0
        if (statusCode >= 400) {
          handleSendFailure(entry, count, attempts, statusCode)
          return
        }
        if (index === 0 && droppedForBatch > 0) {
          droppedCount = Math.max(0, droppedCount - droppedForBatch)
        }
      },
      fail: () => {
        // 网络失败可能是临时抖动，按退避策略重试，超过上限后丢弃。
        handleSendFailure(entry, count, attempts)
      },
    })
  })
  if (pendingReports.size > 0) {
    scheduleFlush()
  }
}

/** 立即发送当前队列，通常在应用进入后台前调用。 */
export function flushReportQueue() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = undefined
  }
  flushDueAt = 0
  flushReports()
}

/** 注册全局未捕获异常监听；App 级 onError 在 App.vue 中通过 onError 钩子捕获 */
export function initErrorReport() {
  try {
    uni.onUnhandledRejection?.(((res: { reason?: unknown }) => {
      const reason = res?.reason
      const message = reason instanceof Error ? reason.stack || reason.message : String(reason)
      reportLog({ type: 'error', message: `UnhandledRejection: ${message}` })
    }) as any)
  } catch {
    // 部分平台不支持，忽略
  }
}
