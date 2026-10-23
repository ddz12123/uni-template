# uni-enterprise-template

HBuilderX 原生工程的 uni-app 空白模板（Vue3 + TS + Pinia + Wot UI v2 + SCSS）。
基础设施已就位，页面为空白，HBuilderX 直接「运行 / 发行」，不走 CLI 编译。

## 快速开始

0. 先在项目根目录执行 `npm install`。Wot UI、VueUse、持久化插件和 `vue-tsc` 都是 npm 依赖，`node_modules` 不在仓库里；HBuilderX 可能会提示安装，但手动执行一次最稳妥。工程化命令（`lint` / `format` / `typecheck` / pre-commit）要求 **Node >= 22.22.1**（`lint-staged@17` 的 engines 要求），建议用根目录 `.nvmrc` 切到 22.22.1；运行和发行仍由 HBuilderX 完成，不受此限制。
1. HBuilderX 打开项目根目录（建议 HBuilderX 5.26 及以上）。
2. 首次运行按 HBuilderX 提示启用 SCSS/Sass 编译支持。
3. 微信小程序在 `manifest.json` 填写 `mp-weixin.appid`；App 平台打包还需在根 `appid` 填写 DCloud appid。
4. 根据目标平台填写开发/生产环境的接口地址；切换 CDN 环境时执行 `npm run sync:cdn:dev` / `npm run sync:cdn:prod`（见「静态资源与 CDN」）。

本项目的 Vue3 运行基线是 HBuilderX 5.26 内置的 Vue 3.4.21 / Pinia 2.1.7 / vue-i18n 9.1.9。`npm run lint`、`format`、`typecheck` 是可选检查，但依赖必须先安装；项目不走 CLI 编译，运行和发行仍由 HBuilderX 完成。

## 依赖版本基线

HBuilderX 5.26 的 `uniapp-cli-vite` 编译器内置 Vue 3.4.21、Pinia 2.1.7、vue-i18n 9.1.9。npm 侧只安装与这个基线兼容的版本：

| 包                            | 版本                      | 原因                                                  |
| ----------------------------- | ------------------------- | ----------------------------------------------------- |
| `vue`                         | `3.4.21`（devDependency） | 仅用于 vue-tsc / 编辑器类型；运行时由 HBuilderX 内置  |
| `@vueuse/core`                | `11.3.0`                  | 12.0.0 起要求 Vue `^3.5.13`，与内置 3.4.21 不兼容     |
| `pinia-plugin-persistedstate` | `4.1.0`                   | 4.2 要求 Pinia >=2.3，4.3+ 要求 Pinia 3；内置是 2.1.7 |
| `vue-tsc`                     | `2.2.12`                  | 与 TS 5.4 / Vue 3.4 兼容，用于检查 `.vue`             |

升级 HBuilderX 后先确认它的内置 Vue/Pinia 版本，再同步调整这里；不要单独把 `@vueuse/core` 升到 12+、把持久化插件升到 4.2+。

Node 版本只约束本地工程化工具（ESLint / Prettier / vue-tsc / husky + lint-staged），最低 22.22.1，与 HBuilderX 的运行基线无关。仓库根目录的 `.nvmrc` 与 `package.json` 的 `engines` 保持一致。

## 目录结构

```
components/AppProvider.vue   页面根容器：组件库暗黑模式 + 页面主题变量联动
config/index.ts              全局常量（应用名/版本号取自 manifest、成功码、超时、刷新接口、登录页）
locale/                      i18n 语言包（zh-Hans/en.json）+ index.ts（vue-i18n 实例、t、setLocale、导航栏/tabBar 兜底）
pages/                       首页 / 我的（tabbar）+ login（401 登出回跳目标，redirect 回原页）
scripts/                     sync-cdn.mjs（按 .env.<mode> 把 CDN 前缀同步到 uni.scss）
store/                       pinia + persistedstate；modules: user（响应式登录态）/ app（主题）
styles/                      tokens.scss 设计令牌 / index.scss 全局样式
types/                       env.d.ts 环境变量类型 / vue-i18n.d.ts（$t 增强）/ builtin-modules.d.ts / assets.d.ts / uni-app-shim.d.ts
uni.scss                     官方 $uni-* 变量 + $cdn（由 sync:cdn:dev / sync:cdn:prod 维护）
utils/                       request 请求层 / auth / storage / static（静态资源 URL）/ report（节流上报）/ update（版本更新）/ share（全局分享）/ 工具函数（基于 @vueuse/core）
```

## 约定

### 请求（utils/request）

```ts
import { http } from '@/utils/request'

const data = await http.get<UserInfo>('/user/info', { id: 1 })
await http.post('/demo/form', data, { custom: { loading: true } }) // 请求级选项：loading / silent / skipAuth
await http.get('/public/config', undefined, { custom: { skipAuth: true } }) // 公开接口
```

直接返回业务 data，失败抛 `ApiError` 并统一弹 toast（`silent: true` 关闭）。
只有 `code` 为数字且同时带 `msg` 或 `data` 的响应才会按统一结构解析（`isApiEnvelope`），
避免业务数据里自带 `code` 字段（如 `{ code: 'CN', name: 'China' }`）时被误判为错误；
token 自动注入（`/auth/login` 与刷新接口免带）；公开接口可用 `custom.skipAuth` 跳过 token 和 401 刷新流程；
401 自动单飞刷新 token 并重放原请求，
刷新失败清登录态并 `reLaunch` 到登录页（已在登录页不再跳转，登录成功后按 `redirect` 回跳）。
并发 401 只提示、只跳转一次；刷新期间用户主动退出或切换账号会丢弃本次刷新结果。
接口约定改 `config/index.ts` 的 `SUCCESS_CODE` / `REFRESH_TOKEN_URL`，响应结构改 `utils/request/index.ts` 的 `isApiEnvelope`。

### 登录页与登录态

模板不包含登录接口和假登录逻辑。`pages/login/login.vue` 只保留页面占位和跳转说明。
请求层检测到登录失效时，会跳转到登录页并携带 `redirect` 参数；接入真实登录后，在登录页完成以下流程：

1. 调用登录接口。
2. 调用 `useUserStore().setToken(token, refreshToken)` 保存令牌。
3. 将用户信息写入 `userInfo`。
4. 使用 `uni.reLaunch({ url: redirect || '/pages/index/index' })` 回到原页面。

令牌只由 `utils/auth.ts` 持久化，Pinia 中的 `token` / `refreshToken` 只是响应式镜像；Pinia 只持久化 `userInfo`，避免出现两套登录态。
`setToken(token, refreshToken)` 会取消 401 后挂起的登录页跳转；不传 `refreshToken` 时会清除旧值，避免换账号后继续沿用上一个账号的令牌。
手动退出请调用 `useUserStore().logout()`（内部同样会取消挂起的跳转）；`reset()` 只负责清空数据，不要用它替代 `logout()`。

### 全局分享（utils/share.ts）

`main.ts` 里 `app.mixin(shareMixin)` 一次接入，所有页面默认可发送给朋友 / 分享到朋友圈，
无需逐页处理。分享菜单在 mixin 的 `onShow` 里逐页开启（微信侧 `menus` 是页面级开关，
放到 `App.onLaunch` 只调一次时页面栈为空，朋友圈入口不会出现）。某页要定制，用 options 写法覆盖即可：

```vue
<script>
export default {
  onShareAppMessage() {
    return { title: '今日特价', path: '/pages/index/index' }
  },
}
</script>
```

注意：不要用 setup 的 `onShareAppMessage` 做覆盖，与全局 mixin 同存时可能不生效
（dcloudio/uni-app#3084）。

### 版本更新与异常

- 版本更新：`App.onLaunch` 调 `checkMiniProgramUpdate()`，有新包下载就绪后弹窗提示重启
- 异常链路：Vue 渲染报错（`main.ts errorHandler`）→ 小程序脚本错误（`App onError`）
  → 未捕获 Promise（`onUnhandledRejection`）→ 野路径（`onPageNotFound` 上报并回首页），统一进 `reportLog`
- 上报节流：`reportLog` 相同错误合并（`extra.repeatCount` 记次数），同批次最多 20 条、队列 200 条，
  后台延迟 ≤3 秒发送，应用进入后台前会主动 flush；发送失败按 3s/6s 指数退避，单条最多发送 3 次，
  4xx（408/429 除外）直接丢弃，避免上报地址或鉴权配置错误时无限重试；`VITE_REPORT_URL` 留空时不发送（仅开发环境打印）

### 主题

- `uni.scss`：编译期变量（`$app-*`），保留官方 `$uni-*` 兼容市场插件
- `styles/tokens.scss`：运行时变量（`--app-*`），暗黑经媒体查询 + `.app-theme-dark` 覆盖层；
  深色下 `--app-primary` 与 `theme.json` 的 `dark.tabSelectedColor` 保持一致
- `theme.json`：原生导航栏 / tabBar / 窗口背景色，`pages.json` 里用 `@变量名` 引用；
  **`darkmode` 与 `themeLocation` 配在 `manifest.json -> mp-weixin` 下**（官方 DarkMode 指南要求写在
  manifest 的平台节点；写在 `pages.json` 时 `darkmode` 不会进编译产物 `app.json`，缺它微信就不做变量替换，
  `@navBgColor` 会被当成非法颜色值）。改完重新编译，以 `unpackage/dist/.../app.json` 里能看到
  `"darkmode": true` 为准
- 组件库暗黑由 `AppProvider` 的 `wd-config-provider` 联动；调用 `useAppStore().setTheme()` 时会同步原生导航栏、tabBar
  和窗口背景色（`setBackgroundColor`），页面显示时也会再同步一次背景，手动主题与系统主题相反时下拉/回弹区域不会露系统底色
- H5 额外同步 `document` 背景色；小程序和 App 的窗口背景由 `uni.setBackgroundColor` 设置

### 小程序启动优化

- `manifest.json -> mp-weixin -> lazyCodeLoading: "requiredComponents"`：开启按需注入（官方 manifest
  文档明确支持该字段，目前仅此取值），只注入当前页面用到的代码，降低启动耗时与内存。
  注意微信侧说明全局 `usingComponents` 声明的组件会被强制拉进依赖池，本模板 `pages.json` 里的
  `^wd-` easycom 全局规则会削弱收益；是否真有提升要自己对比开关前后的真机启动耗时，
  配置不当还可能被审核提示「启动组件按需注入未通过」
- tabBar 用原生配置（`pages.json -> tabBar`），启动时无需等 JS 初始化即可渲染

### 应用名称

应用名称唯一维护在 `manifest.json` 的 `name` 字段。分享标题和运行时代码从 `config/index.ts` 的 `APP_NAME` 读取；不要再新增 `VITE_APP_TITLE`。

### 环境变量

| 变量                | 说明                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| `VITE_APP_BASE_URL` | 接口地址（「运行」加载 `.env.development`，「发行」加载 `.env.production`） |
| `VITE_REPORT_URL`   | 日志上报地址；留空时不发送，仅开发环境打印到控制台                          |
| `VITE_PUBLIC_PATH`  | 静态资源公共前缀：本地 `/static`，生产为 CDN 地址（见下节）                 |

代码中 `import.meta.env.VITE_XXX` 访问。
本地环境文件不要提交到 Git，复制 `.env.example` 后按 HBuilderX 的运行/发行环境命名并填写。
模板不内置 `vite.config.js`；H5 需要反向代理时请自行添加，不配置不影响 HBuilderX 运行和发行。

### 静态资源与 CDN

图片 / 视频 / 音频等静态资源统一走公共前缀，唯一数据源是 `.env.<mode>` 的 `VITE_PUBLIC_PATH`：
本地开发为 `/static`（项目根 `static/` 目录），生产改为 CDN 地址（如 `https://oss-xxxx/static`）。
公共层只提供「前缀 + 拼接方法」，具体资源路径由各页面自己传入，不在公共文件里集中枚举。

- **ts / 模板**（运行时）：调用 `utils/static.ts` 的 `resolveStatic(path)`，`path` 为相对 `static/` 的路径：

  ```ts
  import { resolveStatic } from '@/utils/static'

  resolveStatic('images/login/login-bg.png')
  resolveStatic('videos/demo.mp4')
  ```

  模板：`<image :src="resolveStatic('images/login/login-bg.png')" />`（script setup 中需先 import 并可用）。

- **scss**（编译期，如背景图）：`$cdn` 直接定义在 `uni.scss` 顶部，页面样式自己拼路径：

  ```scss
  .login {
    background-image: url($cdn + '/images/login/login-bg.png');
  }
  ```

  注意：HBuilderX 会把 `uni.scss` 原样注入每个页面的 SCSS 编译单元，所以不要在 `uni.scss` 里用相对路径 `@use` 其他 scss 文件（路径会按页面目录解析，页面样式会编译失败）。

- **切换环境**：`npm run sync:cdn:dev` 读取 `.env.development`，`npm run sync:cdn:prod` 读取 `.env.production`，也可以 `npm run sync:cdn -- staging` 读取 `.env.staging`。
  脚本按 `.env.<mode>.local > .env.<mode> > .env.local > .env` 的顺序找 `VITE_PUBLIC_PATH`；
  非 production 模式都找不到时回退 `.env.example` 并打印警告，production 模式直接报错（避免把本地 `/static` 当成生产 CDN），
  把值写入 `uni.scss` 的 `cdn-start` / `cdn-end` 标记之间。
  切换开发/发行环境后需要重新执行对应命令；仓库默认保留开发值 `/static`。
- **发行切换 CDN**：改 `.env.production` 的 `VITE_PUBLIC_PATH` → 执行 `npm run sync:cdn:prod` → HBuilderX 发行；并在微信公众平台配置 `downloadFile` 合法域名。
- **不要用 `import img from '@/static/xx.png'`** 引用业务资源：import 会把资源打进小程序包（主包上限 2M）且切 CDN 后失效；`static/` 目录只保留必须随包的资源（如 tabBar 图标）。

### 国际化（i18n）

基于 uni-app Vue3 内置的 `vue-i18n`（9.1.9，不走 npm），默认简中 + 英文，语言包在 `locale/*.json`。

- **一份语言包两用**：`locale/zh-Hans.json`、`locale/en.json` 用扁平点号 key（如 `index.title`），
  既是 vue-i18n 的 messages（`locale/index.ts` 里 `flatJson: true` 解析），又供 `pages.json` 的
  `%index.title%` 占位（原生导航栏标题 / tabBar 文字）。
- **页面用法**：模板 `{{ $t('index.title') }}`；`<script setup>` 内 `const { t } = useI18n()`；
  setup 之外（拦截器、工具函数）用 `import { t } from '@/locale'`。
- **切换语言**：`import { setLocale } from '@/locale'` 调 `setLocale('en')`，内部同时更新 vue-i18n、
  `uni.setLocale` 持久化（下次启动 `uni.getLocale` 生效）、刷新小程序 tabBar。
- **小程序端兜底**：`%key%` 会在编译期按 `manifest.json` 的 `fallbackLocale` 替换（当前 `zh-Hans`），
  但不会在运行时跟随语言切换。tabBar 由 `App.onLaunch` / `App.onShow` 的 `syncNativeLocale()` 刷新，
  导航栏标题在页面 setup 调 `useLocaleNavBar('xxx.title')`（`index` / `mine` / `login` 已接入）。
- **fallbackLocale 必须配置**：HBuilderX 编译小程序 `pages.json` 时读的是 `fallbackLocale`（缺省 `en`），
  只写 `locale` 会让原生标题 / tabBar 默认编译成英文。
- **新增语言**：加 `locale/<lang>.json`，在 `locale/index.ts` 的 `AppLocale` 联合类型、`messages`、`LOCALE_OPTIONS` 各补一处。
- 内置 `vue-i18n` 无 npm 类型，`$t` 的模板类型由 `types/vue-i18n.d.ts` 增强补回；vue 本身有真实类型，切勿在 `builtin-modules.d.ts` 里 `declare module 'vue'`（会覆盖）。

## 常见问题

- easycom 规则（`pages.json`）修改后需重启 HBuilderX 运行
- 页面使用 Wot UI 反馈类 hooks 时，需要在当前页面显式挂载对应的 `wd-toast` / `wd-dialog` 实例
- `$cdn` 只能通过 `npm run sync:cdn:dev` / `npm run sync:cdn:prod` 修改；不要在 `uni.scss` 里用相对路径 `@use` 其他 scss 文件
- `@vueuse/core` / `pinia-plugin-persistedstate` 的版本是按 HBuilderX 5.26 内置运行时锁定的，升级 HBuilderX 前先确认内置 Vue/Pinia 版本
- 工程化命令（可选，不影响 HBuilderX 运行；ESLint 管代码质量，Prettier 管格式，两者已解耦不会互相覆盖）：
  - `npm run lint` 质量检查，`npm run lint:fix` 自动修
  - `npm run format` Prettier 排版，`npm run format:check` 只校验不改动（可用于 CI）
  - `npm run typecheck` 使用 `vue-tsc --noEmit`，会同时检查 `.ts` 和 `.vue` 的 script/template；
    `pinia` / `vue-i18n` 仍由 `types/builtin-modules.d.ts` 声明为 any，故 store / i18n API 的推导精度有限
  - `npm run sync:cdn:dev` / `npm run sync:cdn:prod` 按环境同步 `$cdn`（见「静态资源与 CDN」）

## 新页面约定

新页面保持统一的根结构，确保主题变量和 Wot UI 暗黑模式生效：

```vue
<script setup lang="ts">
import AppProvider from '@/components/AppProvider.vue'
import { useLocaleNavBar } from '@/locale'

// 换成当前页的标题 key；小程序端运行时切换语言时靠它刷新原生导航栏
useLocaleNavBar('index.title')
</script>

<template>
  <AppProvider>
    <view class="page" />
  </AppProvider>
</template>
```

页面私有样式写在页面自身；全局只保留页面基础样式和 `.app-safe-bottom`，避免新增无前缀的 `.card`、`.title` 等通用类名。

## 新项目初始化清单

- 修改 `manifest.json.name`，它是应用名称唯一来源。
- 填写微信小程序 `mp-weixin.appid`；App 平台打包还需在 `manifest.json` 根 `appid` 填写 DCloud appid，并检查目标平台的包名、签名和隐私协议配置。
- `manifest.json -> mp-weixin.setting.urlCheck` 默认保持 `true`；开发环境也应配置合法的接口域名，不要用关闭校验的方式掩盖域名配置问题。
- `manifest.json -> distribute.android` 默认不声明额外权限；只有确实使用对应原生能力时才逐项申请，并同步隐私说明。
- `manifest.json -> mp-weixin` 下的 `darkmode` / `themeLocation` / `lazyCodeLoading` 保持现状（已在位），改 `theme.json` 变量名时同步 `pages.json` 的 `@引用`。
- 确认 `manifest.json` 的 `locale` / `fallbackLocale` 与默认语言一致（小程序原生标题默认值由 `fallbackLocale` 决定）。
- 按环境填写接口地址；开发/发行切换时执行 `npm run sync:cdn:dev` / `npm run sync:cdn:prod`。
- 静态资源上 CDN：把资源传到 CDN 后修改 `.env.production` 的 `VITE_PUBLIC_PATH`，执行 `npm run sync:cdn:prod`，并配置小程序 `downloadFile` 合法域名。
- 接入真实登录后，删除登录页占位文案并实现 `redirect` 回跳。
- 确认是否启用全局分享、错误上报和小程序版本更新；不需要时移除对应初始化调用。

## 发布前检查

- H5、微信小程序和 App 均能正常启动。
- 页面 SCSS 能正常编译（`$cdn` 已在 `uni.scss` 中同步为当前环境的值）。
- 浅色、深色和手动主题下，页面、Wot UI、导航栏、TabBar 颜色一致。
- 登录失效能跳转登录页，登录成功能回到 `redirect` 指向的页面。
- 生产环境开启平台域名校验，并核对接口域名和隐私配置。
- 不提交 `.env`、`.env.development`、`.env.production` 等本地环境文件。
