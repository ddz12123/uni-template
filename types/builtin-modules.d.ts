// HBuilderX 内置依赖的模块声明：vue / pinia 等由 HBuilderX 编译器提供，不走 npm 安装，
// tsc 解析不到它们的类型。这里只声明模块存在，让 `npm run typecheck` 关注工程自身代码，
// 代价是这些 store 的 API 类型推导退化为 any（不指望 typecheck 校验内置库）。
declare module 'pinia'
