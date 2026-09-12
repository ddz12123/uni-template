/**
 * 企业级请求层（基于 uni.request，零第三方依赖）：
 * - 统一注入 baseURL / token / 超时
 * - 统一响应结构与错误码处理，业务侧直接拿到 data，失败抛 ApiError
 * - 401 单飞无感刷新 + 原请求重放（免登录接口不进刷新流程，避免登录报错被误判成过期）；
 *   刷新失败清空登录态，提示后回到登录页
 */
import { LOGIN_PATH, REFRESH_TOKEN_URL, REQUEST_TIMEOUT, SUCCESS_CODE, UNAUTHORIZED_CODE } from '@/config'
import { clearTokens, getRefreshToken, getToken, saveTokens } from '@/utils/auth'

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
  msg: string
  data: T
}

/** 请求级扩展配置 */
export interface RequestCustom {
  /** 显示全屏 loading */
  loading?: boolean
  /** 静默模式：失败不弹 toast（业务自行处理） */
  silent?: boolean
  /** 内部标记：token 刷新后已重试过 */
  __retried?: boolean
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

/** 无需携带 token 的接口（如登录 / 刷新本身），按接口约定维护（均为 path 形式） */
const AUTH_FREE_PATHS: string[] = ['/auth/login', REFRESH_TOKEN_URL]

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
  const noQuery = (url || '').split('?')[0]
  return noQuery.replace(/^https?:\/\/[^/]+/, '') || '/'
}

let loadingCount = 0
function showLoading() {
  loadingCount += 1
  uni.showLoading({ title: '加载中...', mask: true })
}
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
        reject(new ApiError(-1, err?.errMsg?.includes('timeout') ? '请求超时，请稍后重试' : '网络异常，请检查网络'))
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
    if (!refreshToken) {
      throw new ApiError(UNAUTHORIZED_CODE, '登录已过期')
    }
    const res = await rawRequest({
      url: REFRESH_TOKEN_URL,
      method: 'POST',
      data: { refreshToken },
    })
    const body = res.data as ApiResponse<{ token: string, refreshToken: string }>
    if (res.statusCode >= 400 || !body || body.code !== SUCCESS_CODE) {
      throw new ApiError(UNAUTHORIZED_CODE, '刷新登录态失败')
    }
    saveTokens(body.data.token, body.data.refreshToken)
    // 刷新成功说明登录态有效：取消可能挂起的登出跳转（极端并发时序下用）
    clearPendingLogout()
    // 通知 user store 同步新 token（store 监听 AUTH_EVENTS.refreshed）
    uni.$emit(AUTH_EVENTS.refreshed, { token: body.data.token, refreshToken: body.data.refreshToken })
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/** 踢回登录页的延迟：让“登录已过期”的 toast 先展示出来再跳 */
const LOGOUT_REDIRECT_DELAY_MS = 1500

let logoutTimer: ReturnType<typeof setTimeout> | undefined

function clearPendingLogout(): void {
  if (logoutTimer) {
    clearTimeout(logoutTimer)
    logoutTimer = undefined
  }
}

/**
 * 刷新失败：清空登录态，提示后回到登录页。
 * - 已在登录页：只清不跳，避免循环
 * - 并发多个请求同时失败：只跳一次
 */
function forceLogout(): void {
  clearTokens()
  uni.$emit(AUTH_EVENTS.logout)
  if (logoutTimer) {
    return
  }
  let target = LOGIN_PATH
  try {
    const pages = getCurrentPages()
    const current = ((pages[pages.length - 1] as any)?.route ?? '') as string
    // route 为无前导斜杠形式（如 `pages/index/index`），LOGIN_PATH 带前导斜杠，需统一比对
    if (current && `/${current}` === LOGIN_PATH) {
      return
    }
    if (current) {
      target = `${LOGIN_PATH}?redirect=${encodeURIComponent(`/${current}`)}`
    }
  }
  catch {
    // 取页面栈失败仍按默认目标跳
  }
  logoutTimer = setTimeout(() => {
    logoutTimer = undefined
    try {
      uni.reLaunch({ url: target })
    }
    catch {
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
  const isAuthFree = AUTH_FREE_PATHS.includes(path)

  if (custom.loading) {
    showLoading()
  }
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
      throw new ApiError(
        res.statusCode,
        (body && typeof body === 'object' && 'msg' in body && body.msg) || `请求失败（${res.statusCode}）`,
      )
    }

    // 业务层错误：非统一结构（如文件流）原样放行由调用方处理
    const body = res.data as ApiResponse<T>
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === SUCCESS_CODE) {
        return body.data
      }
      throw new ApiError(body.code, body.msg || '请求失败')
    }
    return res.data as T
  }
  catch (error) {
    // 401 且未重试过、且不是免登录接口：刷新 token 后重放一次原请求
    const isUnauthorized = error instanceof ApiError && error.code === UNAUTHORIZED_CODE
    if (isUnauthorized && !isAuthFree && !custom.__retried) {
      try {
        await refreshTokenOnce()
      }
      catch {
        // 先提示再跳（forceLogout 内延迟跳转，保证 toast 可见）
        uni.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
        forceLogout()
        throw new ApiError(UNAUTHORIZED_CODE, '登录已过期，请重新登录')
      }
      // await 保证外层 finally 的 hideLoading 等待重放结束后再执行；
      // 重放若再抛错会直接透传给调用方（不会重新进入本 catch，不会重复提示）
      return await request<T>({ ...config, custom: { ...custom, __retried: true } })
    }
    if (!custom.silent && error instanceof ApiError && error.code !== UNAUTHORIZED_CODE) {
      uni.showToast({ title: error.message, icon: 'none' })
    }
    throw error
  }
  finally {
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
