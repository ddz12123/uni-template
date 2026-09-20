/**
 * 环境变量类型声明（对应根目录 .env / .env.development / .env.production）。
 * HBuilderX 的 vue3 工程基于 vite 编译，运行/发行时自动加载对应文件，
 * 业务代码统一通过 import.meta.env.VITE_XXX 访问。
 */
interface ImportMetaEnv {
  /** 接口基础地址 */
  readonly VITE_APP_BASE_URL: string
  /** 错误/日志上报地址（可选） */
  readonly VITE_REPORT_URL?: string
  /** 静态资源公共前缀：本地 '/static'，生产为 CDN 地址（见 utils/static.ts） */
  readonly VITE_PUBLIC_PATH?: string
  /** 以下为 Vite 内置，由构建工具注入 */
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
