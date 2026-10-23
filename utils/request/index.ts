/**
 * 企业级请求层（基于 uni.request，零第三方依赖）：
 * - 统一注入 baseURL / token / 超时
 * - 统一响应结构与错误码处理，业务侧直接拿到 data，失败抛 ApiError
 * - 401 单飞无感刷新 + 原请求重放（免登录接口不进刷新流程，避免登录报错被误判成过期）；
 *   刷新失败清空登录态，提示后回到登录页
 * - 并发 401 只提示/跳转一次；刷新期间用户主动退出或切换账号时丢弃刷新结果
 */
import {
  LOGIN_PATH,
  REFRESH_TOKEN_URL,
  REQUEST_TIMEOUT,
  SUCCESS_CODE,
  UNAUTHORIZED_CODE,
} from '@/config'
import { t } from '@/locale'
import { clearTokens, getAuthEpoch, getRefreshToken, getToken, saveTokens } from '@/utils/auth'

/** 登录态全局事件：请求层与 user store 之间用事件解耦，避免循环依赖 */
export const AUTH_EVENTS = {
  /** token 已刷新（payload: { token, refreshToken }） */
  refreshed: 'auth:token-refreshed',
  /** 登录态已失效被强制清除 */
  logout: 'auth:logout',
}

/** 后端统一响应结构（按你们的接口约定调整 SUCCESS_CODE 与字段名） */
export interface ApiResponse<T = any> {
  code: number
  msg?: string
  data?: T
}

/**
 * 判断响应是否为统一响应结构。
 * 仅凭 `code` 字段存在会把业务数据（如国家表返回 `{ code: 'CN', name: 'China' }`）误判成错误响应，
 * 因此要求 code 为数字，并且同时带 msg 或 data。后端字段约定不同时改这里。
 */
export function isApiEnvelope<T = any>(body: unknown): body is ApiResponse<T> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return false
  }
  const record = body as Record<string, unknown>
  return typeof record.code === 'number' && ('msg' in record || 'data' in record)
}

/** 请求级扩展配置 */
export interface RequestCustom {
  /** 显示全屏 loading */
  loading?: boolean
  /** 静默模式：失败不弹 toast（业务自行处理） */
  silent?: boolean
  /** 跳过 token 注入及 401 刷新流程，用于公开接口 */
  skipAuth?: boolean
}

export interface RequestOptions {
  url: string
  // 注意：uni.request 类型不支持 PATCH（见 tsc 报错），如后端必须用 PATCH，
  // 请改用 POST + 约定（如 X-HTTP-Method-Override），不要直接加回联合类型。
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS'
  data?: any
  header?: Record<string, string>
  timeout?: number
  custom?: RequestCustom
}

type HttpOptions = Pick<RequestOptions, 'custom' | 'header' | 'timeout'>

/** 业务异常：请求层抛出的错误统一归一化为此类型 */
export class ApiError extends Error {
  code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** 刷新期间登录态被用户主动清除/切换：不属于“登录过期”，不提示也不跳转 */
class AuthAbortedError extends Error {}

/** 将 path 归一化为可比较的形式，兼容 query、域名、前导/尾部斜杠。 */
function normalizePath(url: string): string {
  const noQuery = (url || '').split(/[?#]/, 1)[0]
  const path = noQuery.replace(/^https?:\/\/[^/]+/i, '')
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`
  return withLeadingSlash.replace(/\/+$/, '') || '/'
}

/** 无需携带 token 的接口（如登录 / 刷新本身），按接口约定维护（均为 path 形式） */
const AUTH_FREE_PATHS = new Set(['/auth/login', REFRESH_TOKEN_URL].map(normalizePath))

/**
 * baseURL 归一化：缺失时给 '' 兜底（避免拼出 `undefined/xxx`），并去掉尾部斜杠
 * （避免 `https://api.com/` + `/user` 拼出双斜杠）。
 */
const baseURL = (import.meta.env.VITE_APP_BASE_URL ?? '').replace(/\/+$/, '')

/** 拼完整 URL：绝对地址原样返回，相对地址拼 baseURL */
function joinURL(url: string): string {
  if (/^https?:\/\//.test(url)) {
    return url
  }
  if (!baseURL) {
    return url
  }
  return `${baseURL}${url.startsWith('/') ? url : `/${url}`}`
}

/** 取接口 path（去掉域名与 query）：绝对/相对地址统一为 `/xxx` 形式，用于白名单比对 */
function extractPath(url: string): string {
  return normalizePath(url)
}

let loadingCount = 0
function showLoading() {
  loadingCount += 1
  uni.showLoading({ title: t('request.loading'), mask: true })
}
/**
 * loading 计数：并发请求只在全部结束后关一次。
 * 注意 `uni.hideLoading()` 是全局的，会把业务自己 `uni.showLoading()` 的 loading 一起关掉，
 * 业务自管 loading 时不要再给请求加 `loading: true`。
 */
function hideLoading() {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) {
    uni.hideLoading()
  }
}

/* ------------------------------ 底层请求封装 ------------------------------ */

interface RawResponse {
  statusCode: number
  data: any
}

/** 将 uni.request Promise 化（HTTP 4xx/5xx 也会进入 success，由上层按 statusCode 归一化） */
function rawRequest(options: {
  url: string
  method?: RequestOptions['method']
  data?: any
  header?: Record<string, string>
  timeout?: number
}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: joinURL(options.url),
      method: options.method,
      data: options.data,
      header: options.header,
      timeout: options.timeout ?? REQUEST_TIMEOUT,
      success: resolve as any,
      fail: (err) => {
        const message = String(err?.errMsg ?? '').toLowerCase()
        reject(
          new ApiError(
            -1,
            message.includes('timeout') ? t('request.timeout') : t('request.networkError'),
          ),
        )
      },
    })
  })
}

/* --------------------------- 401 处理：无感刷新 --------------------------- */

let refreshPromise: Promise<void> | null = null

/** 单飞刷新：并发 401 只触发一次刷新请求 */
function refreshTokenOnce(): Promise<void> {
  refreshPromise ??= (async () => {
    const refreshToken = getRefreshToken()
    const epoch = getAuthEpoch()
    if (!refreshToken) {
      throw new ApiError(UNAUTHORIZED_CODE, t('request.refreshFailed'))
    }
    let res: RawResponse
    try {
      res = await rawRequest({
        url: REFRESH_TOKEN_URL,
        method: 'POST',
        data: { refreshToken },
      })
    } catch (error) {
      // 刷新请求失败时同样要判断期间是否已主动退出，避免多余的过期提示
      if (getAuthEpoch() !== epoch) {
        throw new AuthAbortedError()
      }
      throw error
    }
    // 用户在刷新请求期间主动退出或切换账号：丢弃结果，避免把旧 token 又写回来
    if (getAuthEpoch() !== epoch) {
      throw new AuthAbortedError()
    }
    const body: unknown = res.data
    if (
      res.statusCode >= 400 ||
      !isApiEnvelope<{ token: string; refreshToken?: string }>(body) ||
      body.code !== SUCCESS_CODE
    ) {
      throw new ApiError(UNAUTHORIZED_CODE, t('request.refreshFailed'))
    }
    const data = body.data
    if (!data || typeof data.token !== 'string' || !data.token) {
      throw new ApiError(UNAUTHORIZED_CODE, t('request.refreshFailed'))
    }
    const nextRefreshToken =
      typeof data.refreshToken === 'string' && data.refreshToken ? data.refreshToken : refreshToken
    saveTokens(data.token, nextRefreshToken)
    // 刷新成功说明登录态有效：取消可能挂起的登出跳转（极端并发时序下用）
    clearPendingLogout()
    // 通知 user store 同步新 token（store 监听 AUTH_EVENTS.refreshed）
    uni.$emit(AUTH_EVENTS.refreshed, {
      token: data.token,
      refreshToken: data.refreshToken,
    })
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/** 踢回登录页的延迟：让“登录已过期”的 toast 先展示出来再跳 */
const LOGOUT_REDIRECT_DELAY_MS = 1500

let logoutTimer: ReturnType<typeof setTimeout> | undefined
/** 已安排跳转，用于并发 401 去重 */
let logoutHandled = false
/** 已提示过登录过期，避免并发 401 连续弹 toast */
let logoutNotified = false

/**
 * 取消可能挂起的强制登出跳转并复位去重状态。
 * 登录成功（user store 的 setToken）与手动退出（logout）时会调用，
 * 避免用户已经重新登录后又被旧定时器踢回登录页。
 */
export function clearPendingLogout(): void {
  logoutHandled = false
  logoutNotified = false
  if (logoutTimer) {
    clearTimeout(logoutTimer)
    logoutTimer = undefined
  }
}

/** 获取当前页面完整路径，保留扫码或分享进入时的 query 参数。 */
function getCurrentPageUrl(): string {
  try {
    const pages = getCurrentPages()
    const current = pages[pages.length - 1] as
      | {
          route?: string
          options?: Record<string, unknown>
          $page?: { fullPath?: string }
        }
      | undefined
    const fullPath = current?.$page?.fullPath
    if (typeof fullPath === 'string' && fullPath) {
      return fullPath.startsWith('/') ? fullPath : `/${fullPath}`
    }

    const route = current?.route
    if (!route) {
      return ''
    }
    const path = route.startsWith('/') ? route : `/${route}`
    const query = Object.entries(current.options ?? {})
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&')
    return query ? `${path}?${query}` : path
  } catch {
    return ''
  }
}

/**
 * 刷新失败：清空登录态，提示后回到登录页。
 * - 已在登录页：只清不跳，避免循环
 * - 并发多个请求同时失败：只提示、只跳一次
 */
function forceLogout(silent = false): void {
  clearTokens()
  uni.$emit(AUTH_EVENTS.logout)
  const notify = () => {
    if (logoutNotified) {
      return
    }
    logoutNotified = true
    uni.showToast({ title: t('request.authExpired'), icon: 'none' })
  }
  if (logoutHandled) {
    // 首个触发者可能是 silent 请求，后续非 silent 请求补一次提示即可
    if (!silent) {
      notify()
    }
    return
  }
  let target = LOGIN_PATH
  try {
    const current = getCurrentPageUrl()
    // route 为无前导斜杠形式（如 `pages/index/index`），LOGIN_PATH 带前导斜杠，需统一比对
    if (current && extractPath(current) === normalizePath(LOGIN_PATH)) {
      return
    }
    if (current) {
      target = `${LOGIN_PATH}?redirect=${encodeURIComponent(current)}`
    }
  } catch {
    // 取页面栈失败仍按默认目标跳
  }
  logoutHandled = true
  if (!silent) {
    notify()
  }
  logoutTimer = setTimeout(() => {
    logoutTimer = undefined
    // 跳转完成后复位，用户未登录又回到业务页时仍能再次被踢回登录页
    logoutHandled = false
    logoutNotified = false
    try {
      uni.reLaunch({ url: target })
    } catch {
      // 忽略（如单元测试环境无路由）
    }
  }, LOGOUT_REDIRECT_DELAY_MS)
}

/* ------------------------------- 请求核心方法 ------------------------------ */

async function request<T = any>(config: RequestOptions): Promise<T> {
  const custom = { ...config.custom }
  // 绝对/相对地址统一按 path 比对白名单；白名单请求（如登录）不进刷新流程，
  // 否则登录页输错密码（后端常返回 401）会被误判成“登录过期”吞掉真实报错
  const path = extractPath(config.url)
  const isAuthFree = custom.skipAuth === true || AUTH_FREE_PATHS.has(path)
  let retried = false

  if (custom.loading) {
    showLoading()
  }
  try {
    while (true) {
      try {
        // token 注入
        const header = { ...config.header }
        const token = getToken()
        if (token && !isAuthFree) {
          header.Authorization = `Bearer ${token}`
        }

        const res = await rawRequest({
          url: config.url,
          method: config.method,
          data: config.data,
          header,
          timeout: config.timeout,
        })

        // HTTP 层错误
        if (res.statusCode >= 400) {
          const body = res.data as ApiResponse | undefined
          const message =
            body && typeof body === 'object' && typeof body.msg === 'string' && body.msg
              ? body.msg
              : t('request.httpError', { code: res.statusCode })
          throw new ApiError(res.statusCode, message)
        }

        // 业务层错误：只有符合统一响应结构才解析，文件流等裸数据原样放行由调用方处理
        const body: unknown = res.data
        if (isApiEnvelope<T>(body)) {
          if (body.code === SUCCESS_CODE) {
            return body.data as T
          }
          throw new ApiError(
            body.code,
            typeof body.msg === 'string' && body.msg ? body.msg : t('request.failed'),
          )
        }
        return res.data as T
      } catch (error) {
        const isUnauthorized = error instanceof ApiError && error.code === UNAUTHORIZED_CODE
        if (isUnauthorized && !isAuthFree && !retried) {
          retried = true
          try {
            await refreshTokenOnce()
          } catch (refreshError) {
            // 用户已主动退出/切换账号：不提示也不跳转，直接把原请求按失败返回
            if (refreshError instanceof AuthAbortedError) {
              throw new ApiError(UNAUTHORIZED_CODE, t('request.authExpired'))
            }
            forceLogout(custom.silent === true)
            throw new ApiError(UNAUTHORIZED_CODE, t('request.authExpired'))
          }
          continue
        }

        if (isUnauthorized && !isAuthFree) {
          forceLogout(custom.silent === true)
          throw new ApiError(UNAUTHORIZED_CODE, t('request.authExpired'))
        }

        if (!custom.silent && error instanceof ApiError) {
          uni.showToast({ title: error.message, icon: 'none' })
        }
        throw error
      }
    }
  } finally {
    if (custom.loading) {
      hideLoading()
    }
  }
}

/** 类型化请求入口：直接返回业务 data，失败抛出 ApiError（错误 toast 已统一处理） */
export const http = {
  request,
  get<T = any>(url: string, params?: Record<string, any>, options?: HttpOptions) {
    return request<T>({ url, method: 'GET', data: params, ...options })
  },
  post<T = any>(url: string, data?: any, options?: HttpOptions) {
    return request<T>({ url, method: 'POST', data, ...options })
  },
  put<T = any>(url: string, data?: any, options?: HttpOptions) {
    return request<T>({ url, method: 'PUT', data, ...options })
  },
  delete<T = any>(url: string, params?: Record<string, any>, options?: HttpOptions) {
    return request<T>({ url, method: 'DELETE', data: params, ...options })
  },
}
