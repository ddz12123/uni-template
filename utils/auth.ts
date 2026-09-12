/**
 * token 存取的唯一入口。
 * 请求拦截器从这里读取 token（而非直接依赖 user store，避免模块循环依赖）；
 * user store 在登录/登出/刷新时通过 saveTokens / clearTokens 与之保持同步。
 */
import { getCache, removeCache, setCache } from './storage'

// 注意：storage 层会自动加 `app:cache:` 前缀，这里只写业务名，
// 落盘实际为 `app:cache:token`，避免出现 `app:cache:app:token` 双前缀。
const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refresh-token'

export function getToken(): string {
  return getCache<string>(TOKEN_KEY) ?? ''
}

export function getRefreshToken(): string {
  return getCache<string>(REFRESH_TOKEN_KEY) ?? ''
}

export function saveTokens(token: string, refreshToken?: string): void {
  setCache(TOKEN_KEY, token)
  if (refreshToken) {
    setCache(REFRESH_TOKEN_KEY, refreshToken)
  }
}

export function clearTokens(): void {
  removeCache(TOKEN_KEY)
  removeCache(REFRESH_TOKEN_KEY)
}
