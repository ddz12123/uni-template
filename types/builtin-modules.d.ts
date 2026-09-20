// HBuilderX 内置依赖的模块声明：pinia / vue-i18n 由 HBuilderX 编译器提供，不走 npm 安装，
// tsc 解析不到它们的类型。这里只声明模块存在，让 `npm run typecheck` 关注工程自身代码，
// 代价是这些 store / i18n 的 API 类型推导退化为 any（不指望 typecheck 校验内置库）。
//
// 注意：vue 本身能从 node_modules/vue 解析到真实类型（@vueuse/core 依赖它），
// 千万不要在这里 `declare module 'vue'`——本文件是 ambient 脚本（无顶层 import/export），
// 那样写会「覆盖」vue 的真实类型（computed/ref/createSSRApp 全部丢失）。
// 需要给 vue 实例补 $t 类型时，用独立的「模块增强」文件，见 types/vue-i18n.d.ts。
declare module 'pinia'
declare module 'vue-i18n'
