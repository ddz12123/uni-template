import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { pinia } from '@/store'
import { clearTokens, getRefreshToken, getToken, saveTokens } from '@/utils/auth'
import { AUTH_EVENTS, clearPendingLogout } from '@/utils/request'

export interface UserInfo {
  id: string
  nickname: string
  avatar: string
  mobile?: string
}

/**
 * 登录态容器：token 在 auth storage 中持久化，这里只保留响应式镜像；userInfo 由 Pinia 持久化。
 * 登录接口接入后，在登录逻辑中调用 setToken 保存令牌、维护 userInfo 即可。
 */
export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref(getToken())
    const refreshToken = ref(getRefreshToken())
    const userInfo = ref<UserInfo | null>(null)

    const isLogged = computed(() => !!token.value)

    function setToken(newToken: string, newRefreshToken?: string) {
      token.value = newToken
      // 未返回 refreshToken 时同步清空镜像，与 saveTokens 的持久化语义保持一致
      refreshToken.value = newRefreshToken ?? ''
      saveTokens(newToken, newRefreshToken)
      // 登录成功：取消 401 后挂起的“回登录页”跳转
      clearPendingLogout()
    }

    function reset() {
      token.value = ''
      refreshToken.value = ''
      userInfo.value = null
      // 清空响应式登录态，磁盘侧 token 也一并清理，
      // 避免只调 reset() 时 uni storage 里残留旧 token。
      // 注意：不要在这里取消挂起的登出跳转——forceLogout 会先 emit logout 再设置定时器。
      clearTokens()
    }

    /** 退出登录：清空 store 与 token 缓存，并取消可能挂起的 401 强制跳转 */
    function logout() {
      clearPendingLogout()
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
  },
  {
    persist: {
      pick: ['userInfo'],
    },
  },
)

/**
 * 请求层事件与 store 的同步桥（模块级只注册一次）：
 * 此前写在 setup 内会导致每次 useUserStore() 都重复 uni.$on。
 * handler 内按需取当前 store 实例；只移除本模块自己的 handler，避免清空其他模块的同名事件。
 */
function handleTokenRefreshed(payload: unknown) {
  const data = payload as { token: string; refreshToken?: string }
  if (!data || typeof data.token !== 'string') {
    return
  }
  const store = useUserStore(pinia)
  store.token = data.token
  if (data.refreshToken) {
    store.refreshToken = data.refreshToken
  }
}

function handleAuthLogout() {
  useUserStore(pinia).reset()
}

uni.$off(AUTH_EVENTS.refreshed, handleTokenRefreshed)
uni.$off(AUTH_EVENTS.logout, handleAuthLogout)
uni.$on(AUTH_EVENTS.refreshed, handleTokenRefreshed)
uni.$on(AUTH_EVENTS.logout, handleAuthLogout)
