<script setup lang="ts">
import AppProvider from '@/components/AppProvider.vue'
</script>

<template>
  <AppProvider>
    <view class="page">
      <view class="placeholder">
        <view class="title">登录页占位</view>
        <view class="description">
          请求层检测到登录失效时会跳转到这里。接入真实登录接口后，在此页完成登录，并按 redirect
          参数回到原页面。
        </view>
      </view>
    </view>
  </AppProvider>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.placeholder {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.title {
  font-size: 36rpx;
  font-weight: 600;
}

.description {
  color: var(--app-text-2);
  line-height: 1.6;
}
</style>
