// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    vue: true,
    typescript: true,
    formatters: false,
    unocss: false,
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },
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
  },
)
