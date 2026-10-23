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

/**
 * 登录态版本号：每次写入/清除 token 时递增。
 * 异步刷新请求返回后用版本号判断期间是否发生过退出/重新登录，
 * 避免旧刷新结果把已经清除的 token 又写回来。
 */
let authEpoch = 0

export function getAuthEpoch(): number {
  return authEpoch
}

export function getToken(): string {
  return getCache<string>(TOKEN_KEY) ?? ''
}

export function getRefreshToken(): string {
  return getCache<string>(REFRESH_TOKEN_KEY) ?? ''
}

/**
 * 保存令牌。未传 refreshToken（或传空）时清除旧值：
 * 换账号登录或后端本次不返回 refreshToken 时，不能继续沿用上一个账号的令牌。
 * 刷新接口若未轮换 refreshToken，调用方应显式传回原值。
 */
export function saveTokens(token: string, refreshToken?: string): void {
  authEpoch += 1
  setCache(TOKEN_KEY, token)
  if (refreshToken) {
    setCache(REFRESH_TOKEN_KEY, refreshToken)
  } else {
    removeCache(REFRESH_TOKEN_KEY)
  }
}

export function clearTokens(): void {
  authEpoch += 1
  removeCache(TOKEN_KEY)
  removeCache(REFRESH_TOKEN_KEY)
}
