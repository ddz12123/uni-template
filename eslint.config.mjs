// @ts-check
// 职责划分（重要，别混用）：
// - ESLint：只负责代码质量规则（未使用变量、逻辑错误、可简写写法等）
// - Prettier：只负责代码格式（缩进/引号/分号/换行），配置见 .prettierrc.json
// 两者共存的关键：下面 `stylistic: false` 关掉了 antfu 自带的全部格式规则，
// 格式一律由 prettier 说了算，避免 "prettier 排好的格式被 eslint 改回去" 的来回打架。
// 日常流程：`npm run lint`（查质量）+ `npm run format`（prettier 排版）。
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    vue: true,
    typescript: true,
    // 关闭 antfu 内置的 stylistic 格式规则：格式交给 prettier（见文件头说明）
    stylistic: false,
    formatters: false,
    unocss: false,
    ignores: [
      'dist/**',
      'unpackage/**',
      'node_modules/**',
      'static/**',
      // HBuilderX 工程的编译清单由 HBuilderX 维护，不参与 lint
      'pages.json',
      'manifest.json',
      // 编译器配置（键序由 tsc 语义决定，不受代码风格约束）
      'tsconfig.json',
    ],
  },
  {
    languageOptions: {
      globals: {
        uni: 'readonly',
        plus: 'readonly',
        wx: 'readonly',
        getCurrentPages: 'readonly',
        getApp: 'readonly',
      },
    },
    rules: {
      // 这条是纯排版偏好（短内容是否换行），与 prettier 的判断标准相反，
      // 开了就会出现 "eslint 要求换行 / prettier 要求合成一行" 的无限拉扯，所以关掉
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
)
