/**
 * 静态资源（图片 / 视频 / 音频等）公共前缀工具。
 *
 * 唯一数据源：环境变量 VITE_PUBLIC_PATH（.env.* 维护）
 * - 本地开发：'/static'，对应项目根 static/ 目录；
 * - 生产发行：'https://oss-xxxx/static' 等 CDN 地址。
 * SCSS 侧的 $cdn（styles/cdn.scss）由 `npm run sync:cdn` 从 .env.production 同步，两侧始终一致。
 *
 * 为什么不用 `import img from '@/static/xx.png'`：
 * import 会把资源打进小程序包内（主包上限 2M），切 CDN 后全部失效；
 * 业务资源统一走 resolveStatic(path) 按 URL 引用，static/ 目录只保留
 * 必须随包的资源（如 pages.json tabBar 图标）。
 */

/** 公共前缀（已归一化：去引号、去首尾斜杠；未配置时回退 '/static'） */
const PUBLIC_PATH = (import.meta.env.VITE_PUBLIC_PATH ?? '/static').replace(/^['"]|['"]$/g, '').replace(/^\/+|\/+$/g, '')

/**
 * 拼接静态资源完整地址。
 * @param path 相对 static 目录的路径，如 'images/login/login-bg.png'（也容忍 '/xx' 开头）
 * @example resolveStatic('images/login/login-bg.png')
 * // 开发 => '/static/images/login/login-bg.png'
 * // 生产 => 'https://oss-xxxx/static/images/login/login-bg.png'
 */
export function resolveStatic(path: string): string {
  return `${PUBLIC_PATH}/${path.replace(/^\/+/, '')}`
}
