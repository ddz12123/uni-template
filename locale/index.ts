/**
 * 国际化（i18n）初始化与语言切换。
 *
 * vue-i18n 是 uni-app Vue3 工程内置依赖（版本 9.1.9），和 vue / pinia 一样由 HBuilderX
 * 编译器提供、不走 npm 安装；模块声明见 types/builtin-modules.d.ts。
 *
 * 语言包（locale/*.json）一份两用，均为「扁平点号 key」（如 "index.title"）：
 * 1. vue 页面 / js —— 经本文件的 i18n 实例（模板 $t、setup 内 useI18n、任意处 t）；
 *    靠 flatJson:true 让 vue-i18n 正确解析扁平 key。
 * 2. pages.json 的原生导航栏标题 / tabBar 文字 —— 用 %index.title% 占位读同一批 json。
 *    H5 / App 由框架自动生效；小程序端不支持 %key%，由 syncNativeLocale 用 API 兜底。
 */
import { onShow } from '@dcloudio/uni-app'
import { computed, watch } from 'vue'
import { createI18n } from 'vue-i18n'
import en from './en.json'
import zhHans from './zh-Hans.json'

/** 本模板支持的语言码（BCP47）。新增语言时同步 locale/*.json 与此联合类型 */
export type AppLocale = 'en' | 'zh-Hans'

/** 语言切换选项：label 用各语言「自称」，不随当前语言翻译 */
export const LOCALE_OPTIONS: { label: string, value: AppLocale }[] = [
  { label: '简体中文', value: 'zh-Hans' },
  { label: 'English', value: 'en' },
]

/**
 * pages.json tabBar.list 各项文字对应的 i18n key，顺序须与 pages.json 完全一致。
 * 小程序端 %key% 不生效，切语言时用 uni.setTabBarItem 按此表兜底刷新。
 */
const TAB_BAR_KEYS = ['index.title', 'mine.title']

/** 把 uni.getLocale() 的语言码归一化到本模板支持的枚举，未知语言回落简中 */
function normalizeLocale(locale?: string): AppLocale {
  return locale && locale.toLowerCase().startsWith('en') ? 'en' : 'zh-Hans'
}

export const i18n = createI18n({
  legacy: false, // Composition 模式，配合 <script setup> 的 useI18n()
  globalInjection: true, // 模板内可直接用 $t
  flatJson: true, // 语言包是扁平点号 key，必须开启才能被正确解析
  locale: normalizeLocale(uni.getLocale()),
  fallbackLocale: 'zh-Hans',
  messages: { 'zh-Hans': zhHans, en },
})

/** 供 setup 之外（请求拦截器、工具函数等）使用的翻译函数 */
export function t(key: string, named?: Record<string, unknown>): string {
  return i18n.global.t(key, named ?? {})
}

/** 当前语言（只读响应式，页面可 watch 做联动） */
export const currentLocale = computed<AppLocale>(() => i18n.global.locale.value)

/**
 * 小程序端原生 tabBar 兜底：按当前语言刷新每个 tab 文字。
 * H5 / App 由框架处理 %key%，本函数已被条件编译隔离，非小程序端调用无副作用。
 * App 启动（onLaunch）与每次 setLocale 后各调用一次。
 */
export function syncNativeLocale() {
  // #ifdef MP
  TAB_BAR_KEYS.forEach((key, index) => {
    // fail 静默：onLaunch 早期 tabBar 可能尚未就绪，此时失败无需报错，首次进入 tab 页会再次同步
    uni.setTabBarItem({ index, text: t(key), fail: () => {} })
  })
  // #endif
}

/**
 * 切换应用语言：
 * 1. 更新 vue-i18n locale —— 页面 $t / useI18n 文案立即响应；
 * 2. uni.setLocale 持久化 —— 下次启动 uni.getLocale 生效；
 * 3. 小程序端兜底刷新原生 tabBar 文字。
 */
export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  uni.setLocale(locale)
  syncNativeLocale()
}

/**
 * 页面级导航栏标题国际化：在页面 setup 内调用。
 * H5 / App 端 pages.json 的 %key% 已自动生效，本函数主要补齐小程序端：
 * onShow 时按当前语言设置标题，语言切换时也同步刷新（全端调用结果一致，无副作用）。
 * @param titleKey 语言包里的标题 key，如 'login.title'
 * @example useLocaleNavBar('index.title')
 */
export function useLocaleNavBar(titleKey: string) {
  const apply = () => uni.setNavigationBarTitle({ title: t(titleKey) })
  onShow(apply)
  watch(currentLocale, apply)
}
