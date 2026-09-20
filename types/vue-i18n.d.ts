/**
 * vue-i18n 的组件实例类型增强（补回模板里的 $t）。
 *
 * 背景：vue-i18n 由 HBuilderX 内置、不走 npm，已在 builtin-modules.d.ts 里声明为 any 模块。
 * 这样它原本对 Vue 组件实例注入的 $t 类型也随之丢失，IDE(Volar) 里 {{ $t('key') }} 会报红。
 *
 * 关键：本文件顶部有 `import 'vue'`，使其成为一个「模块」，因此下面的 `declare module 'vue'`
 * 是类型「增强/合并」——把 $t 追加到 Vue 官方的 ComponentCustomProperties 接口上，不影响
 * vue 其它导出。切勿把这段放进无 import/export 的 ambient 脚本（如 builtin-modules.d.ts），
 * 否则同一段代码会「覆盖」整个 vue 模块，导致 computed/ref/createSSRApp 等全部失效。
 */
import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** vue-i18n 注入的翻译函数，模板中直接 {{ $t('key') }} 使用 */
    $t: (key: string, named?: Record<string, unknown>) => string
  }
}
