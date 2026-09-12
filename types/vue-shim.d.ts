/**
 * SFC 类型垫片：让 `tsc --noEmit` 能解析 `import App from './App.vue'`。
 * HBuilderX 运行时自带 vue，这里只补类型，不影响编译运行。
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<object, object, any>
  export default component
}
