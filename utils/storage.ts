/**
 * 本地缓存封装：统一 key 前缀、支持过期时间，底层使用 uni storage（全端可用）。
 * 原生 uni.getStorageSync 等直接使用会散落各处且无过期能力，业务侧一律走本模块。
 */

const PREFIX = 'app:cache:'

interface CacheWrapper<T> {
  /** 缓存值 */
  v: T
  /** 过期时间戳（ms），为空表示永久 */
  e?: number
}

export function setCache<T>(key: string, value: T, expireSeconds?: number): void {
  const wrapper: CacheWrapper<T> = {
    v: value,
    e: expireSeconds ? Date.now() + expireSeconds * 1000 : undefined,
  }
  uni.setStorageSync(PREFIX + key, wrapper)
}

export function getCache<T>(key: string): T | null {
  try {
    const wrapper = uni.getStorageSync(PREFIX + key) as CacheWrapper<T> | ''
    if (!wrapper) {
      return null
    }
    if (wrapper.e && Date.now() > wrapper.e) {
      uni.removeStorageSync(PREFIX + key)
      return null
    }
    return wrapper.v
  }
  catch {
    return null
  }
}

export function removeCache(key: string): void {
  uni.removeStorageSync(PREFIX + key)
}

/**
 * 清除业务缓存：只清理本模块管理的 app:cache: 键，默认保留 token（登录态）。
 * 不触碰其他存储键（如 pinia 持久化的 user / app，由对应 store 自行管理）。
 * @param keepKeys 业务 key 名（不带 `app:cache:` 前缀，如 `['token', 'refresh-token']`）
 */
export function clearCache(keepKeys: string[] = ['token', 'refresh-token']) {
  const { keys } = uni.getStorageInfoSync()
  keys.forEach((key) => {
    if (!key.startsWith(PREFIX)) {
      return
    }
    if (keepKeys.some(k => key === PREFIX + k)) {
      return
    }
    uni.removeStorageSync(key)
  })
}
