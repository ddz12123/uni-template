/**
 * 静态资源（图片 / 视频 / 音频等）公共前缀工具。
 *
 * 唯一数据源：环境变量 VITE_PUBLIC_PATH（.env.* 维护）
 * - 本地开发：'/static'，对应项目根 static/ 目录；
 * - 生产发行：'https://oss-xxxx/static' 等 CDN 地址。
 * SCSS 侧的 $cdn（定义在 uni.scss）由 `npm run sync:cdn:dev` / `npm run sync:cdn:prod`
 * 从对应 .env.<mode> 同步，两侧保持一致。
 *
 * 为什么不用 `import img from '@/static/xx.png'`：
 * import 会把资源打进小程序包内（主包上限 2M），切 CDN 后全部失效；
 * 业务资源统一走 resolveStatic(path) 按 URL 引用，static/ 目录只保留
 * 必须随包的资源（如 pages.json tabBar 图标）。
 */

/** 未配置或配置为空时的本地静态资源前缀 */
const DEFAULT_PUBLIC_PATH = '/static'

/**
 * 归一化公共前缀：
 * - 本地路径保留前导 /（小程序里 'static/xx' 会按页面目录解析，必须用 '/static/xx'）
 * - 完整 CDN URL 保持原样
 * - 统一去掉尾部 /，避免拼出双斜杠
 */
function normalizePublicPath(value?: string): string {
  const trimmed = (value ?? '').trim().replace(/^['"]|['"]$/g, '')
  if (!trimmed) {
    return DEFAULT_PUBLIC_PATH
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.replace(/\/+$/, '') || '/'
}

const PUBLIC_PATH = normalizePublicPath(import.meta.env.VITE_PUBLIC_PATH)

/**
 * 拼接静态资源完整地址。
 * @param path 相对 static 目录的路径，如 'images/login/login-bg.png'（也容忍 '/xx' 开头）
 * @example resolveStatic('images/login/login-bg.png')
 * // 开发 => '/static/images/login/login-bg.png'
 * // 生产 => 'https://oss-xxxx/static/images/login/login-bg.png'
 */
export function resolveStatic(path: string): string {
  const normalizedPath = path.replace(/^\/+/, '')
  return PUBLIC_PATH === '/' ? `/${normalizedPath}` : `${PUBLIC_PATH}/${normalizedPath}`
}
