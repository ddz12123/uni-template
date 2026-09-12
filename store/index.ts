import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

/**
 * 全局唯一 pinia 实例：
 * - main.ts 中安装到应用
 * - 组件 setup 之外的环境（拦截器、路由守卫等）通过 useXxxStore(pinia) 使用
 */
export const pinia = createPinia()

pinia.use(
  createPersistedState({
    storage: {
      // 小程序端没有 localStorage，统一适配为 uni storage
      getItem: key => (uni.getStorageSync(key) as string) || null,
      setItem: (key, value) => uni.setStorageSync(key, value),
    },
  }),
)
