import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { clearTokens, saveTokens } from '@/utils/auth'
import { AUTH_EVENTS } from '@/utils/request'

export interface UserInfo {
  id: string
  nickname: string
  avatar: string
  mobile?: string
}

/**
 * 登录态容器：token / 用户信息的唯一数据源。
 * 登录接口接入后，在登录逻辑中调用 setToken 保存令牌、维护 userInfo 即可。
 */
export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const refreshToken = ref('')
  const userInfo = ref<UserInfo | null>(null)

  const isLogged = computed(() => !!token.value)

  function setToken(newToken: string, newRefreshToken?: string) {
    token.value = newToken
    if (newRefreshToken) {
      refreshToken.value = newRefreshToken
    }
    saveTokens(newToken, newRefreshToken)
  }

  function reset() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = null
    // store 是登录态唯一数据源的内存侧，磁盘侧 token 也一并清理，
    // 避免只调 reset() 时 uni storage 里残留旧 token。
    clearTokens()
  }

  /** 退出登录：清空 store 与 token 缓存 */
  function logout() {
    reset()
  }

  return {
    token,
    refreshToken,
    userInfo,
    isLogged,
    setToken,
    reset,
    logout,
  }
}, {
  persist: {
    pick: ['token', 'refreshToken', 'userInfo'],
  },
})

/**
 * 请求层事件与 store 的同步桥（模块级只注册一次）：
 * 此前写在 setup 内会导致每次 useUserStore() 都重复 uni.$on。
 * handler 内按需取当前 store 实例；先 $off 再 $on，HMR 重载也不会叠加监听。
 */
uni.$off(AUTH_EVENTS.refreshed)
uni.$off(AUTH_EVENTS.logout)
uni.$on(AUTH_EVENTS.refreshed, (payload: unknown) => {
  const data = payload as { token: string, refreshToken?: string }
  if (!data || typeof data.token !== 'string') {
    return
  }
  const store = useUserStore()
  store.token = data.token
  if (data.refreshToken) {
    store.refreshToken = data.refreshToken
  }
})
uni.$on(AUTH_EVENTS.logout, () => {
  useUserStore().reset()
})
