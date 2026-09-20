<script setup lang="ts">
import AppProvider from '@/components/AppProvider.vue'
import { useLocaleNavBar } from '@/locale'

// 小程序端 pages.json 的 %login.title% 不生效，用 useLocaleNavBar 兜底导航栏标题（H5/App 也一致）
useLocaleNavBar('login.title')
</script>

<template>
  <AppProvider>
    <view class="page">
      <view class="placeholder">
        <view class="title">{{ $t('login.placeholder.title') }}</view>
        <view class="description">
          {{ $t('login.placeholder.desc') }}
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
