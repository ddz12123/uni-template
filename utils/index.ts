/**
 * 通用工具函数（基于 @vueuse/core，对外 API 保持不变，业务侧无须改调用）。
 * 小程序可用性说明：这里只用 shared 层（无 DOM 依赖）的函数，
 * 需要 window / document 的 core 函数不要引进来。
 */
import { useDateFormat, useDebounceFn, useThrottleFn } from '@vueuse/core'

/**
 * 日期格式化（模板占位符：YYYY MM DD HH mm ss）。
 * 注意：iOS 的 JavaScriptCore 不支持 'YYYY-MM-DD HH:mm:ss' 直接解析，
 * 先归一化再交给 useDateFormat；非法输入返回 ''。
 */
export function formatDate(
  input: string | number | Date = Date.now(),
  template = 'YYYY-MM-DD HH:mm:ss',
): string {
  let date: Date
  if (input instanceof Date) {
    date = input
  } else if (typeof input === 'number') {
    date = new Date(input)
  } else {
    date = new Date(input.includes('T') ? input : input.replace(/-/g, '/'))
  }
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return useDateFormat(date, template).value
}

/**
 * 防抖：最后一次触发后 wait 毫秒执行。
 * 附带 `cancel()` / `flush()` / `isPending`（见 @vueuse/core useDebounceFn）。
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, wait = 300) {
  return useDebounceFn(fn, wait)
}

/**
 * 节流：interval 毫秒内最多执行一次（前沿触发，默认无后沿，与原手写行为一致）。
 * 基于 @vueuse/core useThrottleFn（返回即节流后的函数，直接调用即可）。
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, interval = 300) {
  return useThrottleFn(fn, interval)
}
