<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppProvider from '@/components/AppProvider.vue'
import { useUserStore } from '@/store/modules/user'

// 登录页占位：forceLogout 会 reLaunch 到此页并带 `redirect` 参数。
// 接入真实登录时：在此页调后端登录接口，成功后 `setToken` + `reLaunch(redirect)` 即可。
const redirect = ref('')
const userStore = useUserStore()

onLoad((query?: Record<string, string>) => {
  if (query?.redirect) {
    redirect.value = decodeURIComponent(query.redirect)
  }
})

function handleMockLogin() {
  // 占位登录逻辑，联调时删除：写入假 token 并回到原页面
  userStore.setToken('mock-token', 'mock-refresh-token')
  uni.reLaunch({ url: redirect.value || '/pages/index/index' })
}
</script>

<template>
  <AppProvider>
    <view class="page">
      <view class="card">
        <view class="title">
          登录
        </view>
        <view class="text-secondary">
          占位页：接入真实登录接口后替换 handleMockLogin 即可
        </view>
        <wd-button type="primary" block @click="handleMockLogin">
          一键登录（占位）
        </wd-button>
      </view>
    </view>
  </AppProvider>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
}
</style>
