/**
 * 把 .env.production 的 VITE_PUBLIC_PATH 同步到 styles/cdn.scss 的 $cdn。
 * 用法：npm run sync:cdn
 *
 * 背景：ts 侧在运行时读 import.meta.env.VITE_PUBLIC_PATH，但 scss 是编译期产物读不到 .env，
 * 故以 .env.production 为唯一数据源，发行前跑一次本脚本即可，避免两处手工维护漂移。
 * 只替换 cdn-start / cdn-end 标记之间的 $cdn 行，不触碰文件其余内容。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 读取 .env.production 中指定 key 的值（容忍 `KEY = 'value'` 的空格与引号写法） */
function readEnvKey(file, key) {
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return null
  }
  const matched = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm'))
  if (!matched) {
    return null
  }
  return matched[1].replace(/^['"]|['"]$/g, '').replace(/\/+$/, '')
}

const cdnFile = resolve(root, 'styles/cdn.scss')
const scss = readFileSync(cdnFile, 'utf8')

// 目标值：.env.production 的 VITE_PUBLIC_PATH；文件不存在（未初始化本地环境）时回退 .env.example
const value
  = readEnvKey(resolve(root, '.env.production'), 'VITE_PUBLIC_PATH')
    ?? readEnvKey(resolve(root, '.env.example'), 'VITE_PUBLIC_PATH')

if (!value) {
  console.error('[sync:cdn] 未在 .env.production / .env.example 中找到 VITE_PUBLIC_PATH，已跳过')
  process.exitCode = 1
} else {
  // 兼容 CRLF / LF 行尾
  const next = scss.replace(/(\/\* cdn-start \*\/\r?\n)\$cdn:.*?;(\r?\n\/\* cdn-end \*\/)/s, `$1$$cdn: '${value}';$2`)
  if (next === scss) {
    console.error('[sync:cdn] styles/cdn.scss 中未找到 cdn-start / cdn-end 标记，请检查文件是否被改动')
    process.exitCode = 1
  } else {
    writeFileSync(cdnFile, next)
    console.log(`[sync:cdn] $cdn => '${value}'`)
  }
}
