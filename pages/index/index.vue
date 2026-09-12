<script setup lang="ts">
import AppProvider from '@/components/AppProvider.vue'
</script>

<template>
  <AppProvider>
    <view class="page" />
  </AppProvider>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}
</style>
