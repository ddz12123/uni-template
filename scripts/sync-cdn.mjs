/**
 * 按环境把 VITE_PUBLIC_PATH 同步到 uni.scss 的 $cdn。
 *
 * 用法：
 *   npm run sync:cdn:dev     // 读取 .env.development
 *   npm run sync:cdn:prod    // 读取 .env.production
 *   npm run sync:cdn -- staging
 *
 * 为什么写 uni.scss：HBuilderX 会把 uni.scss 原样注入每个页面的 SCSS 编译单元，
 * $cdn 必须直接定义在 uni.scss 里；在 uni.scss 中用相对路径 @use 其他文件时，
 * 路径会按页面目录解析，页面级 SCSS 会找不到文件。
 *
 * 环境文件优先级（与 Vite 一致）：
 * .env.<mode>.local > .env.<mode> > .env.local > .env
 * 以上都没有 VITE_PUBLIC_PATH 时回退 .env.example（方便新克隆项目先跑通）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scssFile = resolve(root, 'uni.scss')

function readModeArg() {
  const args = process.argv.slice(2)
  const envArg = args.find((arg) => arg.startsWith('--env='))
  return (envArg ? envArg.slice('--env='.length) : (args[0] ?? '')).trim()
}

const mode = readModeArg()
if (!mode) {
  console.error('[sync:cdn] 缺少环境名。用法：npm run sync:cdn -- <development|production>')
  console.error('[sync:cdn] 或使用：npm run sync:cdn:dev / npm run sync:cdn:prod')
  process.exit(1)
}
if (!/^[a-z0-9][a-z0-9-]*$/i.test(mode)) {
  console.error(`[sync:cdn] 非法环境名：${mode}`)
  process.exit(1)
}

/** 读取指定 env 文件中的 key（容忍 `KEY = 'value'` 的空格与引号写法） */
function readEnvKey(file, key) {
  if (!existsSync(file)) {
    return null
  }
  const text = readFileSync(file, 'utf8')
  const matched = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm'))
  if (!matched) {
    return null
  }
  return matched[1].replace(/^['"]|['"]$/g, '').trim()
}

const envCandidates = [`.env.${mode}.local`, `.env.${mode}`, '.env.local', '.env']

let source = ''
let value = ''
for (const filename of envCandidates) {
  const next = readEnvKey(resolve(root, filename), 'VITE_PUBLIC_PATH')
  if (next) {
    source = filename
    value = next
    break
  }
}

if (!value) {
  value = readEnvKey(resolve(root, '.env.example'), 'VITE_PUBLIC_PATH') ?? ''
  source = value ? '.env.example' : ''
}

if (!value) {
  console.error(
    `[sync:cdn] 在 ${envCandidates.join(' / ')} / .env.example 中都没有找到 VITE_PUBLIC_PATH`,
  )
  process.exit(1)
}

/** 本地前缀保留前导 /；完整 CDN URL 保留协议，统一去掉尾部 / */
function normalizeValue(input) {
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '')
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '')
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeading.replace(/\/+$/, '') || '/'
}

const cdnValue = normalizeValue(value)
const scss = readFileSync(scssFile, 'utf8')
const markerRE = /\/\* cdn-start \*\/[\s\S]*?\/\* cdn-end \*\//

if (!markerRE.test(scss)) {
  console.error('[sync:cdn] uni.scss 中未找到 cdn-start / cdn-end 标记，请检查文件是否被改动')
  process.exit(1)
}

const next = scss.replace(
  /(\/\* cdn-start \*\/\r?\n)\$cdn:.*?;(\r?\n\/\* cdn-end \*\/)/s,
  (_matched, start, end) => `${start}$cdn: '${cdnValue}';${end}`,
)

writeFileSync(scssFile, next)
console.log(`[sync:cdn] ${mode} => $cdn: '${cdnValue}'（来源：${source}）`)
